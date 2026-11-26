import "server-only";
import { sql } from "drizzle-orm";
import type { getDb } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { SEM_USO_CONTA, type UsoConta } from "@/lib/contas/exclusao";

/**
 * Quantas vezes cada conta financeira é usada: lançamentos (fora o Saldo Inicial, que sai junto),
 * cartões que pagam a fatura nela, recorrentes (origem ou destino da transferência),
 * regras de importação e importações em rascunho.
 * Contas que não aparecem no mapa não são usadas em nada.
 */
export async function usoDasContas(db: ReturnType<typeof getDb> | Transacao, id?: number): Promise<Map<number, UsoConta>> {
  // Com id, conta só aquela conta.
  const so = (coluna: ReturnType<typeof sql.raw>) => sql`(${id ?? null}::int is null or ${coluna} = ${id ?? null}::int)`;
  const { rows } = await db.execute<{ conta: number; tipo: keyof UsoConta; total: string }>(sql`
    select conta_id as conta, 'lancamentos' as tipo, count(*)::text as total from lancamento
      where conta_id is not null and tipo <> 'saldo_inicial' and ${so(sql.raw("conta_id"))} group by conta_id
    union all
    select conta_pagamento_id, 'cartoes', count(*)::text from cartao_credito
      where conta_pagamento_id is not null and ${so(sql.raw("conta_pagamento_id"))} group by conta_pagamento_id
    union all
    select conta, 'recorrentes', count(distinct recorrente)::text from (
      select conta_id as conta, id as recorrente from recorrencia where conta_id is not null
      union all
      select conta_destino_id, id from recorrencia where conta_destino_id is not null
    ) r where ${so(sql.raw("conta"))} group by conta
    union all
    select conta_id, 'regras', count(*)::text from regra_importacao
      where conta_id is not null and ${so(sql.raw("conta_id"))} group by conta_id
    union all
    select conta_id, 'importacoes', count(*)::text from importacao
      where conta_id is not null and situacao = 'rascunho' and ${so(sql.raw("conta_id"))} group by conta_id
  `);
  const mapa = new Map<number, UsoConta>();
  for (const r of rows) {
    const conta = Number(r.conta);
    if (!Number.isInteger(conta)) continue;
    const atual = mapa.get(conta) ?? { ...SEM_USO_CONTA };
    atual[r.tipo] += Number(r.total);
    mapa.set(conta, atual);
  }
  return mapa;
}
