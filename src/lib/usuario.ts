import "server-only";
import bcrypt from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type UsuarioSessao = { id: string; nome: string; email: string };

/**
 * Confere e-mail e senha. Se ainda não existe nenhum usuário no banco,
 * cria o primeiro usando GUI_EMAIL e GUI_SENHA (variáveis de ambiente),
 * desde que o e-mail e a senha digitados sejam exatamente esses.
 */
export async function verificarCredenciais(
  email: string,
  senha: string,
): Promise<UsuarioSessao | null> {
  const db = getDb();
  const emailNormalizado = email.trim().toLowerCase();

  const [encontrado] = await db
    .select()
    .from(schema.usuario)
    .where(sql`lower(${schema.usuario.email}) = ${emailNormalizado}`)
    .limit(1);

  if (encontrado) {
    if (!encontrado.ativo) return null;
    const ok = await bcrypt.compare(senha, encontrado.senhaHash);
    return ok ? { id: String(encontrado.id), nome: encontrado.nome, email: encontrado.email } : null;
  }

  return criarPrimeiroUsuarioSePermitido(emailNormalizado, senha);
}

async function criarPrimeiroUsuarioSePermitido(email: string, senha: string) {
  const emailInicial = process.env.GUI_EMAIL?.trim().toLowerCase();
  const senhaInicial = process.env.GUI_SENHA;
  if (!emailInicial || !senhaInicial) return null;
  if (email !== emailInicial || senha !== senhaInicial) return null;

  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(schema.usuario);
  if (total > 0) return null;

  const senhaHash = await bcrypt.hash(senha, 12);
  const nome = process.env.GUI_NOME?.trim() || email.split("@")[0];
  const [novo] = await db
    .insert(schema.usuario)
    .values({ nome, email, senhaHash })
    .onConflictDoNothing()
    .returning();
  if (!novo) return null;
  return { id: String(novo.id), nome: novo.nome, email: novo.email };
}

export async function buscarUsuario(id: number) {
  const [u] = await getDb().select().from(schema.usuario).where(eq(schema.usuario.id, id)).limit(1);
  return u ?? null;
}
