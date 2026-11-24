import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { BancoOpcao } from "./opcoes";

/** Bancos ativos, com "Outro" primeiro e os demais em ordem alfabética. */
export async function listarBancos(): Promise<BancoOpcao[]> {
  const { banco } = schema;
  return getDb()
    .select({ id: banco.id, nome: banco.nome, codigo: banco.codigo })
    .from(banco)
    .where(eq(banco.ativo, true))
    .orderBy(sql`${banco.codigo} is not null`, asc(banco.nome));
}

