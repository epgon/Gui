/**
 * Regras dos lançamentos recorrentes (sem banco de dados).
 * Valem no navegador e no servidor, e têm testes automáticos em regras.test.ts.
 *
 * Como funciona:
 * - A regra (intervalo, dia fixo, início, repetições ou fim) gera uma lista de ocorrências.
 * - Cada ocorrência tem uma "data" (a data original, que identifica a ocorrência) e um
 *   "vencimento" (a mesma data ou, com "Apenas dia útil", o próximo dia útil).
 * - Nada disso é gravado antes da hora: a lista é calculada sempre que a tela abre.
 */
import { dataComDia, somarDias } from "@/lib/lancamentos/regras";

export type Intervalo = "semanal" | "mensal" | "bimestral" | "trimestral" | "semestral" | "anual" | "livre";

export const INTERVALOS: { valor: Intervalo; rotulo: string }[] = [
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "mensal", rotulo: "Mensal" },
  { valor: "bimestral", rotulo: "Bimestral" },
  { valor: "trimestral", rotulo: "Trimestral" },
  { valor: "semestral", rotulo: "Semestral" },
  { valor: "anual", rotulo: "Anual" },
  { valor: "livre", rotulo: "Livre" },
];

const MESES_POR_INTERVALO: Partial<Record<Intervalo, number>> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };

/** Intervalos por mês usam o Dia Fixo; Semanal e Livre contam a partir do Início. */
export const usaDiaFixo = (intervalo: Intervalo) => MESES_POR_INTERVALO[intervalo] !== undefined;

export type RegraDatas = {
  intervalo: Intervalo;
  intervaloDias: number | null;
  diaFixo: number;
  dataInicio: string;
  repeticoes: number | null;
  dataFim: string | null;
  apenasDiaUtil: boolean;
};

export type Feriado = { dia: number; mes: number; ano: number | null };

export type Ocorrencia = { numero: number; data: string; vencimento: string };

const partes = (iso: string) => iso.split("-").map(Number) as [number, number, number];

/** Primeira ocorrência: o primeiro Dia Fixo a partir do Início (ou o próprio Início). */
export function primeiraOcorrencia(r: Pick<RegraDatas, "intervalo" | "diaFixo" | "dataInicio">): string {
  if (!usaDiaFixo(r.intervalo)) return r.dataInicio;
  const [ano, mes] = partes(r.dataInicio);
  const noMes = dataComDia(ano, mes, r.diaFixo);
  return noMes >= r.dataInicio ? noMes : dataComDia(ano, mes + 1, r.diaFixo);
}

/** Data da ocorrência n (0 = a primeira). Dia 31 em mês curto vira o último dia do mês. */
export function dataDaOcorrencia(r: Pick<RegraDatas, "intervalo" | "intervaloDias" | "diaFixo">, primeira: string, n: number): string {
  const meses = MESES_POR_INTERVALO[r.intervalo];
  if (meses !== undefined) {
    const [ano, mes] = partes(primeira);
    return dataComDia(ano, mes + meses * n, r.diaFixo);
  }
  const passo = r.intervalo === "semanal" ? 7 : Math.max(1, r.intervaloDias ?? 1);
  return somarDias(primeira, passo * n);
}

/** Sábado, domingo ou feriado não são dias úteis. */
export function ehDiaUtil(iso: string, feriados: Feriado[]): boolean {
  const [ano, mes, dia] = partes(iso);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  if (semana === 0 || semana === 6) return false;
  return !feriados.some((f) => f.dia === dia && f.mes === mes && (f.ano === null || f.ano === ano));
}

export function proximoDiaUtil(iso: string, feriados: Feriado[]): string {
  let data = iso;
  for (let i = 0; i < 30 && !ehDiaUtil(data, feriados); i++) data = somarDias(data, 1);
  return data;
}

const LIMITE_OCORRENCIAS = 5000;

/**
 * Ocorrências da regra com vencimento até "ate" (e a partir de "de", se informado).
 * Para quando acabam as repetições ou passa da data de fim.
 */
export function ocorrencias(r: RegraDatas, feriados: Feriado[], ate: string, de?: string): Ocorrencia[] {
  const lista: Ocorrencia[] = [];
  const primeira = primeiraOcorrencia(r);
  for (let n = 0; n < LIMITE_OCORRENCIAS; n++) {
    if (r.repeticoes && n >= r.repeticoes) break;
    const data = dataDaOcorrencia(r, primeira, n);
    if (r.dataFim && data > r.dataFim) break;
    if (data > ate) break;
    const vencimento = r.apenasDiaUtil ? proximoDiaUtil(data, feriados) : data;
    if (vencimento > ate || (de && vencimento < de)) continue;
    lista.push({ numero: n + 1, data, vencimento });
  }
  return lista;
}

/** A data informada é mesmo uma ocorrência desta regra? (protege contra pedidos inventados) */
export function ehOcorrencia(r: RegraDatas, data: string): boolean {
  const primeira = primeiraOcorrencia(r);
  if (data < primeira || (r.dataFim && data > r.dataFim)) return false;
  return ocorrencias({ ...r, apenasDiaUtil: false }, [], data, data).some((o) => o.data === data);
}

/** Troca #ano# e #mes# pelo ano e mês do vencimento: "Luz #mes#/#ano#" -> "Luz 11/2026". */
export function aplicarVariaveis(descricao: string, vencimento: string): string {
  const [ano, mes] = vencimento.split("-");
  return descricao.replace(/#ano#/gi, ano).replace(/#mes#/gi, mes);
}

/** Valor da ocorrência: fixo, ou a média dos últimos lançamentos pagos (arredondada ao centavo). */
export function valorDaOcorrencia(valorFixo: number, mediaUltimos: number, ultimosPagos: number[]): number {
  if (!mediaUltimos) return valorFixo;
  const usados = ultimosPagos.slice(0, mediaUltimos);
  if (!usados.length) return valorFixo;
  return Math.round(usados.reduce((s, v) => s + v, 0) / usados.length);
}

export const OPCOES_MEDIA: { valor: string; rotulo: string }[] = [
  { valor: "1", rotulo: "Valor do último lançamento" },
  ...Array.from({ length: 11 }, (_, i) => ({ valor: String(i + 2), rotulo: `Média dos últimos ${i + 2} lançamentos` })),
];

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function rotuloIntervalo(intervalo: Intervalo, intervaloDias: number | null): string {
  if (intervalo === "livre") return intervaloDias === 1 ? "Todo dia" : `A cada ${intervaloDias ?? 1} dias`;
  return INTERVALOS.find((i) => i.valor === intervalo)?.rotulo ?? intervalo;
}

/** O que aparece na coluna "Dia": "Dia 23", "Toda terça" ou "Início 05/11". */
export function rotuloDia(r: Pick<RegraDatas, "intervalo" | "diaFixo" | "dataInicio">): string {
  if (usaDiaFixo(r.intervalo)) return `Dia ${r.diaFixo}`;
  const [ano, mes, dia] = partes(r.dataInicio);
  if (r.intervalo === "semanal") {
    const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    return `${semana === 0 || semana === 6 ? "Todo" : "Toda"} ${DIAS_SEMANA[semana]}`;
  }
  return `Desde ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}
