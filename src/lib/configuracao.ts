import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { registrarAuditoria, type Transacao } from "@/lib/auditoria";

const { configuracao } = schema;

/** Lê uma configuração (tabela chave e valor). Sem nada gravado, devolve undefined. */
export async function lerConfiguracao(chave: string): Promise<unknown> {
  const [linha] = await getDb().select({ valor: configuracao.valor }).from(configuracao).where(eq(configuracao.chave, chave)).limit(1);
  return linha?.valor;
}

/** Grava (ou atualiza) uma configuração e registra na auditoria, na mesma transação. */
export async function gravarConfiguracao(tx: Transacao, chave: string, valor: unknown, auditoria: { tela: string; descricao: string }) {
  const [antes] = await tx.select({ valor: configuracao.valor }).from(configuracao).where(eq(configuracao.chave, chave)).limit(1);
  await tx
    .insert(configuracao)
    .values({ chave, valor })
    .onConflictDoUpdate({ target: configuracao.chave, set: { valor, atualizadoEm: new Date() } });
  await registrarAuditoria(tx, {
    tela: auditoria.tela,
    entidade: "Configuração",
    entidadeId: null,
    acao: antes ? "alterou" : "cadastrou",
    descricao: auditoria.descricao,
    dados: { antes: antes?.valor ?? null, depois: valor },
  });
}
