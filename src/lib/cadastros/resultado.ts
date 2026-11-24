import { z } from "zod";

/**
 * O que toda ação de cadastro devolve para a tela.
 * A mensagem de erro pode marcar o nome do campo com **asteriscos duplos**
 * para ele aparecer em negrito na faixa amarela ("Preencha o campo **Descrição**.").
 */
export type Resultado = { ok: true; id?: number } | { ok: false; erro: string };

export const falha = (erro: string): Resultado => ({ ok: false, erro });

/** Primeiro erro de uma validação Zod, no formato da faixa amarela. */
export function primeiroErro(erro: z.ZodError): Resultado {
  return falha(erro.issues[0]?.message ?? "Confira os campos do formulário.");
}

/** Texto obrigatório: "Preencha o campo **Nome**." */
export const obrigatorio = (campo: string, maximo = 120) =>
  z
    .string({ error: `Preencha o campo **${campo}**.` })
    .trim()
    .min(1, `Preencha o campo **${campo}**.`)
    .max(maximo, `O campo **${campo}** aceita no máximo ${maximo} caracteres.`);

/** Texto opcional: vazio vira null. */
export const opcional = (campo: string, maximo = 200) =>
  z
    .string()
    .trim()
    .max(maximo, `O campo **${campo}** aceita no máximo ${maximo} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const idValido = z.number().int().positive();

/**
 * Campo Auxiliar dos cadastros (Parâmetros > Campos Auxiliares): texto livre opcional.
 * Quem não manda o campo (ex.: cadastro rápido dentro do lançamento) não mexe nele.
 * Devolve null quando passa do tamanho.
 */
export function lerCampoAuxiliar(entrada: unknown): { campoAuxiliar?: string | null } | null {
  if (!entrada || typeof entrada !== "object" || !("campoAuxiliar" in entrada)) return {};
  const v = (entrada as { campoAuxiliar: unknown }).campoAuxiliar;
  if (v === undefined) return {};
  const texto = typeof v === "string" ? v.trim() : "";
  if (texto.length > 200) return null;
  return { campoAuxiliar: texto || null };
}
export const ERRO_AUXILIAR = "O **Campo Auxiliar** aceita no máximo 200 caracteres.";
