/**
 * Regras de dinheiro e datas dos lançamentos (sem banco de dados).
 * Valem no navegador e no servidor, e têm testes automáticos em regras.test.ts.
 * Datas sempre no formato "2026-11-24" (sem hora); dinheiro sempre em centavos.
 */

export type TipoLancamento =
  | "despesa"
  | "receita"
  | "transferencia_saida"
  | "transferencia_entrada"
  | "saldo_inicial"
  | "acerto_saldo"
  | "pagamento_fatura";

export type Periodicidade = "semanal" | "quinzenal" | "mensal" | "bimestral" | "trimestral" | "semestral" | "anual";

export const PERIODICIDADES: { valor: Periodicidade; rotulo: string }[] = [
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "quinzenal", rotulo: "Quinzenal" },
  { valor: "mensal", rotulo: "Mensal" },
  { valor: "bimestral", rotulo: "Bimestral" },
  { valor: "trimestral", rotulo: "Trimestral" },
  { valor: "semestral", rotulo: "Semestral" },
  { valor: "anual", rotulo: "Anual" },
];

/** Valor com sinal: entradas positivas, saídas negativas. */
export function valorComSinal(tipo: TipoLancamento, valorCentavos: number): number {
  switch (tipo) {
    case "receita":
    case "transferencia_entrada":
      return Math.abs(valorCentavos);
    case "saldo_inicial":
    case "acerto_saldo":
      return valorCentavos;
    default:
      return -Math.abs(valorCentavos);
  }
}

export type Situacao = "realizado" | "a_vencer" | "vencido";

/** Situação não é guardada: é calculada na hora, comparando com hoje. */
export function situacaoDe(dataVencimento: string, dataPagamento: string | null, hoje: string): Situacao {
  if (dataPagamento) return "realizado";
  return dataVencimento < hoje ? "vencido" : "a_vencer";
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const partes = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const doisDigitos = (n: number) => String(n).padStart(2, "0");
export const montarData = (ano: number, mes: number, dia: number) => `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;

/** Quantos dias tem o mês (mes de 1 a 12). */
export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Dia 31 em mês curto vira o último dia do mês. */
export function dataComDia(ano: number, mes: number, dia: number): string {
  // normaliza mês fora de 1..12
  const total = ano * 12 + (mes - 1);
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return montarData(a, m, Math.min(dia, diasNoMes(a, m)));
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = partes(iso);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28/02 ou 29/02). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = partes(iso);
  return dataComDia(a, m + meses, d);
}

/** Data da ocorrência n (0 = a própria data) numa periodicidade. */
export function somarPeriodo(iso: string, periodicidade: Periodicidade, n: number): string {
  switch (periodicidade) {
    case "semanal":
      return somarDias(iso, 7 * n);
    case "quinzenal":
      return somarDias(iso, 15 * n);
    case "mensal":
      return somarMeses(iso, n);
    case "bimestral":
      return somarMeses(iso, 2 * n);
    case "trimestral":
      return somarMeses(iso, 3 * n);
    case "semestral":
      return somarMeses(iso, 6 * n);
    case "anual":
      return somarMeses(iso, 12 * n);
  }
}

const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-11" -> { inicio: "2026-11-01", fim: "2026-11-30", rotulo: "Novembro de 2026" } */
export function mesDe(anoMes: string) {
  const [ano, mes] = anoMes.split("-").map(Number);
  return {
    anoMes: `${ano}-${doisDigitos(mes)}`,
    inicio: montarData(ano, mes, 1),
    fim: montarData(ano, mes, diasNoMes(ano, mes)),
    rotulo: `${NOMES_MESES[mes - 1]} de ${ano}`,
    anterior: somarMeses(montarData(ano, mes, 1), -1).slice(0, 7),
    seguinte: somarMeses(montarData(ano, mes, 1), 1).slice(0, 7),
  };
}

/** "2026-12-01" -> "dez/2026" */
export function rotuloCompetencia(iso: string): string {
  const [ano, mes] = partes(iso);
  return `${NOMES_MESES[mes - 1].slice(0, 3).toLowerCase()}/${ano}`;
}

// ---------------------------------------------------------------------------
// Parcelas
// ---------------------------------------------------------------------------

export type Parcela = { numero: number; descricao: string; data: string; valorCentavos: number };

/**
 * Gera as parcelas de uma compra.
 * - dividir = true: o valor informado é o total, dividido entre as parcelas.
 *   A diferença de centavos vai para a primeira parcela (1.000,00 em 12 = 83,37 + 11 × 83,33).
 * - dividir = false: cada parcela tem o valor informado.
 * - iniciarNaParcela: para compras já em andamento (ex.: começar na 4/12). A primeira parcela
 *   gerada usa a data informada; as seguintes, uma por período.
 */
export function gerarParcelas(p: {
  descricao: string;
  valorCentavos: number;
  quantidade: number;
  iniciarNaParcela: number;
  dividirValor: boolean;
  incluirParcelaNaDescricao: boolean;
  primeiraData: string;
  periodicidade: Periodicidade;
}): Parcela[] {
  const { quantidade, iniciarNaParcela } = p;
  const base = p.dividirValor ? Math.floor(p.valorCentavos / quantidade) : p.valorCentavos;
  const resto = p.dividirValor ? p.valorCentavos - base * quantidade : 0;
  const parcelas: Parcela[] = [];
  for (let numero = iniciarNaParcela; numero <= quantidade; numero++) {
    parcelas.push({
      numero,
      descricao: p.incluirParcelaNaDescricao ? `${p.descricao} ${numero}/${quantidade}` : p.descricao,
      data: somarPeriodo(p.primeiraData, p.periodicidade, numero - iniciarNaParcela),
      valorCentavos: numero === 1 ? base + resto : base,
    });
  }
  return parcelas;
}

// ---------------------------------------------------------------------------
// Fatura do cartão
// ---------------------------------------------------------------------------

/**
 * Em qual fatura a compra cai.
 * - Compra antes do dia de fechamento: fatura que fecha naquele mês.
 * - No dia do fechamento ou depois: fatura do mês seguinte.
 * - Vencimento: no mesmo mês do fechamento se o dia de vencimento for depois do fechamento;
 *   senão, no mês seguinte. Dia 31 em mês curto vira o último dia.
 */
export function faturaDaCompra(dataCompra: string, diaFechamento: number, diaVencimento: number) {
  const [ano, mes] = partes(dataCompra);
  const fechamentoDoMes = dataComDia(ano, mes, diaFechamento);
  const mesFechamento = dataCompra < fechamentoDoMes ? mes : mes + 1;
  const dataFechamento = dataComDia(ano, mesFechamento, diaFechamento);
  const [af, mf] = partes(dataFechamento);
  const dataVencimento = dataComDia(af, diaVencimento > diaFechamento ? mf : mf + 1, diaVencimento);
  return { competencia: montarData(af, mf, 1), dataFechamento, dataVencimento };
}

// ---------------------------------------------------------------------------
// Lançamento detalhado
// ---------------------------------------------------------------------------

/** Valor do detalhado = receitas dos itens − despesas dos itens. O sinal decide se é receita ou despesa. */
export function totalDetalhado(itens: { tipo: "receita" | "despesa"; valorCentavos: number }[]) {
  const saldo = itens.reduce((s, i) => s + (i.tipo === "receita" ? i.valorCentavos : -i.valorCentavos), 0);
  return { tipo: saldo > 0 ? ("receita" as const) : ("despesa" as const), valorCentavos: Math.abs(saldo), saldo };
}
