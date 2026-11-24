import "server-only";
import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { faturaDaCompra } from "./regras";

const { lancamento: l, lancamentoItem: item, lancamentoTag, cartaoCredito: cartao, fatura } = schema;

export type LinhaLancamento = typeof l.$inferInsert;
export type ItemLancamento = Omit<typeof item.$inferInsert, "lancamentoId">;

/** Fatura em que a compra cai (cria a fatura se ainda não existir). */
export async function garantirFatura(tx: Transacao, cartaoId: number, dataCompra: string) {
  const [c] = await tx.select({ diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento }).from(cartao).where(eq(cartao.id, cartaoId));
  const f = faturaDaCompra(dataCompra, c.diaFechamento, c.diaVencimento);
  await tx.insert(fatura).values({ cartaoId, ...f }).onConflictDoNothing();
  const [linha] = await tx
    .select({ id: fatura.id, dataVencimento: fatura.dataVencimento })
    .from(fatura)
    .where(and(eq(fatura.cartaoId, cartaoId), eq(fatura.competencia, f.competencia)));
  return linha;
}

/** Grava um lançamento de conta ou cartão (com tags e itens). Compras no cartão vão para a fatura certa. */
export async function inserirLancamento(tx: Transacao, linha: LinhaLancamento, tagIds: number[], itens: ItemLancamento[]) {
  if (linha.cartaoId) {
    const dataCompra = linha.dataCompra ?? linha.dataVencimento;
    const f = await garantirFatura(tx, linha.cartaoId, dataCompra);
    linha = { ...linha, dataCompra, dataVencimento: f.dataVencimento, faturaId: f.id, dataPagamento: null, valorPagoCentavos: null, realizarAutomaticamente: false };
  }
  const [novo] = await tx.insert(l).values(linha).returning();
  if (tagIds.length) await tx.insert(lancamentoTag).values(tagIds.map((tagId) => ({ lancamentoId: novo.id, tagId })));
  if (itens.length) await tx.insert(item).values(itens.map((i) => ({ ...i, lancamentoId: novo.id })));
  return novo;
}
