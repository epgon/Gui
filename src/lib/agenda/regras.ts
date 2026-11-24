import { diasNoMes, montarData, somarDias, type Situacao } from "@/lib/lancamentos/regras";

/** O mínimo de um lançamento que a Agenda precisa para as contas do dia. */
type Movimento = { data: string; valorCentavos: number; situacao: Situacao };

export type ResumoDia = { total: number; receitas: number; despesas: number; quantidade: number; percentual: number };

/**
 * Total do dia e "% Realizado": quanto do movimento do dia (receitas mais despesas, sem sinal)
 * já foi pago ou recebido. Arredondado para baixo, para só mostrar 100% quando tudo foi realizado.
 */
export function resumirDia(linhas: Movimento[]): ResumoDia {
  let receitas = 0;
  let despesas = 0;
  let realizado = 0;
  for (const l of linhas) {
    if (l.valorCentavos > 0) receitas += l.valorCentavos;
    else despesas -= l.valorCentavos;
    if (l.situacao === "realizado") realizado += Math.abs(l.valorCentavos);
  }
  const movimento = receitas + despesas;
  return {
    total: receitas - despesas,
    receitas,
    despesas,
    quantidade: linhas.length,
    percentual: movimento ? Math.floor((realizado / movimento) * 100) : 0,
  };
}

/** Separa os lançamentos por dia (AAAA-MM-DD). */
export function agruparPorDia<T extends { data: string }>(linhas: T[]): Map<string, T[]> {
  const porDia = new Map<string, T[]>();
  for (const l of linhas) {
    const lista = porDia.get(l.data);
    if (lista) lista.push(l);
    else porDia.set(l.data, [l]);
  }
  return porDia;
}

/** Datas do calendário do mês ("AAAA-MM"), em semanas completas de domingo a sábado. */
export function gradeDoMes(anoMes: string): string[] {
  const [ano, mes] = anoMes.split("-").map(Number);
  const primeiro = montarData(ano, mes, 1);
  const semanaDoPrimeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const inicio = somarDias(primeiro, -semanaDoPrimeiro);
  const total = Math.ceil((semanaDoPrimeiro + diasNoMes(ano, mes)) / 7) * 7;
  return Array.from({ length: total }, (_, i) => somarDias(inicio, i));
}
