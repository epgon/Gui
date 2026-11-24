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
