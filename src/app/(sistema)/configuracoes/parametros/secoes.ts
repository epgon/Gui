/** Seções da tela de Parâmetros (fora do arquivo "use client" para a página do servidor poder ler). */
export const SECOES = [
  { chave: "gerais", titulo: "Parâmetros Gerais" },
  { chave: "lancamentos", titulo: "Lançamentos" },
  { chave: "contas", titulo: "Contas e Cartões" },
  { chave: "auxiliares", titulo: "Campos Auxiliares" },
  { chave: "feriados", titulo: "Feriados" },
] as const;
export type Secao = (typeof SECOES)[number]["chave"];
