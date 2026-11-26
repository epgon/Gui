/**
 * Onde uma conta financeira está sendo usada (para saber se ela pode ser excluída).
 * O lançamento "Saldo Inicial" não conta: ele é parte do cadastro e sai junto com a conta.
 */
export type UsoConta = { lancamentos: number; cartoes: number; recorrentes: number; regras: number; importacoes: number };
export const SEM_USO_CONTA: UsoConta = { lancamentos: 0, cartoes: 0, recorrentes: 0, regras: 0, importacoes: 0 };

const vezes = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Excluir só vale para conta sem lançamentos (fora o Saldo Inicial) e que não é usada em nada.
 * Devolve o motivo de não poder (para a dica do menu e o erro da ação) ou null quando pode.
 */
export function motivoParaNaoExcluirConta(uso: UsoConta = SEM_USO_CONTA): string | null {
  if (uso.lancamentos > 0) return `Tem ${vezes(uso.lancamentos, "lançamento", "lançamentos")}. Se não for mais usá-la, inative-a.`;
  if (uso.cartoes > 0) return `É a conta de pagamento de ${vezes(uso.cartoes, "cartão de crédito", "cartões de crédito")}. Troque a conta ${uso.cartoes === 1 ? "nele" : "neles"} antes.`;
  if (uso.recorrentes > 0) return `É usada em ${vezes(uso.recorrentes, "recorrente", "recorrentes")}. Troque a conta ${uso.recorrentes === 1 ? "nele" : "neles"} antes.`;
  if (uso.regras > 0) return `É usada em ${vezes(uso.regras, "regra de importação", "regras de importação")}. Troque a conta ${uso.regras === 1 ? "nela" : "nelas"} antes.`;
  if (uso.importacoes > 0) return "É usada em uma importação ainda em rascunho. Conclua ou exclua a importação antes.";
  return null;
}
