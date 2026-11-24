import { sql } from "drizzle-orm";
import { schema } from "@/db";

const { lancamento: l } = schema;

/** Valor com sinal, em SQL (mesma regra de valorComSinal). */
export const valorComSinalSql = sql<number>`(case
  when ${l.tipo} in ('receita', 'transferencia_entrada') then abs(${l.valorCentavos})
  when ${l.tipo} in ('saldo_inicial', 'acerto_saldo') then ${l.valorCentavos}
  else -abs(${l.valorCentavos}) end)`;

/** Valor realizado com sinal (usa o valor pago quando existe). */
export const valorRealizadoSql = sql<number>`(case
  when ${l.tipo} in ('receita', 'transferencia_entrada') then abs(coalesce(${l.valorPagoCentavos}, ${l.valorCentavos}))
  when ${l.tipo} in ('saldo_inicial', 'acerto_saldo') then coalesce(${l.valorPagoCentavos}, ${l.valorCentavos})
  else -abs(coalesce(${l.valorPagoCentavos}, ${l.valorCentavos})) end)`;
