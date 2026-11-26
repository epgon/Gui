import "server-only";
import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { parametro, semAcento, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { listarFaturas } from "@/lib/cartoes/servidor";
import { hojeIso } from "@/lib/datas";
import { situacaoDe } from "@/lib/lancamentos/regras";
import { lerParametros } from "@/lib/parametros/servidor";
import { SITUACOES_ABERTAS_NEGOCIACAO, podeDesfazerRenegociacao } from "./negociacao";
import {
  diasEntre,
  estimarAtraso,
  percentualPago,
  resumirSaldo,
  situacaoDaDivida,
  taxaMensalParaAnual,
  valorPresente,
  type ConfigAtraso,
  type FormaDivida,
  type Obrigacao,
  type SaldoInformado,
  type TipoDivida,
} from "./regras";
import type { ContaEmAberto, DetalheDivida, EventoLinha, FiltrosDividas, LinhaDivida, LinhaObrigacao, ResumoDividas, VinculoLinha } from "./tipos";

const { divida, dividaVinculo, dividaEvento, dividaRenegociacao, negociacao, negociacaoDivida, lancamento: l, contato, fatura, cartaoCredito: cartao, recorrencia, parcelamento, categoria } = schema;

const numero = (v: string | null) => (v === null ? null : Number(v));

type Parametrizacao = { multaPadraoPct: number; moraMensalPct: number };

const configDe = (d: { multaPercentual: string | null; moraMensal: string | null; taxaMensal: string | null }, p: Parametrizacao): ConfigAtraso => ({
  multaPct: numero(d.multaPercentual) ?? p.multaPadraoPct,
  moraMensalPct: numero(d.moraMensal) ?? p.moraMensalPct,
  taxaMensalPct: numero(d.taxaMensal) ?? 0,
});

/** Tudo de que as contas das dívidas precisam, lido do banco de uma vez. */
async function lerBase(ids: number[] | null, hoje: string) {
  const db = getDb();
  const parametros = (await lerParametros()).dividas;
  const dividas = await db
    .select({
      d: divida,
      credor: contato.nome,
      parcelamentoQuantidade: parcelamento.quantidade,
      parcelamentoInicio: parcelamento.iniciarNaParcela,
    })
    .from(divida)
    .innerJoin(contato, eq(contato.id, divida.contatoId))
    .leftJoin(parcelamento, eq(parcelamento.id, divida.parcelamentoId))
    .where(ids ? inArray(divida.id, ids) : undefined)
    .orderBy(asc(divida.id));
  const idsDividas = dividas.map((x) => x.d.id);
  if (!idsDividas.length) return { parametros, dividas, lancamentos: [], eventos: [], vinculos: [], faturas: [], renegociacoes: [], emNegociacao: new Set<number>(), hoje };

  const [renegociacoes, naoFechadas] = await Promise.all([
    db.select().from(dividaRenegociacao).where(or(inArray(dividaRenegociacao.acordoId, idsDividas), inArray(dividaRenegociacao.originalId, idsDividas))),
    db
      .select({ dividaId: negociacaoDivida.dividaId })
      .from(negociacaoDivida)
      .innerJoin(negociacao, eq(negociacao.id, negociacaoDivida.negociacaoId))
      .where(and(inArray(negociacaoDivida.dividaId, idsDividas), inArray(negociacao.situacao, SITUACOES_ABERTAS_NEGOCIACAO))),
  ]);
  const emNegociacao = new Set(naoFechadas.map((x) => x.dividaId));

  const vinculos = await db.select().from(dividaVinculo).where(inArray(dividaVinculo.dividaId, idsDividas));
  const idsFaturas = vinculos.map((v) => v.faturaId).filter((x): x is number => x !== null);
  const idsRecorrencias = vinculos.map((v) => v.recorrenciaId).filter((x): x is number => x !== null);

  const [lancamentos, eventos, faturas] = await Promise.all([
    db
      .select({
        id: l.id,
        dividaId: l.dividaId,
        recorrenciaId: l.recorrenciaId,
        descricao: l.descricao,
        valorCentavos: l.valorCentavos,
        valorOriginalCentavos: l.valorOriginalCentavos,
        dataVencimento: l.dataVencimento,
        dataPagamento: l.dataPagamento,
        parcelaNumero: l.parcelaNumero,
        parcelaTotal: l.parcelaTotal,
        parcelamentoId: l.parcelamentoId,
        origemId: l.lancamentoOrigemId,
        origem: l.origem,
        cartaoId: l.cartaoId,
        atualizadoEm: l.atualizadoEm,
      })
      .from(l)
      .where(and(eq(l.tipo, "despesa"), or(inArray(l.dividaId, idsDividas), idsRecorrencias.length ? inArray(l.recorrenciaId, idsRecorrencias) : undefined)))
      .orderBy(asc(l.dataVencimento), asc(l.id)),
    db.select().from(dividaEvento).where(inArray(dividaEvento.dividaId, idsDividas)).orderBy(asc(dividaEvento.data), asc(dividaEvento.id)),
    idsFaturas.length ? listarFaturas(inArray(fatura.id, idsFaturas), hoje) : Promise.resolve([]),
  ]);
  return { parametros, dividas, lancamentos, eventos, vinculos, faturas, renegociacoes, emNegociacao, hoje };
}
type Base = Awaited<ReturnType<typeof lerBase>>;

/** Os lançamentos e faturas de uma dívida, no formato das contas (Obrigacao) e da tela (LinhaObrigacao). */
function obrigacoesDe(base: Base, d: Base["dividas"][number]) {
  const { hoje } = base;
  const cfg = configDe(d.d, base.parametros);
  const idRecorrencias = new Set(base.vinculos.filter((v) => v.dividaId === d.d.id && v.recorrenciaId !== null).map((v) => v.recorrenciaId));
  const ajustadas = new Set<number>();
  for (const e of base.eventos) {
    if (e.dividaId === d.d.id && e.tipo === "amortizacao" && e.dados && typeof e.dados === "object" && "ajustes" in e.dados) {
      for (const a of (e.dados as { ajustes: { id: number }[] }).ajustes) ajustadas.add(a.id);
    }
  }
  const encargos = new Set<number>();
  for (const e of base.eventos) if (e.dividaId === d.d.id && e.tipo === "encargo" && e.lancamentoId) encargos.add(e.lancamentoId);

  const contas: { o: Obrigacao; linha: LinhaObrigacao }[] = [];
  for (const x of base.lancamentos) {
    if (x.dividaId !== d.d.id && !(x.recorrenciaId !== null && idRecorrencias.has(x.recorrenciaId))) continue;
    const valor = Math.abs(Number(x.valorCentavos));
    const estimativa = estimarAtraso(valor, x.dataVencimento, hoje, cfg);
    const aberta = !x.dataPagamento;
    contas.push({
      o: { id: x.id, valorCentavos: valor, vencimento: x.dataVencimento, dataPagamento: x.dataPagamento, registradoEm: x.atualizadoEm.getTime(), deSistema: x.origem === "sistema" },
      linha: {
        chave: `l${x.id}`,
        origem: "lancamento",
        id: x.id,
        descricao: x.descricao,
        vencimento: x.dataVencimento,
        dataPagamento: x.dataPagamento,
        valorCentavos: valor,
        valorOriginalCentavos: x.valorOriginalCentavos === null ? null : Math.abs(Number(x.valorOriginalCentavos)),
        parcela: x.parcelaNumero && x.parcelaTotal ? `${x.parcelaNumero}/${x.parcelaTotal}` : null,
        restante: x.origemId !== null,
        encargo: encargos.has(x.id),
        ajustada: ajustadas.has(x.id),
        situacao: situacaoDe(x.dataVencimento, x.dataPagamento, hoje),
        atrasoDias: aberta ? estimativa.dias : 0,
        acrescimoCentavos: aberta ? estimativa.acrescimoCentavos : 0,
        podePagarAqui: aberta && x.cartaoId === null,
      },
    });
  }
  const idsFaturas = new Set(base.vinculos.filter((v) => v.dividaId === d.d.id && v.faturaId !== null).map((v) => v.faturaId));
  for (const f of base.faturas) {
    if (!idsFaturas.has(f.id)) continue;
    const aberta = f.pendenteCentavos > 0;
    const valor = aberta ? f.pendenteCentavos : f.totalCentavos;
    const estimativa = estimarAtraso(valor, f.dataVencimento, hoje, cfg);
    contas.push({
      o: { id: -f.id, valorCentavos: valor, vencimento: f.dataVencimento, dataPagamento: aberta ? null : (f.ultimoPagamento ?? f.dataVencimento), registradoEm: 0, deSistema: false },
      linha: {
        chave: `f${f.id}`,
        origem: "fatura",
        id: f.id,
        descricao: `Fatura ${f.rotulo}`,
        vencimento: f.dataVencimento,
        dataPagamento: aberta ? null : (f.ultimoPagamento ?? f.dataVencimento),
        valorCentavos: valor,
        valorOriginalCentavos: null,
        parcela: null,
        restante: false,
        encargo: false,
        ajustada: false,
        situacao: situacaoDe(f.dataVencimento, aberta ? null : (f.ultimoPagamento ?? f.dataVencimento), hoje),
        atrasoDias: aberta ? estimativa.dias : 0,
        acrescimoCentavos: aberta ? estimativa.acrescimoCentavos : 0,
        podePagarAqui: false,
      },
    });
  }
  contas.sort((a, b) => (a.o.vencimento === b.o.vencimento ? a.o.id - b.o.id : a.o.vencimento < b.o.vencimento ? -1 : 1));
  return { cfg, contas };
}

function montarLinha(base: Base, d: Base["dividas"][number]): { linha: LinhaDivida; contas: ReturnType<typeof obrigacoesDe>["contas"]; cfg: ConfigAtraso; informado: SaldoInformado | null } {
  const { hoje } = base;
  const { cfg, contas } = obrigacoesDe(base, d);
  const obrigacoes = contas.map((c) => c.o);
  const eventos = base.eventos.filter((e) => e.dividaId === d.d.id);
  const ultimo = [...eventos].filter((e) => e.tipo === "atualizacao_saldo" && e.saldoCentavos !== null).sort((a, b) => (a.data === b.data ? a.id - b.id : a.data < b.data ? -1 : 1)).pop();
  const informado: SaldoInformado | null = ultimo ? { saldoCentavos: Number(ultimo.saldoCentavos), data: ultimo.data, registradoEm: ultimo.criadoEm.getTime() } : null;
  const forma = d.d.forma as FormaDivida;
  const saldo = resumirSaldo({ forma, obrigacoes, informado, hoje, atraso: cfg });
  const sit = situacaoDaDivida({ situacao: d.d.situacao, forma, obrigacoes, saldoCentavos: saldo.exibido, hoje, emNegociacao: base.emNegociacao.has(d.d.id) });
  const abertas = obrigacoes.filter((o) => !o.dataPagamento);
  const anterior = eventos.filter((e) => e.tipo === "pagamento" && e.lancamentoId === null).reduce((s, e) => s + Number(e.valorCentavos ?? 0), 0);
  const pagoCentavos = obrigacoes.filter((o) => o.dataPagamento).reduce((s, o) => s + o.valorCentavos, 0) + anterior;

  // Parcelas: as do parcelamento da dívida (e os restantes de pagamentos parciais), mais as pagas antes do cadastro.
  const deParcela = contas.filter((c) => c.linha.origem === "lancamento" && !c.linha.encargo && (c.linha.parcela !== null || c.linha.restante));
  const pagasAntes = d.parcelamentoInicio ? d.parcelamentoInicio - 1 : 0;
  const pagas = deParcela.filter((c) => c.o.dataPagamento && !c.linha.restante).length + pagasAntes;
  const total = pagas + deParcela.filter((c) => !c.o.dataPagamento).length;
  return {
    linha: {
      id: d.d.id,
      descricao: d.d.descricao,
      contatoId: d.d.contatoId,
      credor: d.credor,
      tipo: d.d.tipo as TipoDivida,
      forma,
      situacao: sit.situacao,
      situacaoGravada: d.d.situacao,
      acordoId: base.renegociacoes.find((r) => r.originalId === d.d.id)?.acordoId ?? null,
      originaisIds: base.renegociacoes.filter((r) => r.acordoId === d.d.id).map((r) => r.originalId),
      diasAtraso: sit.diasAtraso,
      parcelasAtrasadas: sit.parcelasAtrasadas,
      taxaMensal: numero(d.d.taxaMensal),
      multaPercentual: numero(d.d.multaPercentual),
      moraMensal: numero(d.d.moraMensal),
      garantia: d.d.garantia,
      contaId: d.d.contaId,
      categoriaId: d.d.categoriaId,
      formaPagamentoId: d.d.formaPagamentoId,
      valorOriginalCentavos: d.d.valorOriginalCentavos === null ? null : Number(d.d.valorOriginalCentavos),
      dataContratacao: d.d.dataContratacao,
      observacao: d.d.observacao,
      proximoVencimento: abertas.length ? abertas[0].vencimento : null,
      parcelasPagas: pagas,
      parcelasTotal: forma === "parcelas_fixas" ? total : 0,
      saldo,
      pagoCentavos,
      progresso: percentualPago(pagoCentavos, saldo.exibido),
      criadoEm: d.d.criadoEm,
      atualizadoEm: d.d.atualizadoEm,
    },
    contas,
    cfg,
    informado,
  };
}

/** Todas as dívidas com saldo e situação calculados na hora. */
export async function carregarTodasDividas(hoje = hojeIso()): Promise<LinhaDivida[]> {
  const base = await lerBase(null, hoje);
  return base.dividas.map((d) => montarLinha(base, d).linha);
}

const ESTA_ABERTA = new Set(["em_dia", "em_atraso", "em_negociacao"]);

/** Os números do topo (Visão Geral do módulo e faixa de totais da lista). */
export function resumirDividas(linhas: LinhaDivida[], contas: Map<number, { vencimento: string; valor: number; aberta: boolean }[]>, hoje: string): ResumoDividas {
  const ativas = linhas.filter((x) => ESTA_ABERTA.has(x.situacao));
  const todas = [...contas.entries()].filter(([id]) => ativas.some((a) => a.id === id)).flatMap(([, v]) => v).filter((o) => o.aberta);
  const vencidas = todas.filter((o) => o.vencimento < hoje);
  const em30 = todas.filter((o) => o.vencimento >= hoje && diasEntre(hoje, o.vencimento) <= 30);
  const total = ativas.reduce((s, x) => s + x.saldo.exibido, 0);
  const pago = ativas.reduce((s, x) => s + x.pagoCentavos, 0);
  return {
    totalDevidoCentavos: total,
    estimado: ativas.some((x) => x.saldo.origem !== "parcelas"),
    atrasoCentavos: vencidas.reduce((s, o) => s + o.valor, 0),
    atrasoParcelas: vencidas.length,
    atrasoMaisAntigaDias: vencidas.length ? Math.max(...vencidas.map((o) => diasEntre(o.vencimento, hoje))) : 0,
    vence30Centavos: em30.reduce((s, o) => s + o.valor, 0),
    vence30Parcelas: em30.length,
    dividasAtivas: ativas.length,
    pagoCentavos: pago,
    progresso: percentualPago(pago, total),
  };
}

export type DadosListaDividas = {
  linhas: LinhaDivida[];
  todas: LinhaDivida[];
  resumo: ResumoDividas;
  totalDevidoLista: number;
  credores: { id: number; nome: string }[];
};

export function lerFiltrosDividas(sp: ParametrosBusca): FiltrosDividas {
  const pagina = Math.max(1, Math.floor(Number(parametro(sp, "pagina")) || 1));
  return { busca: parametro(sp, "busca").slice(0, 100), credor: parametro(sp, "credor"), tipo: parametro(sp, "tipo"), situacao: parametro(sp, "situacao"), conta: parametro(sp, "conta"), pagina };
}

/** Aplica os filtros do painel (em memória: são poucas dívidas). */
export function filtrarDividas(linhas: LinhaDivida[], f: FiltrosDividas): LinhaDivida[] {
  const termo = semAcento(f.busca).toLowerCase();
  return linhas.filter((x) => {
    if (termo && !semAcento(`${x.descricao} ${x.credor}`).toLowerCase().includes(termo)) return false;
    if (f.credor && String(x.contatoId) !== f.credor) return false;
    if (f.tipo && x.tipo !== f.tipo) return false;
    // "Em atraso" também mostra a dívida em negociação que tem parcela vencida (é o que o indicador da Visão Geral conta).
    if (f.situacao === "em_atraso" ? !(x.situacao === "em_atraso" || (x.situacao === "em_negociacao" && x.diasAtraso > 0)) : f.situacao && x.situacao !== f.situacao) return false;
    if (f.conta && String(x.contaId ?? "") !== f.conta) return false;
    return true;
  });
}

/** Ordem da lista: em atraso primeiro, depois pelo próximo vencimento; encerradas por último. */
export function ordenarDividas(linhas: LinhaDivida[]): LinhaDivida[] {
  const peso = (x: LinhaDivida) => (x.situacao === "em_atraso" || (x.situacao === "em_negociacao" && x.diasAtraso > 0) ? 0 : x.situacao === "em_dia" || x.situacao === "em_negociacao" ? 1 : 2);
  return [...linhas].sort((a, b) => peso(a) - peso(b) || (a.proximoVencimento ?? "9999").localeCompare(b.proximoVencimento ?? "9999") || a.descricao.localeCompare(b.descricao, "pt-BR"));
}

export async function carregarListaDividas(f: FiltrosDividas, hoje = hojeIso()): Promise<DadosListaDividas> {
  const base = await lerBase(null, hoje);
  const montadas = base.dividas.map((d) => montarLinha(base, d));
  const todas = montadas.map((m) => m.linha);
  const mapa = new Map(montadas.map((m) => [m.linha.id, m.contas.map((c) => ({ vencimento: c.o.vencimento, valor: c.o.valorCentavos, aberta: !c.o.dataPagamento }))]));
  const linhas = ordenarDividas(filtrarDividas(todas, f));
  const credores = [...new Map(todas.map((x) => [x.contatoId, x.credor])).entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return {
    linhas,
    todas,
    resumo: resumirDividas(todas, mapa, hoje),
    totalDevidoLista: linhas.filter((x) => ESTA_ABERTA.has(x.situacao)).reduce((s, x) => s + x.saldo.exibido, 0),
    credores,
  };
}

/** Só o resumo (Visão Geral do módulo). */
export async function carregarResumoDividas(hoje = hojeIso()): Promise<{ resumo: ResumoDividas; linhas: LinhaDivida[] }> {
  const base = await lerBase(null, hoje);
  const montadas = base.dividas.map((d) => montarLinha(base, d));
  const todas = montadas.map((m) => m.linha);
  const mapa = new Map(montadas.map((m) => [m.linha.id, m.contas.map((c) => ({ vencimento: c.o.vencimento, valor: c.o.valorCentavos, aberta: !c.o.dataPagamento }))]));
  return { resumo: resumirDividas(todas, mapa, hoje), linhas: ordenarDividas(todas) };
}

const ROTULO_EVENTO: Record<string, string> = {
  cadastro: "Cadastro",
  pagamento: "Pagamento",
  atualizacao_saldo: "Saldo atualizado",
  amortizacao: "Amortização",
  encargo: "Encargo",
  renegociacao: "Renegociação",
  quitacao: "Quitação",
  vinculo: "Vínculo",
  anotacao: "Anotação",
  cancelamento: "Cancelamento",
  desfeito: "Desfeito",
};
export const rotuloEvento = (tipo: string) => ROTULO_EVENTO[tipo] ?? tipo;

/** Tudo de uma dívida para a janela Detalhando Dívida. */
export async function carregarDetalheDivida(id: number, hoje = hojeIso()): Promise<DetalheDivida | null> {
  const base = await lerBase([id], hoje);
  const d = base.dividas[0];
  if (!d) return null;
  const { linha, contas, cfg } = montarLinha(base, d);
  const db = getDb();
  const obrigacoes = contas.map((c) => c.linha);

  const historico: EventoLinha[] = base.eventos
    .filter((e) => e.dividaId === id)
    // O pagamento de parcelas já aparece pelos lançamentos pagos (mesmo quando pago por Lançamentos).
    .filter((e) => !(e.tipo === "pagamento" && e.lancamentoId !== null))
    .map((e) => ({ chave: `e${e.id}`, data: e.data, tipo: e.tipo, descricao: e.descricao, valorCentavos: e.valorCentavos === null ? null : Number(e.valorCentavos), lancamentoId: e.lancamentoId, ordem: e.criadoEm.getTime() }));
  for (const c of contas) {
    if (!c.linha.dataPagamento || c.linha.origem !== "lancamento") continue;
    const dif = c.linha.valorOriginalCentavos !== null && c.linha.valorOriginalCentavos !== c.linha.valorCentavos;
    historico.push({
      chave: `p${c.linha.id}`,
      data: c.linha.dataPagamento,
      tipo: "pagamento",
      descricao: `Pagamento: ${c.linha.descricao}${dif ? (c.linha.valorCentavos > c.linha.valorOriginalCentavos! ? " (com juros)" : " (parcial ou com desconto)") : ""}`,
      valorCentavos: c.linha.valorCentavos,
      lancamentoId: c.linha.id,
      ordem: c.o.registradoEm,
    });
  }
  historico.sort((a, b) => (a.data === b.data ? b.ordem - a.ordem : a.data < b.data ? 1 : -1));

  // Vínculos: faturas, recorrentes e lançamentos acompanhados.
  const vinculos: VinculoLinha[] = [];
  const doBanco = base.vinculos.filter((v) => v.dividaId === id);
  for (const v of doBanco) {
    if (v.faturaId !== null) {
      const f = base.faturas.find((x) => x.id === v.faturaId);
      const [cartaoNome] = f ? await db.select({ nome: cartao.descricao }).from(cartao).where(eq(cartao.id, f.cartaoId)) : [];
      vinculos.push({ chave: `f${v.id}`, tipo: "fatura", id: v.faturaId, rotulo: f ? `Fatura ${cartaoNome?.nome ?? "do cartão"} ${f.rotulo}` : "Fatura", detalhe: "Fatura de cartão acompanhada como dívida", href: f ? `/cadastros/cartoes-de-credito?faturas=${f.cartaoId}` : "/cadastros/cartoes-de-credito" });
    } else if (v.recorrenciaId !== null) {
      const [r] = await db.select({ descricao: recorrencia.descricao }).from(recorrencia).where(eq(recorrencia.id, v.recorrenciaId));
      vinculos.push({ chave: `r${v.id}`, tipo: "recorrencia", id: v.recorrenciaId, rotulo: r?.descricao ?? "Recorrente", detalhe: "Recorrente acompanhado como dívida", href: "/financeiro/recorrentes" });
    }
  }
  const acompanhados = contas.filter((c) => c.linha.origem === "lancamento" && c.linha.parcela === null && !c.linha.restante && !c.linha.encargo && base.lancamentos.find((x) => x.id === c.linha.id)?.dividaId === id && base.lancamentos.find((x) => x.id === c.linha.id)?.origem !== "sistema");
  for (const c of acompanhados) {
    vinculos.push({ chave: `l${c.linha.id}`, tipo: "lancamento", id: c.linha.id, rotulo: c.linha.descricao, detalhe: "Lançamento acompanhado como dívida", href: `/financeiro/lancamentos?mes=${c.linha.vencimento.slice(0, 7)}&busca=${encodeURIComponent(c.linha.descricao)}` });
  }

  // Acordo e dívidas originais (renegociação).
  const nomesDividas = new Map<number, string>();
  const outras = [...new Set(base.renegociacoes.flatMap((r) => [r.acordoId, r.originalId]).filter((x) => x !== id))];
  if (outras.length) for (const o of await db.select({ id: divida.id, descricao: divida.descricao }).from(divida).where(inArray(divida.id, outras))) nomesDividas.set(o.id, o.descricao);
  for (const r of base.renegociacoes) {
    if (r.originalId === id) vinculos.push({ chave: `a${r.acordoId}`, tipo: "divida", id: r.acordoId, rotulo: nomesDividas.get(r.acordoId) ?? `Acordo #${r.acordoId}`, detalhe: "Acordo que substituiu esta dívida", href: `/gestao/dividas/minhas?detalhar=${r.acordoId}` });
    if (r.acordoId === id) vinculos.push({ chave: `o${r.originalId}`, tipo: "divida", id: r.originalId, rotulo: nomesDividas.get(r.originalId) ?? `Dívida #${r.originalId}`, detalhe: "Dívida original, renegociada neste acordo", href: `/gestao/dividas/minhas?detalhar=${r.originalId}` });
  }
  const ehAcordo = base.renegociacoes.some((r) => r.acordoId === id);
  const podeDesfazer = ehAcordo
    ? podeDesfazerRenegociacao({ acordoSituacao: d.d.situacao, lancamentosAcordo: base.lancamentos.filter((x) => x.dividaId === id).map((x) => ({ dataPagamento: x.dataPagamento })) })
    : null;

  // Evolução do saldo: parte do total e desce a cada pagamento.
  const pagas = contas.filter((c) => c.o.dataPagamento).sort((a, b) => (a.o.dataPagamento! < b.o.dataPagamento! ? -1 : 1));
  const totalInicial = contas.reduce((s, c) => s + c.o.valorCentavos, 0);
  let corrente = totalInicial;
  const evolucao: DetalheDivida["evolucao"] = [{ data: (d.d.dataContratacao ?? d.d.criadoEm.toISOString().slice(0, 10)), saldoCentavos: totalInicial }];
  for (const c of pagas) {
    corrente -= c.o.valorCentavos;
    evolucao.push({ data: c.o.dataPagamento!, saldoCentavos: Math.max(0, corrente) });
  }

  const jurosPagosCentavos = obrigacoes.filter((o) => o.dataPagamento && o.valorOriginalCentavos !== null && o.valorCentavos > o.valorOriginalCentavos).reduce((s, o) => s + o.valorCentavos - o.valorOriginalCentavos!, 0);
  const abertas = obrigacoes.filter((o) => !o.dataPagamento);
  return {
    divida: linha,
    obrigacoes,
    historico,
    vinculos,
    jurosPagosCentavos,
    previsaoTermino: abertas.length ? abertas[abertas.length - 1].vencimento : null,
    evolucao: evolucao.length > 24 ? evolucao.slice(-24) : evolucao,
    taxaAnual: linha.taxaMensal ? taxaMensalParaAnual(linha.taxaMensal) : null,
    desfazerRenegociacao: podeDesfazer ? { pode: podeDesfazer.ok, motivo: podeDesfazer.ok ? null : podeDesfazer.motivo } : null,
    valorPresenteCentavos: linha.taxaMensal && linha.forma === "parcelas_fixas" ? valorPresente(contas.map((c) => c.o), hoje, cfg.taxaMensalPct) : null,
  };
}

/** Contas em aberto no Gui que ainda não são dívida: faturas fechadas, despesas vencidas e (opcional) recorrentes. */
export async function carregarContasEmAberto(hoje = hojeIso()): Promise<{ contas: ContaEmAberto[]; recorrentes: ContaEmAberto[] }> {
  const db = getDb();
  const [vinculos, lancamentos, recs] = await Promise.all([
    db.select({ faturaId: dividaVinculo.faturaId, recorrenciaId: dividaVinculo.recorrenciaId }).from(dividaVinculo),
    db
      .select({ id: l.id, descricao: l.descricao, valor: l.valorCentavos, vencimento: l.dataVencimento, contaNome: schema.contaFinanceira.descricao })
      .from(l)
      .innerJoin(schema.contaFinanceira, eq(schema.contaFinanceira.id, l.contaId))
      .where(and(eq(l.tipo, "despesa"), isNull(l.dataPagamento), isNull(l.dividaId), isNull(l.cartaoId), isNull(l.transferenciaId), lt(l.dataVencimento, hoje)))
      .orderBy(asc(l.dataVencimento), asc(l.id)),
    db
      .select({ id: recorrencia.id, descricao: recorrencia.descricao, valor: recorrencia.valorCentavos, dia: recorrencia.diaFixo })
      .from(recorrencia)
      .where(and(eq(recorrencia.ativo, true), eq(recorrencia.formato, "simples"), eq(recorrencia.tipo, "despesa"), isNull(recorrencia.contaDestinoId)))
      .orderBy(asc(sql`lower(${recorrencia.descricao})`)),
  ]);
  const faturasLigadas = new Set(vinculos.map((v) => v.faturaId).filter((x): x is number => x !== null));
  const recLigadas = new Set(vinculos.map((v) => v.recorrenciaId).filter((x): x is number => x !== null));

  const faturasFechadas = (await listarFaturas(ne(fatura.situacao, "paga"), hoje)).filter((f) => f.situacao === "fechada" && f.pendenteCentavos > 0 && !faturasLigadas.has(f.id));
  const nomesCartoes = new Map((await db.select({ id: cartao.id, nome: cartao.descricao }).from(cartao)).map((c) => [c.id, c.nome]));

  const contas: ContaEmAberto[] = [
    ...faturasFechadas.map((f) => ({
      chave: `f${f.id}`,
      origem: "fatura" as const,
      id: f.id,
      descricao: `Fatura ${nomesCartoes.get(f.cartaoId) ?? "do cartão"}`,
      rotuloOrigem: `Fatura-Cartão ${nomesCartoes.get(f.cartaoId) ?? ""} ${f.rotulo}`.replace(/\s+/g, " "),
      vencimento: f.dataVencimento,
      valorCentavos: f.pendenteCentavos,
      atrasoDias: Math.max(0, diasEntre(f.dataVencimento, hoje)),
      href: `/cadastros/cartoes-de-credito?faturas=${f.cartaoId}`,
    })),
    ...lancamentos.map((x) => ({
      chave: `l${x.id}`,
      origem: "lancamento" as const,
      id: x.id,
      descricao: x.descricao,
      rotuloOrigem: `Lançamento: ${x.descricao}`,
      vencimento: x.vencimento,
      valorCentavos: Math.abs(Number(x.valor)),
      atrasoDias: Math.max(0, diasEntre(x.vencimento, hoje)),
      href: `/financeiro/lancamentos?mes=${x.vencimento.slice(0, 7)}&busca=${encodeURIComponent(x.descricao)}`,
    })),
  ].sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""));
  const recorrentes: ContaEmAberto[] = recs
    .filter((r) => !recLigadas.has(r.id))
    .map((r) => ({
      chave: `r${r.id}`,
      origem: "recorrente" as const,
      id: r.id,
      descricao: r.descricao,
      rotuloOrigem: `Recorrente: ${r.descricao}`,
      vencimento: null,
      valorCentavos: Math.abs(Number(r.valor)),
      atrasoDias: 0,
      href: "/financeiro/recorrentes",
    }));
  return { contas, recorrentes };
}

/** Categorias padrão do módulo ("Parcelas de Dívidas" e "Juros e Encargos"), se existirem. */
export async function categoriasDeDividas(): Promise<{ parcelas: number | null; encargos: number | null }> {
  const db = getDb();
  const [raiz] = await db.select({ id: categoria.id }).from(categoria).where(and(eq(categoria.nome, "Dívidas"), isNull(categoria.categoriaPaiId), isNull(categoria.especial)));
  if (!raiz) return { parcelas: null, encargos: null };
  const filhas = await db.select({ id: categoria.id, nome: categoria.nome }).from(categoria).where(eq(categoria.categoriaPaiId, raiz.id));
  return { parcelas: filhas.find((c) => c.nome === "Parcelas de Dívidas")?.id ?? null, encargos: filhas.find((c) => c.nome === "Juros e Encargos")?.id ?? null };
}
