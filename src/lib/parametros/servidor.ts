import "server-only";
import { cache } from "react";
import { getDb, schema } from "@/db";
import { lerParametrosDe, lerRecursosDe, type Parametros, type Recurso, type Recursos } from "./tipos";

/** Todas as configurações (a tabela é pequena), lidas uma vez por página. */
export const lerConfiguracoes = cache(async (): Promise<Record<string, unknown>> => {
  const linhas = await getDb().select({ chave: schema.configuracao.chave, valor: schema.configuracao.valor }).from(schema.configuracao);
  return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
});

export async function lerParametros(): Promise<Parametros> {
  return lerParametrosDe(await lerConfiguracoes());
}

export async function lerRecursos(): Promise<Recursos> {
  return lerRecursosDe(await lerConfiguracoes());
}

export async function recursoAtivo(r: Recurso): Promise<boolean> {
  return (await lerRecursos())[r];
}
