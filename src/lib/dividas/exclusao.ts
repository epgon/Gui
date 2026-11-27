/**
 * Onde uma dívida está sendo usada (para saber se ela pode ser excluída).
 * `pagamentos` conta tudo o que já foi pago por ela: parcelas, encargos, amortizações, quitação e
 * pagamentos anteriores ao cadastro, além das faturas e recorrentes acompanhados que já tiveram pagamento.
 */
export type UsoDivida = {
  pagamentos: number;
  /** "original": foi renegociada e virou parte de um acordo. "acordo": é o acordo de uma renegociação. */
  renegociacao: "original" | "acordo" | null;
  negociacoes: number;
  planos: number;
};
export const SEM_USO_DIVIDA: UsoDivida = { pagamentos: 0, renegociacao: null, negociacoes: 0, planos: 0 };

const vezes = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Excluir só vale para dívida sem nenhum pagamento e que não está em renegociação, negociação nem plano de quitação.
 * Devolve o motivo de não poder (para a dica do menu e o erro da ação) ou null quando pode.
 */
export function motivoParaNaoExcluirDivida(uso: UsoDivida = SEM_USO_DIVIDA): string | null {
  if (uso.pagamentos > 0) return `Tem ${vezes(uso.pagamentos, "pagamento registrado", "pagamentos registrados")}. Se não for mais cobrada, cancele a dívida.`;
  if (uso.renegociacao === "original") return "Foi renegociada e faz parte de um acordo. Desfaça a renegociação no acordo antes.";
  if (uso.renegociacao === "acordo") return "É o acordo de uma renegociação. Use Desfazer renegociação para apagá-lo.";
  if (uso.negociacoes > 0) return `Está em ${vezes(uso.negociacoes, "negociação", "negociações")}. Tire a dívida ${uso.negociacoes === 1 ? "dela" : "delas"} ou exclua ${uso.negociacoes === 1 ? "a negociação" : "as negociações"} antes.`;
  if (uso.planos > 0) return `Está em ${vezes(uso.planos, "plano de quitação", "planos de quitação")}. Retire a dívida ${uso.planos === 1 ? "dele" : "deles"} antes.`;
  return null;
}
