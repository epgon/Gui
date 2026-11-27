/**
 * Motor de regras do Consultor Gui (fase D4): alertas e recomendações da seção 8.6 da especificação.
 * Funções puras, sem banco e sem IA: os mesmos números sempre dão os mesmos alertas.
 * Dinheiro em centavos inteiros; datas no formato "2026-11-24".
 *
 * Cada regra devolve gravidade, título, texto, "Como calculei" (os números), ação sugerida (só um link: o Consultor
 * nunca grava nada) e o endereço da tela que resolve.
 * R9 e R10 olham o Plano de Quitação ativo (fase D5).
 */
import { diasEntre, taxaMensalParaAnual } from "../regras";
import { formatarReais, quitarComExtraMensal, reservaUsavel, rotuloMes, somarMesesYm, mesDe, type DividaSim } from "../simulador";

export type Gravidade = "alta" | "atencao" | "info" | "boa";

export const ORDEM_GRAVIDADE: Record<Gravidade, number> = { alta: 0, atencao: 1, info: 2, boa: 3 };
export const ROTULO_GRAVIDADE: Record<Gravidade, string> = { alta: "Alta", atencao: "Atenção", info: "Informação", boa: "Boa notícia" };

/** Uma ação sugerida: só um link para a janela normal do Gui. Quem grava é a pessoa, no botão de confirmar da janela. */
export type LinkAcao = { rotulo: string; href: string };

export type Alerta = {
  /** Estável: a regra e o que ela aponta ("R1:12" = regra R1 da dívida 12). Serve para Dispensar e Lembrar. */
  id: string;
  regra: string;
  gravidade: Gravidade;
  titulo: string;
  texto: string;
  /** "Como calculei": uma linha por número ou critério. */
  calculo: string[];
  acao: LinkAcao | null;
  dividaId: number | null;
};

/** As regras do Consultor. R9 e R10 só valem com um Plano de Quitação ativo. */
export const REGRAS_CONSULTOR: { id: string; titulo: string; gravidade: string }[] = [
  { id: "R1", titulo: "Parcela de dívida em atraso", gravidade: "Alta" },
  { id: "R2", titulo: "Parcelas do mês acima do limite da renda", gravidade: "Atenção ou Alta" },
  { id: "R3", titulo: "Saldo do próximo mês não cobre as parcelas", gravidade: "Alta" },
  { id: "R4", titulo: "Dívida com taxa muito alta", gravidade: "Alta" },
  { id: "R5", titulo: "Reserva acima do mínimo e dívida mais cara que o rendimento", gravidade: "Informação" },
  { id: "R6", titulo: "Reserva abaixo do mínimo enquanto paga extra", gravidade: "Atenção" },
  { id: "R7", titulo: "Dívida atrasada há muito tempo: vale negociar", gravidade: "Informação" },
  { id: "R8", titulo: "Saldo antigo ou dívida sem taxa", gravidade: "Informação" },
  { id: "R9", titulo: "Plano ativo com o mês anterior abaixo do planejado", gravidade: "Atenção" },
  { id: "R10", titulo: "Dívida nova ou compra parcelada grande depois do plano", gravidade: "Atenção" },
  { id: "R11", titulo: "Pagando só o mínimo com sobra positiva", gravidade: "Informação" },
  { id: "R12", titulo: "Dívida quitada: parcela liberada", gravidade: "Boa notícia" },
  { id: "R13", titulo: "Fatura de cartão alta e vencida (sinal de rotativo)", gravidade: "Alta" },
];

export type LimitesConsultor = {
  /** Parcelas do mês acima deste % da renda: atenção. */
  rendaAtencaoPct: number;
  /** Acima deste %: alta. */
  rendaAltaPct: number;
  /** Taxa ao mês acima disto é "muito alta". */
  taxaAltaPct: number;
  /** Rendimento estimado da reserva, % ao mês. */
  rendimentoReservaPct: number;
  /** Atraso (dias) a partir do qual vale abrir negociação. */
  diasParaNegociar: number;
  /** Saldo informado há mais que isto (dias) é considerado antigo. */
  diasSaldoAntigo: number;
  /** Quanto da sobra livre a sugestão de pagar a mais usa (%). */
  extraSobraPct: number;
  /** R12: por quantos dias a dívida quitada ainda gera o aviso. */
  diasBoaNoticia: number;
  /** R6: olha as amortizações dos últimos N dias. */
  diasExtraRecente: number;
};

export const LIMITES_PADRAO: LimitesConsultor = {
  rendaAtencaoPct: 30,
  rendaAltaPct: 50,
  taxaAltaPct: 6,
  rendimentoReservaPct: 0.8,
  diasParaNegociar: 90,
  diasSaldoAntigo: 60,
  extraSobraPct: 50,
  diasBoaNoticia: 45,
  diasExtraRecente: 90,
};

export type DividaConsultor = {
  id: number;
  descricao: string;
  credor: string;
  tipo: string;
  forma: "parcelas_fixas" | "sem_parcelas";
  /** Em dia, em atraso, em negociação ou quitada (as outras não entram). */
  situacao: "em_dia" | "em_atraso" | "em_negociacao" | "quitada";
  /** Taxa ao mês em %; null = sem taxa informada. */
  taxaMensalPct: number | null;
  saldoCentavos: number;
  /** De onde vem o saldo mostrado: o que o credor informou, a estimativa com atraso ou a soma das parcelas. */
  saldoOrigem: "informado" | "estimado" | "parcelas";
  /** Data do último saldo informado pelo credor (null = nunca informado). */
  informadoEm: string | null;
  diasAtraso: number;
  parcelasAtrasadas: number;
  /** Soma das parcelas vencidas e não pagas. */
  atrasoCentavos: number;
  /** Estimativa de multa e juros já acumulados nas parcelas vencidas. */
  acrescimoCentavos: number;
  /** Uma parcela "normal" da dívida (para R12). */
  parcelaCentavos: number;
  parcelasAbertas: number;
  quitadaEm: string | null;
  /** A dívida no formato do Simulador (para R11). */
  sim: DividaSim | null;
};

export type FaturaVencida = { cartaoId: number; cartao: string; rotulo: string; vencimento: string; valorCentavos: number };

/** O que as regras R9 e R10 precisam saber do Plano de Quitação ativo. */
export type PlanoParaConsultor = {
  id: number;
  nome: string;
  versao: number;
  /** O último mês fechado do plano, comparado com o realizado. */
  mesAnterior: { mes: string; planejadoCentavos: number; realizadoCentavos: number; situacao: "cumprido" | "parcial" | "nao_cumprido" } | null;
  mesFinalPlanejado: string | null;
  /** Previsão recalculada com o que falta pagar hoje. */
  previsaoMesFinal: string | null;
  /** Há desvio e proposta de ajuste esperando a decisão da pessoa. */
  ajustePendente: boolean;
  /** Os desvios detectados, em frases (para "Por que meu plano atrasou?"). */
  desvios: string[];
  /** Quanto ficou sem pagar nos meses fechados. */
  deficitCentavos: number;
  /** Frase da opção de ajuste recomendada (null = sem desvio). */
  ajusteRecomendado: string | null;
  /** Dívidas ativas criadas depois da aprovação e que não estão no plano. */
  novasDividas: { id: number; descricao: string; saldoCentavos: number }[];
  /** Compras parceladas no cartão feitas depois da aprovação e grandes em relação à sobra. */
  comprasParceladas: { parcelamentoId: number; descricao: string; totalCentavos: number; parcelas: number; parcelaCentavos: number }[];
};

export type ContextoConsultor = {
  hoje: string;
  /** Plano de Quitação ativo (null = não há). */
  plano?: PlanoParaConsultor | null;
  dividas: DividaConsultor[];
  /** Receitas médias por mês; null = ainda sem histórico para calcular. */
  rendaMensalCentavos: number | null;
  /** Média mensal de receitas menos despesas (sem as parcelas de dívida); null = sem histórico. */
  sobraMensalCentavos: number | null;
  /** O que as dívidas tiram do mês atual (parcelas com vencimento no mês, pagas ou não). */
  parcelasDoMesCentavos: number;
  /** Soma das parcelas de referência das dívidas ativas (a mesma base dos cenários do Simulador). */
  parcelasReferenciaCentavos: number;
  reservaCentavos: number;
  reservaMinimaCentavos: number;
  /** Dinheiro pago a mais (amortizações e quitações) nos últimos dias. */
  extrasRecentesCentavos: number;
  /** Para a R3: saldo das contas hoje e as parcelas abertas que vencem até o fim do próximo mês. */
  caixa: { saldoCentavos: number; parcelasAteProximoMesCentavos: number } | null;
  faturasVencidas: FaturaVencida[];
};

const ATIVAS = new Set(["em_dia", "em_atraso", "em_negociacao"]);
const ativa = (d: DividaConsultor) => ATIVAS.has(d.situacao);
const dia = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

const minhas = "/gestao/dividas/minhas";
const abrirDivida = (id: number) => `${minhas}?detalhar=${id}`;

/** Classificação do % da renda que as parcelas tomam: usada nos alertas e na barra da Visão Geral. */
export function classificarPercentualRenda(percentual: number, l: Pick<LimitesConsultor, "rendaAtencaoPct" | "rendaAltaPct">): "ok" | "atencao" | "alta" {
  if (percentual > l.rendaAltaPct) return "alta";
  if (percentual > l.rendaAtencaoPct) return "atencao";
  return "ok";
}

/** Parcelas do mês como % da renda média (uma casa decimal). null quando não há renda para comparar. */
export function percentualDaRenda(parcelasCentavos: number, rendaCentavos: number | null): number | null {
  if (rendaCentavos === null || rendaCentavos <= 0) return null;
  return Math.round((parcelasCentavos / rendaCentavos) * 1000) / 10;
}

/** A sobra que fica livre depois das parcelas de referência (a mesma conta dos cenários do Simulador). */
export const sobraLivre = (c: Pick<ContextoConsultor, "sobraMensalCentavos" | "parcelasReferenciaCentavos">) => (c.sobraMensalCentavos === null ? 0 : Math.max(0, c.sobraMensalCentavos - c.parcelasReferenciaCentavos));

// ---------------------------------------------------------------------------
// As regras
// ---------------------------------------------------------------------------

/** R1: parcela de dívida em atraso. */
export function regraR1(c: ContextoConsultor): Alerta[] {
  return c.dividas.filter((d) => ativa(d) && d.parcelasAtrasadas > 0).map((d) => ({
    id: `R1:${d.id}`,
    regra: "R1",
    gravidade: "alta" as const,
    titulo: `${plural(d.parcelasAtrasadas, "parcela em atraso", "parcelas em atraso")}: ${d.descricao}`,
    texto: `A parcela mais antiga venceu há ${dia(d.diasAtraso)}. Com multa e juros de mora, a estimativa é de ${formatarReais(d.acrescimoCentavos)} a mais que o valor original.${d.situacao === "em_negociacao" ? " Esta dívida está em negociação: o atraso continua contando até o acordo." : ""}`,
    calculo: [
      `${plural(d.parcelasAtrasadas, "parcela vencida", "parcelas vencidas")} somando ${formatarReais(d.atrasoCentavos)}.`,
      `A mais antiga venceu há ${dia(d.diasAtraso)}.`,
      `Multa e juros de mora estimados: ${formatarReais(d.acrescimoCentavos)}. É uma estimativa com as regras mais comuns; o valor certo é o que o credor informar.`,
    ],
    acao: { rotulo: "Abrir a dívida", href: abrirDivida(d.id) },
    dividaId: d.id,
  }));
}

/** R2: parcelas do mês acima de uma parte da renda. */
export function regraR2(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  const p = percentualDaRenda(c.parcelasDoMesCentavos, c.rendaMensalCentavos);
  if (p === null || c.parcelasDoMesCentavos <= 0) return [];
  const nivel = classificarPercentualRenda(p, l);
  if (nivel === "ok") return [];
  const limite = nivel === "alta" ? l.rendaAltaPct : l.rendaAtencaoPct;
  return [
    {
      id: "R2",
      regra: "R2",
      gravidade: nivel === "alta" ? "alta" : "atencao",
      titulo: `As parcelas das dívidas tomam ${pct(p)} da sua renda`,
      texto: `Neste mês, as parcelas somam ${formatarReais(c.parcelasDoMesCentavos)} e a sua renda média é de ${formatarReais(c.rendaMensalCentavos!)}. Acima de ${pct(limite)} da renda o orçamento fica apertado e sobra pouco espaço para imprevistos.`,
      calculo: [
        `Parcelas com vencimento neste mês: ${formatarReais(c.parcelasDoMesCentavos)}.`,
        `Renda média mensal (receitas dos últimos meses fechados): ${formatarReais(c.rendaMensalCentavos!)}.`,
        `${formatarReais(c.parcelasDoMesCentavos)} ÷ ${formatarReais(c.rendaMensalCentavos!)} = ${pct(p)}.`,
        `Limites: atenção acima de ${pct(l.rendaAtencaoPct)} e alta acima de ${pct(l.rendaAltaPct)} (mudam em Configurações > Parâmetros).`,
      ],
      acao: { rotulo: "Comparar estratégias", href: "/gestao/dividas/simulador?modo=estrategias" },
      dividaId: null,
    },
  ];
}

/** R3: o saldo do próximo mês não cobre as parcelas. */
export function regraR3(c: ContextoConsultor): Alerta[] {
  if (!c.caixa || c.caixa.parcelasAteProximoMesCentavos <= 0) return [];
  const sobra = c.sobraMensalCentavos ?? 0;
  const previsto = c.caixa.saldoCentavos + sobra;
  if (previsto >= c.caixa.parcelasAteProximoMesCentavos) return [];
  const falta = c.caixa.parcelasAteProximoMesCentavos - previsto;
  return [
    {
      id: "R3",
      regra: "R3",
      gravidade: "alta",
      titulo: "O dinheiro previsto não cobre as parcelas até o fim do próximo mês",
      texto: `Você tem ${formatarReais(c.caixa.saldoCentavos)} nas contas e, em média, sobra ${formatarReais(sobra)} por mês. As parcelas em aberto até o fim do próximo mês somam ${formatarReais(c.caixa.parcelasAteProximoMesCentavos)}: faltam cerca de ${formatarReais(falta)}.`,
      calculo: [
        `Saldo atual das contas (sem a reserva): ${formatarReais(c.caixa.saldoCentavos)}.`,
        `Sobra mensal média (sem as parcelas de dívida): ${formatarReais(sobra)}${c.sobraMensalCentavos === null ? " (ainda sem histórico, usei zero)" : ""}.`,
        `Previsto: ${formatarReais(c.caixa.saldoCentavos)} + ${formatarReais(sobra)} = ${formatarReais(previsto)}.`,
        `Parcelas em aberto (vencidas e até o fim do próximo mês): ${formatarReais(c.caixa.parcelasAteProximoMesCentavos)}.`,
        "É uma previsão simples: não conta receitas ou despesas que fogem da média.",
      ],
      acao: { rotulo: "Ver as dívidas", href: minhas },
      dividaId: null,
    },
  ];
}

/** R4: dívida com taxa muito alta. */
export function regraR4(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  return c.dividas.filter((d) => ativa(d) && d.taxaMensalPct !== null && d.taxaMensalPct > l.taxaAltaPct && d.saldoCentavos > 0).map((d) => {
    const anual = taxaMensalParaAnual(d.taxaMensalPct!);
    const jurosMes = Math.round((d.saldoCentavos * d.taxaMensalPct!) / 100);
    return {
      id: `R4:${d.id}`,
      regra: "R4",
      gravidade: "alta" as const,
      titulo: `Taxa muito alta: ${d.descricao}`,
      texto: `A taxa é de ${pct(d.taxaMensalPct!)} ao mês (${pct(anual)} ao ano). Sobre o saldo de ${formatarReais(d.saldoCentavos)}, isso custa cerca de ${formatarReais(jurosMes)} de juros por mês. Dívidas assim costumam ser as primeiras a quitar ou trocar por uma mais barata.`,
      calculo: [
        `Taxa informada: ${pct(d.taxaMensalPct!)} ao mês, que equivale a ${pct(anual)} ao ano ((1 + taxa)^12 − 1).`,
        `Juros de um mês: ${formatarReais(d.saldoCentavos)} × ${pct(d.taxaMensalPct!)} = ${formatarReais(jurosMes)}.`,
        `Limite de "taxa muito alta": ${pct(l.taxaAltaPct)} ao mês (muda em Configurações > Parâmetros).`,
      ],
      acao: { rotulo: "Simular quitação", href: `/gestao/dividas/simulador?modo=quitar&divida=${d.id}` },
      dividaId: d.id,
    };
  });
}

/** A dívida ativa com maior taxa (a mais cara). */
const maisCara = (c: ContextoConsultor) => c.dividas.filter((d) => ativa(d) && d.taxaMensalPct !== null && d.saldoCentavos > 0).sort((a, b) => b.taxaMensalPct! - a.taxaMensalPct! || b.saldoCentavos - a.saldoCentavos)[0];

/** R5: reserva acima do mínimo e dívida mais cara que o rendimento da reserva. */
export function regraR5(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  const usavel = reservaUsavel(c);
  if (usavel <= 0) return [];
  const d = maisCara(c);
  if (!d || d.taxaMensalPct! <= l.rendimentoReservaPct) return [];
  const valor = Math.min(usavel, d.saldoCentavos);
  return [
    {
      id: `R5:${d.id}`,
      regra: "R5",
      gravidade: "info",
      titulo: `Avalie usar ${formatarReais(valor)} da reserva em ${d.descricao}`,
      texto: `A reserva tem ${formatarReais(usavel)} acima do mínimo e rende uma estimativa de ${pct(l.rendimentoReservaPct)} ao mês. A dívida ${d.descricao} custa ${pct(d.taxaMensalPct!)} ao mês. Abater parte dela costuma sair mais barato que manter o dinheiro parado. A decisão é sua: use só o que passa da reserva mínima.`,
      calculo: [
        `Reserva atual: ${formatarReais(c.reservaCentavos)}. Reserva mínima: ${formatarReais(c.reservaMinimaCentavos)}. Acima do mínimo: ${formatarReais(usavel)}.`,
        `Rendimento estimado da reserva: ${pct(l.rendimentoReservaPct)} ao mês (é um palpite; muda em Parâmetros).`,
        `Taxa da dívida: ${pct(d.taxaMensalPct!)} ao mês, a maior entre as dívidas com taxa.`,
        `Valor sugerido: o menor entre o que passa do mínimo (${formatarReais(usavel)}) e o saldo da dívida (${formatarReais(d.saldoCentavos)}) = ${formatarReais(valor)}.`,
      ],
      acao: { rotulo: "Simular com a reserva", href: `/gestao/dividas/simulador?modo=quitar&divida=${d.id}` },
      dividaId: d.id,
    },
  ];
}

/** R6: reserva abaixo do mínimo enquanto se paga extra nas dívidas. */
export function regraR6(c: ContextoConsultor): Alerta[] {
  if (c.reservaMinimaCentavos <= 0 || c.reservaCentavos >= c.reservaMinimaCentavos || c.extrasRecentesCentavos <= 0) return [];
  return [
    {
      id: "R6",
      regra: "R6",
      gravidade: "atencao",
      titulo: "Priorize recompor a reserva antes de pagar mais nas dívidas",
      texto: `A reserva está em ${formatarReais(c.reservaCentavos)}, abaixo do mínimo de ${formatarReais(c.reservaMinimaCentavos)}, e você pagou ${formatarReais(c.extrasRecentesCentavos)} a mais nas dívidas recentemente. Sem reserva, um imprevisto pode virar uma dívida nova, geralmente mais cara.`,
      calculo: [
        `Reserva atual: ${formatarReais(c.reservaCentavos)}.`,
        `Reserva mínima: ${formatarReais(c.reservaMinimaCentavos)} (meses de despesas definidos em Parâmetros × despesa média).`,
        `Faltam ${formatarReais(c.reservaMinimaCentavos - c.reservaCentavos)} para chegar ao mínimo.`,
        `Pagamentos extras (amortizações e quitações) nos últimos 90 dias: ${formatarReais(c.extrasRecentesCentavos)}.`,
      ],
      acao: { rotulo: "Ver o Simulador", href: "/gestao/dividas/simulador" },
      dividaId: null,
    },
  ];
}

/** R7: dívida atrasada há muito tempo, vale abrir negociação. */
export function regraR7(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  return c.dividas.filter((d) => ativa(d) && d.diasAtraso > l.diasParaNegociar && d.situacao !== "em_negociacao").map((d) => ({
    id: `R7:${d.id}`,
    regra: "R7",
    gravidade: "info" as const,
    titulo: `Vale negociar: ${d.descricao} está atrasada há ${dia(d.diasAtraso)}`,
    texto: `Depois de mais de ${dia(l.diasParaNegociar)} de atraso, os credores costumam oferecer descontos para receber. Isso não é garantia: compare a proposta com o saldo antes de aceitar. O Gui calcula os juros implícitos e se a parcela cabe na sua sobra.`,
    calculo: [`Atraso da parcela mais antiga: ${dia(d.diasAtraso)}.`, `Limite para sugerir negociação: ${dia(l.diasParaNegociar)} (muda em Parâmetros).`, `Saldo estimado da dívida: ${formatarReais(d.saldoCentavos)}.`],
    acao: { rotulo: "Abrir negociação", href: `/gestao/dividas/negociacoes?nova=1&divida=${d.id}` },
    dividaId: d.id,
  }));
}

/** R8: saldo informado há muito tempo, ou dívida sem taxa. */
export function regraR8(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  const alertas: Alerta[] = [];
  for (const d of c.dividas.filter(ativa)) {
    if (!d.informadoEm) continue;
    const dias = diasEntre(d.informadoEm, c.hoje);
    if (dias <= l.diasSaldoAntigo) continue;
    alertas.push({
      id: `R8:${d.id}`,
      regra: "R8",
      gravidade: "info",
      titulo: `O saldo de ${d.descricao} não é atualizado há ${dia(dias)}`,
      texto: "Juros, tarifas e seguros mudam o saldo real. Peça ao credor o saldo de hoje (extrato, aplicativo ou boleto de quitação) e informe no Gui para as contas ficarem certas.",
      calculo: [`Último saldo informado pelo credor: ${d.informadoEm.split("-").reverse().join("/")} (${dia(dias)} atrás).`, `O Gui deixa de usar um saldo informado depois de ${dia(l.diasSaldoAntigo)} e volta a estimar.`],
      acao: { rotulo: "Atualizar saldo", href: `${abrirDivida(d.id)}&acao=saldo` },
      dividaId: d.id,
    });
  }
  const semTaxa = c.dividas.filter((d) => ativa(d) && d.taxaMensalPct === null && d.tipo !== "pessoa_fisica" && d.saldoCentavos > 0);
  if (semTaxa.length > 0) {
    alertas.push({
      id: "R8:sem-taxa",
      regra: "R8",
      gravidade: "info",
      titulo: `${plural(semTaxa.length, "dívida sem taxa de juros informada", "dívidas sem taxa de juros informada")}`,
      texto: `Sem a taxa, o Simulador e as recomendações tratam a dívida como se não tivesse juros (0%) e o resultado fica aproximado. Veja a taxa no contrato ou com o credor: ${semTaxa.slice(0, 3).map((d) => d.descricao).join(", ")}${semTaxa.length > 3 ? " e outras" : ""}.`,
      calculo: [`Dívidas ativas sem taxa (fora as de pessoa física): ${semTaxa.map((d) => d.descricao).join(", ")}.`, "Sem taxa informada, as contas usam 0% ao mês."],
      acao: { rotulo: "Ver as dívidas", href: minhas },
      dividaId: null,
    });
  }
  return alertas;
}

/** R9: o plano ativo ficou abaixo do planejado no mês anterior. */
export function regraR9(c: ContextoConsultor): Alerta[] {
  const p = c.plano;
  const m = p?.mesAnterior;
  if (!p || !m || (m.situacao !== "parcial" && m.situacao !== "nao_cumprido")) return [];
  const falta = m.planejadoCentavos - m.realizadoCentavos;
  return [
    {
      id: `R9:${p.id}`,
      regra: "R9",
      gravidade: "atencao",
      titulo: `Seu plano de quitação ficou abaixo do planejado em ${rotuloMes(m.mes)}`,
      texto: `Em ${rotuloMes(m.mes)} o plano previa ${formatarReais(m.planejadoCentavos)} e você pagou ${formatarReais(m.realizadoCentavos)}: faltaram ${formatarReais(falta)}.${p.ajustePendente ? " Há uma proposta de ajuste esperando a sua decisão." : ""}`,
      calculo: [
        `Plano "${p.nome}" (versão ${p.versao}): meta de ${formatarReais(m.planejadoCentavos)} em ${rotuloMes(m.mes)}.`,
        `Pago nesse mês nas dívidas do plano: ${formatarReais(m.realizadoCentavos)} (situação: ${m.situacao === "parcial" ? "parcial" : "não cumprido"}).`,
        `${formatarReais(m.planejadoCentavos)} − ${formatarReais(m.realizadoCentavos)} = ${formatarReais(falta)} a menos.`,
        ...(p.mesFinalPlanejado && p.previsaoMesFinal ? [`Prevista no plano: ${rotuloMes(p.mesFinalPlanejado)}. Previsão recalculada hoje: ${rotuloMes(p.previsaoMesFinal)}.`] : []),
      ],
      acao: { rotulo: "Ver o plano", href: "/gestao/dividas/plano" },
      dividaId: null,
    },
  ];
}

/** R10: dívida nova ou compra parcelada grande depois de aprovado o plano. */
export function regraR10(c: ContextoConsultor): Alerta[] {
  const p = c.plano;
  if (!p) return [];
  const novas: Alerta[] = p.novasDividas.map((d) => ({
    id: `R10:d${d.id}`,
    regra: "R10",
    gravidade: "atencao" as const,
    titulo: `Dívida nova depois do plano: ${d.descricao}`,
    texto: `A dívida ${d.descricao} (${formatarReais(d.saldoCentavos)}) foi cadastrada depois que o plano "${p.nome}" foi aprovado e não está nele. Ela pesa no orçamento e pode atrasar a quitação.`,
    calculo: [`Plano "${p.nome}" (versão ${p.versao}) foi aprovado antes do cadastro desta dívida.`, `Saldo da dívida nova: ${formatarReais(d.saldoCentavos)}.`, "Abra o plano: se houver desvio, o Gui propõe um ajuste que inclui a dívida (você aprova ou mantém como está)."],
    acao: { rotulo: "Ver o plano", href: "/gestao/dividas/plano" },
    dividaId: d.id,
  }));
  const compras: Alerta[] = p.comprasParceladas.map((x) => ({
    id: `R10:c${x.parcelamentoId}`,
    regra: "R10",
    gravidade: "atencao" as const,
    titulo: `Compra parcelada grande depois do plano: ${x.descricao}`,
    texto: `Uma compra de ${formatarReais(x.totalCentavos)} em ${x.parcelas}× de ${formatarReais(x.parcelaCentavos)} no cartão foi lançada depois que o plano foi aprovado. Ela ocupa a sua sobra dos próximos meses.`,
    calculo: [`Total da compra: ${formatarReais(x.totalCentavos)} em ${x.parcelas} parcelas de ${formatarReais(x.parcelaCentavos)}.`, c.sobraMensalCentavos === null ? "Sem histórico para comparar com a sobra mensal; usei um valor mínimo de R$ 1.000,00 para considerar a compra grande." : `Considero grande a compra que passa da sua sobra mensal de ${formatarReais(c.sobraMensalCentavos)}.`, "Compras no cartão não são dívida cadastrada: o plano não conta com elas."],
    acao: { rotulo: "Ver o plano", href: "/gestao/dividas/plano" },
    dividaId: null,
  }));
  return [...novas, ...compras];
}

/** R11: pagando só o mínimo, com sobra positiva. */
export function regraR11(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  const livre = sobraLivre(c);
  if (livre <= 0) return [];
  const metade = Math.floor((livre * l.extraSobraPct) / 100);
  // Arredonda para baixo em múltiplos de R$ 10 (quando passa disso) para a sugestão ser um valor "redondo".
  const extra = metade >= 1000 ? Math.floor(metade / 1000) * 1000 : metade;
  if (extra < 2000) return [];
  const candidatas = c.dividas.filter((d) => ativa(d) && d.forma === "parcelas_fixas" && d.sim && d.taxaMensalPct !== null && d.taxaMensalPct > 0 && d.parcelasAbertas >= 3 && d.sim.saldoCentavos > 0).sort((a, b) => b.taxaMensalPct! - a.taxaMensalPct!);
  const inicioYm = mesDe(c.hoje);
  for (const d of candidatas) {
    const r = quitarComExtraMensal(d.sim!, extra, inicioYm);
    if (r.mesesAntecipados === null || r.mesesAntecipados < 1 || r.economiaJurosCentavos <= 0) continue;
    return [
      {
        id: `R11:${d.id}`,
        regra: "R11",
        gravidade: "info",
        titulo: `Pagar ${formatarReais(extra)} a mais por mês em ${d.descricao} termina ${plural(r.mesesAntecipados, "mês", "meses")} antes`,
        texto: `Pagando só as parcelas, sobra todo mês um valor livre de cerca de ${formatarReais(livre)}. Usar ${formatarReais(extra)} disso na dívida mais cara com parcelas (${d.descricao}, ${pct(d.taxaMensalPct!)} ao mês) economiza cerca de ${formatarReais(r.economiaJurosCentavos)} de juros. É uma estimativa: confirme com o credor como o pagamento antecipado é abatido.`,
        calculo: [
          `Sobra mensal média: ${formatarReais(c.sobraMensalCentavos ?? 0)}. Parcelas de referência das dívidas: ${formatarReais(c.parcelasReferenciaCentavos)}. Sobra livre: ${formatarReais(livre)}.`,
          `Extra sugerido: ${pct(l.extraSobraPct)} da sobra livre, arredondado para baixo = ${formatarReais(extra)}.`,
          `Dívida escolhida: a de maior taxa com parcelas (${pct(d.taxaMensalPct!)} ao mês).`,
          `Simulação mês a mês até ${r.resultado.mesFinal ? rotuloMes(r.resultado.mesFinal) : "o fim"}: ${plural(r.mesesAntecipados, "mês a menos", "meses a menos")} e ${formatarReais(r.economiaJurosCentavos)} a menos de juros.`,
        ],
        acao: { rotulo: "Simular", href: `/gestao/dividas/simulador?modo=quitar&divida=${d.id}` },
        dividaId: d.id,
      },
    ];
  }
  return [];
}

/** R12: dívida quitada, parcela liberada. */
export function regraR12(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  const alvo = maisCara(c) ?? c.dividas.filter((d) => ativa(d) && d.saldoCentavos > 0).sort((a, b) => b.saldoCentavos - a.saldoCentavos)[0];
  return c.dividas
    .filter((d) => d.situacao === "quitada" && d.quitadaEm && d.parcelaCentavos > 0 && diasEntre(d.quitadaEm, c.hoje) >= 0 && diasEntre(d.quitadaEm, c.hoje) <= l.diasBoaNoticia)
    .map((d) => ({
      id: `R12:${d.id}`,
      regra: "R12",
      gravidade: "boa" as const,
      titulo: `${d.descricao} foi quitada`,
      texto: alvo
        ? `A parcela de ${formatarReais(d.parcelaCentavos)} que ia para essa dívida ficou livre. Redirecioná-la para ${alvo.descricao} é o efeito "bola de neve": o mesmo esforço mensal quita a próxima mais rápido.`
        : `A parcela de ${formatarReais(d.parcelaCentavos)} que ia para essa dívida ficou livre. Sem outras dívidas ativas, vale direcioná-la para a reserva de emergência.`,
      calculo: [`Quitada em ${d.quitadaEm!.split("-").reverse().join("/")}.`, `Parcela liberada: ${formatarReais(d.parcelaCentavos)} por mês.`, alvo ? `Próxima da fila: ${alvo.descricao}${alvo.taxaMensalPct !== null ? `, a de maior taxa (${pct(alvo.taxaMensalPct)} ao mês)` : ", a de maior saldo"}.` : "Não há outra dívida ativa."],
      acao: alvo ? { rotulo: "Simular", href: `/gestao/dividas/simulador?modo=quitar&divida=${alvo.id}` } : null,
      dividaId: d.id,
    }));
}

/** R13: fatura de cartão alta e/ou recorrente vencida e não paga (sinal de rotativo). */
export function regraR13(c: ContextoConsultor, l: LimitesConsultor): Alerta[] {
  const porCartao = new Map<number, FaturaVencida[]>();
  for (const f of c.faturasVencidas) porCartao.set(f.cartaoId, [...(porCartao.get(f.cartaoId) ?? []), f]);
  const alertas: Alerta[] = [];
  for (const [cartaoId, faturas] of porCartao) {
    const ordenadas = [...faturas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const total = ordenadas.reduce((s, f) => s + f.valorCentavos, 0);
    const maior = Math.max(...ordenadas.map((f) => f.valorCentavos));
    const p = percentualDaRenda(maior, c.rendaMensalCentavos);
    const alta = p !== null && p > l.rendaAtencaoPct;
    const recorrente = ordenadas.length >= 2;
    if (!alta && !recorrente) continue;
    const cartao = ordenadas[0].cartao;
    const dias = diasEntre(ordenadas[0].vencimento, c.hoje);
    alertas.push({
      id: `R13:${cartaoId}`,
      regra: "R13",
      gravidade: "alta",
      titulo: `Fatura do ${cartao} vencida${recorrente ? ` (${ordenadas.length} faturas em aberto)` : ""}`,
      texto: `${recorrente ? `${ordenadas.length} faturas vencidas e não pagas somam ${formatarReais(total)}` : `A fatura de ${ordenadas[0].rotulo} (${formatarReais(maior)}) venceu há ${dia(dias)}`}${alta ? `, equivalente a ${pct(p!)} da renda média mensal` : ""}. Fatura não paga costuma virar crédito rotativo, uma das taxas mais altas do mercado. Se não der para pagar o total, cadastre o parcelamento como dívida do tipo Cartão para acompanhar o saldo e comparar caminhos.`,
      calculo: [
        ...ordenadas.map((f) => `Fatura ${f.rotulo}: ${formatarReais(f.valorCentavos)}, venceu em ${f.vencimento.split("-").reverse().join("/")}.`),
        p !== null ? `Maior fatura ÷ renda média (${formatarReais(c.rendaMensalCentavos!)}) = ${pct(p)}. Considero "alta" acima de ${pct(l.rendaAtencaoPct)}.` : "Sem renda média calculada: só a recorrência foi considerada.",
        "Dispara quando a fatura é alta ou quando há duas ou mais faturas vencidas do mesmo cartão.",
      ],
      acao: { rotulo: "Ver as faturas", href: `/cadastros/cartoes-de-credito?faturas=${cartaoId}` },
      dividaId: null,
    });
  }
  return alertas;
}

/** Roda todas as regras ligadas e devolve os alertas na ordem de gravidade (e, dentro dela, nos de valor maior primeiro). */
export function calcularAlertas(c: ContextoConsultor, limites: LimitesConsultor = LIMITES_PADRAO, desligadas: string[] = []): Alerta[] {
  const todas = [...regraR1(c), ...regraR2(c, limites), ...regraR3(c), ...regraR4(c, limites), ...regraR5(c, limites), ...regraR6(c), ...regraR7(c, limites), ...regraR8(c, limites), ...regraR9(c), ...regraR10(c), ...regraR11(c, limites), ...regraR12(c, limites), ...regraR13(c, limites)];
  return todas.filter((a) => !desligadas.includes(a.regra)).sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
}

// ---------------------------------------------------------------------------
// Dispensar e Lembrar em 7 dias
// ---------------------------------------------------------------------------

/** O que se guarda de cada alerta tratado: dispensado de vez, ou adiado até uma data. */
export type EstadoAlertas = Record<string, { dispensado?: true; ate?: string }>;

export const CHAVE_ESTADO_ALERTAS = "dividas.alertas_estado";
export const MAXIMO_ESTADOS = 300;
export const DIAS_LEMBRAR = 7;

export function lerEstadoAlertas(valor: unknown): EstadoAlertas {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const estado: EstadoAlertas = {};
  for (const [id, v] of Object.entries(valor as Record<string, unknown>)) {
    if (!/^R\d{1,2}(:[\w-]{1,20})?$/.test(id) || !v || typeof v !== "object") continue;
    const o = v as { dispensado?: unknown; ate?: unknown };
    if (o.dispensado === true) estado[id] = { dispensado: true };
    else if (typeof o.ate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.ate)) estado[id] = { ate: o.ate };
  }
  return estado;
}

/** "Lembrar em 7 dias": o alerta some e volta no oitavo dia. */
export const dataDoLembrete = (hoje: string, dias = DIAS_LEMBRAR) => {
  const [a, m, d] = hoje.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

export type AcaoAlerta = "dispensar" | "lembrar" | "restaurar";

/** Aplica uma ação ao estado e tira os adiamentos que já venceram (e o que passar do máximo guardado). */
export function atualizarEstadoAlertas(estado: EstadoAlertas, id: string, acao: AcaoAlerta, hoje: string): EstadoAlertas {
  const novo: EstadoAlertas = {};
  for (const [k, v] of Object.entries(estado)) if (v.dispensado || (v.ate && v.ate > hoje)) novo[k] = v;
  if (acao === "dispensar") novo[id] = { dispensado: true };
  else if (acao === "lembrar") novo[id] = { ate: dataDoLembrete(hoje) };
  else delete novo[id];
  const chaves = Object.keys(novo);
  if (chaves.length > MAXIMO_ESTADOS) for (const k of chaves.slice(0, chaves.length - MAXIMO_ESTADOS)) delete novo[k];
  return novo;
}

/** Separa os alertas que aparecem agora dos dispensados ou adiados. */
export function filtrarPorEstado(alertas: Alerta[], estado: EstadoAlertas, hoje: string): { visiveis: Alerta[]; escondidos: Alerta[] } {
  const visiveis: Alerta[] = [];
  const escondidos: Alerta[] = [];
  for (const a of alertas) {
    const e = estado[a.id];
    (e && (e.dispensado || (e.ate && e.ate > hoje)) ? escondidos : visiveis).push(a);
  }
  return { visiveis, escondidos };
}

/** Só para a Visão Geral e o sino: mês seguinte (usado nas contas de caixa do servidor). */
export const mesSeguinte = (hoje: string) => somarMesesYm(mesDe(hoje), 1);
