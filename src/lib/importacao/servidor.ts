import "server-only";
import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { hojeIso } from "@/lib/datas";
import { somarDias } from "@/lib/lancamentos/regras";
import { carregarContexto, pendentes } from "@/lib/recorrentes/servidor";
import { chaveDuplicidade, conciliar, janela, regraQueAtende } from "./regras";
import { normalizar } from "./texto";
import type { CamposLinha, Candidato, Condicao, PreencherRegra, RegraAplicavel, TransacaoArquivo } from "./tipos";

const { importacao, importacaoLinha: linha, regraImportacao, lancamento: l, contaFinanceira: conta, cartaoCredito: cartao, contato, categoria } = schema;

type Db = ReturnType<typeof getDb> | Transacao;
export type Importacao = typeof importacao.$inferSelect;
export type LinhaImportacao = typeof linha.$inferSelect;

/** Erro com mensagem para a faixa amarela. */
export class ErroImportacao extends Error {}
export const erro = (mensagem: string): never => {
  throw new ErroImportacao(mensagem);
};

/** Regras ativas, já no formato usado para aplicar. */
export async function carregarRegrasAtivas(db: Db): Promise<RegraAplicavel[]> {
  const linhas = await db.select().from(regraImportacao).where(eq(regraImportacao.ativo, true));
  return linhas.map((r) => ({
    id: r.id,
    nome: r.nome,
    contaId: r.contaId,
    cartaoId: r.cartaoId,
    ordem: r.ordem,
    condicoes: (Array.isArray(r.condicoes) ? r.condicoes : []) as Condicao[],
    acao: r.acao,
    preencher: (r.preencher ?? {}) as PreencherRegra,
  }));
}

/** Linhas que já viraram lançamento (ou foram conciliadas) em importações que não foram canceladas. */
const vinculadaSql = sql`exists (
  select 1 from ${linha} il join ${importacao} i on i.id = il.importacao_id
  where il.lancamento_id = ${l.id} and il.status in ('adicionado', 'conciliado') and i.situacao <> 'cancelada')`;

/** Chaves de duplicidade do que já foi importado nesta conta ou cartão (em outras importações). */
export async function chavesJaImportadas(db: Db, imp: Importacao): Promise<Set<string>> {
  const linhas = await db
    .select({ fitid: linha.fitid, data: linha.data, valorCentavos: linha.valorCentavos, tipo: linha.tipo, descricao: linha.descricao })
    .from(linha)
    .innerJoin(importacao, eq(importacao.id, linha.importacaoId))
    .where(
      and(
        ne(importacao.id, imp.id),
        ne(importacao.situacao, "cancelada"),
        imp.contaId ? eq(importacao.contaId, imp.contaId) : eq(importacao.cartaoId, imp.cartaoId!),
        inArray(linha.status, ["adicionado", "conciliado"]),
        isNotNull(linha.lancamentoId),
      ),
    );
  return new Set(linhas.map(chaveDuplicidade));
}

/**
 * Lançamentos do sistema que podem ser a mesma transação do extrato: na conta (ou em qualquer conta,
 * conforme a checagem), dentro das datas, ainda sem vínculo com outra linha importada.
 * Inclui as ocorrências previstas dos recorrentes (aluguel, salário...).
 */
export async function buscarCandidatos(db: Db, imp: Importacao, datas: string[], hoje = hojeIso()): Promise<Candidato[]> {
  const j = janela(datas, imp.toleranciaDias);
  if (!j) return [];
  const eCartao = imp.cartaoId !== null;
  const dataRef = eCartao ? sql<string>`coalesce(${l.dataCompra}, ${l.dataVencimento})` : sql<string>`coalesce(${l.dataPagamento}, ${l.dataVencimento})`;
  const gravados = await db
    .select({
      id: l.id,
      descricao: l.descricao,
      tipo: l.tipo,
      valor: sql<number>`abs(case when ${l.dataPagamento} is not null then coalesce(${l.valorPagoCentavos}, ${l.valorCentavos}) else ${l.valorCentavos} end)`,
      data: dataRef,
      pago: l.dataPagamento,
      conta: conta.descricao,
      cartao: cartao.descricao,
    })
    .from(l)
    .leftJoin(conta, eq(conta.id, l.contaId))
    .leftJoin(cartao, eq(cartao.id, l.cartaoId))
    .where(
      and(
        eCartao ? eq(l.cartaoId, imp.cartaoId!) : imp.qualquerConta ? isNotNull(l.contaId) : eq(l.contaId, imp.contaId!),
        inArray(l.tipo, ["receita", "despesa", "transferencia_saida", "transferencia_entrada", "pagamento_fatura"]),
        sql`${dataRef} between ${j.de} and ${j.ate}`,
        sql`not ${vinculadaSql}`,
      ),
    );
  const lista: Candidato[] = gravados.map((x) => ({
    chave: `l:${x.id}`,
    descricao: x.descricao,
    data: String(x.data),
    valorCentavos: Number(x.valor),
    tipo: x.tipo === "receita" || x.tipo === "transferencia_entrada" ? "receita" : "despesa",
    destino: x.conta ?? x.cartao ?? "",
    realizado: !!x.pago,
    previsto: false,
  }));

  // Recorrentes previstos (ainda não gravados) nas mesmas datas.
  const ctx = await carregarContexto(db, hoje);
  if (ctx.regras.length) {
    const nomes = new Map((await db.select({ id: conta.id, d: conta.descricao }).from(conta)).map((c) => [c.id, c.d]));
    const nomesCartao = new Map((await db.select({ id: cartao.id, d: cartao.descricao }).from(cartao)).map((c) => [c.id, c.d]));
    // Compras no cartão aparecem no vencimento da fatura: olha até dois meses depois.
    for (const p of pendentes(ctx, somarDias(j.ate, eCartao ? 70 : 0))) {
      for (const perna of p.pernas) {
        const daqui = eCartao ? perna.cartaoId === imp.cartaoId : imp.qualquerConta ? perna.contaId !== null : perna.contaId === imp.contaId;
        const data = eCartao ? (perna.dataCompra ?? perna.dataVencimento) : perna.dataVencimento;
        if (!daqui || data < j.de || data > j.ate) continue;
        lista.push({
          chave: `r:${p.regra.id}:${p.data}`,
          descricao: p.descricao,
          data,
          valorCentavos: Math.abs(perna.valorComSinal),
          tipo: perna.valorComSinal >= 0 ? "receita" : "despesa",
          destino: (perna.contaId ? nomes.get(perna.contaId) : nomesCartao.get(perna.cartaoId!)) ?? "",
          realizado: false,
          previsto: true,
        });
      }
    }
  }
  return lista;
}

/** "Último lançamento parecido": categoria e contato usados da última vez que a mesma descrição foi importada. */
async function historico(db: Db, descricoes: string[]): Promise<Map<string, { categoriaId: number | null; contatoId: number | null }>> {
  const mapa = new Map<string, { categoriaId: number | null; contatoId: number | null }>();
  if (!descricoes.length) return mapa;
  const linhas = await db
    .select({ descricao: linha.descricao, categoriaId: l.categoriaId, contatoId: l.contatoId })
    .from(linha)
    .innerJoin(l, eq(l.id, linha.lancamentoId))
    .where(and(inArray(linha.descricao, [...new Set(descricoes)]), eq(linha.status, "adicionado"), isNotNull(l.categoriaId)))
    .orderBy(desc(linha.id));
  for (const x of linhas) {
    const chave = normalizar(x.descricao);
    if (!mapa.has(chave)) mapa.set(chave, { categoriaId: x.categoriaId, contatoId: x.contatoId });
  }
  return mapa;
}

/** Categorias e contatos pelo nome (para as colunas Categoria e Cliente/Fornecedor do CSV). */
async function porNome(db: Db) {
  const [cats, contatos] = await Promise.all([
    db.select({ id: categoria.id, nome: categoria.nome, natureza: categoria.natureza, especial: categoria.especial, ativo: categoria.ativo }).from(categoria),
    db.select({ id: contato.id, nome: contato.nome }).from(contato),
  ]);
  return {
    categoria: (nome: string, tipo: "receita" | "despesa") =>
      cats.find((c) => !c.especial && c.ativo && c.natureza === tipo && normalizar(c.nome) === normalizar(nome))?.id ?? null,
    contato: (nome: string) => contatos.find((c) => normalizar(c.nome) === normalizar(nome))?.id ?? null,
  };
}

/** Grava as linhas lidas do arquivo e já aplica duplicidade, regras e conciliação. */
export async function gravarLinhas(tx: Transacao, imp: Importacao, transacoes: TransacaoArquivo[]) {
  await tx.delete(linha).where(eq(linha.importacaoId, imp.id));
  if (!transacoes.length) return;
  const jaImportadas = await chavesJaImportadas(tx, imp);
  const nomes = await porNome(tx);
  const valores = transacoes.map((t) => {
    const duplicada = jaImportadas.has(chaveDuplicidade(t));
    const campos: CamposLinha = { descricao: t.descricao };
    if (t.categoria) {
      const id = nomes.categoria(t.categoria, t.tipo);
      if (id) Object.assign(campos, { categoriaId: id, origemCategoria: "arquivo" });
    }
    if (t.contato) {
      const id = nomes.contato(t.contato);
      Object.assign(campos, id ? { contatoId: id } : { contatoNome: t.contato });
    }
    return {
      importacaoId: imp.id,
      numeroLinha: t.numeroLinha,
      dadosBrutos: t.bruto,
      fitid: t.fitid,
      data: t.data,
      valorCentavos: t.valorCentavos,
      tipo: t.tipo,
      descricao: t.descricao,
      documento: t.documento,
      campos,
      status: duplicada ? ("ignorado" as const) : ("novo" as const),
      duplicada,
    };
  });
  for (let i = 0; i < valores.length; i += 500) await tx.insert(linha).values(valores.slice(i, i + 500));
  await processarLinhas(tx, imp, { aplicarRegras: true });
}

/**
 * Aplica as regras (opcional) e refaz a conciliação das linhas que ainda não viraram lançamento.
 * Não mexe nas linhas adicionadas, conciliadas, duplicadas nem nas que você ignorou à mão.
 */
export async function processarLinhas(tx: Transacao, imp: Importacao, opcoes: { aplicarRegras: boolean; ids?: number[] }) {
  const todas = await tx.select().from(linha).where(eq(linha.importacaoId, imp.id)).orderBy(linha.numeroLinha);
  const ignoradaAMao = (x: LinhaImportacao) => x.status === "ignorado" && x.regraId === null;
  const alvo = todas.filter((x) => !x.duplicada && x.status !== "adicionado" && x.status !== "conciliado" && (!opcoes.ids || opcoes.ids.includes(x.id)) && !(ignoradaAMao(x) && !opcoes.ids));
  if (!alvo.length) return;
  const regras = opcoes.aplicarRegras ? await carregarRegrasAtivas(tx) : [];
  const destino = { contaId: imp.contaId, cartaoId: imp.cartaoId };
  const hist = await historico(tx, alvo.map((x) => x.descricao));

  const atualizadas = alvo.map((x) => {
    let campos = { ...(x.campos as CamposLinha) };
    let regraId = x.regraId;
    let ignorada = false;
    if (opcoes.aplicarRegras) {
      // Tira o que uma regra anterior tinha preenchido (a regra pode ter mudado).
      if (regraId !== null && campos.origemCategoria === "regra") campos = { ...campos, categoriaId: null, origemCategoria: null };
      regraId = null;
      const r = regraQueAtende(regras, { descricao: x.descricao, documento: x.documento, valorCentavos: x.valorCentavos, tipo: x.tipo }, destino);
      if (r) {
        regraId = r.id;
        if (r.acao === "ignorar") ignorada = true;
        else {
          const p = r.preencher;
          if (p.descricao) campos.descricao = p.descricao;
          if (p.categoriaId && campos.origemCategoria !== "manual") Object.assign(campos, { categoriaId: p.categoriaId, origemCategoria: "regra" });
          if (p.contatoId) Object.assign(campos, { contatoId: p.contatoId, contatoNome: null });
          if (p.formaPagamentoId) campos.formaPagamentoId = p.formaPagamentoId;
          if (p.tagIds?.length) campos.tagIds = [...new Set([...(campos.tagIds ?? []), ...p.tagIds])];
        }
      }
    } else if (ignoradaAMao(x)) {
      ignorada = false;
    } else if (x.status === "ignorado" && x.regraId !== null) {
      ignorada = true;
    }
    if (!campos.categoriaId) {
      const h = hist.get(normalizar(x.descricao));
      if (h?.categoriaId) Object.assign(campos, { categoriaId: h.categoriaId, origemCategoria: "historico" });
      if (h?.contatoId && !campos.contatoId && !campos.contatoNome) campos.contatoId = h.contatoId;
    }
    return { x, campos, regraId, ignorada };
  });

  const paraConciliar = atualizadas.filter((a) => !a.ignorada).map((a) => ({ chave: a.x.id, data: a.x.data, valorCentavos: a.x.valorCentavos, tipo: a.x.tipo }));
  const candidatos = await buscarCandidatos(tx, imp, paraConciliar.map((p) => p.data));
  // Candidatos já reservados por linhas encontradas que não estão sendo refeitas ficam de fora.
  const reservados = new Set(
    todas
      .filter((x) => !alvo.includes(x) && x.status === "encontrado")
      .flatMap((x) => (x.candidatos as Candidato[]).map((c) => c.chave)),
  );
  const resultado = conciliar(paraConciliar, candidatos.filter((c) => !reservados.has(c.chave)), imp.toleranciaDias);

  for (const a of atualizadas) {
    const r = a.ignorada ? null : resultado.get(a.x.id);
    await tx
      .update(linha)
      .set({ campos: a.campos, regraId: a.regraId, status: a.ignorada ? "ignorado" : (r?.status ?? "novo"), candidatos: r?.candidatos ?? [] })
      .where(eq(linha.id, a.x.id));
  }
}

/** Totais por status, para a lista e o resumo da revisão. */
export async function totaisPorStatus(db: Db, ids: number[]) {
  const mapa = new Map<number, Record<string, number>>();
  if (!ids.length) return mapa;
  const linhas = await db
    .select({ importacaoId: linha.importacaoId, status: linha.status, quantidade: sql<number>`count(*)::int` })
    .from(linha)
    .where(inArray(linha.importacaoId, ids))
    .groupBy(linha.importacaoId, linha.status);
  for (const x of linhas) mapa.set(x.importacaoId, { ...(mapa.get(x.importacaoId) ?? {}), [x.status]: Number(x.quantidade) });
  return mapa;
}
