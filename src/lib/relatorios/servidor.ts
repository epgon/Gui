import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { descendentes, montarArvore, type CategoriaNaArvore } from "@/lib/categorias";
import { hojeIso } from "@/lib/datas";
import { somarDias } from "@/lib/lancamentos/regras";
import { valorComSinalSql } from "@/lib/lancamentos/sql";
import { carregarContexto, pendentes } from "@/lib/recorrentes/servidor";
import type { FiltrosRelatorio, Movimento, Nomes } from "./regras";

const { lancamento: l, lancamentoItem: item, lancamentoTag, categoria, contaFinanceira: conta, cartaoCredito: cartao, contato, formaPagamento: forma, tag } = schema;

export type ArvoreCategorias = Map<number, CategoriaNaArvore>;

export async function carregarArvore(): Promise<ArvoreCategorias> {
  const todas = await getDb()
    .select({ id: categoria.id, nome: categoria.nome, categoriaPaiId: categoria.categoriaPaiId, ordem: categoria.ordem, cor: categoria.cor, natureza: categoria.natureza, especial: categoria.especial, ativo: categoria.ativo, padraoSistema: categoria.padraoSistema })
    .from(categoria);
  return new Map(montarArvore(todas).map((c) => [c.id, c]));
}

/** Nomes de contas, cartões, contatos, formas e tags (para as linhas do Saldo Detalhado). */
export async function carregarNomes(arvore: ArvoreCategorias): Promise<Nomes> {
  const db = getDb();
  const [contas, cartoes, contatos, formas, tags] = await Promise.all([
    db.select({ id: conta.id, nome: conta.descricao }).from(conta),
    db.select({ id: cartao.id, nome: cartao.descricao }).from(cartao),
    db.select({ id: contato.id, nome: contato.nome }).from(contato),
    db.select({ id: forma.id, nome: forma.descricao }).from(forma),
    db.select({ id: tag.id, nome: tag.descricao }).from(tag),
  ]);
  const mapa = (xs: { id: number; nome: string }[]) => new Map(xs.map((x) => [x.id, x.nome]));
  return { arvore, contas: mapa(contas), cartoes: mapa(cartoes), contatos: mapa(contatos), formas: mapa(formas), tags: mapa(tags) };
}

const especialDoTipo = (tipo: string): Movimento["especial"] =>
  tipo === "transferencia_saida" || tipo === "transferencia_entrada" ? "transferencia" : tipo === "saldo_inicial" || tipo === "acerto_saldo" ? "acerto_saldo" : null;

/**
 * Tudo o que entra nos relatórios no intervalo e com os filtros escolhidos:
 * - lançamentos gravados (o detalhado entra item a item, cada um na sua categoria);
 * - recorrentes previstos (ainda não gravados), como na lista de Lançamentos.
 * O pagamento de fatura não entra: a despesa já está nas compras do cartão (senão contaria duas vezes).
 * Saldo Inicial e Acerto de Saldo só entram com "Acerto de Saldo" ligado; transferências, com "Transferência".
 */
export async function carregarMovimentos(f: FiltrosRelatorio, arvore: ArvoreCategorias, hoje = hojeIso()): Promise<Movimento[]> {
  const db = getDb();
  const cartaoFiltro = f.destino.startsWith("cartao:") ? Number(f.destino.slice(7)) : null;
  const contaFiltro = f.destino.startsWith("conta:") ? Number(f.destino.slice(6)) : null;

  let categorias: Set<number> | null = null;
  if (f.categoria) {
    const lista = [...arvore.values()].map((c) => ({ id: c.id, categoriaPaiId: c.categoriaPaiId }));
    categorias = new Set([Number(f.categoria), ...descendentes(lista, Number(f.categoria))]);
  }
  const passaCategoria = (id: number | null) => !categorias || (id !== null && categorias.has(id));

  const tiposFora = ["pagamento_fatura", ...(f.incluirAcerto ? [] : ["saldo_inicial", "acerto_saldo"]), ...(f.incluirTransferencia ? [] : ["transferencia_saida", "transferencia_entrada"])] as (typeof l.$inferSelect.tipo)[];

  const dataSql: SQL =
    f.considerar === "pagamento"
      ? sql`${l.dataPagamento}`
      : f.considerar === "referencia"
        ? sql`coalesce(${l.dataReferencia}, ${l.dataVencimento})`
        : f.considerar === "compra"
          ? sql`coalesce(${l.dataCompra}, ${l.dataVencimento})`
          : sql`${l.dataVencimento}`;

  const situacao: SQL | undefined =
    f.situacao === "realizado"
      ? isNotNull(l.dataPagamento)
      : f.situacao === "nao_realizado"
        ? isNull(l.dataPagamento)
        : f.situacao === "a_vencer"
          ? and(isNull(l.dataPagamento), gte(l.dataVencimento, hoje))
          : f.situacao === "vencido"
            ? and(isNull(l.dataPagamento), lt(l.dataVencimento, hoje))
            : undefined;

  const escopo =
    cartaoFiltro !== null
      ? eq(l.cartaoId, cartaoFiltro)
      : contaFiltro !== null
        ? or(eq(l.contaId, contaFiltro), sql`${l.cartaoId} in (select ${cartao.id} from ${cartao} where ${cartao.contaPagamentoId} = ${contaFiltro})`)
        : undefined;

  const linhas = await db
    .select({
      id: l.id,
      tipo: l.tipo,
      formato: l.formato,
      data: sql<string>`(${dataSql})::text`,
      valor: valorComSinalSql,
      categoriaId: l.categoriaId,
      contaId: l.contaId,
      cartaoId: l.cartaoId,
      contatoId: l.contatoId,
      formaId: l.formaPagamentoId,
      tagIds: sql<number[]>`coalesce((select array_agg(${lancamentoTag.tagId}) from ${lancamentoTag} where ${lancamentoTag.lancamentoId} = ${l.id}), '{}')`,
    })
    .from(l)
    .where(
      and(
        notInArray(l.tipo, tiposFora),
        sql`(${dataSql}) >= ${f.inicio}`,
        sql`(${dataSql}) <= ${f.fim}`,
        situacao,
        escopo,
        f.forma ? eq(l.formaPagamentoId, Number(f.forma)) : undefined,
        f.contato ? eq(l.contatoId, Number(f.contato)) : undefined,
        f.tag ? sql`exists (select 1 from ${lancamentoTag} where ${lancamentoTag.lancamentoId} = ${l.id} and ${lancamentoTag.tagId} = ${Number(f.tag)})` : undefined,
      ),
    )
    .orderBy(asc(l.id));

  const idsDetalhados = linhas.filter((x) => x.formato === "detalhado").map((x) => x.id);
  const itens = idsDetalhados.length ? await db.select().from(item).where(inArray(item.lancamentoId, idsDetalhados)) : [];
  const itensPor = new Map<number, typeof itens>();
  for (const i of itens) itensPor.set(i.lancamentoId, [...(itensPor.get(i.lancamentoId) ?? []), i]);

  const especiais = new Map([...arvore.values()].filter((c) => c.especial).map((c) => [c.especial!, c.id]));
  const movimentos: Movimento[] = [];
  for (const x of linhas) {
    const especial = especialDoTipo(x.tipo);
    const base = { data: x.data, especial, contaId: x.contaId, cartaoId: x.cartaoId, contatoId: x.contatoId, formaId: x.formaId, tagIds: (x.tagIds ?? []).map(Number) };
    const doLancamento = itensPor.get(x.id);
    if (x.formato === "detalhado" && doLancamento?.length) {
      for (const i of doLancamento) {
        if (!passaCategoria(i.categoriaId)) continue;
        movimentos.push({ ...base, categoriaId: i.categoriaId, valorCentavos: i.tipo === "receita" ? Math.abs(i.valorCentavos) : -Math.abs(i.valorCentavos) });
      }
      continue;
    }
    const categoriaId = x.categoriaId ?? (especial ? (especiais.get(especial) ?? null) : null);
    if (!passaCategoria(categoriaId)) continue;
    movimentos.push({ ...base, categoriaId, valorCentavos: Number(x.valor) });
  }

  // Recorrentes previstos: não estão pagos, então ficam de fora em "Realizado" e na data de pagamento.
  if (f.situacao !== "realizado" && f.considerar !== "pagamento") {
    const ctx = await carregarContexto(db, hoje);
    // Folga de dois meses: no cartão, a compra e o vencimento da fatura caem em meses diferentes.
    for (const p of pendentes(ctx, somarDias(f.fim, 62), somarDias(f.inicio, -62))) {
      const g = p.regra;
      if (f.forma && g.formaPagamentoId !== Number(f.forma)) continue;
      if (f.contato && g.contatoId !== Number(f.contato)) continue;
      if (f.tag && !g.tagIds.includes(Number(f.tag))) continue;
      for (const perna of p.pernas) {
        const especial = especialDoTipo(perna.tipo);
        if (especial === "transferencia" && !f.incluirTransferencia) continue;
        const data = f.considerar === "compra" ? (perna.dataCompra ?? perna.dataVencimento) : perna.dataVencimento;
        if (data < f.inicio || data > f.fim) continue;
        if (f.situacao === "a_vencer" && perna.dataVencimento < hoje) continue;
        if (f.situacao === "vencido" && perna.dataVencimento >= hoje) continue;
        if (cartaoFiltro !== null && perna.cartaoId !== cartaoFiltro) continue;
        if (contaFiltro !== null && perna.contaId !== contaFiltro && !(perna.cartaoId && ctx.cartoes.get(perna.cartaoId)?.contaPagamentoId === contaFiltro)) continue;
        const base = { data, especial, contaId: perna.contaId, cartaoId: perna.cartaoId, contatoId: g.contatoId, formaId: g.formaPagamentoId, tagIds: g.tagIds };
        if (g.formato === "detalhado") {
          for (const i of g.itens) {
            if (!passaCategoria(i.categoriaId)) continue;
            movimentos.push({ ...base, categoriaId: i.categoriaId, valorCentavos: i.tipo === "receita" ? Math.abs(i.valorCentavos) : -Math.abs(i.valorCentavos) });
          }
          continue;
        }
        const categoriaId = especial ? (especiais.get(especial) ?? null) : g.categoriaId;
        if (!passaCategoria(categoriaId)) continue;
        movimentos.push({ ...base, categoriaId, valorCentavos: perna.valorComSinal });
      }
    }
  }
  return movimentos;
}

/** Os últimos lançamentos gravados de uma categoria (e das filhas), até hoje (compras no cartão pela data da compra). Usado no Detalhar categoria. */
export async function ultimosDaCategoria(ids: number[], hoje = hojeIso(), quantidade = 10) {
  if (!ids.length) return [];
  const db = getDb();
  const linhas = await db
    .select({
      id: l.id,
      descricao: l.descricao,
      data: sql<string>`coalesce(${l.dataCompra}, ${l.dataVencimento})::text`,
      dataPagamento: l.dataPagamento,
      valor: valorComSinalSql,
      formato: l.formato,
      contaNome: conta.descricao,
      cartaoNome: cartao.descricao,
      itens: sql<{ tipo: string; valor: number; categoriaId: number }[]>`coalesce((select json_agg(json_build_object('tipo', ${item.tipo}, 'valor', ${item.valorCentavos}, 'categoriaId', ${item.categoriaId})) from ${item} where ${item.lancamentoId} = ${l.id}), '[]')`,
    })
    .from(l)
    .leftJoin(conta, eq(conta.id, l.contaId))
    .leftJoin(cartao, eq(cartao.id, l.cartaoId))
    .where(
      and(
        ne(l.tipo, "pagamento_fatura"),
        sql`coalesce(${l.dataCompra}, ${l.dataVencimento}) <= ${hoje}`,
        or(inArray(l.categoriaId, ids), sql`exists (select 1 from ${item} where ${item.lancamentoId} = ${l.id} and ${inArray(item.categoriaId, ids)})`),
      ),
    )
    .orderBy(sql`coalesce(${l.dataCompra}, ${l.dataVencimento}) desc`, sql`${l.id} desc`)
    .limit(quantidade);
  const conjunto = new Set(ids);
  return linhas.map((x) => ({
    id: x.id,
    descricao: x.descricao,
    data: x.data,
    pago: x.dataPagamento !== null,
    contaOuCartao: x.contaNome ?? x.cartaoNome ?? "",
    // No detalhado, só a parte que é desta categoria.
    valorCentavos:
      x.formato === "detalhado"
        ? x.itens.filter((i) => conjunto.has(Number(i.categoriaId))).reduce((s, i) => s + (i.tipo === "receita" ? Math.abs(Number(i.valor)) : -Math.abs(Number(i.valor))), 0)
        : Number(x.valor),
  }));
}
