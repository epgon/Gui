"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { TIPOS_CONTA } from "@/lib/cadastros/opcoes";
import { falha, idValido, obrigatorio, primeiroErro, type Resultado, ERRO_AUXILIAR, lerCampoAuxiliar } from "@/lib/cadastros/resultado";
import { dataValida } from "@/lib/datas";
import { motivoParaNaoExcluirConta, SEM_USO_CONTA } from "@/lib/contas/exclusao";
import { usoDasContas } from "@/lib/contas/uso";
import { lerValorEmCentavos } from "@/lib/dinheiro";
import { sincronizarSaldoInicial } from "@/lib/lancamentos/saldo-inicial";
import { exigirLogin } from "@/lib/sessao";
import { CHAVE_OPCOES } from "@/lib/visao-geral/servidor";

const { contaFinanceira: conta, banco, lancamento, mapeamentoCsv, importacao, configuracao } = schema;
const TELA = "Contas Financeiras";
const ENTIDADE = "Conta Financeira";
/** Limite de segurança: R$ 999 bilhões. */
const MAXIMO_CENTAVOS = 99_999_999_999_999;

const formulario = z.object({
  descricao: obrigatorio("Descrição", 60),
  bancoId: z.coerce.number({ error: "Selecione o campo **Banco**." }).int().positive("Selecione o campo **Banco**."),
  tipo: z.enum(TIPOS_CONTA.map((t) => t.valor) as [string, ...string[]], { error: "Selecione o campo **Tipo**." }),
  considerarNosSaldos: z.boolean(),
  saldoInicial: z
    .string()
    .trim()
    .transform((texto, ctx) => {
      if (!texto) return 0;
      const centavos = lerValorEmCentavos(texto);
      if (centavos === null || Math.abs(centavos) > MAXIMO_CENTAVOS) {
        ctx.addIssue({ code: "custom", message: "Informe um valor válido no campo **Saldo Inicial** (ex.: 1.250,00)." });
        return z.NEVER;
      }
      return centavos;
    }),
  saldoInicialData: z.string().refine(dataValida, "Informe uma data válida no campo **Data do Saldo Inicial**."),
});

export type DadosConta = {
  descricao: string;
  bancoId: string;
  tipo: string;
  considerarNosSaldos: boolean;
  saldoInicial: string;
  saldoInicialData: string;
  /** Parâmetros > Campos Auxiliares. */
  campoAuxiliar?: string;
};

export async function salvarConta(id: number | null, entrada: DadosConta): Promise<Resultado> {
  await exigirLogin();
  const v = formulario.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  const aux = lerCampoAuxiliar(entrada);
  if (!aux) return falha(ERRO_AUXILIAR);
  if (id !== null && !idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  const { saldoInicial, ...resto } = v.data;
  const dados = { ...resto, tipo: resto.tipo as (typeof TIPOS_CONTA)[number]["valor"], saldoInicialCentavos: saldoInicial, ...aux };
  const db = getDb();

  const [bancoOk] = await db.select({ id: banco.id }).from(banco).where(eq(banco.id, dados.bancoId)).limit(1);
  if (!bancoOk) return falha("Selecione o campo **Banco**.");

  const repetida = await db
    .select({ id: conta.id })
    .from(conta)
    .where(and(sql`lower(${conta.descricao}) = lower(${dados.descricao})`, id ? ne(conta.id, id) : undefined))
    .limit(1);
  if (repetida.length) return falha(`Já existe uma conta financeira chamada **${dados.descricao}**.`);

  return db.transaction(async (tx) => {
    if (id === null) {
      const [{ proxima }] = await tx.select({ proxima: sql<number>`coalesce(max(${conta.ordem}), 0) + 1` }).from(conta);
      const [nova] = await tx.insert(conta).values({ ...dados, ordem: proxima }).returning();
      await sincronizarSaldoInicial(tx, nova.id, dados.saldoInicialCentavos, dados.saldoInicialData);
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: nova.id, acao: "cadastrou", descricao: `a Conta Financeira ${nova.descricao}`, dados });
      refresh();
      return { ok: true, id: nova.id } as const;
    }
    const [antes] = await tx.select().from(conta).where(eq(conta.id, id)).for("update");
    if (!antes) return falha("Esta conta financeira não existe mais.");
    await tx.update(conta).set(dados).where(eq(conta.id, id));
    await sincronizarSaldoInicial(tx, id, dados.saldoInicialCentavos, dados.saldoInicialData);
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `a Conta Financeira ${dados.descricao}`, dados: diferencas(antes, dados) });
    refresh();
    return { ok: true, id } as const;
  });
}

export async function alterarSituacaoConta(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Cadastro não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(conta).set({ ativo }).where(eq(conta.id, id)).returning();
    if (!linha) return falha("Esta conta financeira não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: `a Conta Financeira ${linha.descricao}` });
    refresh();
    return { ok: true } as const;
  });
}

/**
 * Exclui de vez uma conta que nunca foi usada: sem lançamentos (fora o Saldo Inicial),
 * sem cartão que pague a fatura nela, sem recorrentes, regras ou importações em rascunho.
 * As que já foram usadas devem ser inativadas.
 * Saem junto: o lançamento Saldo Inicial e os vínculos de CSV memorizados para ela.
 * Importações já concluídas ou canceladas ficam no histórico, sem a conta.
 */
export async function excluirConta(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  try {
    return await getDb().transaction(async (tx) => {
      const [alvo] = await tx.select().from(conta).where(eq(conta.id, id)).for("update");
      if (!alvo) return falha("Esta conta financeira não existe mais.");
      const uso = (await usoDasContas(tx, id)).get(id) ?? SEM_USO_CONTA;
      const motivo = motivoParaNaoExcluirConta(uso);
      if (motivo) return falha(`Não é possível excluir a conta financeira **${alvo.descricao}**. ${motivo}`);

      await tx.delete(lancamento).where(and(eq(lancamento.contaId, id), eq(lancamento.tipo, "saldo_inicial")));
      await tx.delete(mapeamentoCsv).where(eq(mapeamentoCsv.contaId, id));
      await tx.update(importacao).set({ contaId: null }).where(and(eq(importacao.contaId, id), ne(importacao.situacao, "rascunho")));
      // Tira a conta da lista de contas escondidas na Visão Geral.
      await tx
        .update(configuracao)
        .set({
          valor: sql`jsonb_set(${configuracao.valor}, '{contasOcultas}', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(${configuracao.valor}->'contasOcultas') e where e <> to_jsonb(${id}::int)))`,
        })
        .where(and(eq(configuracao.chave, CHAVE_OPCOES), sql`jsonb_typeof(${configuracao.valor}->'contasOcultas') = 'array'`, sql`${configuracao.valor}->'contasOcultas' @> ${JSON.stringify([id])}::jsonb`));
      await tx.delete(conta).where(eq(conta.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "excluiu", descricao: `a Conta Financeira ${alvo.descricao}`, dados: alvo });
      refresh();
      return { ok: true } as const;
    });
  } catch (e) {
    // A conta passou a ser usada no mesmo instante (chave estrangeira; o drizzle guarda o erro do banco em cause).
    if ((e as { cause?: { code?: string } })?.cause?.code === "23503") {
      return falha("Esta conta financeira acabou de ser usada e não pode mais ser excluída. Recarregue a página para ver onde.");
    }
    throw e;
  }
}
