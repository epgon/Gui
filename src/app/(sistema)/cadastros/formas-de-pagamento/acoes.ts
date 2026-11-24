"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { falha, idValido, obrigatorio, primeiroErro, type Resultado } from "@/lib/cadastros/resultado";
import { exigirLogin } from "@/lib/sessao";

const { formaPagamento: forma } = schema;
const TELA = "Formas de Pagamento";
const ENTIDADE = "Forma de Pagamento";

const formulario = z.object({
  descricao: obrigatorio("Descrição", 60),
  sigla: obrigatorio("Sigla", 5)
    .transform((s) => s.toUpperCase())
    .refine((s) => /^[A-Z0-9]+$/.test(s), "A **Sigla** aceita só letras sem acento e números (ex.: PX)."),
});
export type DadosForma = { descricao: string; sigla: string };

export async function salvarForma(id: number | null, entrada: DadosForma): Promise<Resultado> {
  await exigirLogin();
  const v = formulario.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  if (id !== null && !idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  const dados = v.data;
  const db = getDb();

  const repetida = await db
    .select({ descricao: forma.descricao, sigla: forma.sigla })
    .from(forma)
    .where(
      and(
        sql`(lower(${forma.descricao}) = lower(${dados.descricao}) or upper(${forma.sigla}) = ${dados.sigla})`,
        id ? ne(forma.id, id) : undefined,
      ),
    )
    .limit(1);
  if (repetida.length) {
    return repetida[0].sigla?.toUpperCase() === dados.sigla
      ? falha(`A sigla **${dados.sigla}** já é usada por ${repetida[0].descricao}.`)
      : falha(`Já existe uma forma de pagamento chamada **${dados.descricao}**.`);
  }

  return db.transaction(async (tx) => {
    if (id === null) {
      const [nova] = await tx.insert(forma).values(dados).returning();
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: nova.id, acao: "cadastrou", descricao: `a Forma de Pagamento ${nova.descricao}`, dados });
      refresh();
      return { ok: true, id: nova.id } as const;
    }
    const [antes] = await tx.select().from(forma).where(eq(forma.id, id)).for("update");
    if (!antes) return falha("Esta forma de pagamento não existe mais.");
    await tx.update(forma).set(dados).where(eq(forma.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `a Forma de Pagamento ${dados.descricao}`, dados: diferencas(antes, dados) });
    refresh();
    return { ok: true, id } as const;
  });
}

export async function alterarSituacaoForma(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Cadastro não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(forma).set({ ativo }).where(eq(forma.id, id)).returning();
    if (!linha) return falha("Esta forma de pagamento não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: `a Forma de Pagamento ${linha.descricao}` });
    refresh();
    return { ok: true } as const;
  });
}
