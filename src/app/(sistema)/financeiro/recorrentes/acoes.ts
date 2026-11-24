"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { totalDetalhado } from "@/lib/lancamentos/regras";
import { carregarRegras } from "@/lib/recorrentes/servidor";
import type { AbaRecorrente, DadosPlano, DadosRecorrente } from "@/lib/recorrentes/tipos";
import { ErroValidacao, lerDatasRecorrencia } from "@/lib/recorrentes/validacao";
import { exigirLogin } from "@/lib/sessao";

const { recorrencia: r, recorrenciaItem, recorrenciaTag, plano, contaFinanceira: conta, cartaoCredito: cartao, categoria, formaPagamento, contato, tag } = schema;
const TELA = "Recorrentes";
const ENTIDADE = "Recorrente";
const MAXIMO_CENTAVOS = 99_999_999_999;

const erro = (mensagem: string): never => {
  throw new ErroValidacao(mensagem);
};

function lerValor(texto: string, campo: string): number {
  if (!texto?.trim()) erro(`Preencha o campo **${campo}**.`);
  const centavos = lerValorEmCentavos(texto);
  if (centavos === null || centavos > MAXIMO_CENTAVOS) erro(`Informe um valor válido no campo **${campo}** (ex.: 1.250,00).`);
  if (centavos! <= 0) erro(`O campo **${campo}** precisa ser maior que zero.`);
  return centavos!;
}

function lerTexto(texto: string, campo: string, maximo: number, obrigatorio = false): string | null {
  const limpo = (texto ?? "").trim();
  if (!limpo) return obrigatorio ? erro(`Preencha o campo **${campo}**.`) : null;
  if (limpo.length > maximo) erro(`O campo **${campo}** aceita no máximo ${maximo} caracteres.`);
  return limpo;
}

const lerId = (texto: string | number | null | undefined) => {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function conferirCategoria(tx: Transacao, id: number | null, campo: string, natureza: "receita" | "despesa") {
  if (id === null) erro(`Selecione o campo **${campo}**.`);
  const [c] = await tx.select({ especial: categoria.especial, natureza: categoria.natureza }).from(categoria).where(eq(categoria.id, id!));
  if (!c || c.especial) erro(`Selecione o campo **${campo}**.`);
  if (c!.natureza !== natureza) erro(`A categoria escolhida é de ${c!.natureza}. Escolha uma categoria de ${natureza} no campo **${campo}**.`);
  return id!;
}

async function conferirExiste(tx: Transacao, tabela: typeof formaPagamento | typeof contato, id: number | null, campo: string) {
  if (id === null) return null;
  const [linha] = await tx.select({ id: tabela.id }).from(tabela).where(eq(tabela.id, id));
  if (!linha) erro(`Selecione o campo **${campo}**.`);
  return id;
}

async function lerDestino(tx: Transacao, destino: string, soContas: boolean, campo: string) {
  const m = /^(conta|cartao):(\d+)$/.exec(destino ?? "");
  if (!m || (soContas && m[1] !== "conta")) erro(`Selecione o campo **${campo}**.`);
  const id = Number(m![2]);
  const tabela = m![1] === "conta" ? conta : cartao;
  const [x] = await tx.select({ id: tabela.id }).from(tabela).where(eq(tabela.id, id));
  if (!x) erro(`Selecione o campo **${campo}**.`);
  return m![1] === "conta" ? { contaId: id, cartaoId: null } : { contaId: null, cartaoId: id };
}

async function lerTags(tx: Transacao, ids: number[]): Promise<number[]> {
  const unicos = [...new Set((Array.isArray(ids) ? ids : []).map(lerId).filter((x): x is number => x !== null))];
  if (!unicos.length) return [];
  const achadas = await tx.select({ id: tag.id }).from(tag).where(inArray(tag.id, unicos));
  if (achadas.length !== unicos.length) erro("Selecione o campo **Tags** de novo: alguma tag não existe mais.");
  return unicos;
}

async function lerItens(tx: Transacao, d: DadosRecorrente) {
  if (!Array.isArray(d.itens) || d.itens.length === 0) erro("Adicione pelo menos um item no campo **Detalhes**.");
  if (d.itens.length > 100) erro("O campo **Detalhes** aceita no máximo 100 itens.");
  const itens = [];
  for (const [i, it] of d.itens.entries()) {
    const n = i + 1;
    const tipo = it.tipo === "receita" ? ("receita" as const) : ("despesa" as const);
    itens.push({
      tipo,
      descricao: lerTexto(it.descricao, `Descrição do item ${n}`, 120, true)!,
      valorCentavos: lerValor(it.valor, `Valor do item ${n}`),
      categoriaId: await conferirCategoria(tx, lerId(it.categoriaId), `Categoria do item ${n}`, tipo),
      ordem: i,
    });
  }
  const total = totalDetalhado(itens);
  if (total.valorCentavos === 0) erro("A soma dos itens do campo **Detalhes** não pode ser zero.");
  return { itens, ...total };
}

// ---------------------------------------------------------------------------
// Recorrentes
// ---------------------------------------------------------------------------

export async function salvarRecorrente(id: number | null, d: DadosRecorrente): Promise<Resultado> {
  await exigirLogin();
  if (id !== null && !idValido.safeParse(id).success) return falha("Recorrente não encontrado.");
  try {
    return await getDb().transaction(async (tx) => {
      const aba: AbaRecorrente = d.aba === "detalhado" || d.aba === "transferencia" ? d.aba : "simples";
      let tipo: "receita" | "despesa" = d.tipo === "receita" ? "receita" : "despesa";
      let descricao = lerTexto(d.descricao, "Descrição", 120, aba !== "transferencia") ?? "Transferência";
      let valorCentavos = 0;
      let categoriaId: number | null = null;
      let itens: Awaited<ReturnType<typeof lerItens>>["itens"] = [];
      let planoId: number | null = null;
      let contaDestinoId: number | null = null;
      let destino: { contaId: number | null; cartaoId: number | null };

      const mediaUltimos = aba !== "detalhado" && d.modoValor === "media" ? Number(d.mediaUltimos) : 0;
      if (!Number.isInteger(mediaUltimos) || mediaUltimos < 0 || mediaUltimos > 12) erro("Escolha uma opção no campo **Média**.");

      if (aba === "detalhado") {
        const x = await lerItens(tx, d);
        itens = x.itens;
        tipo = x.tipo;
        valorCentavos = x.valorCentavos;
        destino = await lerDestino(tx, d.destino, false, "Conta ou Cartão");
      } else if (aba === "transferencia") {
        tipo = "despesa";
        valorCentavos = lerValor(d.valor, mediaUltimos ? "Valor de referência" : "Valor");
        destino = await lerDestino(tx, d.destino, true, "Conta Financeira");
        contaDestinoId = lerId(d.contaDestinoId);
        if (!contaDestinoId || !(await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, contaDestinoId))).length) erro("Selecione o campo **Conta de Destino**.");
        if (contaDestinoId === destino.contaId) erro("A **Conta de Destino** precisa ser diferente da conta de origem.");
      } else {
        planoId = lerId(d.planoId);
        if (planoId) {
          const [p] = await tx.select().from(plano).where(eq(plano.id, planoId));
          if (!p) erro("Selecione o campo **Plano** de novo: ele não existe mais.");
          if (p!.tipo !== tipo) erro(`O plano escolhido é de ${p!.tipo}. Escolha um plano de ${tipo} no campo **Plano**.`);
          // Com plano, a descrição e o valor vêm do plano.
          descricao = p!.descricao;
          valorCentavos = p!.valorCentavos;
        } else {
          valorCentavos = lerValor(d.valor, mediaUltimos ? "Valor de referência" : "Valor");
        }
        categoriaId = await conferirCategoria(tx, lerId(d.categoriaId), "Categoria", tipo);
        destino = await lerDestino(tx, d.destino, false, "Conta ou Cartão");
      }

      const datas = lerDatasRecorrencia(d.recorrencia);
      const tagIds = await lerTags(tx, d.tagIds);
      const dados = {
        formato: aba,
        tipo,
        descricao,
        valorCentavos,
        mediaUltimos,
        ...datas,
        realizarAutomaticamente: !!d.realizarAutomaticamente,
        ...destino,
        contaDestinoId,
        categoriaId,
        formaPagamentoId: await conferirExiste(tx, formaPagamento, lerId(d.formaPagamentoId), "Forma de Pagamento"),
        contatoId: aba === "transferencia" ? null : await conferirExiste(tx, contato, lerId(d.contatoId), "Cliente ou Fornecedor"),
        planoId,
        observacao: lerTexto(d.observacao, "Observação", 1000),
      };

      let regraId: number;
      if (id === null) {
        const [nova] = await tx.insert(r).values(dados).returning();
        regraId = nova.id;
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: regraId, acao: "cadastrou", descricao: `o Recorrente ${descricao}`, dados: { ...dados, tagIds, itens } });
      } else {
        const [antes] = await tx.select().from(r).where(eq(r.id, id)).for("update");
        if (!antes) erro("Este recorrente não existe mais.");
        regraId = id;
        await tx.update(r).set(dados).where(eq(r.id, id));
        await tx.delete(recorrenciaItem).where(eq(recorrenciaItem.recorrenciaId, id));
        await tx.delete(recorrenciaTag).where(eq(recorrenciaTag.recorrenciaId, id));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o Recorrente ${descricao}`, dados: { ...diferencas(antes!, dados), tagIds, itens } });
      }
      if (itens.length) await tx.insert(recorrenciaItem).values(itens.map((i) => ({ ...i, recorrenciaId: regraId })));
      if (tagIds.length) await tx.insert(recorrenciaTag).values(tagIds.map((tagId) => ({ recorrenciaId: regraId, tagId })));
      refresh();
      return { ok: true as const, id: regraId };
    });
  } catch (e) {
    if (e instanceof ErroValidacao) return falha(e.message);
    throw e;
  }
}

/** Recorrente carregado para edição. */
export async function carregarRecorrente(id: number): Promise<DadosRecorrente | null> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return null;
  const [x] = await carregarRegras(getDb(), { ids: [id] });
  if (!x) return null;
  return {
    aba: x.formato,
    tipo: x.tipo,
    planoId: x.planoId ? String(x.planoId) : "",
    descricao: x.descricao,
    modoValor: x.mediaUltimos ? "media" : "valor",
    mediaUltimos: String(x.mediaUltimos || 3),
    valor: formatarCentavos(x.valorCentavos),
    categoriaId: x.categoriaId ? String(x.categoriaId) : "",
    destino: x.contaId ? `conta:${x.contaId}` : `cartao:${x.cartaoId}`,
    contaDestinoId: x.contaDestinoId ? String(x.contaDestinoId) : "",
    formaPagamentoId: x.formaPagamentoId ? String(x.formaPagamentoId) : "",
    contatoId: x.contatoId ? String(x.contatoId) : "",
    tagIds: x.tagIds,
    itens: x.itens.map((i) => ({ chave: `r${i.id}`, tipo: i.tipo, descricao: i.descricao, valor: formatarCentavos(i.valorCentavos), categoriaId: String(i.categoriaId) })),
    observacao: x.observacao ?? "",
    realizarAutomaticamente: x.realizarAutomaticamente,
    recorrencia: {
      intervalo: x.intervalo,
      intervaloDias: String(x.intervaloDias ?? 30),
      diaFixo: String(x.diaFixo),
      dataInicio: x.dataInicio,
      fim: x.dataFim ? "data" : "repeticoes",
      repeticoes: x.repeticoes ? String(x.repeticoes) : "",
      dataFim: x.dataFim ?? "",
      apenasDiaUtil: x.apenasDiaUtil,
    },
  };
}

/** Inativar para de gerar os próximos lançamentos; os já lançados continuam. */
export async function alterarSituacaoRecorrente(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Recorrente não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(r).set({ ativo }).where(eq(r.id, id)).returning();
    if (!linha) return falha("Este recorrente não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: `o Recorrente ${linha.descricao}` });
    refresh();
    return { ok: true } as const;
  });
}

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

/** Editar o plano atualiza a descrição e o valor de todos os recorrentes ligados a ele. */
export async function salvarPlano(id: number | null, d: DadosPlano): Promise<Resultado> {
  await exigirLogin();
  if (id !== null && !idValido.safeParse(id).success) return falha("Plano não encontrado.");
  try {
    return await getDb().transaction(async (tx) => {
      const dados = {
        nome: lerTexto(d.nome, "Nome", 80, true)!,
        descricao: lerTexto(d.descricao, "Descrição", 120, true)!,
        tipo: d.tipo === "receita" ? ("receita" as const) : ("despesa" as const),
        valorCentavos: lerValor(d.valor, "Valor"),
      };
      if (id === null) {
        const [novo] = await tx.insert(plano).values(dados).returning();
        await registrarAuditoria(tx, { tela: TELA, entidade: "Plano", entidadeId: novo.id, acao: "cadastrou", descricao: `o Plano ${dados.nome}`, dados });
        refresh();
        return { ok: true as const, id: novo.id };
      }
      const [antes] = await tx.select().from(plano).where(eq(plano.id, id)).for("update");
      if (!antes) erro("Este plano não existe mais.");
      const [{ usos }] = await tx.select({ usos: count() }).from(r).where(eq(r.planoId, id));
      if (usos > 0 && antes!.tipo !== dados.tipo) erro("Este plano já tem recorrentes ligados: não dá para trocar entre **Despesa** e **Receita**.");
      await tx.update(plano).set(dados).where(eq(plano.id, id));
      await tx.update(r).set({ descricao: dados.descricao, valorCentavos: dados.valorCentavos }).where(and(eq(r.planoId, id), eq(r.formato, "simples")));
      await registrarAuditoria(tx, { tela: TELA, entidade: "Plano", entidadeId: id, acao: "alterou", descricao: `o Plano ${dados.nome}`, dados: { ...diferencas(antes!, dados), recorrentesAtualizados: usos } });
      refresh();
      return { ok: true as const, id };
    });
  } catch (e) {
    if (e instanceof ErroValidacao) return falha(e.message);
    throw e;
  }
}

export async function alterarSituacaoPlano(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Plano não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(plano).set({ ativo }).where(eq(plano.id, id)).returning();
    if (!linha) return falha("Este plano não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: "Plano", entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: `o Plano ${linha.nome}` });
    refresh();
    return { ok: true } as const;
  });
}
