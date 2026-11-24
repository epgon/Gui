import "server-only";
import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { hojeIso } from "@/lib/datas";

const { lancamento: l, categoria } = schema;

/**
 * Mantém o lançamento "Saldo Inicial" da conta igual ao cadastro:
 * já realizado, na data do saldo, categoria especial Acerto de Saldo. Saldo zero = sem lançamento.
 */
export async function sincronizarSaldoInicial(tx: Transacao, contaId: number, centavos: number, data: string | null) {
  const onde = and(eq(l.contaId, contaId), eq(l.tipo, "saldo_inicial"));
  if (!centavos) {
    await tx.delete(l).where(onde);
    return;
  }
  const dia = data ?? hojeIso();
  const [acerto] = await tx.select({ id: categoria.id }).from(categoria).where(eq(categoria.especial, "acerto_saldo"));
  const valores = { valorCentavos: centavos, valorPagoCentavos: centavos, dataVencimento: dia, dataPagamento: dia, categoriaId: acerto?.id ?? null };
  const [existente] = await tx.select({ id: l.id }).from(l).where(onde);
  if (existente) await tx.update(l).set(valores).where(eq(l.id, existente.id));
  else await tx.insert(l).values({ ...valores, tipo: "saldo_inicial", descricao: "Saldo Inicial", contaId, origem: "sistema" });
}
