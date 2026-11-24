/**
 * Aplica as migrações (criação e atualização das tabelas) no banco.
 * Uso: npm run db:migrar
 * Na Vercel, roda sozinho antes de cada publicação (ver "build" no package.json).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL) {
      console.error(
        "\n[Gui] ERRO: a variável DATABASE_URL não foi cadastrada na Vercel.\n" +
          "Cadastre em Settings > Environment Variables e publique de novo (Redeploy).\n",
      );
      process.exit(1);
    }
    console.warn("[Gui] DATABASE_URL não configurada: migrações puladas.");
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("[Gui] Banco de dados atualizado.");
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  console.error("[Gui] Falha ao atualizar o banco de dados:", erro);
  process.exit(1);
});
