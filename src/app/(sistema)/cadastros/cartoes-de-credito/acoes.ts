"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { motivoParaNaoExcluirCartao, SEM_USO_CARTAO } from "@/lib/cartoes/exclusao";
import { usoDosCartoes } from "@/lib/cartoes/uso";
import { falha, idValido, obrigatorio, primeiroErro, type Resultado, ERRO_AUXILIAR, lerCampoAuxiliar } from "@/lib/cadastros/resultado";
import { lerValorEmCentavos } from "@/lib/dinheiro";
import { exigirLogin } from "@/lib/sessao";

const { cartaoCredito: cartao, contaFinanceira: conta, banco, mapeamentoCsv, importacao } = schema;
const TELA = "Cartões de Crédito";
const ENTIDADE = "Cartão de Crédito";
/** O limite é guardado num inteiro: até R$ 20 milhões. */
const LIMITE_MAXIMO = 2_000_000_000;

const dia = (campo: string) =>
  z.coerce
    .number({ error: `Selecione o campo **${campo}**.` })
    .int(`Selecione o campo **${campo}**.`)
    .min(1, `Selecione o campo **${campo}**.`)
    .max(31, `Selecione o campo **${campo}**.`);

const formulario = z.object({
  descricao: obrigatorio("Descrição", 60),
  bancoId: z.coerce.number({ error: "Selecione o campo **Bandeira ou Emissor**." }).int().positive("Selecione o campo **Bandeira ou Emissor**."),
  ilimitado: z.boolean(),
  diaFechamento: dia("Dia do Fechamento"),
  diaVencimento: dia("Dia do Vencimento"),
  contaPagamentoId: z
    .string()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Selecione uma conta válida em **Conta Financeira Padrão para Pagamento**."),
});

/** Confere o limite (na ordem da tela: depois da Descrição e antes dos dias). */
function lerLimite(entrada: { ilimitado: unknown; limite: unknown }): number | string {
  if (entrada.ilimitado === true) return 0;
  const texto = typeof entrada.limite === "string" ? entrada.limite.trim() : "";
  if (!texto) return "Preencha o campo **Limite** (ou ligue a chave Ilimitado).";
  const centavos = lerValorEmCentavos(texto);
  if (centavos === null || centavos <= 0 || centavos > LIMITE_MAXIMO) return "Informe um valor válido no campo **Limite** (ex.: 5.000,00).";
  return centavos;
}

export type DadosCartao = {
  descricao: string;
  bancoId: string;
  ilimitado: boolean;
  limite: string;
  diaFechamento: string;
  diaVencimento: string;
  contaPagamentoId: string;
  /** Parâmetros > Campos Auxiliares. */
  campoAuxiliar?: string;
};

export async function salvarCartao(id: number | null, entrada: DadosCartao): Promise<Resultado> {
  await exigirLogin();
  const descricao = obrigatorio("Descrição", 60).safeParse(entrada.descricao);
  if (!descricao.success) return primeiroErro(descricao.error);
  const limiteCentavos = lerLimite(entrada);
  if (typeof limiteCentavos === "string") return falha(limiteCentavos);
  const v = formulario.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  const aux = lerCampoAuxiliar(entrada);
  if (!aux) return falha(ERRO_AUXILIAR);
  if (id !== null && !idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  const dados = { ...v.data, limiteCentavos, ...aux };
  const db = getDb();

  const [bancoOk] = await db.select({ id: banco.id }).from(banco).where(eq(banco.id, dados.bancoId)).limit(1);
  if (!bancoOk) return falha("Selecione o campo **Bandeira ou Emissor**.");
  if (dados.contaPagamentoId !== null) {
    const [contaOk] = await db.select({ id: conta.id }).from(conta).where(eq(conta.id, dados.contaPagamentoId)).limit(1);
    if (!contaOk) return falha("A conta escolhida em **Conta Financeira Padrão para Pagamento** não existe mais.");
  }

  const repetido = await db
    .select({ id: cartao.id })
    .from(cartao)
    .where(and(sql`lower(${cartao.descricao}) = lower(${dados.descricao})`, id ? ne(cartao.id, id) : undefined))
    .limit(1);
  if (repetido.length) return falha(`Já existe um cartão chamado **${dados.descricao}**.`);

  return db.transaction(async (tx) => {
    if (id === null) {
      const [{ proxima }] = await tx.select({ proxima: sql<number>`coalesce(max(${cartao.ordem}), 0) + 1` }).from(cartao);
      const [novo] = await tx.insert(cartao).values({ ...dados, ordem: proxima }).returning();
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novo.id, acao: "cadastrou", descricao: `o Cartão de Crédito ${novo.descricao}`, dados });
      refresh();
      return { ok: true, id: novo.id } as const;
    }
    const [antes] = await tx.select().from(cartao).where(eq(cartao.id, id)).for("update");
    if (!antes) return falha("Este cartão não existe mais.");
    await tx.update(cartao).set(dados).where(eq(cartao.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o Cartão de Crédito ${dados.descricao}`, dados: diferencas(antes, dados) });
    refresh();
    return { ok: true, id } as const;
  });
}

export async function alterarSituacaoCartao(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Cadastro não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(cartao).set({ ativo }).where(eq(cartao.id, id)).returning();
    if (!linha) return falha("Este cartão não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: `o Cartão de Crédito ${linha.descricao}` });
    refresh();
    return { ok: true } as const;
  });
}

/**
 * Exclui de vez um cartão que nunca foi usado: sem lançamentos, sem faturas,
 * sem recorrentes, regras ou importações em rascunho. Os que já foram usados devem ser inativados.
 * Saem junto os vínculos de CSV memorizados para ele; importações já concluídas ou canceladas
 * ficam no histórico, sem o cartão.
 */
export async function excluirCartao(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  try {
    return await getDb().transaction(async (tx) => {
      const [alvo] = await tx.select().from(cartao).where(eq(cartao.id, id)).for("update");
      if (!alvo) return falha("Este cartão não existe mais.");
      const uso = (await usoDosCartoes(tx, id)).get(id) ?? SEM_USO_CARTAO;
      const motivo = motivoParaNaoExcluirCartao(uso);
      if (motivo) return falha(`Não é possível excluir o cartão de crédito **${alvo.descricao}**. ${motivo}`);

      await tx.delete(mapeamentoCsv).where(eq(mapeamentoCsv.cartaoId, id));
      await tx.update(importacao).set({ cartaoId: null }).where(and(eq(importacao.cartaoId, id), ne(importacao.situacao, "rascunho")));
      await tx.delete(cartao).where(eq(cartao.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "excluiu", descricao: `o Cartão de Crédito ${alvo.descricao}`, dados: alvo });
      refresh();
      return { ok: true } as const;
    });
  } catch (e) {
    // O cartão passou a ser usado no mesmo instante (chave estrangeira; o drizzle guarda o erro do banco em cause).
    if ((e as { cause?: { code?: string } })?.cause?.code === "23503") {
      return falha("Este cartão acabou de ser usado e não pode mais ser excluído. Recarregue a página para ver onde.");
    }
    throw e;
  }
}
