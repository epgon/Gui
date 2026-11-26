/**
 * Contas da Gestão de Dívidas (sem banco de dados), com testes em regras.test.ts.
 * Dinheiro sempre em centavos inteiros; datas no formato "2026-11-24".
 * Arredondamento para o centavo mais próximo (meio centavo sobe).
 */

import { dataComDia, somarMeses } from "@/lib/lancamentos/regras";

export const TIPOS_DIVIDA = [
  { valor: "emprestimo_pessoal", rotulo: "Empréstimo pessoal" },
  { valor: "consignado", rotulo: "Consignado" },
  { valor: "financiamento_veiculo", rotulo: "Financiamento de veículo" },
  { valor: "financiamento_imovel", rotulo: "Financiamento imobiliário" },
  { valor: "cartao", rotulo: "Cartão (rotativo ou parcelamento de fatura)" },
  { valor: "cheque_especial", rotulo: "Cheque especial" },
  { valor: "crediario", rotulo: "Crediário ou loja" },
  { valor: "pessoa_fisica", rotulo: "Pessoa física" },
  { valor: "conta_atrasada", rotulo: "Conta atrasada" },
  { valor: "acordo", rotulo: "Acordo" },
  { valor: "outro", rotulo: "Outro" },
] as const;
export type TipoDivida = (typeof TIPOS_DIVIDA)[number]["valor"];

export const GARANTIAS = [
  { valor: "nenhuma", rotulo: "Nenhuma" },
  { valor: "bem_financiado", rotulo: "Bem financiado (carro, imóvel)" },
  { valor: "desconto_folha", rotulo: "Desconto em folha" },
  { valor: "fiador", rotulo: "Fiador ou avalista" },
] as const;
export type GarantiaDivida = (typeof GARANTIAS)[number]["valor"];

export const FORMAS_DIVIDA = [
  { valor: "parcelas_fixas", rotulo: "Parcelas fixas" },
  { valor: "sem_parcelas", rotulo: "Sem parcelas definidas (só o saldo)" },
] as const;
export type FormaDivida = (typeof FORMAS_DIVIDA)[number]["valor"];

export const rotuloTipoDivida = (v: string) => TIPOS_DIVIDA.find((t) => t.valor === v)?.rotulo ?? v;
export const rotuloGarantia = (v: string) => GARANTIAS.find((t) => t.valor === v)?.rotulo ?? v;

/** Padrões mais comuns no Brasil: multa de 2% (uma vez) e juros de mora de 1% ao mês. */
export const MULTA_PADRAO = 2;
export const MORA_PADRAO = 1;
/** O saldo informado pelo credor vale por este tempo; depois disso o Gui volta a estimar. */
export const DIAS_SALDO_RECENTE = 60;

const arredondar = (n: number) => Math.round(n + 1e-9);

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/** Quantos dias vão de `inicio` até `fim` (negativo se `fim` for antes). */
export function diasEntre(inicio: string, fim: string): number {
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fim.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Taxas
// ---------------------------------------------------------------------------

const quatroCasas = (n: number) => Math.round(n * 10_000) / 10_000;

/** Taxa ao ano (em %) para ao mês (em %): (1 + anual)^(1/12) − 1. Ex.: 12% a.a. = 0,9489% a.m. */
export function taxaAnualParaMensal(anualPct: number): number {
  return quatroCasas(((1 + anualPct / 100) ** (1 / 12) - 1) * 100);
}

/** Taxa ao mês (em %) para ao ano (em %). */
export function taxaMensalParaAnual(mensalPct: number): number {
  return quatroCasas(((1 + mensalPct / 100) ** 12 - 1) * 100);
}

// ---------------------------------------------------------------------------
// Atraso (estimativa)
// ---------------------------------------------------------------------------

export type ConfigAtraso = {
  /** % sobre o valor da parcela, cobrada uma vez. */
  multaPct: number;
  /** % ao mês, proporcional aos dias de atraso. */
  moraMensalPct: number;
  /** Taxa de juros da dívida (% ao mês), também proporcional aos dias. Vazio = 0. */
  taxaMensalPct: number;
};

export type EstimativaAtraso = {
  dias: number;
  multaCentavos: number;
  moraCentavos: number;
  jurosCentavos: number;
  /** Só o que se soma à parcela (multa + mora + juros). */
  acrescimoCentavos: number;
  /** Parcela + acréscimo. */
  totalCentavos: number;
};

/**
 * Quanto uma parcela vencida custa hoje (estimativa, cada credor calcula de um jeito):
 * multa uma vez + mora por dia (`parcela × mora/30 × dias`) + juros da dívida pelos mesmos dias.
 * Parcela em dia (ou paga) não tem acréscimo.
 */
export function estimarAtraso(valorCentavos: number, vencimento: string, hoje: string, c: ConfigAtraso): EstimativaAtraso {
  const dias = diasEntre(vencimento, hoje);
  if (dias <= 0) return { dias: 0, multaCentavos: 0, moraCentavos: 0, jurosCentavos: 0, acrescimoCentavos: 0, totalCentavos: valorCentavos };
  const multaCentavos = arredondar((valorCentavos * c.multaPct) / 100);
  const moraCentavos = arredondar((valorCentavos * (c.moraMensalPct / 100) * dias) / 30);
  const jurosCentavos = arredondar((valorCentavos * (c.taxaMensalPct / 100) * dias) / 30);
  const acrescimoCentavos = multaCentavos + moraCentavos + jurosCentavos;
  return { dias, multaCentavos, moraCentavos, jurosCentavos, acrescimoCentavos, totalCentavos: valorCentavos + acrescimoCentavos };
}

// ---------------------------------------------------------------------------
// Saldo devedor
// ---------------------------------------------------------------------------

/** Uma obrigação da dívida: um lançamento de despesa ligado a ela (parcela, encargo ou conta acompanhada). */
export type Obrigacao = {
  id: number;
  valorCentavos: number;
  vencimento: string;
  dataPagamento: string | null;
  /** Quando o lançamento foi gravado ou alterado pela última vez (para desempatar o mesmo dia). */
  registradoEm: number;
  /** Gravada pelo botão Pagar da dívida sem parcelas (só essas abatem o saldo informado). */
  deSistema: boolean;
};

export type SaldoInformado = { saldoCentavos: number; data: string; registradoEm: number };

/** Obrigações ainda não pagas. */
export const emAberto = (obrigacoes: Obrigacao[]) => obrigacoes.filter((o) => !o.dataPagamento);

/** Saldo pelas parcelas: soma das obrigações ainda não pagas. */
export function saldoPelasParcelas(obrigacoes: Obrigacao[]): number {
  return emAberto(obrigacoes).reduce((s, o) => s + o.valorCentavos, 0);
}

/** Saldo estimado: pelas parcelas mais a estimativa de multa e juros das vencidas. */
export function saldoEstimado(obrigacoes: Obrigacao[], hoje: string, c: ConfigAtraso): number {
  return emAberto(obrigacoes).reduce((s, o) => s + estimarAtraso(o.valorCentavos, o.vencimento, hoje, c).totalCentavos, 0);
}

/** Um pagamento "depois" do saldo informado: em outro dia, ou no mesmo dia mas gravado depois. */
const depoisDe = (o: Obrigacao, inf: SaldoInformado) =>
  !!o.dataPagamento && (o.dataPagamento > inf.data || (o.dataPagamento === inf.data && o.registradoEm > inf.registradoEm));

/** Saldo informado: o último que o credor disse, menos os pagamentos feitos depois dele (nunca abaixo de zero). */
export function saldoInformadoAtual(inf: SaldoInformado, obrigacoes: Obrigacao[], somenteDeSistema = false): number {
  const pagos = obrigacoes.filter((o) => depoisDe(o, inf) && (!somenteDeSistema || o.deSistema)).reduce((s, o) => s + o.valorCentavos, 0);
  return Math.max(0, inf.saldoCentavos - pagos);
}

export type OrigemSaldo = "informado" | "estimado" | "parcelas";

export type ResumoSaldo = {
  pelasParcelas: number;
  estimado: number;
  /** Só quando há saldo informado (já abatidos os pagamentos depois dele). */
  informado: number | null;
  informadoEm: string | null;
  /** O informado tem mais de 60 dias. */
  informadoAntigo: boolean;
  /** O valor que a tela mostra, com a etiqueta de onde veio. */
  exibido: number;
  origem: OrigemSaldo;
  /** Quanto de multa e juros já se acumulou nas parcelas vencidas. */
  atrasoCentavos: number;
};

/**
 * Os três saldos e o que mostrar (seção 8.3 da especificação):
 * o informado quando existe e tem menos de 60 dias; senão o estimado (se há atraso) ou o das parcelas.
 * Dívida sem parcelas definidas parte do saldo informado e soma o que estiver em aberto (encargos, contas acompanhadas).
 */
export function resumirSaldo(p: {
  forma: "parcelas_fixas" | "sem_parcelas";
  obrigacoes: Obrigacao[];
  informado: SaldoInformado | null;
  hoje: string;
  atraso: ConfigAtraso;
}): ResumoSaldo {
  const { forma, obrigacoes, informado, hoje, atraso } = p;
  const pelasParcelas = saldoPelasParcelas(obrigacoes);
  const estimadoParcelas = saldoEstimado(obrigacoes, hoje, atraso);
  const atrasoCentavos = estimadoParcelas - pelasParcelas;
  const idade = informado ? diasEntre(informado.data, hoje) : null;
  const informadoAntigo = idade !== null && idade > DIAS_SALDO_RECENTE;
  const informadoAtual = informado ? saldoInformadoAtual(informado, obrigacoes, forma === "sem_parcelas") : null;

  if (forma === "sem_parcelas") {
    const base = informadoAtual ?? 0;
    return {
      pelasParcelas: base + pelasParcelas,
      estimado: base + estimadoParcelas,
      informado: informadoAtual,
      informadoEm: informado?.data ?? null,
      informadoAntigo,
      exibido: base + estimadoParcelas,
      origem: "informado",
      atrasoCentavos,
    };
  }
  const usaInformado = informadoAtual !== null && !informadoAntigo;
  return {
    pelasParcelas,
    estimado: estimadoParcelas,
    informado: informadoAtual,
    informadoEm: informado?.data ?? null,
    informadoAntigo,
    exibido: usaInformado ? informadoAtual : estimadoParcelas,
    origem: usaInformado ? "informado" : atrasoCentavos > 0 ? "estimado" : "parcelas",
    atrasoCentavos,
  };
}

/** Valor presente das parcelas futuras (quanto deve custar quitar hoje, se há taxa): parcela / (1 + i)^n, n em meses. */
export function valorPresente(obrigacoes: Obrigacao[], hoje: string, taxaMensalPct: number): number {
  const i = taxaMensalPct / 100;
  return emAberto(obrigacoes).reduce((s, o) => {
    const meses = Math.max(0, diasEntre(hoje, o.vencimento)) / 30;
    return s + arredondar(o.valorCentavos / (1 + i) ** meses);
  }, 0);
}

// ---------------------------------------------------------------------------
// Situação
// ---------------------------------------------------------------------------

export type SituacaoDivida = "em_dia" | "em_atraso" | "em_negociacao" | "quitada" | "renegociada" | "cancelada";

/** Dívida com algo a pagar: em dia, em atraso ou em negociação. */
export const estaAtiva = (s: SituacaoDivida) => s === "em_dia" || s === "em_atraso" || s === "em_negociacao";

export const ROTULO_SITUACAO_DIVIDA: Record<SituacaoDivida, string> = {
  em_dia: "Em dia",
  em_atraso: "Em atraso",
  em_negociacao: "Em negociação",
  quitada: "Quitada",
  renegociada: "Renegociada",
  cancelada: "Cancelada",
};

export type SituacaoCalculada = { situacao: SituacaoDivida; diasAtraso: number; parcelasAtrasadas: number };

/**
 * Situação mostrada (seção 6.5). Renegociada e Cancelada vêm do cadastro. As outras saem das parcelas:
 * sem nada a pagar é Quitada; com uma negociação em andamento, Em negociação (os dias de atraso continuam sendo calculados);
 * com parcela vencida e não paga, Em atraso (com os dias da mais antiga); senão, Em dia.
 * Assim, "Voltar para não pago" numa parcela reabre a dívida sozinho.
 */
export function situacaoDaDivida(p: {
  situacao: "ativa" | "quitada" | "renegociada" | "cancelada";
  forma: "parcelas_fixas" | "sem_parcelas";
  obrigacoes: Obrigacao[];
  saldoCentavos: number;
  hoje: string;
  /** Há uma negociação em andamento envolvendo esta dívida. */
  emNegociacao?: boolean;
}): SituacaoCalculada {
  if (p.situacao === "renegociada") return { situacao: "renegociada", diasAtraso: 0, parcelasAtrasadas: 0 };
  if (p.situacao === "cancelada") return { situacao: "cancelada", diasAtraso: 0, parcelasAtrasadas: 0 };
  const abertas = emAberto(p.obrigacoes);
  const vencidas = abertas.filter((o) => o.vencimento < p.hoje);
  const diasAtraso = vencidas.length ? Math.max(...vencidas.map((o) => diasEntre(o.vencimento, p.hoje))) : 0;
  const nadaAPagar = p.forma === "parcelas_fixas" ? abertas.length === 0 && p.obrigacoes.length > 0 : p.saldoCentavos <= 0;
  if (nadaAPagar || (p.situacao === "quitada" && abertas.length === 0)) return { situacao: "quitada", diasAtraso: 0, parcelasAtrasadas: 0 };
  if (p.emNegociacao) return { situacao: "em_negociacao", diasAtraso, parcelasAtrasadas: vencidas.length };
  if (vencidas.length) return { situacao: "em_atraso", diasAtraso, parcelasAtrasadas: vencidas.length };
  return { situacao: "em_dia", diasAtraso: 0, parcelasAtrasadas: 0 };
}

/** Quanto já foi pago em relação ao que foi pago mais o que falta (0 a 100). */
export function percentualPago(pagoCentavos: number, saldoCentavos: number): number {
  const total = pagoCentavos + saldoCentavos;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((pagoCentavos / total) * 100)));
}

// ---------------------------------------------------------------------------
// Amortização (pagamento extra)
// ---------------------------------------------------------------------------

export type ParcelaAberta = { id: number; vencimento: string; valorCentavos: number };
export type AjusteAmortizacao = { id: number; vencimento: string; antesCentavos: number; depoisCentavos: number; removida: boolean };

/** Parcelas na ordem em que serão pagas. */
const porData = (a: ParcelaAberta, b: ParcelaAberta) => (a.vencimento === b.vencimento ? a.id - b.id : a.vencimento < b.vencimento ? -1 : 1);

export type ResultadoAmortizacao = { ok: true; ajustes: AjusteAmortizacao[] } | { ok: false; erro: string };

/**
 * "Reduzir o valor das próximas parcelas": o extra sai de todas as parcelas em aberto, na proporção do valor de cada uma.
 * Os centavos que sobram da divisão vão, um a um, para as primeiras parcelas. A soma dos cortes é exatamente o extra.
 */
export function amortizarReduzindoValor(parcelas: ParcelaAberta[], extraCentavos: number): ResultadoAmortizacao {
  const lista = [...parcelas].sort(porData);
  const total = lista.reduce((s, p) => s + p.valorCentavos, 0);
  if (!lista.length) return { ok: false, erro: "Não há parcelas em aberto." };
  if (!Number.isInteger(extraCentavos) || extraCentavos <= 0) return { ok: false, erro: "Informe um valor maior que zero." };
  if (extraCentavos >= total) return { ok: false, erro: "O valor cobre todas as parcelas em aberto. Use **Quitar**." };
  const cortes = lista.map((p) => Math.floor((extraCentavos * p.valorCentavos) / total));
  let resto = extraCentavos - cortes.reduce((s, c) => s + c, 0);
  for (let i = 0; resto > 0; i = (i + 1) % lista.length) {
    if (cortes[i] < lista[i].valorCentavos) {
      cortes[i] += 1;
      resto -= 1;
    }
  }
  return {
    ok: true,
    ajustes: lista.map((p, i) => ({ id: p.id, vencimento: p.vencimento, antesCentavos: p.valorCentavos, depoisCentavos: p.valorCentavos - cortes[i], removida: false })),
  };
}

/**
 * "Reduzir a quantidade": o extra quita as últimas parcelas inteiras; o que sobrar abate a parcela seguinte
 * (de trás para a frente). A soma do que sai é exatamente o extra.
 */
export function amortizarReduzindoQuantidade(parcelas: ParcelaAberta[], extraCentavos: number): ResultadoAmortizacao {
  const lista = [...parcelas].sort(porData);
  const total = lista.reduce((s, p) => s + p.valorCentavos, 0);
  if (!lista.length) return { ok: false, erro: "Não há parcelas em aberto." };
  if (!Number.isInteger(extraCentavos) || extraCentavos <= 0) return { ok: false, erro: "Informe um valor maior que zero." };
  if (extraCentavos >= total) return { ok: false, erro: "O valor cobre todas as parcelas em aberto. Use **Quitar**." };
  let resto = extraCentavos;
  const ajustes: AjusteAmortizacao[] = lista.map((p) => ({ id: p.id, vencimento: p.vencimento, antesCentavos: p.valorCentavos, depoisCentavos: p.valorCentavos, removida: false }));
  for (let i = ajustes.length - 1; i >= 0 && resto > 0; i--) {
    const a = ajustes[i];
    if (resto >= a.antesCentavos) {
      resto -= a.antesCentavos;
      a.depoisCentavos = 0;
      a.removida = true;
    } else {
      a.depoisCentavos = a.antesCentavos - resto;
      resto = 0;
    }
  }
  return { ok: true, ajustes };
}

// ---------------------------------------------------------------------------
// Vínculos (faturas e recorrentes acompanhados como dívida)
// ---------------------------------------------------------------------------

export type AlvoVinculo = { tipo: "fatura" | "recorrencia" | "lancamento"; id: number };
export type VinculoExistente = AlvoVinculo & { dividaId: number };

/**
 * Cada fatura, recorrente ou lançamento fica ligado a no máximo uma dívida (a obrigação existe uma vez só).
 * Devolve a dívida que já tem o alvo, ou null se ele está livre.
 */
export function dividaQueJaTem(existentes: VinculoExistente[], alvo: AlvoVinculo): number | null {
  return existentes.find((v) => v.tipo === alvo.tipo && v.id === alvo.id)?.dividaId ?? null;
}

/** "Lembrar todo mês": a primeira data com o dia escolhido, de hoje em diante (dia 31 vale o último dia de meses mais curtos). */
export function primeiroDiaDoLembrete(hoje: string, dia: number): string {
  const noMes = dataComDia(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), dia);
  if (noMes >= hoje) return noMes;
  const proximo = somarMeses(`${hoje.slice(0, 7)}-01`, 1);
  return dataComDia(Number(proximo.slice(0, 4)), Number(proximo.slice(5, 7)), dia);
}
