import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { contemTexto, parametro, semAcento, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { descendentes, montarArvore, rotuloCategoria } from "@/lib/categorias";
import { hojeIso } from "@/lib/datas";
import { lerValorEmCentavos } from "@/lib/dinheiro";
import { carregarContexto, pendentes, type Contexto, type Pendente, type Perna } from "@/lib/recorrentes/servidor";
import { listarFaturas } from "@/lib/cartoes/servidor";
import { mesDe, situacaoDe, somarDias, valorComSinal, type Situacao } from "./regras";
import { valorComSinalSql, valorRealizadoSql } from "./sql";
import { filtrarAvancado, lerFiltrosAvancados } from "@/lib/listagem/avancado";
import { CAMPOS_LANCAMENTOS_BASE, LEITORES_LANCAMENTOS } from "./avancado";
import type { Aba, Filtros, FiltroSituacao, LinhaLista, OperadorFiltro, Opcoes, Resumo } from "./tipos";

const { lancamento: l, contaFinanceira: conta, cartaoCredito: cartao, banco, categoria, contato, formaPagamento: forma, tag, lancamentoTag, lancamentoItem, anexo, fatura, divida } = schema;

export { valorComSinalSql, valorRealizadoSql } from "./sql";

const operador = (sp: ParametrosBusca, nome: string): OperadorFiltro => (parametro(sp, nome) === "dif" ? "dif" : "");

export function lerFiltros(sp: ParametrosBusca, hoje = hojeIso()): Filtros {
  const mes = parametro(sp, "mes");
  const aba = parametro(sp, "aba");
  const situacao = parametro(sp, "situacao");
  const destino = parametro(sp, "destino");
  const id = (nome: string) => (/^\d+$/.test(parametro(sp, nome)) ? parametro(sp, nome) : "");
  return {
    mes: /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoje.slice(0, 7),
    aba: (["receitas", "despesas", "transferencias", "recorrentes"].includes(aba) ? aba : "todos") as Aba,
    destino: /^(conta|cartao):\d+$/.test(destino) ? destino : "",
    situacao: (["nao_realizado", "realizado", "a_vencer", "vencido"].includes(situacao) ? situacao : "") as FiltroSituacao,
    busca: parametro(sp, "busca").slice(0, 100),
    detalhar: parametro(sp, "detalhar") === "1",
    categoria: id("categoria"),
    forma: id("forma"),
    contato: id("contato"),
    tag: id("tag"),
    categoriaOp: operador(sp, "categoria_op"),
    formaOp: operador(sp, "forma_op"),
    contatoOp: operador(sp, "contato_op"),
    tagOp: operador(sp, "tag_op"),
    avancado: parametro(sp, "av").slice(0, 2000),
  };
}

const passaSituacao = (s: Situacao, filtro: FiltroSituacao) =>
  !filtro || (filtro === "nao_realizado" ? s !== "realizado" : s === filtro);

const passaAba = (aba: Aba, x: LinhaLista) => {
  const { tipo, valorCentavos: valor } = x;
  if (aba === "recorrentes") return x.recorrenciaId !== null || x.previsto !== null;
  const transferencia = tipo === "transferencia_saida" || tipo === "transferencia_entrada";
  if (aba === "transferencias") return transferencia;
  if (aba === "receitas") return !transferencia && valor > 0;
  if (aba === "despesas") return !transferencia && valor < 0;
  return true;
};

/** Ids das contas que entram no saldo (filtro por conta, ou todas as marcadas "Considerar nos saldos"). */
async function contasDoSaldo(destino: string): Promise<number[] | null> {
  if (destino.startsWith("cartao:")) return null;
  if (destino.startsWith("conta:")) return [Number(destino.slice(6))];
  const linhas = await getDb().select({ id: conta.id }).from(conta).where(eq(conta.considerarNosSaldos, true));
  return linhas.map((c) => c.id);
}

/** Lista do mês, já com as faturas agrupadas e os totais. */
export async function listarLancamentos(f: Filtros, hoje = hojeIso()): Promise<{ linhas: LinhaLista[]; resumo: Resumo }> {
  const db = getDb();
  const mes = mesDe(f.mes);
  const cartaoFiltro = f.destino.startsWith("cartao:") ? Number(f.destino.slice(7)) : null;
  const contaFiltro = f.destino.startsWith("conta:") ? Number(f.destino.slice(6)) : null;

  // Filtros de conteúdo: com algum deles ligado, as compras do cartão aparecem separadas.
  const filtrosConteudo: SQL[] = [];
  if (f.busca) {
    const centavos = lerValorEmCentavos(f.busca);
    filtrosConteudo.push(
      or(contemTexto(l.descricao, f.busca), contemTexto(l.documento, f.busca), centavos !== null ? eq(sql`abs(${l.valorCentavos})`, Math.abs(centavos)) : undefined)!,
    );
  }
  // DIFERENTE exclui o que tem aquele valor (lançamentos sem valor nenhum continuam aparecendo).
  if (f.categoria) {
    const todas = await db.select({ id: categoria.id, categoriaPaiId: categoria.categoriaPaiId }).from(categoria);
    const ids = [Number(f.categoria), ...descendentes(todas, Number(f.categoria))];
    const tem = or(inArray(l.categoriaId, ids), sql`exists (select 1 from ${lancamentoItem} where ${lancamentoItem.lancamentoId} = ${l.id} and ${inArray(lancamentoItem.categoriaId, ids)})`)!;
    filtrosConteudo.push(f.categoriaOp === "dif" ? sql`not coalesce(${tem}, false)` : tem);
  }
  if (f.forma) filtrosConteudo.push(f.formaOp === "dif" ? sql`${l.formaPagamentoId} is distinct from ${Number(f.forma)}` : eq(l.formaPagamentoId, Number(f.forma)));
  if (f.contato) filtrosConteudo.push(f.contatoOp === "dif" ? sql`${l.contatoId} is distinct from ${Number(f.contato)}` : eq(l.contatoId, Number(f.contato)));
  if (f.tag) {
    const tem = sql`exists (select 1 from ${lancamentoTag} where ${lancamentoTag.lancamentoId} = ${l.id} and ${lancamentoTag.tagId} = ${Number(f.tag)})`;
    filtrosConteudo.push(f.tagOp === "dif" ? sql`not ${tem}` : tem);
  }
  const avancados = lerFiltrosAvancados(f.avancado, CAMPOS_LANCAMENTOS_BASE);
  const agruparFaturas = cartaoFiltro === null && filtrosConteudo.length === 0 && avancados.length === 0;

  const escopo =
    cartaoFiltro !== null
      ? eq(l.cartaoId, cartaoFiltro)
      : contaFiltro !== null
        ? or(eq(l.contaId, contaFiltro), sql`${l.cartaoId} in (select ${cartao.id} from ${cartao} where ${cartao.contaPagamentoId} = ${contaFiltro})`)
        : undefined;

  const linhasDb = await db
    .select({
      id: l.id,
      tipo: l.tipo,
      formato: l.formato,
      descricao: l.descricao,
      valor: valorComSinalSql,
      dataVencimento: l.dataVencimento,
      dataPagamento: l.dataPagamento,
      dataCompra: l.dataCompra,
      dataReferencia: l.dataReferencia,
      documento: l.documento,
      valorPago: l.valorPagoCentavos,
      contaId: l.contaId,
      cartaoId: l.cartaoId,
      faturaId: l.faturaId,
      faturaPagaId: l.faturaPagaId,
      contaNome: conta.descricao,
      cartaoNome: cartao.descricao,
      bancoCodigo: banco.codigo,
      bancoNome: banco.nome,
      categoriaId: l.categoriaId,
      contato: contato.nome,
      forma: forma.descricao,
      parcelaNumero: l.parcelaNumero,
      parcelaTotal: l.parcelaTotal,
      parcelamentoId: l.parcelamentoId,
      transferenciaId: l.transferenciaId,
      recorrenciaId: l.recorrenciaId,
      dividaId: l.dividaId,
      dividaNome: divida.descricao,
      realizarAutomaticamente: l.realizarAutomaticamente,
      valorOriginal: l.valorOriginalCentavos,
      origemId: l.lancamentoOrigemId,
      observacao: sql<boolean>`coalesce(length(${l.observacao}), 0) > 0`,
      anexos: sql<number>`(select count(*)::int from ${anexo} where ${anexo.lancamentoId} = ${l.id})`,
      tags: sql<string[]>`coalesce((select array_agg(${tag.descricao} order by ${tag.descricao}) from ${lancamentoTag} join ${tag} on ${tag.id} = ${lancamentoTag.tagId} where ${lancamentoTag.lancamentoId} = ${l.id}), '{}')`,
    })
    .from(l)
    .leftJoin(conta, eq(conta.id, l.contaId))
    .leftJoin(cartao, eq(cartao.id, l.cartaoId))
    .leftJoin(banco, sql`${banco.id} = coalesce(${conta.bancoId}, ${cartao.bancoId})`)
    .leftJoin(contato, eq(contato.id, l.contatoId))
    .leftJoin(forma, eq(forma.id, l.formaPagamentoId))
    .leftJoin(divida, eq(divida.id, l.dividaId))
    // Pagamentos de fatura entram na linha "Fatura-Cartão"; sem ela (compras separadas), ficam de fora para não contar duas vezes.
    .where(and(gte(l.dataVencimento, mes.inicio), lte(l.dataVencimento, mes.fim), escopo, agruparFaturas ? undefined : ne(l.tipo, "pagamento_fatura"), ...filtrosConteudo))
    .orderBy(asc(l.dataVencimento), asc(l.id));

  // Categorias (com numeração) e itens dos detalhados.
  const todasCategorias = await db
    .select({ id: categoria.id, nome: categoria.nome, categoriaPaiId: categoria.categoriaPaiId, ordem: categoria.ordem, cor: categoria.cor, natureza: categoria.natureza, especial: categoria.especial, ativo: categoria.ativo, padraoSistema: categoria.padraoSistema })
    .from(categoria);
  const arvore = new Map(montarArvore(todasCategorias).map((c) => [c.id, c]));
  const idsDetalhados = linhasDb.filter((x) => x.formato === "detalhado").map((x) => x.id);
  const itens = idsDetalhados.length
    ? await db.select().from(lancamentoItem).where(inArray(lancamentoItem.lancamentoId, idsDetalhados)).orderBy(asc(lancamentoItem.ordem), asc(lancamentoItem.id))
    : [];

  const paraLinha = (x: (typeof linhasDb)[number]): LinhaLista => {
    const cat = x.categoriaId ? arvore.get(x.categoriaId) : undefined;
    return {
      chave: `l${x.id}`,
      id: x.id,
      faturaId: x.faturaId,
      faturaSituacao: null,
      tipo: x.tipo,
      formato: x.formato,
      descricao: x.descricao,
      valorCentavos: Number(x.valor),
      data: x.dataVencimento,
      dataPagamento: x.dataPagamento,
      dataCompra: x.dataCompra,
      dataReferencia: x.dataReferencia,
      documento: x.documento,
      valorPagoCentavos: x.valorPago === null ? null : Math.abs(Number(x.valorPago)),
      situacao: situacaoDe(x.dataVencimento, x.dataPagamento, hoje),
      contaOuCartao: x.contaNome ?? x.cartaoNome ?? "",
      bancoCodigo: x.bancoCodigo,
      bancoNome: x.bancoNome,
      eCartao: x.cartaoId !== null,
      cartaoId: x.cartaoId,
      categoria: cat ? rotuloCategoria(cat) : null,
      categoriaCor: cat?.corEfetiva ?? null,
      contato: x.contato,
      forma: x.forma,
      tags: x.tags ?? [],
      parcela: x.parcelaNumero && x.parcelaTotal ? `${x.parcelaNumero}/${x.parcelaTotal}` : null,
      parcelamentoId: x.parcelamentoId,
      transferenciaId: x.transferenciaId,
      recorrenciaId: x.recorrenciaId,
      dividaId: x.dividaId,
      dividaNome: x.dividaNome,
      previsto: null,
      realizarAutomaticamente: x.realizarAutomaticamente,
      valorOriginalCentavos: x.valorOriginal === null ? null : Math.abs(Number(x.valorOriginal)),
      restante: x.origemId !== null,
      observacao: x.observacao,
      anexos: Number(x.anexos),
      itens: itens
        .filter((i) => i.lancamentoId === x.id)
        .map((i) => {
          const c = arvore.get(i.categoriaId);
          return { id: i.id, tipo: i.tipo, descricao: i.descricao, valorCentavos: i.tipo === "receita" ? i.valorCentavos : -i.valorCentavos, categoria: c ? rotuloCategoria(c) : "", categoriaCor: c?.corEfetiva ?? "#9CA3AF" };
        }),
      compras: [],
    };
  };

  let linhas: LinhaLista[] = [];
  const porFatura = new Map<number, LinhaLista[]>();
  const pagamentosPorFatura = new Map<number, LinhaLista[]>();
  for (const x of linhasDb) {
    const linha = paraLinha(x);
    if (agruparFaturas && x.faturaId !== null) {
      porFatura.set(x.faturaId, [...(porFatura.get(x.faturaId) ?? []), linha]);
    } else if (agruparFaturas && x.faturaPagaId !== null) {
      pagamentosPorFatura.set(x.faturaPagaId, [...(pagamentosPorFatura.get(x.faturaPagaId) ?? []), linha]);
    } else {
      linhas.push(linha);
    }
  }
  const idsFaturas = [...new Set([...porFatura.keys(), ...pagamentosPorFatura.keys()])];
  if (idsFaturas.length) {
    const [faturas, cartoes] = await Promise.all([
      listarFaturas(inArray(fatura.id, idsFaturas), hoje),
      db.select({ id: cartao.id, nome: cartao.descricao, bancoCodigo: banco.codigo, bancoNome: banco.nome }).from(cartao).leftJoin(banco, eq(banco.id, cartao.bancoId)),
    ]);
    const mCartoes = new Map(cartoes.map((c) => [c.id, c]));
    for (const fa of faturas) {
      const compras = porFatura.get(fa.id) ?? [];
      const pagamentos = pagamentosPorFatura.get(fa.id) ?? [];
      const c = mCartoes.get(fa.cartaoId);
      const paga = fa.situacao === "paga";
      const dataPagamento = paga ? fa.ultimoPagamento : null;
      linhas.push({
        ...(compras[0] ?? pagamentos[0]),
        chave: `f${fa.id}`,
        id: null,
        faturaId: fa.id,
        faturaSituacao: fa.situacao,
        tipo: "pagamento_fatura",
        formato: "simples",
        descricao: `Fatura-${c?.nome ?? ""}`,
        // Com as compras no filtro, a linha vale o total delas; só com o pagamento (pago por outra conta), vale o pagamento.
        valorCentavos: compras.length ? compras.reduce((s, x) => s + x.valorCentavos, 0) : pagamentos.reduce((s, x) => s + x.valorCentavos, 0),
        data: fa.dataVencimento,
        dataPagamento,
        dataCompra: null,
        dataReferencia: null,
        documento: null,
        valorPagoCentavos: null,
        situacao: situacaoDe(fa.dataVencimento, dataPagamento, hoje),
        contaOuCartao: c?.nome ?? "",
        eCartao: true,
        cartaoId: fa.cartaoId,
        bancoCodigo: c?.bancoCodigo ?? null,
        bancoNome: c?.bancoNome ?? null,
        categoria: null,
        categoriaCor: null,
        contato: null,
        forma: null,
        tags: [],
        parcela: null,
        parcelamentoId: null,
        transferenciaId: null,
        recorrenciaId: null,
        previsto: null,
        realizarAutomaticamente: false,
        observacao: false,
        anexos: 0,
        itens: [],
        compras,
      });
    }
    linhas.sort((a, b) => a.data.localeCompare(b.data) || (a.id ?? 0) - (b.id ?? 0));
  }

  // Recorrentes previstos (calculados na hora, ainda não gravados).
  const ctx = await carregarContexto(db, hoje);
  const pendMes = pendentes(ctx, mes.fim, mes.inicio);
  if (pendMes.length) {
    const previstos = await linhasPrevistas(pendMes, f, { cartaoFiltro, contaFiltro, ctx, arvore, hoje });
    if (previstos.length) {
      linhas = [...linhas, ...previstos];
      linhas.sort((a, b) => a.data.localeCompare(b.data) || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER));
    }
  }

  linhas = linhas.filter((x) => passaAba(f.aba, x) && passaSituacao(x.situacao, f.situacao));
  if (avancados.length) linhas = filtrarAvancado(linhas, avancados, CAMPOS_LANCAMENTOS_BASE, LEITORES_LANCAMENTOS);

  const receitas = linhas.filter((x) => x.valorCentavos > 0).reduce((s, x) => s + x.valorCentavos, 0);
  const despesas = linhas.filter((x) => x.valorCentavos < 0).reduce((s, x) => s - x.valorCentavos, 0);

  // Saldos: só das contas (cartão não tem saldo).
  let saldoAnterior: number | null = null;
  let saldoAtual: number | null = null;
  let saldoPrevisto: number | null = null;
  const contas = await contasDoSaldo(f.destino);
  if (contas !== null) {
    const naConta = contas.length ? inArray(l.contaId, contas) : sql`false`;
    // Compras de cartão ainda não pagas entram no previsto (pelas faturas), uma vez só.
    const cartoesDaConta =
      contaFiltro !== null
        ? sql`${l.cartaoId} in (select ${cartao.id} from ${cartao} where ${cartao.contaPagamentoId} = ${contaFiltro})`
        : isNotNull(l.cartaoId);
    const [anterior] = await db
      .select({
        contas: sql<number>`coalesce(sum(${valorComSinalSql}) filter (where ${naConta}), 0)`,
        cartoes: sql<number>`coalesce(sum(${valorComSinalSql}) filter (where ${and(cartoesDaConta, isNull(l.dataPagamento))}), 0)`,
      })
      .from(l)
      .where(lt(l.dataVencimento, mes.inicio));
    const [atual] = await db
      .select({ total: sql<number>`coalesce(sum(${valorRealizadoSql}), 0)` })
      .from(l)
      .where(and(naConta, isNotNull(l.dataPagamento), lte(l.dataPagamento, mes.fim)));
    // Previsto do mês: tudo do mês no escopo, sem os filtros de aba e situação.
    const [doMes] = await db
      .select({
        contas: sql<number>`coalesce(sum(${valorComSinalSql}) filter (where ${naConta}), 0)`,
        cartoes: sql<number>`coalesce(sum(${valorComSinalSql}) filter (where ${and(cartoesDaConta, isNull(l.dataPagamento))}), 0)`,
      })
      .from(l)
      .where(and(gte(l.dataVencimento, mes.inicio), lte(l.dataVencimento, mes.fim)));
    // Recorrentes previstos entram no Saldo Anterior e no Saldo Previsto (nunca no Saldo Atual).
    const contasSet = new Set(contas);
    const entraNoSaldo = (p: Perna) =>
      p.contaId !== null ? contasSet.has(p.contaId) : contaFiltro === null || ctx.cartoes.get(p.cartaoId!)?.contaPagamentoId === contaFiltro;
    const somaPrevistos = (lista: Pendente[]) => lista.reduce((s, x) => s + x.pernas.filter(entraNoSaldo).reduce((t, p) => t + p.valorComSinal, 0), 0);
    saldoAnterior = Number(anterior.contas) + Number(anterior.cartoes) + somaPrevistos(pendentes(ctx, somarDias(mes.inicio, -1)));
    saldoPrevisto = saldoAnterior + Number(doMes.contas) + Number(doMes.cartoes) + somaPrevistos(pendMes);
    saldoAtual = Number(atual.total);
  }

  return { linhas, resumo: { receitas, despesas, total: receitas - despesas, saldoAnterior, saldoPrevisto, saldoAtual } };
}

type Arvore = Map<number, ReturnType<typeof montarArvore>[number]>;

/** Linhas das ocorrências previstas, com os mesmos filtros da lista. */
async function linhasPrevistas(
  lista: Pendente[],
  f: Filtros,
  o: { cartaoFiltro: number | null; contaFiltro: number | null; ctx: Contexto; arvore: Arvore; hoje: string },
): Promise<LinhaLista[]> {
  const db = getDb();
  const [contas, cartoes, formas, contatos, tags] = await Promise.all([
    db.select({ id: conta.id, nome: conta.descricao, bancoCodigo: banco.codigo, bancoNome: banco.nome }).from(conta).leftJoin(banco, eq(banco.id, conta.bancoId)),
    db.select({ id: cartao.id, nome: cartao.descricao, bancoCodigo: banco.codigo, bancoNome: banco.nome }).from(cartao).leftJoin(banco, eq(banco.id, cartao.bancoId)),
    db.select({ id: forma.id, nome: forma.descricao }).from(forma),
    db.select({ id: contato.id, nome: contato.nome }).from(contato),
    db.select({ id: tag.id, nome: tag.descricao }).from(tag),
  ]);
  const porId = <T extends { id: number }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const [mContas, mCartoes, mFormas, mContatos, mTags] = [porId(contas), porId(cartoes), porId(formas), porId(contatos), porId(tags)];

  let categorias: Set<number> | null = null;
  if (f.categoria) {
    const todas = [...o.arvore.values()].map((c) => ({ id: c.id, categoriaPaiId: c.categoriaPaiId }));
    categorias = new Set([Number(f.categoria), ...descendentes(todas, Number(f.categoria))]);
  }
  const busca = semAcento(f.busca).toLowerCase();
  const centavos = f.busca ? lerValorEmCentavos(f.busca) : null;

  const linhas: LinhaLista[] = [];
  for (const p of lista) {
    const g = p.regra;
    if (busca && !semAcento(p.descricao).toLowerCase().includes(busca) && (centavos === null || Math.abs(centavos) !== p.valorCentavos)) continue;
    if (categorias && !(g.categoriaId && categorias.has(g.categoriaId)) && !g.itens.some((i) => categorias!.has(i.categoriaId))) continue;
    if (f.forma && g.formaPagamentoId !== Number(f.forma)) continue;
    if (f.contato && g.contatoId !== Number(f.contato)) continue;
    if (f.tag && !g.tagIds.includes(Number(f.tag))) continue;
    const cat = g.categoriaId && g.formato !== "transferencia" ? o.arvore.get(g.categoriaId) : undefined;
    for (const perna of p.pernas) {
      if (o.cartaoFiltro !== null && perna.cartaoId !== o.cartaoFiltro) continue;
      if (o.contaFiltro !== null && perna.contaId !== o.contaFiltro && !(perna.cartaoId && o.ctx.cartoes.get(perna.cartaoId)?.contaPagamentoId === o.contaFiltro)) continue;
      const lugar = perna.contaId ? mContas.get(perna.contaId) : mCartoes.get(perna.cartaoId!);
      linhas.push({
        chave: `p${g.id}-${p.data}-${perna.tipo}`,
        id: null,
        faturaId: null,
        faturaSituacao: null,
        tipo: perna.tipo,
        formato: g.formato === "detalhado" ? "detalhado" : "simples",
        descricao: p.descricao,
        valorCentavos: perna.valorComSinal,
        data: perna.dataVencimento,
        dataPagamento: null,
        dataCompra: perna.dataCompra,
        dataReferencia: null,
        documento: null,
        valorPagoCentavos: null,
        situacao: situacaoDe(perna.dataVencimento, null, o.hoje),
        contaOuCartao: lugar?.nome ?? "",
        bancoCodigo: lugar?.bancoCodigo ?? null,
        bancoNome: lugar?.bancoNome ?? null,
        eCartao: perna.cartaoId !== null,
        cartaoId: perna.cartaoId,
        categoria: cat ? rotuloCategoria(cat) : null,
        categoriaCor: cat?.corEfetiva ?? null,
        contato: g.contatoId ? (mContatos.get(g.contatoId)?.nome ?? null) : null,
        forma: g.formaPagamentoId ? (mFormas.get(g.formaPagamentoId)?.nome ?? null) : null,
        tags: g.tagIds.map((t) => mTags.get(t)?.nome ?? "").filter(Boolean).sort(),
        parcela: null,
        parcelamentoId: null,
        transferenciaId: null,
        recorrenciaId: g.id,
        previsto: { recorrenciaId: g.id, data: p.data },
        realizarAutomaticamente: g.realizarAutomaticamente,
        observacao: !!g.observacao,
        anexos: 0,
        itens: g.itens.map((i) => {
          const c = o.arvore.get(i.categoriaId);
          return { id: i.id, tipo: i.tipo, descricao: i.descricao, valorCentavos: i.tipo === "receita" ? i.valorCentavos : -i.valorCentavos, categoria: c ? rotuloCategoria(c) : "", categoriaCor: c?.corEfetiva ?? "#9CA3AF" };
        }),
        compras: [],
      });
    }
  }
  return linhas;
}

/** Saldo atual de cada conta (só o que já foi pago ou recebido até hoje). */
export async function saldosDasContas(hoje = hojeIso()): Promise<Map<number, number>> {
  const linhas = await getDb()
    .select({ contaId: l.contaId, total: sql<number>`coalesce(sum(${valorRealizadoSql}), 0)` })
    .from(l)
    .where(and(isNotNull(l.contaId), isNotNull(l.dataPagamento), lte(l.dataPagamento, hoje)))
    .groupBy(l.contaId);
  return new Map(linhas.map((x) => [x.contaId!, Number(x.total)]));
}

/** Opções dos campos do formulário e dos filtros. */
export async function carregarOpcoes(): Promise<Opcoes> {
  const db = getDb();
  const [contas, cartoes, categorias, formas, contatos, tags] = await Promise.all([
    db
      .select({ id: conta.id, descricao: conta.descricao, ativo: conta.ativo, bancoCodigo: banco.codigo, bancoNome: banco.nome })
      .from(conta)
      .leftJoin(banco, eq(banco.id, conta.bancoId))
      .orderBy(asc(conta.ordem), asc(conta.descricao)),
    db
      .select({ id: cartao.id, descricao: cartao.descricao, ativo: cartao.ativo, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento, bancoCodigo: banco.codigo, bancoNome: banco.nome })
      .from(cartao)
      .leftJoin(banco, eq(banco.id, cartao.bancoId))
      .orderBy(asc(cartao.ordem), asc(cartao.descricao)),
    db
      .select({ id: categoria.id, nome: categoria.nome, categoriaPaiId: categoria.categoriaPaiId, ordem: categoria.ordem, cor: categoria.cor, natureza: categoria.natureza, especial: categoria.especial, ativo: categoria.ativo, padraoSistema: categoria.padraoSistema })
      .from(categoria),
    db.select({ id: forma.id, rotulo: forma.descricao, ativo: forma.ativo }).from(forma).orderBy(asc(forma.descricao)),
    db.select({ id: contato.id, rotulo: contato.nome, ativo: contato.ativo }).from(contato).orderBy(asc(sql`lower(${contato.nome})`)),
    db.select({ id: tag.id, rotulo: tag.descricao, ativo: tag.ativo }).from(tag).orderBy(asc(sql`lower(${tag.descricao})`)),
  ]);
  return {
    destinos: [
      ...contas.map((c) => ({ valor: `conta:${c.id}`, rotulo: c.descricao, grupo: "Contas" as const, bancoCodigo: c.bancoCodigo, bancoNome: c.bancoNome, ativo: c.ativo })),
      ...cartoes.map((c) => ({ valor: `cartao:${c.id}`, rotulo: c.descricao, grupo: "Cartões" as const, bancoCodigo: c.bancoCodigo, bancoNome: c.bancoNome, ativo: c.ativo })),
    ],
    cartoes: cartoes.map((c) => ({ id: c.id, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento })),
    categorias: montarArvore(categorias)
      .filter((c) => !c.especial)
      .map((c) => ({ id: c.id, rotulo: rotuloCategoria(c), cor: c.corEfetiva, natureza: c.natureza, nivel: c.nivel, ativo: c.ativo })),
    formas,
    contatos,
    tags,
  };
}

export { valorComSinal };
