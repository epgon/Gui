/**
 * Cria o usuário do sistema ou troca a senha dele.
 * Uso: npm run criar-usuario
 * Também serve para "esqueci minha senha": rode de novo com o mesmo e-mail.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { count, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { usuario } from "../src/db/schema";
import { perguntar } from "./perguntar";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não configurada. Rode antes: npm run configurar");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle(pool);
  try {
    const email = (await perguntar("E-mail de acesso: ")).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("E-mail inválido.");

    const [existente] = await db
      .select()
      .from(usuario)
      .where(sql`lower(${usuario.email}) = ${email}`)
      .limit(1);

    const nome = existente ? existente.nome : (await perguntar("Seu nome: ")) || email.split("@")[0];
    const senha = await perguntar("Senha (mínimo 8 caracteres, não aparece na tela): ", { esconder: true });
    if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    const confirmacao = await perguntar("Repita a senha: ", { esconder: true });
    if (senha !== confirmacao) throw new Error("As senhas não conferem.");

    const senhaHash = await bcrypt.hash(senha, 12);
    if (existente) {
      await db.update(usuario).set({ senhaHash, ativo: true }).where(sql`${usuario.id} = ${existente.id}`);
      console.log(`Senha de ${email} atualizada.`);
    } else {
      const [{ total }] = await db.select({ total: count() }).from(usuario);
      if (total > 0) {
        throw new Error("Já existe um usuário com outro e-mail. O Gui tem um usuário só.");
      }
      await db.insert(usuario).values({ nome, email, senhaHash });
      console.log(`Usuário ${email} criado.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  console.error("Erro:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
