import "server-only";
import { getDb, schema } from "@/db";

type Db = ReturnType<typeof getDb>;
/** Uma transação aberta (ou o próprio banco). */
export type Transacao = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type Acao = (typeof schema.acaoAuditoriaEnum.enumValues)[number];

/**
 * Grava uma linha na auditoria, dentro da mesma transação da operação.
 * Ex.: registrarAuditoria(tx, { tela: "Tags", entidade: "Tag", entidadeId: 3,
 *        acao: "cadastrou", descricao: "a Tag Viagem", dados: { ... } })
 */
export async function registrarAuditoria(
  tx: Transacao,
  registro: { tela: string; entidade: string; entidadeId: number | null; acao: Acao; descricao: string; dados?: unknown },
) {
  await tx.insert(schema.auditoria).values({ ...registro, dados: registro.dados ?? null });
}

/** Para alterações: guarda só os campos que mudaram, com o valor de antes e o de depois. */
export function diferencas(antes: Record<string, unknown>, depois: Record<string, unknown>) {
  const mudou: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const chave of Object.keys(depois)) {
    if (JSON.stringify(antes[chave] ?? null) !== JSON.stringify(depois[chave] ?? null)) {
      mudou[chave] = { antes: antes[chave] ?? null, depois: depois[chave] ?? null };
    }
  }
  return mudou;
}
