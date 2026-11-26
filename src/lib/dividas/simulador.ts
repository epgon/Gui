/**
 * Simulador da Gestão de Dívidas (fase D3): só contas, sem banco.
 * Nada aqui grava, lê ou altera dado real: entra uma descrição das dívidas e sai uma projeção mês a mês.
 * Dinheiro sempre em centavos inteiros; arredondamento ao centavo mais próximo a cada mês.
 *
 * Como cada mês é calculado (para cada dívida):
 *   1. paga-se a parcela programada (e, na dívida da vez, o extra), contra o saldo que vinha do mês anterior;
 *   2. sobre o que sobrou incidem os juros do mês.
 * Assim uma parcela que vence hoje vale o valor cheio e as futuras são trazidas a valor presente pela taxa da dívida,
 * como em `valorPresente` (regras.ts). Sem pagamento extra, a conta fecha com o total das parcelas.
 */

export const LIMITE_MESES = 360;

export type Estrategia = "bola_de_neve" | "avalanche" | "risco" | "personalizada";

export const ESTRATEGIAS: { valor: Estrategia; rotulo: string; texto: string }[] = [
  { valor: "bola_de_neve", rotulo: "Bola de Neve", texto: "Começa pela dívida de menor saldo: quita mais rápido e libera parcela cedo." },
  { valor: "avalanche", rotulo: "Avalanche", texto: "Começa pela dívida de maior taxa de juros: é a que costuma pagar menos juros no total." },
  { valor: "risco", rotulo: "Risco primeiro", texto: "Começa pelo que tem as piores consequências: atraso mais antigo, depois dívida com garantia (bem), maior taxa e menor saldo." },
  { valor: "personalizada", rotulo: "Personalizada", texto: "A ordem que você escolher." },
];
export const rotuloEstrategia = (e: string) => ESTRATEGIAS.find((x) => x.valor === e)?.rotulo ?? e;

/** Uma dívida do jeito que o simulador precisa. */
export type DividaSim = {
  /** "d12" (dívida real) ou "h1" (hipotética). */
  id: string;
  nome: string;
  credor: string;
  /** Saldo que a simulação usa no começo: parcelas trazidas a valor presente (mais o atraso estimado); ou o saldo, se não há parcelas. */
  saldoCentavos: number;
  /** O que falta pagar somando as parcelas como estão (para comparar com o valor presente). */
  saldoNominalCentavos: number;
  taxaMensalPct: number;
  /** Pagamento programado em cada mês; o índice 0 é o mês atual. Vazio quando a dívida não tem parcelas. */
  cronograma: number[];
  /** Sem parcelas: o pagamento mínimo de todo mês. Nas dívidas com parcelas fica em 0. */
  parcelaMinimaCentavos: number;
  /** Uma parcela "normal" da dívida (base dos cenários). */
  parcelaReferenciaCentavos: number;
  atrasoDias: number;
  comGarantia: boolean;
  hipotetica?: boolean;
};

const arredondar = (n: number) => Math.round(n);

// ---------------------------------------------------------------------------
// Meses (texto "AAAA-MM")
// ---------------------------------------------------------------------------

export const mesDe = (data: string) => data.slice(0, 7);
const numeroDoMes = (ym: string) => Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1);
export const somarMesesYm = (ym: string, n: number): string => {
  const t = numeroDoMes(ym) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
/** Índice do mês (0 = o mês de início); datas antes do início caem no índice 0 (atrasadas vencem "agora"). */
export const indiceDoMes = (inicioYm: string, ym: string) => Math.max(0, numeroDoMes(ym) - numeroDoMes(inicioYm));

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2028-08" -> "ago/2028" */
export const rotuloMes = (ym: string) => `${MESES_CURTOS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;

// ---------------------------------------------------------------------------
// Montar a dívida do simulador
// ---------------------------------------------------------------------------

export type ObrigacaoAberta = { vencimento: string; valorCentavos: number; acrescimoCentavos: number };

/** Cronograma e saldo de uma dívida com parcelas, a partir do que falta pagar. O atraso estimado entra no mês atual. */
export function montarDividaComParcelas(p: {
  id: string;
  nome: string;
  credor: string;
  taxaMensalPct: number;
  abertas: ObrigacaoAberta[];
  inicioYm: string;
  atrasoDias: number;
  comGarantia: boolean;
}): DividaSim {
  const cronograma: number[] = [];
  for (const o of p.abertas) {
    const i = indiceDoMes(p.inicioYm, mesDe(o.vencimento));
    while (cronograma.length <= i) cronograma.push(0);
    cronograma[i] += o.valorCentavos + o.acrescimoCentavos;
  }
  const taxa = p.taxaMensalPct / 100;
  const saldo = cronograma.reduce((s, v, k) => s + v / (1 + taxa) ** k, 0);
  const nominal = cronograma.reduce((s, v) => s + v, 0);
  // Uma parcela "normal": a do segundo mês com pagamento (o primeiro pode juntar atrasos); na falta, a única que existe.
  const comValor = cronograma.map((v, k) => ({ v, k })).filter((x) => x.v > 0);
  const referencia = comValor.length > 1 ? comValor[1].v : (comValor[0]?.v ?? 0);
  return {
    id: p.id,
    nome: p.nome,
    credor: p.credor,
    saldoCentavos: arredondar(saldo),
    saldoNominalCentavos: nominal,
    taxaMensalPct: p.taxaMensalPct,
    cronograma,
    parcelaMinimaCentavos: 0,
    parcelaReferenciaCentavos: referencia,
    atrasoDias: p.atrasoDias,
    comGarantia: p.comGarantia,
  };
}

/** Dívida sem parcelas: só o saldo. O mínimo mensal padrão são os juros do mês (o saldo não cresce), editável na tela. */
export function montarDividaSemParcelas(p: { id: string; nome: string; credor: string; taxaMensalPct: number; saldoCentavos: number; parcelaMinimaCentavos?: number; atrasoDias: number; comGarantia: boolean }): DividaSim {
  const minima = p.parcelaMinimaCentavos ?? arredondar((p.saldoCentavos * p.taxaMensalPct) / 100);
  return {
    id: p.id,
    nome: p.nome,
    credor: p.credor,
    saldoCentavos: p.saldoCentavos,
    saldoNominalCentavos: p.saldoCentavos,
    taxaMensalPct: p.taxaMensalPct,
    cronograma: [],
    parcelaMinimaCentavos: Math.max(0, minima),
    parcelaReferenciaCentavos: Math.max(0, minima),
    atrasoDias: p.atrasoDias,
    comGarantia: p.comGarantia,
  };
}

/** Parcela de um financiamento pela tabela Price (primeira parcela um mês depois). */
export function parcelaPrice(valorCentavos: number, taxaMensalPct: number, parcelas: number): number {
  if (parcelas < 1 || valorCentavos <= 0) return 0;
  const i = taxaMensalPct / 100;
  if (i === 0) return arredondar(valorCentavos / parcelas);
  return arredondar((valorCentavos * i) / (1 - (1 + i) ** -parcelas));
}

/** "E se eu fizer um empréstimo?": uma dívida que não existe, com parcelas pela tabela Price a partir do mês seguinte. */
export function criarDividaHipotetica(p: { id: string; nome: string; valorCentavos: number; taxaMensalPct: number; parcelas: number }): DividaSim {
  const parcela = parcelaPrice(p.valorCentavos, p.taxaMensalPct, p.parcelas);
  const cronograma = [0, ...new Array<number>(Math.max(0, p.parcelas)).fill(parcela)];
  return {
    id: p.id,
    nome: p.nome,
    credor: "Hipotética",
    saldoCentavos: p.valorCentavos,
    saldoNominalCentavos: parcela * p.parcelas,
    taxaMensalPct: p.taxaMensalPct,
    cronograma,
    parcelaMinimaCentavos: 0,
    parcelaReferenciaCentavos: parcela,
    atrasoDias: 0,
    comGarantia: false,
    hipotetica: true,
  };
}

// ---------------------------------------------------------------------------
// Ordem de quitação
// ---------------------------------------------------------------------------

/** A ordem em que o dinheiro extra vai de uma dívida para a outra. A ordem é fixada no começo (pelo saldo inicial). */
export function ordenarDividas(estrategia: Estrategia, dividas: DividaSim[], personalizada: string[] = []): string[] {
  const reais = dividas.filter((d) => !d.hipotetica);
  const porNome = (a: DividaSim, b: DividaSim) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id);
  const menorSaldo = (a: DividaSim, b: DividaSim) => a.saldoCentavos - b.saldoCentavos || porNome(a, b);
  let ordenadas: DividaSim[];
  if (estrategia === "bola_de_neve") ordenadas = [...reais].sort(menorSaldo);
  else if (estrategia === "avalanche") ordenadas = [...reais].sort((a, b) => b.taxaMensalPct - a.taxaMensalPct || menorSaldo(a, b));
  else if (estrategia === "risco") {
    ordenadas = [...reais].sort((a, b) => b.atrasoDias - a.atrasoDias || Number(b.comGarantia) - Number(a.comGarantia) || b.taxaMensalPct - a.taxaMensalPct || menorSaldo(a, b));
  } else {
    const posicao = new Map(personalizada.map((id, i) => [id, i]));
    ordenadas = [...reais].sort((a, b) => (posicao.get(a.id) ?? 1e6) - (posicao.get(b.id) ?? 1e6) || menorSaldo(a, b));
  }
  return ordenadas.map((d) => d.id);
}

// ---------------------------------------------------------------------------
// A simulação
// ---------------------------------------------------------------------------

export type ExtraPontual = { /** 0 = o mês de início. */ indice: number; valorCentavos: number };

export type EntradaSimulacao = {
  dividas: DividaSim[];
  estrategia: Estrategia;
  personalizada?: string[];
  /** Quanto se paga por mês no total, parcelas incluídas. null = pagar só as parcelas. */
  valorMensalCentavos: number | null;
  extras?: ExtraPontual[];
  /** Mês de início ("AAAA-MM"): o mês de hoje. */
  inicioYm: string;
  limiteMeses?: number;
};

export type MesSimulado = {
  indice: number;
  mes: string;
  /** Tudo o que foi pago no mês. */
  pagoCentavos: number;
  /** Parte do pago que veio das parcelas programadas. */
  parcelasCentavos: number;
  /** Parte do pago além das parcelas. */
  extraCentavos: number;
  jurosCentavos: number;
  /** Saldo devedor total no fim do mês (já com os juros). */
  saldoCentavos: number;
  porDivida: Record<string, { pagoCentavos: number; saldoCentavos: number }>;
};

export type ResultadoDivida = {
  id: string;
  nome: string;
  quitadaEmIndice: number | null;
  quitadaEm: string | null;
  totalPagoCentavos: number;
  totalJurosCentavos: number;
};

export type AvisoSimulacao = { tipo: "nao_quita" | "nao_cobre_juros" | "valor_menor_parcelas" | "mes_negativo" | "reserva_minima" | "sobra_negativa"; texto: string };

export type ResultadoSimulacao = {
  meses: MesSimulado[];
  dividas: ResultadoDivida[];
  quitouTudo: boolean;
  mesesAteQuitar: number | null;
  mesFinal: string | null;
  saldoInicialCentavos: number;
  totalPagoCentavos: number;
  totalJurosCentavos: number;
  /** A primeira dívida a ser quitada. */
  primeiraQuitada: { id: string; nome: string; indice: number; mes: string } | null;
  ordemEscolhida: string[];
  avisos: AvisoSimulacao[];
};

/** Roda a simulação mês a mês. Função pura: não altera a entrada. */
export function simular(e: EntradaSimulacao): ResultadoSimulacao {
  const limite = e.limiteMeses ?? LIMITE_MESES;
  const ids = e.dividas.map((d) => d.id);
  const saldo = new Map(e.dividas.map((d) => [d.id, d.saldoCentavos]));
  const totalPago = new Map(ids.map((id) => [id, 0]));
  const totalJuros = new Map(ids.map((id) => [id, 0]));
  const quitadaEm = new Map<string, number>();
  const ordem = ordenarDividas(e.estrategia, e.dividas, e.personalizada);
  const extrasDoMes = (i: number) => (e.extras ?? []).filter((x) => x.indice === i).reduce((s, x) => s + Math.max(0, x.valorCentavos), 0);
  const ultimoDoCronograma = new Map(
    e.dividas.map((d) => {
      let u = -1;
      d.cronograma.forEach((v, k) => v > 0 && (u = k));
      return [d.id, u] as const;
    }),
  );
  const avisos: AvisoSimulacao[] = [];
  const meses: MesSimulado[] = [];
  for (const d of e.dividas) if (d.saldoCentavos <= 0) quitadaEm.set(d.id, 0);
  const abertas = () => e.dividas.filter((d) => (saldo.get(d.id) ?? 0) > 0);
  let mesesComParcelaMaiorQueValor = 0;

  for (let i = 0; i < limite && abertas().length > 0; i++) {
    const pagoDivida = new Map<string, number>();
    const pagar = (id: string, valor: number) => {
      const atual = saldo.get(id) ?? 0;
      const v = Math.max(0, Math.min(valor, atual));
      if (v <= 0) return 0;
      saldo.set(id, atual - v);
      pagoDivida.set(id, (pagoDivida.get(id) ?? 0) + v);
      totalPago.set(id, (totalPago.get(id) ?? 0) + v);
      return v;
    };

    // 1. Parcelas programadas.
    let parcelas = 0;
    for (const d of abertas()) {
      let devida: number;
      if (d.cronograma.length === 0) devida = d.parcelaMinimaCentavos;
      else if (i >= ultimoDoCronograma.get(d.id)!) devida = saldo.get(d.id) ?? 0; // última parcela (ou além dela): fecha os centavos
      else devida = d.cronograma[i] ?? 0;
      parcelas += pagar(d.id, devida);
    }

    // 2. O extra do mês vai para as dívidas da vez, na ordem da estratégia.
    const valorMensal = e.valorMensalCentavos;
    const oferecido = (valorMensal === null ? 0 : Math.max(0, valorMensal - parcelas)) + extrasDoMes(i);
    if (valorMensal !== null && valorMensal < parcelas) mesesComParcelaMaiorQueValor++;
    let sobraDoExtra = oferecido;
    for (const id of ordem) {
      if (sobraDoExtra <= 0) break;
      sobraDoExtra -= pagar(id, sobraDoExtra);
    }
    const extraAplicado = oferecido - sobraDoExtra;

    // 3. Juros sobre o que sobrou.
    let juros = 0;
    for (const d of e.dividas) {
      const s = saldo.get(d.id) ?? 0;
      if (s <= 0) {
        if (!quitadaEm.has(d.id)) quitadaEm.set(d.id, i);
        continue;
      }
      const j = arredondar((s * d.taxaMensalPct) / 100);
      saldo.set(d.id, s + j);
      totalJuros.set(d.id, (totalJuros.get(d.id) ?? 0) + j);
      juros += j;
    }

    const porDivida: MesSimulado["porDivida"] = {};
    for (const d of e.dividas) porDivida[d.id] = { pagoCentavos: pagoDivida.get(d.id) ?? 0, saldoCentavos: saldo.get(d.id) ?? 0 };
    meses.push({
      indice: i,
      mes: somarMesesYm(e.inicioYm, i),
      pagoCentavos: parcelas + extraAplicado,
      parcelasCentavos: parcelas,
      extraCentavos: extraAplicado,
      jurosCentavos: juros,
      saldoCentavos: [...saldo.values()].reduce((s, v) => s + v, 0),
      porDivida,
    });
  }

  const quitouTudo = abertas().length === 0;
  const dividas: ResultadoDivida[] = e.dividas.map((d) => {
    const q = quitadaEm.get(d.id);
    return {
      id: d.id,
      nome: d.nome,
      quitadaEmIndice: q ?? null,
      quitadaEm: q === undefined ? null : somarMesesYm(e.inicioYm, q),
      totalPagoCentavos: totalPago.get(d.id) ?? 0,
      totalJurosCentavos: totalJuros.get(d.id) ?? 0,
    };
  });
  const quitadas = dividas.filter((d) => d.quitadaEmIndice !== null && !e.dividas.find((x) => x.id === d.id)?.hipotetica && (e.dividas.find((x) => x.id === d.id)?.saldoCentavos ?? 0) > 0).sort((a, b) => a.quitadaEmIndice! - b.quitadaEmIndice! || ordem.indexOf(a.id) - ordem.indexOf(b.id));
  const primeira = quitadas[0];

  if (!quitouTudo) {
    const pendentes = e.dividas.filter((d) => (saldo.get(d.id) ?? 0) > 0);
    const naoCobrem = pendentes.filter((d) => meses.length > 1 && (meses[meses.length - 1].porDivida[d.id]?.saldoCentavos ?? 0) >= (meses[0].porDivida[d.id]?.saldoCentavos ?? 0));
    avisos.push({ tipo: "nao_quita", texto: `Não quita em ${Math.floor(limite / 12)} anos com esse valor.${naoCobrem.length ? ` O pagamento não cobre os juros de: ${naoCobrem.map((d) => d.nome).join(", ")}.` : ""}` });
    if (naoCobrem.length) avisos.push({ tipo: "nao_cobre_juros", texto: `O pagamento não cobre os juros de ${naoCobrem.map((d) => d.nome).join(", ")}: o saldo não diminui.` });
  }
  if (mesesComParcelaMaiorQueValor > 0) {
    avisos.push({ tipo: "valor_menor_parcelas", texto: `O valor mensal informado é menor que as parcelas em ${mesesComParcelaMaiorQueValor} ${mesesComParcelaMaiorQueValor === 1 ? "mês" : "meses"}. As parcelas foram consideradas pagas mesmo assim.` });
  }

  return {
    meses,
    dividas,
    quitouTudo,
    mesesAteQuitar: quitouTudo ? meses.length : null,
    mesFinal: quitouTudo && meses.length ? meses[meses.length - 1].mes : null,
    saldoInicialCentavos: e.dividas.reduce((s, d) => s + Math.max(0, d.saldoCentavos), 0),
    totalPagoCentavos: [...totalPago.values()].reduce((s, v) => s + v, 0),
    totalJurosCentavos: [...totalJuros.values()].reduce((s, v) => s + v, 0),
    primeiraQuitada: primeira ? { id: primeira.id, nome: primeira.nome, indice: primeira.quitadaEmIndice!, mes: primeira.quitadaEm! } : null,
    ordemEscolhida: ordem,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Sobra, reserva e avisos que dependem deles
// ---------------------------------------------------------------------------

export type SituacaoFinanceira = {
  /** Média mensal de (receitas − despesas que não são parcelas de dívida). Pode ser negativa. */
  sobraMensalCentavos: number;
  /** Média mensal das despesas que não são parcelas de dívida (positivo). */
  despesaMediaCentavos: number;
  reservaCentavos: number;
  reservaMinimaCentavos: number;
};

/** Reserva mínima: N meses de despesas médias. */
export const reservaMinima = (despesaMediaCentavos: number, meses: number) => Math.max(0, arredondar(despesaMediaCentavos * meses));

/** Quanto da reserva dá para usar sem passar da reserva mínima. */
export const reservaUsavel = (s: Pick<SituacaoFinanceira, "reservaCentavos" | "reservaMinimaCentavos">) => Math.max(0, s.reservaCentavos - s.reservaMinimaCentavos);

/**
 * Avisos de mês negativo e de reserva abaixo do mínimo.
 * Mês negativo: o que se paga das dívidas, tirando o dinheiro de fora (extra pontual, reserva, empréstimo), passa da sobra mensal.
 */
export function avisosDaSituacao(r: ResultadoSimulacao, s: SituacaoFinanceira, p: { reservaUsadaCentavos: number; extras: ExtraPontual[]; dinheiroDeForaCentavos?: number; inicioYm: string }): AvisoSimulacao[] {
  const avisos: AvisoSimulacao[] = [];
  const deFora = (i: number) => p.extras.filter((x) => x.indice === i).reduce((t, x) => t + x.valorCentavos, 0) + (i === 0 ? p.reservaUsadaCentavos + (p.dinheiroDeForaCentavos ?? 0) : 0);
  const negativos = r.meses.filter((m) => m.pagoCentavos - deFora(m.indice) > s.sobraMensalCentavos);
  if (s.sobraMensalCentavos <= 0 && r.meses.length > 0) {
    avisos.push({ tipo: "sobra_negativa", texto: "A sua sobra mensal é zero ou negativa: qualquer pagamento de dívida sai do saldo das contas ou da reserva." });
  } else if (negativos.length) {
    const primeiro = negativos[0];
    avisos.push({
      tipo: "mes_negativo",
      texto: `${negativos.length === 1 ? "Um mês fica" : `${negativos.length} meses ficam`} negativo${negativos.length === 1 ? "" : "s"} (o primeiro em ${rotuloMes(primeiro.mes)}): o pagamento passa da sua sobra mensal em ${formatarReais(primeiro.pagoCentavos - deFora(primeiro.indice) - s.sobraMensalCentavos)}.`,
    });
  }
  const aposUso = s.reservaCentavos - p.reservaUsadaCentavos;
  if (p.reservaUsadaCentavos > 0 && aposUso < s.reservaMinimaCentavos) {
    avisos.push({ tipo: "reserva_minima", texto: `Usar ${formatarReais(p.reservaUsadaCentavos)} da reserva deixa ${formatarReais(Math.max(0, aposUso))}, abaixo da reserva mínima de ${formatarReais(s.reservaMinimaCentavos)}.` });
  }
  return avisos;
}

const formatadorReais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Só para as frases do simulador (sem depender de outros módulos). */
export const formatarReais = (centavos: number) => `R$ ${formatadorReais.format(centavos / 100)}`;

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

export type Cenario = "conservador" | "intermediario" | "acelerado";
export const CENARIOS: { valor: Cenario; rotulo: string; texto: string }[] = [
  { valor: "conservador", rotulo: "Conservador", texto: "Só as parcelas e uma parte pequena da sobra. A reserva fica intocada." },
  { valor: "intermediario", rotulo: "Intermediário", texto: "As parcelas e metade da sobra. A reserva fica intocada." },
  { valor: "acelerado", rotulo: "Acelerado", texto: "As parcelas, toda a sobra e, uma vez, o que passar da reserva mínima." },
];
export type PercentuaisCenarios = { conservador: number; intermediario: number; acelerado: number };
export const PERCENTUAIS_PADRAO: PercentuaisCenarios = { conservador: 25, intermediario: 50, acelerado: 100 };

/**
 * Valor mensal e uso da reserva de cada cenário.
 * "Sobra livre" = o que sobra da sobra mensal depois das parcelas de referência; o percentual do cenário é sobre ela.
 * No Acelerado (100%) o valor mensal chega à sobra mensal inteira.
 */
export function valoresDoCenario(c: Cenario, p: { parcelasReferenciaCentavos: number; sobraMensalCentavos: number; percentuais: PercentuaisCenarios; reservaUsavelCentavos: number }): { valorMensalCentavos: number; reservaUsadaCentavos: number; extraMensalCentavos: number } {
  const sobraLivre = Math.max(0, p.sobraMensalCentavos - p.parcelasReferenciaCentavos);
  const extra = arredondar((sobraLivre * p.percentuais[c]) / 100);
  return { valorMensalCentavos: p.parcelasReferenciaCentavos + extra, reservaUsadaCentavos: c === "acelerado" ? p.reservaUsavelCentavos : 0, extraMensalCentavos: extra };
}

// ---------------------------------------------------------------------------
// Quitar uma dívida
// ---------------------------------------------------------------------------

export type AnaliseQuitacao = {
  /** Quanto custa quitar hoje (parcelas a valor presente, mais o atraso estimado). */
  quitarHojeCentavos: number;
  /** O que se pagaria seguindo as parcelas. */
  seguirComoEstaCentavos: number;
  economiaHojeCentavos: number;
  /** Seguindo as parcelas. */
  comoEsta: ResultadoSimulacao;
};

/** Quitar hoje contra seguir como está. */
export function analisarQuitacao(d: DividaSim, inicioYm: string): AnaliseQuitacao {
  const comoEsta = simular({ dividas: [d], estrategia: "avalanche", valorMensalCentavos: null, inicioYm });
  const seguir = comoEsta.totalPagoCentavos;
  return { quitarHojeCentavos: d.saldoCentavos, seguirComoEstaCentavos: seguir, economiaHojeCentavos: Math.max(0, seguir - d.saldoCentavos), comoEsta };
}

/** Pagando R$ Y a mais por mês na dívida. */
export function quitarComExtraMensal(d: DividaSim, extraCentavos: number, inicioYm: string): { resultado: ResultadoSimulacao; economiaJurosCentavos: number; mesesAntecipados: number | null } {
  const base = analisarQuitacao(d, inicioYm).comoEsta;
  const parcela = Math.max(d.parcelaReferenciaCentavos, d.parcelaMinimaCentavos);
  const resultado = simular({ dividas: [d], estrategia: "avalanche", valorMensalCentavos: parcela + Math.max(0, extraCentavos), inicioYm });
  return {
    resultado,
    economiaJurosCentavos: base.totalJurosCentavos - resultado.totalJurosCentavos,
    mesesAntecipados: base.mesesAteQuitar !== null && resultado.mesesAteQuitar !== null ? base.mesesAteQuitar - resultado.mesesAteQuitar : null,
  };
}

/**
 * Quanto pagar por mês para a dívida acabar em N meses (valor fixo, o pagamento sai no começo do mês e os juros incidem depois).
 * Parte da fórmula e sobe centavo a centavo até a simulação de fato terminar em N meses (os juros arredondados podem deixar uns centavos).
 */
export function pagamentoParaQuitarEm(d: DividaSim, meses: number, inicioYm: string): number {
  if (meses < 1 || d.saldoCentavos <= 0) return Math.max(0, d.saldoCentavos);
  const i = d.taxaMensalPct / 100;
  let p = i === 0 ? Math.ceil(d.saldoCentavos / meses) : Math.ceil((d.saldoCentavos * i) / (1 - (1 + i) ** -meses) / (1 + i));
  for (let k = 0; k < 500; k++) {
    const r = simularPagamentoFixo(d, p, inicioYm);
    if (r.quitouTudo && (r.mesesAteQuitar ?? Infinity) <= meses) return p;
    p += 1;
  }
  return p;
}

/** Simula a dívida pagando um valor mensal fixo (a mais quando maior que a parcela). */
export function simularPagamentoFixo(d: DividaSim, valorMensalCentavos: number, inicioYm: string): ResultadoSimulacao {
  return simular({ dividas: [{ ...d, cronograma: [], parcelaMinimaCentavos: 0 }], estrategia: "avalanche", valorMensalCentavos, inicioYm });
}

// ---------------------------------------------------------------------------
// Frase-resumo
// ---------------------------------------------------------------------------

export type ComparacaoEstrategia = { estrategia: Estrategia; resultado: ResultadoSimulacao };

/** Roda as quatro estratégias com as mesmas entradas. */
export function compararEstrategias(base: Omit<EntradaSimulacao, "estrategia">): ComparacaoEstrategia[] {
  return ESTRATEGIAS.filter((x) => x.valor !== "personalizada" || (base.personalizada?.length ?? 0) > 0).map((x) => ({ estrategia: x.valor, resultado: simular({ ...base, estrategia: x.valor }) }));
}

export type DestaquesComparacao = { menorJuros: Estrategia | null; quitaTudoAntes: Estrategia | null; primeiraAntes: Estrategia | null };

export function destacarComparacao(c: ComparacaoEstrategia[]): DestaquesComparacao {
  const quita = c.filter((x) => x.resultado.quitouTudo);
  const melhor = <T,>(xs: T[], chave: (x: T) => number) => (xs.length ? xs.reduce((a, b) => (chave(b) < chave(a) ? b : a)) : null);
  const juros = melhor(quita, (x) => x.resultado.totalJurosCentavos);
  const antes = melhor(quita, (x) => x.resultado.mesesAteQuitar ?? 1e9);
  const primeira = melhor(c.filter((x) => x.resultado.primeiraQuitada), (x) => x.resultado.primeiraQuitada!.indice);
  return { menorJuros: juros?.estrategia ?? null, quitaTudoAntes: antes?.estrategia ?? null, primeiraAntes: primeira?.estrategia ?? null };
}

/** A frase do Consultor para a comparação de estratégias. */
export function fraseComparacao(c: ComparacaoEstrategia[]): string {
  const quita = c.filter((x) => x.resultado.quitouTudo);
  if (!quita.length) return "Com esse valor mensal nenhuma estratégia quita tudo no prazo da simulação. Aumente o valor mensal ou use a reserva.";
  const d = destacarComparacao(c);
  const nomeDe = (e: Estrategia | null) => (e ? rotuloEstrategia(e) : "");
  const melhor = quita.find((x) => x.estrategia === d.menorJuros)!;
  const termina = melhor.resultado.mesFinal ? rotuloMes(melhor.resultado.mesFinal) : "";
  const outras = quita.filter((x) => x.estrategia !== d.menorJuros);
  const pior = outras.length ? outras.reduce((a, b) => (b.resultado.totalJurosCentavos > a.resultado.totalJurosCentavos ? b : a)) : null;
  let frase = `Com a ${nomeDe(d.menorJuros)} você termina em ${termina}`;
  if (pior && pior.resultado.totalJurosCentavos > melhor.resultado.totalJurosCentavos) {
    frase += ` e paga ${formatarReais(pior.resultado.totalJurosCentavos - melhor.resultado.totalJurosCentavos)} a menos de juros que na ${nomeDe(pior.estrategia)}`;
  } else {
    frase += " e é a que paga menos juros";
  }
  frase += ".";
  if (d.primeiraAntes && d.primeiraAntes !== d.menorJuros) {
    const a = c.find((x) => x.estrategia === d.primeiraAntes)!.resultado.primeiraQuitada!;
    const b = melhor.resultado.primeiraQuitada;
    const diferenca = b ? b.indice - a.indice : 0;
    if (diferenca > 0) frase += ` A ${nomeDe(d.primeiraAntes)} quita o primeiro credor ${diferenca} ${diferenca === 1 ? "mês" : "meses"} antes.`;
  }
  return frase;
}

// ---------------------------------------------------------------------------
// Proposta de negociação
// ---------------------------------------------------------------------------

export type OpcaoProposta = {
  rotulo: string;
  /** Quanto sai do bolso ao todo. */
  totalCentavos: number;
  /** Pago agora (entrada ou à vista). */
  agoraCentavos: number;
  parcelas: number;
  valorParcelaCentavos: number;
  /** Mês em que a última parcela é paga (null se não acaba). */
  fim: string | null;
  /** Quanto custa a mais ou a menos que o saldo de hoje (negativo = economiza). */
  diferencaSaldoCentavos: number;
};

/**
 * Compara a proposta com continuar como está e com quitar usando a reserva.
 * `saldoCentavos` é o saldo de hoje das dívidas da negociação; `continuar` é a simulação delas só com as parcelas.
 */
export function compararProposta(p: {
  saldoCentavos: number;
  proposta: { entradaCentavos: number; parcelas: number; valorParcelaCentavos: number; primeiroVencimento: string | null };
  continuar: ResultadoSimulacao;
  inicioYm: string;
  reservaCentavos: number;
  reservaMinimaCentavos: number;
  sobraMensalCentavos: number;
}): { opcoes: OpcaoProposta[]; cabeNaSobra: boolean | null; folgaCentavos: number | null; quitarComReserva: { possivel: boolean; deixaAbaixoDoMinimo: boolean; sobraDaReservaCentavos: number } } {
  const { proposta: pr } = p;
  const total = pr.entradaCentavos + pr.parcelas * pr.valorParcelaCentavos;
  const primeiro = pr.primeiroVencimento ? mesDe(pr.primeiroVencimento) : somarMesesYm(p.inicioYm, 1);
  const fimProposta = pr.parcelas > 0 ? somarMesesYm(primeiro, pr.parcelas - 1) : p.inicioYm;
  const opcoes: OpcaoProposta[] = [
    {
      rotulo: "Aceitar a proposta",
      totalCentavos: total,
      agoraCentavos: pr.entradaCentavos,
      parcelas: pr.parcelas,
      valorParcelaCentavos: pr.valorParcelaCentavos,
      fim: fimProposta,
      diferencaSaldoCentavos: total - p.saldoCentavos,
    },
    {
      rotulo: "Continuar como está",
      totalCentavos: p.continuar.totalPagoCentavos,
      agoraCentavos: 0,
      parcelas: p.continuar.meses.filter((m) => m.parcelasCentavos > 0).length,
      valorParcelaCentavos: p.continuar.meses.find((m) => m.parcelasCentavos > 0)?.parcelasCentavos ?? 0,
      fim: p.continuar.mesFinal,
      diferencaSaldoCentavos: p.continuar.totalPagoCentavos - p.saldoCentavos,
    },
    {
      rotulo: "Quitar hoje com a reserva",
      totalCentavos: p.saldoCentavos,
      agoraCentavos: p.saldoCentavos,
      parcelas: 0,
      valorParcelaCentavos: 0,
      fim: p.inicioYm,
      diferencaSaldoCentavos: 0,
    },
  ];
  const parcelaMensal = pr.parcelas > 0 ? pr.valorParcelaCentavos : null;
  const folga = parcelaMensal === null ? null : p.sobraMensalCentavos - parcelaMensal;
  const depois = p.reservaCentavos - p.saldoCentavos;
  return {
    opcoes,
    cabeNaSobra: folga === null ? null : folga >= 0,
    folgaCentavos: folga,
    quitarComReserva: { possivel: depois >= 0, deixaAbaixoDoMinimo: depois < p.reservaMinimaCentavos, sobraDaReservaCentavos: Math.max(0, depois) },
  };
}
