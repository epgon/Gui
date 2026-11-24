"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { falha, type Resultado } from "@/lib/cadastros/resultado";
import { normalizarPreferencia, TELAS_LISTAGEM, type PreferenciaListagem } from "@/lib/listagem/telas";
import { exigirLogin } from "@/lib/sessao";

const { preferenciaListagem: pl } = schema;

/** Grava as Configurações da Listagem (Colunas, Ordenação e Outros) de uma tela. */
export async function salvarPreferenciaListagem(tela: string, entrada: PreferenciaListagem): Promise<Resultado> {
  await exigirLogin();
  const def = TELAS_LISTAGEM[tela];
  if (!def) return falha("Esta lista não tem configurações.");
  if (!entrada || typeof entrada !== "object") return falha("Confira as configurações.");
  const p = normalizarPreferencia(tela, entrada);
  const valores = { colunas: p.colunas, ordenacao: p.ordenacao ? [p.ordenacao] : [], registrosPorPagina: p.porPagina, destacarPares: p.destacarPares, compactar: p.compactar };
  await getDb().transaction(async (tx) => {
    await tx.insert(pl).values({ tela, ...valores }).onConflictDoUpdate({ target: pl.tela, set: valores });
    await registrarAuditoria(tx, { tela: def.titulo, entidade: "Configurações da Listagem", entidadeId: null, acao: "alterou", descricao: `as Configurações da Listagem de ${def.titulo}`, dados: valores });
  });
  refresh();
  return { ok: true };
}

/** "Restaurar Padrão": apaga a configuração gravada e a lista volta ao normal. */
export async function restaurarPreferenciaListagem(tela: string): Promise<Resultado> {
  await exigirLogin();
  const def = TELAS_LISTAGEM[tela];
  if (!def) return falha("Esta lista não tem configurações.");
  await getDb().transaction(async (tx) => {
    await tx.delete(pl).where(eq(pl.tela, tela));
    await registrarAuditoria(tx, { tela: def.titulo, entidade: "Configurações da Listagem", entidadeId: null, acao: "alterou", descricao: `as Configurações da Listagem de ${def.titulo} para o padrão` });
  });
  refresh();
  return { ok: true };
}
