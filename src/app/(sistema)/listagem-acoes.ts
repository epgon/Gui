"use server";

import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { falha, type Resultado } from "@/lib/cadastros/resultado";
import { normalizarPreferencia, TELA_GLOBAL, TELAS_LISTAGEM, type PreferenciaListagem } from "@/lib/listagem/telas";
import { exigirLogin } from "@/lib/sessao";

const { preferenciaListagem: pl } = schema;

/**
 * Grava, na hora, as Configurações da Listagem de uma tela (Colunas, Ordenação e Outros).
 * A aparência (linhas pares e compactar) vale para todas as listas e vai em `salvarAparenciaListagens`.
 */
export async function salvarPreferenciaListagem(tela: string, entrada: PreferenciaListagem): Promise<Resultado> {
  await exigirLogin();
  const def = TELAS_LISTAGEM[tela];
  if (!def) return falha("Esta lista não tem configurações.");
  if (!entrada || typeof entrada !== "object") return falha("Confira as configurações.");
  const p = normalizarPreferencia(tela, entrada);
  const valores = { colunas: p.colunas, ordenacao: p.ordenacao, registrosPorPagina: p.porPagina, semPaginacao: p.semPaginacao, destaques: p.destaques };
  // Os destaques só existem nas telas que os têm: nas outras não entram no registro da auditoria.
  const dadosAuditoria = def.destaques ? valores : { colunas: p.colunas, ordenacao: p.ordenacao, registrosPorPagina: p.porPagina, semPaginacao: p.semPaginacao };
  await getDb().transaction(async (tx) => {
    await tx.insert(pl).values({ tela, ...valores }).onConflictDoUpdate({ target: pl.tela, set: valores });
    await registrarAuditoria(tx, { tela: def.titulo, entidade: "Configurações da Listagem", entidadeId: null, acao: "alterou", descricao: `as Configurações da Listagem de ${def.titulo}`, dados: dadosAuditoria });
  });
  refresh();
  return { ok: true };
}

/** "Aparência em Todas as Listagens": vale para todas as listas, por isso fica numa linha só (tela "*"). */
export async function salvarAparenciaListagens(entrada: { destacarPares: boolean; compactar: boolean }): Promise<Resultado> {
  await exigirLogin();
  if (!entrada || typeof entrada.destacarPares !== "boolean" || typeof entrada.compactar !== "boolean") return falha("Confira as configurações.");
  const valores = { destacarPares: entrada.destacarPares, compactar: entrada.compactar };
  await getDb().transaction(async (tx) => {
    await tx.insert(pl).values({ tela: TELA_GLOBAL, ...valores }).onConflictDoUpdate({ target: pl.tela, set: valores });
    await registrarAuditoria(tx, { tela: "Todas as Listagens", entidade: "Configurações da Listagem", entidadeId: null, acao: "alterou", descricao: "a aparência de todas as listagens", dados: valores });
  });
  refresh();
  return { ok: true };
}
