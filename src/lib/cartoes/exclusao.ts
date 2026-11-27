/**
 * Onde um cartão de crédito está sendo usado (para saber se ele pode ser excluído).
 * `lancamentos` conta as compras no cartão; `faturas` conta as faturas já criadas para ele.
 */
export type UsoCartao = { lancamentos: number; faturas: number; recorrentes: number; regras: number; importacoes: number };
export const SEM_USO_CARTAO: UsoCartao = { lancamentos: 0, faturas: 0, recorrentes: 0, regras: 0, importacoes: 0 };

const vezes = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Excluir só vale para cartão sem lançamentos nem faturas e que não é usado em nada.
 * Devolve o motivo de não poder (para a dica do menu e o erro da ação) ou null quando pode.
 */
export function motivoParaNaoExcluirCartao(uso: UsoCartao = SEM_USO_CARTAO): string | null {
  if (uso.lancamentos > 0) return `Tem ${vezes(uso.lancamentos, "lançamento", "lançamentos")}. Se não for mais usá-lo, inative-o.`;
  if (uso.faturas > 0) return `Tem ${vezes(uso.faturas, "fatura", "faturas")}. Se não for mais usá-lo, inative-o.`;
  if (uso.recorrentes > 0) return `É usado em ${vezes(uso.recorrentes, "recorrente", "recorrentes")}. Troque o cartão ${uso.recorrentes === 1 ? "nele" : "neles"} antes.`;
  if (uso.regras > 0) return `É usado em ${vezes(uso.regras, "regra de importação", "regras de importação")}. Troque o cartão ${uso.regras === 1 ? "nela" : "nelas"} antes.`;
  if (uso.importacoes > 0) return "É usado em uma importação ainda em rascunho. Conclua ou exclua a importação antes.";
  return null;
}
