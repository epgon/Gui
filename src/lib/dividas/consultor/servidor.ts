import "server-only";
import { desc, eq, inArray, ne } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/db";
import { listarFaturas } from "@/lib/cartoes/servidor";
import { hojeIso } from "@/lib/datas";
import { saldosDasContas } from "@/lib/lancamentos/consultas";
import { lerConfiguracoes, lerParametros } from "@/lib/parametros/servidor";
import { negociacaoAberta } from "../negociacao";
import { carregarNegociacoes } from "../negociacoes";
import { evolucaoDoTotalDevido, fatiasDeDividas, jurosEstimadosPorMes, parcelasDoMes, preverQuitacao, type ItemEvolucao } from "../painel";
import { estaAtiva, rotuloTipoDivida } from "../regras";
import { carregarDividasCompletas, ordenarDividas, resumirDividas, type DividaCompleta } from "../servidor";
import { carregarSituacaoFinanceira } from "../simulador-servidor";
import { mesDe, somarMesesYm } from "../simulador";
import type { LinhaDivida, ResumoDividas } from "../tipos";
import type { PropostaAberta, ContextoPerguntas } from "./perguntas";
import {
  CHAVE_ESTADO_ALERTAS,
  LIMITES_PADRAO,
  calcularAlertas,
  classificarPercentualRenda,
  filtrarPorEstado,
  lerEstadoAlertas,
  percentualDaRenda,
  type Alerta,
  type DividaConsultor,
  type EstadoAlertas,
  type FaturaVencida,
  type LimitesConsultor,
} from "./regras";

const { contaFinanceira, cartaoCredito, dividaVinculo, fatura, consultorAssunto, consultorMensagem } = schema;

const SITUACOES_DO_CONSULTOR = new Set(["em_dia", "em_atraso", "em_negociacao", "quitada"]);

const ultimoDiaDoMes = (ym: string) => `${ym}-${String(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;

/** Uma dívida do jeito que as regras do Consultor entendem. */
function paraConsultor(c: DividaCompleta): DividaConsultor | null {
  const l = c.linha;
  if (!SITUACOES_DO_CONSULTOR.has(l.situacao)) return null;
  const vencidas = c.obrigacoes.filter((o) => !o.dataPagamento && o.atrasoDias > 0);
  const abertas = c.obrigacoes.filter((o) => !o.dataPagamento);
  const parcelasPagas = c.obrigacoes.filter((o) => o.dataPagamento && o.origem === "lancamento" && o.parcela !== null && !o.restante).sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  const ultima = parcelasPagas[0];
  return {
    id: l.id,
    descricao: l.descricao,
    credor: l.credor,
    tipo: l.tipo,
    forma: l.forma,
    situacao: l.situacao as DividaConsultor["situacao"],
    taxaMensalPct: l.taxaMensal,
    saldoCentavos: l.saldo.exibido,
    saldoOrigem: l.saldo.origem,
    informadoEm: l.saldo.informadoEm,
    diasAtraso: l.diasAtraso,
    parcelasAtrasadas: l.parcelasAtrasadas,
    atrasoCentavos: vencidas.reduce((s, o) => s + o.valorCentavos, 0),
    acrescimoCentavos: vencidas.reduce((s, o) => s + o.acrescimoCentavos, 0),
    parcelaCentavos: c.sim?.parcelaReferenciaCentavos || (ultima ? (ultima.valorOriginalCentavos ?? ultima.valorCentavos) : 0),
    parcelasAbertas: abertas.length,
    quitadaEm: c.quitadaEm,
    sim: c.sim,
  };
}

export type PainelDividas = {
  hoje: string;
  ctx: ContextoPerguntas;
  limites: LimitesConsultor;
  desligadas: string[];
  estado: EstadoAlertas;
  /** Todos os alertas calculados (sem olhar Dispensar e Lembrar). */
  alertas: Alerta[];
  visiveis: Alerta[];
  escondidos: Alerta[];
  resumo: ResumoDividas;
  /** Todas as dívidas, na ordem da lista. */
  linhas: LinhaDivida[];
  jurosMesCentavos: number;
  parcelasMesCentavos: number;
  percentualRenda: number | null;
  nivelRenda: "ok" | "atencao" | "alta";
  previsao: ReturnType<typeof preverQuitacao>;
  evolucao: { mes: string; totalCentavos: number }[];
  porCredor: ReturnType<typeof fatiasDeDividas>;
  porTipo: ReturnType<typeof fatiasDeDividas>;
  cartaoNaVisaoGeral: boolean;
};

export function limitesDe(p: Awaited<ReturnType<typeof lerParametros>>["dividas"]): LimitesConsultor {
  return {
    ...LIMITES_PADRAO,
    rendaAtencaoPct: p.limiteRendaAtencaoPct,
    rendaAltaPct: p.limiteRendaAltaPct,
    taxaAltaPct: p.limiteTaxaAltaPct,
    rendimentoReservaPct: p.rendimentoReservaPct,
    diasParaNegociar: p.diasParaNegociar,
  };
}

/**
 * Tudo da Visão Geral do módulo e do Consultor Gui, calculado na hora (só leitura): indicadores, alertas e o contexto das perguntas.
 * Usa as mesmas contas do Fluxo de Caixa para a sobra e a reserva (as do Simulador).
 */
export const carregarPainelDividas = cache(async (hoje: string = hojeIso()): Promise<PainelDividas> => {
  const db = getDb();
  const [completas, parametros, config, financeiro, contas, saldos] = await Promise.all([
    carregarDividasCompletas(hoje),
    lerParametros(),
    lerConfiguracoes(),
    carregarSituacaoFinanceira(hoje),
    db.select({ id: contaFinanceira.id, ativo: contaFinanceira.ativo, considerar: contaFinanceira.considerarNosSaldos }).from(contaFinanceira),
    saldosDasContas(hoje),
  ]);
  const limites = limitesDe(parametros.dividas);
  const linhasTodas = completas.map((c) => c.linha);
  const ativas = completas.filter((c) => estaAtiva(c.linha.situacao));
  const dividas = completas.map(paraConsultor).filter((d): d is DividaConsultor => d !== null);

  // Indicadores do topo (os mesmos da lista de Minhas Dívidas).
  const mapa = new Map(completas.map((c) => [c.linha.id, c.obrigacoes.map((o) => ({ vencimento: o.vencimento, valor: o.valorCentavos, aberta: !o.dataPagamento }))]));
  const resumo = resumirDividas(linhasTodas, mapa, hoje);
  const parcelasMes = parcelasDoMes(ativas.flatMap((c) => c.obrigacoes.filter((o) => !o.encargo)), hoje);
  const fimProximoMes = ultimoDiaDoMes(somarMesesYm(mesDe(hoje), 1));
  const parcelasAteProximoMes = ativas.flatMap((c) => c.obrigacoes).filter((o) => !o.dataPagamento && !o.encargo && o.vencimento <= fimProximoMes).reduce((s, o) => s + o.valorCentavos, 0);

  // Renda, sobra e reserva (as do Simulador).
  const { situacao: sit, base } = financeiro;
  const renda = sit.sobraMensalCentavos + sit.despesaMediaCentavos;
  const temHistorico = renda > 0 || sit.despesaMediaCentavos > 0;
  const idsReserva = new Set(base.contasReserva.map((x) => x.id));
  const saldoCaixa = contas.filter((x) => x.ativo && x.considerar && !idsReserva.has(x.id)).reduce((s, x) => s + (saldos.get(x.id) ?? 0), 0);
  const limiteExtra = somarDiasTexto(hoje, -limites.diasExtraRecente);
  const extras = completas.flatMap((c) => c.extras).filter((e) => e.data >= limiteExtra && e.data <= hoje).reduce((s, e) => s + e.valorCentavos, 0);

  // Faturas de cartão vencidas e não pagas, que ainda não são dívida (R13).
  const [faturas, vinculadas, cartoes] = await Promise.all([listarFaturas(ne(fatura.situacao, "paga"), hoje), db.select({ faturaId: dividaVinculo.faturaId }).from(dividaVinculo), db.select({ id: cartaoCredito.id, nome: cartaoCredito.descricao }).from(cartaoCredito)]);
  const jaDivida = new Set(vinculadas.map((v) => v.faturaId).filter((x): x is number => x !== null));
  const nomes = new Map(cartoes.map((x) => [x.id, x.nome]));
  const faturasVencidas: FaturaVencida[] = faturas
    .filter((f) => f.pendenteCentavos > 0 && f.dataVencimento < hoje && !jaDivida.has(f.id))
    .map((f) => ({ cartaoId: f.cartaoId, cartao: nomes.get(f.cartaoId) ?? "cartão", rotulo: f.rotulo, vencimento: f.dataVencimento, valorCentavos: f.pendenteCentavos }));

  // Propostas abertas das negociações em andamento (pergunta "Essa proposta é boa?").
  const negociacoes = (await carregarNegociacoes(null, linhasTodas)).linhas.filter((n) => negociacaoAberta(n.situacao));
  const propostas: PropostaAberta[] = negociacoes.flatMap((n) =>
    n.propostas
      .filter((p) => p.situacao === "aberta")
      .map((p) => ({ negociacaoId: n.id, propostaId: p.id, credor: n.credor, dividas: n.dividas.map((d) => d.descricao).join(", "), saldoCentavos: n.saldoCentavos, modalidade: p.modalidade, entradaCentavos: p.entradaCentavos, parcelas: p.parcelas, valorParcelaCentavos: p.valorParcelaCentavos, validade: p.validade })),
  );

  const ctx: ContextoPerguntas = {
    hoje,
    dividas,
    rendaMensalCentavos: renda > 0 ? renda : null,
    sobraMensalCentavos: temHistorico ? sit.sobraMensalCentavos : null,
    parcelasDoMesCentavos: parcelasMes,
    parcelasReferenciaCentavos: ativas.reduce((s, c) => s + (c.sim?.parcelaReferenciaCentavos ?? 0), 0),
    reservaCentavos: sit.reservaCentavos,
    reservaMinimaCentavos: sit.reservaMinimaCentavos,
    extrasRecentesCentavos: extras,
    caixa: ativas.length ? { saldoCentavos: saldoCaixa, parcelasAteProximoMesCentavos: parcelasAteProximoMes } : null,
    faturasVencidas,
    limites,
    propostas,
  };

  const desligadas = parametros.dividas.alertasDesligados;
  const alertas = calcularAlertas(ctx, limites, desligadas);
  const estado = lerEstadoAlertas(config[CHAVE_ESTADO_ALERTAS]);
  const { visiveis, escondidos } = filtrarPorEstado(alertas, estado, hoje);

  const percentualRenda = percentualDaRenda(parcelasMes, ctx.rendaMensalCentavos);
  const itens: ItemEvolucao[] = completas
    .filter((c) => c.linha.situacaoGravada !== "cancelada")
    .map((c) => ({
      desde: c.desde,
      forma: c.linha.forma,
      obrigacoes: c.obrigacoes.filter((o) => !o.encargo).map((o) => ({ vencimento: o.vencimento, dataPagamento: o.dataPagamento, valorCentavos: o.valorCentavos })),
      saldoHojeCentavos: estaAtiva(c.linha.situacao) ? c.linha.saldo.exibido : 0,
    }));
  const ativasLinhas = ativas.map((c) => c.linha).filter((l) => l.saldo.exibido > 0);
  const rotuloTipo = (t: string) => rotuloTipoDivida(t).replace(" (rotativo ou parcelamento de fatura)", "");

  return {
    hoje,
    ctx,
    limites,
    desligadas,
    estado,
    alertas,
    visiveis,
    escondidos,
    resumo,
    linhas: ordenarDividas(linhasTodas),
    jurosMesCentavos: jurosEstimadosPorMes(ativas.map((c) => ({ saldoCentavos: c.linha.saldo.exibido, taxaMensalPct: c.linha.taxaMensal }))),
    parcelasMesCentavos: parcelasMes,
    percentualRenda,
    nivelRenda: percentualRenda === null ? "ok" : classificarPercentualRenda(percentualRenda, limites),
    previsao: preverQuitacao(ativas.flatMap((c) => (c.sim ? [c.sim] : [])), mesDe(hoje)),
    evolucao: evolucaoDoTotalDevido(itens, hoje, 12),
    porCredor: fatiasDeDividas(ativasLinhas.map((l) => ({ chave: String(l.contatoId), nome: l.credor, saldoCentavos: l.saldo.exibido }))),
    porTipo: fatiasDeDividas(ativasLinhas.map((l) => ({ chave: l.tipo, nome: rotuloTipo(l.tipo), saldoCentavos: l.saldo.exibido }))),
    cartaoNaVisaoGeral: parametros.dividas.cartaoVisaoGeral,
  };
});

function somarDiasTexto(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Assuntos e mensagens do Consultor
// ---------------------------------------------------------------------------

export type AssuntoLinha = { id: number; titulo: string; situacao: "aberto" | "arquivado"; dividaId: number | null; atualizadoEm: string; mensagens: number };
export type MensagemLinha = { id: number; autor: "pessoa" | "gui" | "gui_ia"; texto: string; dados: unknown; criadoEm: string };

export async function listarAssuntos(): Promise<AssuntoLinha[]> {
  const db = getDb();
  const assuntos = await db.select().from(consultorAssunto).orderBy(desc(consultorAssunto.atualizadoEm), desc(consultorAssunto.id)).limit(200);
  if (!assuntos.length) return [];
  const mensagens = await db.select({ assuntoId: consultorMensagem.assuntoId }).from(consultorMensagem).where(inArray(consultorMensagem.assuntoId, assuntos.map((a) => a.id)));
  const contagem = new Map<number, number>();
  for (const m of mensagens) contagem.set(m.assuntoId, (contagem.get(m.assuntoId) ?? 0) + 1);
  return assuntos.map((a) => ({ id: a.id, titulo: a.titulo, situacao: a.situacao === "arquivado" ? "arquivado" : "aberto", dividaId: a.dividaId, atualizadoEm: a.atualizadoEm.toISOString(), mensagens: contagem.get(a.id) ?? 0 }));
}

export async function listarMensagens(assuntoId: number): Promise<MensagemLinha[]> {
  const linhas = await getDb().select().from(consultorMensagem).where(eq(consultorMensagem.assuntoId, assuntoId)).orderBy(consultorMensagem.criadoEm, consultorMensagem.id);
  return linhas.map((m) => ({ id: m.id, autor: m.autor === "pessoa" || m.autor === "gui_ia" ? m.autor : "gui", texto: m.texto, dados: m.dados, criadoEm: m.criadoEm.toISOString() }));
}
