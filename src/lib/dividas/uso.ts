import "server-only";
import { sql } from "drizzle-orm";
import type { getDb } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { SEM_USO_DIVIDA, type UsoDivida } from "@/lib/dividas/exclusao";

type Tipo = "pagamentos" | "original" | "acordo" | "negociacoes" | "planos";

/**
 * Como cada dívida é usada: pagamentos, renegociação, negociações e planos de quitação.
 * Dívidas que não aparecem no mapa não têm nada disso.
 */
export async function usoDasDividas(db: ReturnType<typeof getDb> | Transacao, id?: number): Promise<Map<number, UsoDivida>> {
  // Com id, conta só aquela dívida.
  const so = (coluna: string) => sql`(${id ?? null}::int is null or ${sql.raw(coluna)} = ${id ?? null}::int)`;
  const { rows } = await db.execute<{ divida: number; tipo: Tipo; total: string }>(sql`
    select divida_id as divida, 'pagamentos' as tipo, count(*)::text as total from lancamento
      where divida_id is not null and data_pagamento is not null and ${so("divida_id")} group by divida_id
    union all
    select divida_id, 'pagamentos', count(*)::text from divida_evento
      where tipo::text in ('pagamento', 'amortizacao', 'quitacao') and lancamento_id is null and ${so("divida_id")} group by divida_id
    union all
    select v.divida_id, 'pagamentos', count(*)::text from divida_vinculo v
      join lancamento p on p.fatura_paga_id = v.fatura_id and p.data_pagamento is not null
      where v.fatura_id is not null and ${so("v.divida_id")} group by v.divida_id
    union all
    select v.divida_id, 'pagamentos', count(*)::text from divida_vinculo v
      join lancamento p on p.recorrencia_id = v.recorrencia_id and p.data_pagamento is not null
      where v.recorrencia_id is not null and ${so("v.divida_id")} group by v.divida_id
    union all
    select original_id, 'original', count(*)::text from divida_renegociacao where ${so("original_id")} group by original_id
    union all
    select acordo_id, 'acordo', count(*)::text from divida_renegociacao where ${so("acordo_id")} group by acordo_id
    union all
    select divida_id, 'negociacoes', count(*)::text from negociacao_divida where ${so("divida_id")} group by divida_id
    union all
    select divida_id, 'planos', count(distinct plano_id)::text from plano_quitacao_mes where ${so("divida_id")} group by divida_id
  `);
  const mapa = new Map<number, UsoDivida>();
  for (const r of rows) {
    const divida = Number(r.divida);
    if (!Number.isInteger(divida)) continue;
    const atual = mapa.get(divida) ?? { ...SEM_USO_DIVIDA };
    if (r.tipo === "original" || r.tipo === "acordo") atual.renegociacao = atual.renegociacao === "acordo" ? "acordo" : r.tipo;
    else atual[r.tipo] += Number(r.total);
    mapa.set(divida, atual);
  }
  return mapa;
}
