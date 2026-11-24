/** Listas de opções usadas nas telas de cadastro (seguras para o navegador). */

export const TIPOS_CONTA = [
  { valor: "outro", rotulo: "Outro" },
  { valor: "conta_corrente", rotulo: "Conta Corrente" },
  { valor: "carteira", rotulo: "Carteira ou Interno" },
  { valor: "poupanca", rotulo: "Poupança" },
  { valor: "investimento", rotulo: "Investimento" },
] as const;
export type TipoConta = (typeof TIPOS_CONTA)[number]["valor"];
export const rotuloTipoConta = (t: string) => TIPOS_CONTA.find((o) => o.valor === t)?.rotulo ?? "Outro";

export const SEXOS = [
  { valor: "nao_informado", rotulo: "Não informado" },
  { valor: "feminino", rotulo: "Feminino" },
  { valor: "masculino", rotulo: "Masculino" },
  { valor: "outro", rotulo: "Outro" },
] as const;
export type Sexo = (typeof SEXOS)[number]["valor"];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** Dias 1 a 31, para fechamento e vencimento do cartão. */
export const DIAS_MES = Array.from({ length: 31 }, (_, i) => String(i + 1));

export type BancoOpcao = { id: number; nome: string; codigo: string | null };
