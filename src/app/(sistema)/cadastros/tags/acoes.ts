"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { falha, idValido, obrigatorio, primeiroErro, type Resultado } from "@/lib/cadastros/resultado";
import { exigirLogin } from "@/lib/sessao";

const { tag } = schema;
const TELA = "Tags";

const formulario = z.object({ descricao: obrigatorio("Descrição", 60) });
export type DadosTag = { descricao: string };

export async function salvarTag(id: number | null, entrada: DadosTag): Promise<Resultado> {
  await exigirLogin();
  const v = formulario.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  if (id !== null && !idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  const dados = v.data;
  const db = getDb();

  const repetida = await db
    .select({ id: tag.id })
    .from(tag)
    .where(and(sql`lower(${tag.descricao}) = lower(${dados.descricao})`, id ? ne(tag.id, id) : undefined))
    .limit(1);
  if (repetida.length) return falha(`Já existe uma tag com a descrição **${dados.descricao}**.`);

  return db.transaction(async (tx) => {
    if (id === null) {
      const [nova] = await tx.insert(tag).values(dados).returning();
      await registrarAuditoria(tx, { tela: TELA, entidade: "Tag", entidadeId: nova.id, acao: "cadastrou", descricao: `a Tag ${nova.descricao}`, dados });
      refresh();
      return { ok: true, id: nova.id } as const;
    }
    const [antes] = await tx.select().from(tag).where(eq(tag.id, id)).for("update");
    if (!antes) return falha("Esta tag não existe mais.");
    await tx.update(tag).set(dados).where(eq(tag.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: "Tag", entidadeId: id, acao: "alterou", descricao: `a Tag ${dados.descricao}`, dados: diferencas(antes, dados) });
    refresh();
    return { ok: true, id } as const;
  });
}

export async function alterarSituacaoTag(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Cadastro não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(tag).set({ ativo }).where(eq(tag.id, id)).returning();
    if (!linha) return falha("Esta tag não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: "Tag", entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: `a Tag ${linha.descricao}` });
    refresh();
    return { ok: true } as const;
  });
}
