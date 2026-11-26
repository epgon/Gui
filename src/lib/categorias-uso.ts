import "server-only";
import { sql } from "drizzle-orm";
import type { getDb } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { SEM_USO, type UsoCategoria } from "@/lib/categorias";

/**
 * Quantas vezes cada categoria é usada: lançamentos (cabeçalho ou item do detalhado),
 * recorrentes (cabeçalho ou item), regras de importação e linhas de importações em rascunho.
 * Categorias que não aparecem no mapa não são usadas em nada.
 */
export async function usoDasCategorias(db: ReturnType<typeof getDb> | Transacao, id?: number): Promise<Map<number, UsoCategoria>> {
  // Com id, conta só aquela categoria.
  const so = sql`(${id ?? null}::int is null or categoria_id = ${id ?? null}::int)`;
  const soTexto = (coluna: ReturnType<typeof sql.raw>) => sql`(${id === undefined ? null : String(id)}::text is null or ${coluna} = ${id === undefined ? null : String(id)}::text)`;
  const { rows } = await db.execute<{ categoria: string; tipo: keyof UsoCategoria; total: string }>(sql`
    select categoria::text, 'lancamentos' as tipo, count(distinct lancamento)::text as total from (
      select categoria_id as categoria, id as lancamento from lancamento where categoria_id is not null and ${so}
      union all
      select categoria_id, lancamento_id from lancamento_item where ${so}
    ) l group by categoria
    union all
    select categoria::text, 'recorrentes', count(distinct recorrente)::text from (
      select categoria_id as categoria, id as recorrente from recorrencia where categoria_id is not null and ${so}
      union all
      select categoria_id, recorrencia_id from recorrencia_item where ${so}
    ) r group by categoria
    union all
    select preencher->>'categoriaId', 'regras', count(*)::text from regra_importacao
      where coalesce(preencher->>'categoriaId', '') <> '' and ${soTexto(sql.raw("preencher->>'categoriaId'"))}
      group by 1
    union all
    select il.campos->>'categoriaId', 'importacoes', count(*)::text from importacao_linha il
      join importacao i on i.id = il.importacao_id
      where i.situacao = 'rascunho' and coalesce(il.campos->>'categoriaId', '') <> '' and ${soTexto(sql.raw("il.campos->>'categoriaId'"))}
      group by 1
  `);
  const mapa = new Map<number, UsoCategoria>();
  for (const r of rows) {
    const cat = Number(r.categoria);
    if (!Number.isInteger(cat)) continue;
    const atual = mapa.get(cat) ?? { ...SEM_USO };
    atual[r.tipo] += Number(r.total);
    mapa.set(cat, atual);
  }
  return mapa;
}
