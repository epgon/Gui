import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Conexão com o banco. O endereço vem da variável DATABASE_URL
 * (cadastrada na Vercel ou no arquivo .env do computador).
 * Uma única conexão é reaproveitada entre as requisições.
 */
const globalParaDb = globalThis as unknown as { poolGui?: Pool };

function criarPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "A variável DATABASE_URL não está configurada. Veja o README, seção \"Variáveis de ambiente\".",
    );
  }
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
}

export function getDb() {
  globalParaDb.poolGui ??= criarPool();
  return drizzle(globalParaDb.poolGui, { schema });
}

export { schema };
