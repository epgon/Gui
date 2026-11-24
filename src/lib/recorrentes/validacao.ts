import "server-only";
import { dataValida } from "@/lib/datas";
import type { DadosRecorrencia } from "@/lib/lancamentos/tipos";
import { INTERVALOS, primeiraOcorrencia, usaDiaFixo, type Intervalo } from "./regras";

/** Erro de preenchimento: a mensagem vai para a faixa amarela do formulário. */
export class ErroValidacao extends Error {}
const erro = (mensagem: string): never => {
  throw new ErroValidacao(mensagem);
};

const MAXIMO_REPETICOES = 999;

/** Valida o bloco de recorrência (Intervalo, Dia Fixo, Início, Repetições ou Fim). */
export function lerDatasRecorrencia(d: DadosRecorrencia) {
  const intervalo = (INTERVALOS.find((i) => i.valor === d?.intervalo)?.valor ?? erro("Selecione o campo **Intervalo**.")) as Intervalo;
  let intervaloDias: number | null = null;
  if (intervalo === "livre") {
    intervaloDias = Number(d.intervaloDias);
    if (!Number.isInteger(intervaloDias) || intervaloDias < 1 || intervaloDias > 3650) erro("Informe de 1 a 3650 no campo **A cada quantos dias**.");
  }
  if (!d.dataInicio) erro("Preencha o campo **Início**.");
  if (!dataValida(d.dataInicio)) erro("Informe uma data válida no campo **Início**.");
  let diaFixo = Number(d.diaFixo);
  if (usaDiaFixo(intervalo)) {
    if (!Number.isInteger(diaFixo) || diaFixo < 1 || diaFixo > 31) erro("Informe um dia de 1 a 31 no campo **Dia Fixo**.");
  } else {
    diaFixo = Number(d.dataInicio.slice(8, 10));
  }
  let repeticoes: number | null = null;
  let dataFim: string | null = null;
  if (d.fim === "data") {
    if (d.dataFim) {
      if (!dataValida(d.dataFim)) erro("Informe uma data válida no campo **Fim**.");
      dataFim = d.dataFim;
      if (dataFim < primeiraOcorrencia({ intervalo, diaFixo, dataInicio: d.dataInicio })) erro("O **Fim** precisa ser depois da primeira ocorrência.");
    }
  } else if (String(d.repeticoes ?? "").trim()) {
    repeticoes = Number(d.repeticoes);
    if (!Number.isInteger(repeticoes) || repeticoes < 1 || repeticoes > MAXIMO_REPETICOES) erro(`Informe de 1 a ${MAXIMO_REPETICOES} no campo **Repetições** (ou deixe em branco para não ter fim).`);
  }
  return { intervalo, intervaloDias, diaFixo, dataInicio: d.dataInicio, repeticoes, dataFim, apenasDiaUtil: !!d.apenasDiaUtil };
}
