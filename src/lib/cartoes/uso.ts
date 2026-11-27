import "server-only";
import { sql } from "drizzle-orm";
import type { getDb } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { SEM_USO_CARTAO, type UsoCartao } from "@/lib/cartoes/exclusao";

/**
 * Quantas vezes cada cartão de crédito é usado: lançamentos (compras), faturas,
 * recorrentes, regras de importação e importações em rascunho.
 * Cartões que não aparecem no mapa não são usados em nada.
 */
export async function usoDosCartoes(db: ReturnType<typeof getDb> | Transacao, id?: number): Promise<Map<number, UsoCartao>> {
  // Com id, conta só aquele cartão.
  const so = (coluna: string) => sql`(${id ?? null}::int is null or ${sql.raw(coluna)} = ${id ?? null}::int)`;
  const { rows } = await db.execute<{ cartao: number; tipo: keyof UsoCartao; total: string }>(sql`
    select cartao_id as cartao, 'lancamentos' as tipo, count(*)::text as total from lancamento
      where cartao_id is not null and ${so("cartao_id")} group by cartao_id
    union all
    select cartao_id, 'faturas', count(*)::text from fatura
      where ${so("cartao_id")} group by cartao_id
    union all
    select cartao_id, 'recorrentes', count(*)::text from recorrencia
      where cartao_id is not null and ${so("cartao_id")} group by cartao_id
    union all
    select cartao_id, 'regras', count(*)::text from regra_importacao
      where cartao_id is not null and ${so("cartao_id")} group by cartao_id
    union all
    select cartao_id, 'importacoes', count(*)::text from importacao
      where cartao_id is not null and situacao = 'rascunho' and ${so("cartao_id")} group by cartao_id
  `);
  const mapa = new Map<number, UsoCartao>();
  for (const r of rows) {
    const cartao = Number(r.cartao);
    if (!Number.isInteger(cartao)) continue;
    const atual = mapa.get(cartao) ?? { ...SEM_USO_CARTAO };
    atual[r.tipo] += Number(r.total);
    mapa.set(cartao, atual);
  }
  return mapa;
}
