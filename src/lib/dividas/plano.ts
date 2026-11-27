/**
 * Plano de Quitação da Gestão de Dívidas (fase D5): só contas, sem banco.
 * Funções puras: entra a descrição das dívidas e o que foi pago, sai o plano, o planejado contra o realizado,
 * os desvios e a proposta de ajuste. Nada aqui grava, e **nada muda no plano sem a pessoa aprovar**.
 * Dinheiro em centavos inteiros; meses no formato "2026-11"; datas "2026-11-24".
 *
 * O plano guarda só o planejado (quanto pagar de cada dívida em cada mês). O realizado nunca é gravado:
 * é a soma dos lançamentos pagos ligados às dívidas do plano (parcela, pagamento parcial e restante, amortização, quitação, encargo).
 */
import {
  formatarReais,
  indiceDoMes,
  mesDe,
  rotuloMes,
  simular,
  somarMesesYm,
  type DividaSim,
  type Estrategia,
  type ResultadoSimulacao,
} from "./simulador";

/** Diferenças de até R$ 1,00 não contam como "pagou menos" (arredondamentos e centavos de juros). */
export const TOLERANCIA_CENTAVOS = 100;
/** A sobra mensal cair mais que isto (em relação à da aprovação) pede um ajuste. */
export const QUEDA_SOBRA_PCT = 20;

export type SituacaoPlano = "rascunho" | "ativo" | "substituido" | "encerrado";
export const ROTULO_SITUACAO_PLANO: Record<SituacaoPlano, string> = { rascunho: "Rascunho", ativo: "Ativo", substituido: "Substituído", encerrado: "Encerrado" };

/** "d12" (id no Simulador) <-> 12 (id da dívida). */
export const idDaDivida = (simId: string) => Number(simId.replace(/^d/, ""));
export const idNoSimulador = (id: number) => `d${id}`;

export type ExtraDoPlano = { mes: string; valorCentavos: number };

/** O que define o plano: a estratégia, o valor mensal e os extras. */
export type ConfigPlano = {
  estrategia: Estrategia;
  /** Ordem da estratégia Personalizada (ids do Simulador, "d12"). */
  personalizada: string[];
  /** Total por mês, parcelas incluídas. null = só as parcelas. */
  valorMensalCentavos: number | null;
  /** Pagamentos extras pontuais (ex.: 13º em dezembro). */
  extras: ExtraDoPlano[];
  /** Reserva usada no primeiro mês (só na criação). */
  reservaUsadaCentavos: number;
};

export type LinhaPlano = { mes: string; dividaId: number; planejadoCentavos: number };
export type PontoSaldo = { mes: string; saldoCentavos: number };

export type PlanoMontado = {
  linhas: LinhaPlano[];
  /** Saldo devedor planejado no fim de cada mês. */
  saldoPlanejado: PontoSaldo[];
  saldoInicialCentavos: number;
  mesFinal: string | null;
  quitouTudo: boolean;
  resultado: ResultadoSimulacao;
};

/** Roda a simulação do plano. `jaPagoNoInicioCentavos`: o que já foi pago neste mês (sai do valor do primeiro mês). */
export function simularPlano(dividas: DividaSim[], config: ConfigPlano, inicioYm: string, jaPagoNoInicioCentavos = 0): ResultadoSimulacao {
  const extras = config.extras.filter((x) => x.mes >= inicioYm && x.valorCentavos > 0).map((x) => ({ indice: indiceDoMes(inicioYm, x.mes), valorCentavos: x.valorCentavos }));
  if (config.reservaUsadaCentavos > 0) extras.push({ indice: 0, valorCentavos: config.reservaUsadaCentavos });
  return simular({ dividas: dividas.filter((d) => !d.hipotetica), estrategia: config.estrategia, personalizada: config.personalizada, valorMensalCentavos: config.valorMensalCentavos, extras, inicioYm, jaPagoNoInicioCentavos });
}

const somar = (valores: number[]) => valores.reduce((s, v) => s + v, 0);

/**
 * Monta o plano (a meta de cada dívida em cada mês) a partir da simulação.
 * No mês de início o planejado inclui o que já foi pago neste mês (`realizadoNoMes`, por id da dívida), para a comparação fechar.
 */
export function montarPlano(p: { dividas: DividaSim[]; config: ConfigPlano; inicioYm: string; realizadoNoMes?: Record<number, number> }): PlanoMontado {
  const reais = p.dividas.filter((d) => !d.hipotetica);
  const jaPago = p.realizadoNoMes ?? {};
  const resultado = simularPlano(reais, p.config, p.inicioYm, somar(reais.map((d) => jaPago[idDaDivida(d.id)] ?? 0)));
  const linhas: LinhaPlano[] = [];
  const meses = resultado.meses.length ? resultado.meses : [{ indice: 0, mes: p.inicioYm, porDivida: {} as Record<string, { pagoCentavos: number }> }];
  for (const m of meses) {
    for (const d of reais) {
      const id = idDaDivida(d.id);
      const total = (m.porDivida[d.id]?.pagoCentavos ?? 0) + (m.indice === 0 ? (jaPago[id] ?? 0) : 0);
      if (total > 0) linhas.push({ mes: m.mes, dividaId: id, planejadoCentavos: total });
    }
  }
  return {
    linhas,
    saldoPlanejado: resultado.meses.map((m) => ({ mes: m.mes, saldoCentavos: m.saldoCentavos })),
    saldoInicialCentavos: resultado.saldoInicialCentavos,
    mesFinal: resultado.mesFinal,
    quitouTudo: resultado.quitouTudo,
    resultado,
  };
}

// ---------------------------------------------------------------------------
// Planejado x realizado
// ---------------------------------------------------------------------------

export type Pagamento = { dividaId: number; data: string; valorCentavos: number };

export type SituacaoMes = "cumprido" | "parcial" | "nao_cumprido" | "em_andamento" | "futuro";
export const ROTULO_SITUACAO_MES: Record<SituacaoMes, string> = { cumprido: "Cumprido", parcial: "Parcial", nao_cumprido: "Não cumprido", em_andamento: "Em andamento", futuro: "Futuro" };

export type MesComparado = {
  mes: string;
  planejadoCentavos: number;
  realizadoCentavos: number;
  /** Realizado menos planejado: positivo = pagou a mais (azul), negativo = pagou a menos (laranja). */
  diferencaCentavos: number;
  situacao: SituacaoMes;
  porDivida: { dividaId: number; planejadoCentavos: number; realizadoCentavos: number }[];
};

/** O realizado é a soma dos pagamentos do mês, na data em que foram pagos. */
export function realizadoPorMesEDivida(pagamentos: Pagamento[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const x of pagamentos) {
    const k = `${mesDe(x.data)}|${x.dividaId}`;
    mapa.set(k, (mapa.get(k) ?? 0) + x.valorCentavos);
  }
  return mapa;
}

/** Situação de um mês, dado o planejado e o realizado. `atual` = o mês de hoje. */
export function situacaoDoMes(mes: string, atual: string, planejadoCentavos: number, realizadoCentavos: number): SituacaoMes {
  if (mes > atual) return "futuro";
  if (planejadoCentavos <= 0 || realizadoCentavos + TOLERANCIA_CENTAVOS >= planejadoCentavos) return "cumprido";
  if (mes === atual) return "em_andamento";
  return realizadoCentavos < TOLERANCIA_CENTAVOS ? "nao_cumprido" : "parcial";
}

/**
 * Compara, mês a mês, o planejado com o realizado.
 * `encerramentos`: dívidas que já não estão ativas (quitada, renegociada, cancelada) e o mês em que acabaram (null = sem data):
 * depois disso o plano não cobra mais nada delas.
 */
export function compararPlano(p: { linhas: LinhaPlano[]; pagamentos: Pagamento[]; hoje: string; encerramentos?: Map<number, string | null> }): MesComparado[] {
  const atual = mesDe(p.hoje);
  const encerramentos = p.encerramentos ?? new Map<number, string | null>();
  const realizado = realizadoPorMesEDivida(p.pagamentos);
  const meses = [...new Set(p.linhas.map((l) => l.mes))].sort();
  const dividas = [...new Set(p.linhas.map((l) => l.dividaId))];
  return meses.map((mes) => {
    const porDivida: MesComparado["porDivida"] = [];
    for (const id of dividas) {
      if (encerramentos.has(id)) {
        const fim = encerramentos.get(id) ?? null;
        if (fim === null ? mes >= atual : mes > fim) continue;
      }
      const planejado = p.linhas.find((l) => l.mes === mes && l.dividaId === id)?.planejadoCentavos ?? 0;
      const feito = realizado.get(`${mes}|${id}`) ?? 0;
      if (planejado > 0 || feito > 0) porDivida.push({ dividaId: id, planejadoCentavos: planejado, realizadoCentavos: feito });
    }
    const planejadoCentavos = somar(porDivida.map((d) => d.planejadoCentavos));
    const realizadoCentavos = somar(porDivida.map((d) => d.realizadoCentavos));
    return { mes, planejadoCentavos, realizadoCentavos, diferencaCentavos: realizadoCentavos - planejadoCentavos, situacao: situacaoDoMes(mes, atual, planejadoCentavos, realizadoCentavos), porDivida };
  });
}

/** Os meses que contam para desvio e R9: depois de um ajuste aprovado, os anteriores ficam só no histórico. */
export const mesesAcompanhados = (meses: MesComparado[], desde: string | null) => (desde ? meses.filter((m) => m.mes >= desde) : meses);

/** Quanto falta pagar dos meses já fechados (planejado menos realizado, contando o que se pagou a mais). Nunca negativo. */
export function deficitAcumulado(meses: MesComparado[], hoje: string): number {
  const atual = mesDe(hoje);
  return Math.max(0, somar(meses.filter((m) => m.mes < atual).map((m) => m.planejadoCentavos - m.realizadoCentavos)));
}

/** O mês fechado mais recente do plano (o "mês anterior" da regra R9). */
export function mesAnteriorDoPlano(meses: MesComparado[], hoje: string): MesComparado | null {
  const atual = mesDe(hoje);
  const fechados = meses.filter((m) => m.mes < atual);
  return fechados.length ? fechados[fechados.length - 1] : null;
}

export type SerieSaldos = { mes: string; planejadoCentavos: number; realizadoCentavos: number | null }[];

/**
 * Saldo devedor planejado e realizado no fim de cada mês, para o gráfico.
 * O realizado dos meses fechados é o planejado mais o que ficou sem pagar até ali (aproximado: não conta os juros do atraso);
 * o mês atual usa o saldo de hoje. Meses futuros não têm realizado.
 */
export function serieDeSaldos(saldoPlanejado: PontoSaldo[], meses: MesComparado[], hoje: string, saldoHojeCentavos: number): SerieSaldos {
  const atual = mesDe(hoje);
  let acumulado = 0;
  return saldoPlanejado.map((p) => {
    const m = meses.find((x) => x.mes === p.mes);
    if (p.mes < atual) {
      acumulado += m ? m.planejadoCentavos - m.realizadoCentavos : 0;
      return { mes: p.mes, planejadoCentavos: p.saldoCentavos, realizadoCentavos: Math.max(0, p.saldoCentavos + acumulado) };
    }
    return { mes: p.mes, planejadoCentavos: p.saldoCentavos, realizadoCentavos: p.mes === atual ? Math.max(0, saldoHojeCentavos) : null };
  });
}

/** Quanto do plano até agora (meses fechados e o atual) já foi pago, em %. */
export function percentualDoPlano(meses: MesComparado[], hoje: string): number {
  const atual = mesDe(hoje);
  const ate = meses.filter((m) => m.mes <= atual);
  const planejado = somar(ate.map((m) => m.planejadoCentavos));
  if (planejado <= 0) return 100;
  return Math.min(100, Math.round((somar(ate.map((m) => Math.min(m.realizadoCentavos, m.planejadoCentavos))) / planejado) * 100));
}

// ---------------------------------------------------------------------------
// Previsão recalculada
// ---------------------------------------------------------------------------

/** Meses entre dois meses ("2027-03" depois de "2027-01" = 2). */
export const mesesEntre = (de: string, ate: string) => indiceDoMes("0000-01", ate) - indiceDoMes("0000-01", de);

/** A previsão com o que falta pagar hoje: segue o valor mensal e os extras que ainda vêm do plano. */
export function preverPlano(dividas: DividaSim[], config: ConfigPlano, inicioYm: string, jaPagoNoInicioCentavos: number): ResultadoSimulacao {
  return simularPlano(dividas, { ...config, reservaUsadaCentavos: 0 }, inicioYm, jaPagoNoInicioCentavos);
}

// ---------------------------------------------------------------------------
// Desvios e proposta de ajuste
// ---------------------------------------------------------------------------

export type Desvio = { tipo: "realizado_abaixo" | "previsao_atrasada" | "sobra_caiu" | "divida_nova"; texto: string };

export type NovaDivida = { id: number; descricao: string; saldoCentavos: number };

/** O plano pede ajuste quando o realizado ficou abaixo, a previsão passou do prazo, a sobra caiu muito ou entrou dívida nova. */
export function detectarDesvios(p: {
  meses: MesComparado[];
  hoje: string;
  mesFinalPlanejado: string | null;
  previsao: ResultadoSimulacao | null;
  sobraNaAprovacaoCentavos: number | null;
  sobraAtualCentavos: number | null;
  novasDividas: NovaDivida[];
}): Desvio[] {
  const desvios: Desvio[] = [];
  const atual = mesDe(p.hoje);
  const deficit = deficitAcumulado(p.meses, p.hoje);
  if (deficit > TOLERANCIA_CENTAVOS) {
    const abaixo = p.meses.filter((m) => m.mes < atual && (m.situacao === "parcial" || m.situacao === "nao_cumprido"));
    const detalhe = abaixo.map((m) => `${rotuloMes(m.mes)} (pagou ${formatarReais(m.realizadoCentavos)} de ${formatarReais(m.planejadoCentavos)})`).join("; ");
    desvios.push({ tipo: "realizado_abaixo", texto: `O realizado ficou abaixo do planejado nos meses fechados: faltam ${formatarReais(deficit)}${detalhe ? `. ${detalhe}` : ""}.` });
  }
  if (p.previsao && p.mesFinalPlanejado) {
    if (!p.previsao.quitouTudo) desvios.push({ tipo: "previsao_atrasada", texto: `Com o que falta pagar hoje e o valor mensal do plano, as dívidas não terminam em 30 anos (o plano previa ${rotuloMes(p.mesFinalPlanejado)}).` });
    else if (p.previsao.mesFinal && p.previsao.mesFinal > p.mesFinalPlanejado) {
      const n = mesesEntre(p.mesFinalPlanejado, p.previsao.mesFinal);
      desvios.push({ tipo: "previsao_atrasada", texto: `A previsão recalculada é ${rotuloMes(p.previsao.mesFinal)}, ${n} ${n === 1 ? "mês" : "meses"} depois do previsto no plano (${rotuloMes(p.mesFinalPlanejado)}).` });
    }
  }
  const { sobraNaAprovacaoCentavos: antes, sobraAtualCentavos: agora } = p;
  if (antes !== null && agora !== null && antes > 0 && agora < antes * (1 - QUEDA_SOBRA_PCT / 100)) {
    const queda = Math.round(((antes - agora) / antes) * 100);
    desvios.push({ tipo: "sobra_caiu", texto: `A sua sobra mensal caiu ${queda}%: era ${formatarReais(antes)} quando o plano foi aprovado e hoje é ${formatarReais(agora)}.` });
  }
  if (p.novasDividas.length) {
    desvios.push({ tipo: "divida_nova", texto: `${p.novasDividas.length === 1 ? "Entrou uma dívida" : `Entraram ${p.novasDividas.length} dívidas`} depois da aprovação, fora do plano: ${p.novasDividas.map((d) => `${d.descricao} (${formatarReais(d.saldoCentavos)})`).join("; ")}.` });
  }
  return desvios;
}

export type OpcaoAjuste = {
  opcao: "aumentar" | "adiar";
  titulo: string;
  /** Novo valor mensal total do plano (null = só as parcelas). */
  valorMensalCentavos: number | null;
  /** Quanto a mais por mês que o plano atual (0 quando não aumenta). */
  aumentoCentavos: number;
  mesFinal: string | null;
  /** O novo valor cabe na sobra mensal de hoje? null = sem histórico para dizer. */
  cabeNaSobra: boolean | null;
  calculo: string[];
};

export type PropostaAjuste = {
  /** Muda quando o desvio muda: serve para "Manter como está" não voltar a perguntar o mesmo. */
  assinatura: string;
  desvios: Desvio[];
  aumentar: OpcaoAjuste | null;
  adiar: OpcaoAjuste | null;
  recomendada: "aumentar" | "adiar";
};

const mesFinalDe = (r: ResultadoSimulacao) => (r.quitouTudo ? r.mesFinal : null);

/**
 * A proposta de ajuste, calculada na hora a partir do que falta pagar hoje:
 * - **aumentar**: o menor valor mensal que ainda termina no mês previsto no plano (busca por bisseção, com a simulação de verdade);
 * - **adiar**: manter o valor mensal (ou o que cabe na sobra, se ela caiu) e ver em que mês termina.
 * Nenhuma delas muda o plano: quem decide é a pessoa, em "Aprovar ajuste".
 */
export function gerarPropostaAjuste(p: {
  /** As dívidas ativas hoje (as do plano e as novas), com o que falta pagar. */
  dividas: DividaSim[];
  config: ConfigPlano;
  inicioYm: string;
  mesFinalPlanejado: string | null;
  sobraAtualCentavos: number | null;
  jaPagoNoInicioCentavos: number;
  desvios: Desvio[];
  deficitCentavos: number;
}): PropostaAjuste {
  const dividas = p.dividas.filter((d) => !d.hipotetica && d.saldoCentavos > 0);
  const referencia = somar(dividas.map((d) => d.parcelaReferenciaCentavos));
  const base = p.config.valorMensalCentavos ?? referencia;
  const config = { ...p.config, reservaUsadaCentavos: 0 };
  const simularCom = (valor: number | null) => simularPlano(dividas, { ...config, valorMensalCentavos: valor }, p.inicioYm, p.jaPagoNoInicioCentavos);
  const alvo = p.mesFinalPlanejado;
  const sobra = p.sobraAtualCentavos;

  // Aumentar: o menor valor mensal que termina até o mês previsto.
  let aumentar: OpcaoAjuste | null = null;
  if (alvo && alvo >= p.inicioYm && dividas.length) {
    const termina = (v: number) => {
      const r = simularCom(v);
      return r.quitouTudo && !!r.mesFinal && r.mesFinal <= alvo;
    };
    const teto = Math.max(base, somar(dividas.map((d) => d.saldoCentavos)) * 2 + referencia);
    let necessario = base;
    if (!termina(base)) {
      let baixo = base;
      let alto = teto;
      for (let k = 0; k < 60 && alto - baixo > 1; k++) {
        const meio = Math.floor((baixo + alto) / 2);
        if (termina(meio)) alto = meio;
        else baixo = meio;
      }
      necessario = alto;
    }
    const aumento = Math.max(0, necessario - base);
    const r = simularCom(necessario);
    aumentar = {
      opcao: "aumentar",
      titulo: aumento > 0 ? `Aumentar ${formatarReais(aumento)} por mês, de ${rotuloMes(p.inicioYm)} a ${rotuloMes(alvo)}` : `Manter ${formatarReais(base)} por mês e refazer o plano com os saldos de hoje (termina em ${rotuloMes(alvo)}, no prazo)`,
      valorMensalCentavos: necessario,
      aumentoCentavos: aumento,
      mesFinal: mesFinalDe(r),
      cabeNaSobra: sobra === null ? null : necessario <= sobra,
      calculo: [
        `Valor mensal atual do plano: ${formatarReais(base)}${p.config.valorMensalCentavos === null ? " (só as parcelas)" : ""}.`,
        `Para terminar até ${rotuloMes(alvo)} com o que falta pagar hoje, o menor valor mensal é ${formatarReais(necessario)} (a simulação testa valores até acertar o mês).`,
        `Diferença: ${formatarReais(aumento)} por mês.`,
        sobra === null ? "Sem histórico para comparar com a sua sobra mensal." : `A sua sobra mensal de hoje é ${formatarReais(sobra)}: ${necessario <= sobra ? "o novo valor cabe nela" : `o novo valor passa dela em ${formatarReais(necessario - sobra)}`}.`,
      ],
    };
  }

  // Adiar: o mesmo valor (ou o que cabe na sobra de hoje) e a data nova.
  const cabeMenos = sobra !== null && sobra < base && sobra >= referencia;
  const valorAdiar = cabeMenos ? sobra! : base;
  const rAdiar = simularCom(p.config.valorMensalCentavos === null && !cabeMenos ? null : valorAdiar);
  let adiar: OpcaoAjuste | null = null;
  const fimAdiar = mesFinalDe(rAdiar);
  if (fimAdiar) {
    const meses = alvo ? Math.max(0, mesesEntre(alvo, fimAdiar)) : 0;
    adiar = {
      opcao: "adiar",
      titulo: meses > 0 ? `Adiar a quitação em ${meses} ${meses === 1 ? "mês" : "meses"}, para ${rotuloMes(fimAdiar)}${cabeMenos ? ` (pagando ${formatarReais(valorAdiar)} por mês, o que cabe na sua sobra)` : ""}` : `Refazer o plano com os saldos de hoje, sem mudar a data (${rotuloMes(fimAdiar)})`,
      valorMensalCentavos: p.config.valorMensalCentavos === null && !cabeMenos ? null : valorAdiar,
      aumentoCentavos: 0,
      mesFinal: fimAdiar,
      cabeNaSobra: sobra === null ? null : valorAdiar <= sobra,
      calculo: [
        `Mantendo ${formatarReais(valorAdiar)} por mês${cabeMenos ? " (a sua sobra mensal de hoje é menor que o valor do plano)" : ""}, as dívidas terminam em ${rotuloMes(fimAdiar)}.`,
        alvo ? `O plano previa ${rotuloMes(alvo)}: ${meses > 0 ? `${meses} ${meses === 1 ? "mês" : "meses"} a mais` : "sem atraso"}.` : "O plano não tinha data final.",
        `Total de juros daqui para frente: ${formatarReais(rAdiar.totalJurosCentavos)}.`,
      ],
    };
  }

  const aumentarViavel = !!aumentar && (aumentar.aumentoCentavos === 0 || aumentar.cabeNaSobra === true);
  const recomendada: PropostaAjuste["recomendada"] = aumentarViavel || !adiar ? "aumentar" : "adiar";
  const assinatura = [Math.round(p.deficitCentavos / 100), p.desvios.map((d) => d.tipo).sort().join("+"), mesFinalDe(simularCom(p.config.valorMensalCentavos)) ?? "-"].join("|");
  return { assinatura, desvios: p.desvios, aumentar, adiar, recomendada: recomendada === "aumentar" && !aumentar ? "adiar" : recomendada };
}

/** A versão nova do plano ao aprovar um ajuste: os meses fechados ficam como estavam e do mês atual em diante vale o cálculo novo. */
export function montarNovaVersao(p: {
  /** Todas as dívidas ativas hoje. */
  dividas: DividaSim[];
  atual: { linhas: LinhaPlano[]; saldoPlanejado: PontoSaldo[]; config: ConfigPlano };
  opcao: OpcaoAjuste;
  inicioYm: string;
  realizadoNoMes: Record<number, number>;
}): { montado: PlanoMontado; linhas: LinhaPlano[]; saldoPlanejado: PontoSaldo[]; config: ConfigPlano } {
  const ordem = [...p.atual.config.personalizada, ...p.dividas.map((d) => d.id).filter((id) => !p.atual.config.personalizada.includes(id))];
  const config: ConfigPlano = { ...p.atual.config, valorMensalCentavos: p.opcao.valorMensalCentavos, personalizada: ordem, extras: p.atual.config.extras.filter((x) => x.mes >= p.inicioYm), reservaUsadaCentavos: 0 };
  const montado = montarPlano({ dividas: p.dividas, config, inicioYm: p.inicioYm, realizadoNoMes: p.realizadoNoMes });
  return {
    montado,
    linhas: [...p.atual.linhas.filter((l) => l.mes < p.inicioYm), ...montado.linhas],
    saldoPlanejado: [...p.atual.saldoPlanejado.filter((x) => x.mes < p.inicioYm), ...montado.saldoPlanejado],
    config,
  };
}

// ---------------------------------------------------------------------------
// Agendar pagamentos extras
// ---------------------------------------------------------------------------

export type ExtraAgendavel = { mes: string; dividaId: number; planejadoCentavos: number; jaNosLancamentosCentavos: number; agendarCentavos: number };

/**
 * O que ainda dá para agendar de cada dívida no mês: o planejado menos o que já existe em Lançamentos para ela naquele mês
 * (parcelas, extras já agendados ou pagos). Só o mês atual e o seguinte, para não encher Lançamentos de previsões que mudam.
 */
export function extrasParaAgendar(p: { linhas: LinhaPlano[]; lancamentosPorMesEDivida: Map<string, number>; hoje: string; encerramentos?: Map<number, string | null> }): ExtraAgendavel[] {
  const atual = mesDe(p.hoje);
  const janela = new Set([atual, somarMesesYm(atual, 1)]);
  const saida: ExtraAgendavel[] = [];
  for (const l of p.linhas) {
    if (!janela.has(l.mes) || p.encerramentos?.has(l.dividaId)) continue;
    const ja = p.lancamentosPorMesEDivida.get(`${l.mes}|${l.dividaId}`) ?? 0;
    const agendar = l.planejadoCentavos - ja;
    if (agendar >= TOLERANCIA_CENTAVOS) saida.push({ mes: l.mes, dividaId: l.dividaId, planejadoCentavos: l.planejadoCentavos, jaNosLancamentosCentavos: ja, agendarCentavos: agendar });
  }
  return saida.sort((a, b) => a.mes.localeCompare(b.mes) || a.dividaId - b.dividaId);
}
