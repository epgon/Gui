/**
 * Sobra mensal e despesa média do Simulador (seção 8.4 da especificação), sem banco.
 * Usa as mesmas contas do Fluxo de Caixa (montarFluxoDeCaixa), pela data de pagamento, só do que já foi realizado.
 * A única diferença é de propósito: as parcelas de dívida ficam de fora, porque a sobra é o que a pessoa tem
 * para pagar as dívidas (as parcelas inclusas).
 */
import type { CategoriaNaArvore } from "@/lib/categorias";
import { colunasDoPeriodo, montarFluxoDeCaixa, type Movimento } from "@/lib/relatorios/regras";

const pad = (n: number) => String(n).padStart(2, "0");

/** Os últimos N meses fechados antes de hoje: do dia 1 do primeiro ao último dia do mês passado. */
export function periodoDaSobra(hoje: string, meses: number): { inicio: string; fim: string } {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  const total = ano * 12 + (mes - 1);
  const primeiro = total - meses;
  const ultimo = total - 1;
  const fimAno = Math.floor(ultimo / 12);
  const fimMes = (ultimo % 12) + 1;
  const diasNoMes = new Date(Date.UTC(fimAno, fimMes, 0)).getUTCDate();
  return { inicio: `${Math.floor(primeiro / 12)}-${pad((primeiro % 12) + 1)}-01`, fim: `${fimAno}-${pad(fimMes)}-${pad(diasNoMes)}` };
}

/** Tira as parcelas e lançamentos de dívida (os que têm dívida) dos movimentos. */
export const semDividas = (movimentos: Movimento[]) => movimentos.filter((m) => !m.dividaId);

export type SobraCalculada = { sobraMensalCentavos: number; despesaMediaCentavos: number; inicio: string; fim: string; meses: number };

/** Média mensal de (receitas − despesas) e das despesas, sem as dívidas, nos últimos N meses fechados. */
export function calcularSobra(movimentos: Movimento[], hoje: string, meses: number, arvore: Map<number, CategoriaNaArvore> = new Map()): SobraCalculada {
  const { inicio, fim } = periodoDaSobra(hoje, meses);
  const colunas = colunasDoPeriodo("mensal", inicio, fim);
  const fluxo = montarFluxoDeCaixa(semDividas(movimentos), "mensal", colunas, arvore);
  return { sobraMensalCentavos: fluxo.saldo.media, despesaMediaCentavos: Math.abs(fluxo.despesas.media), inicio, fim, meses: colunas.length };
}
