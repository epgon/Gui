"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { TIPOS_CONTA } from "@/lib/cadastros/opcoes";
import { falha, idValido, obrigatorio, primeiroErro, type Resultado, ERRO_AUXILIAR, lerCampoAuxiliar } from "@/lib/cadastros/resultado";
import { dataValida } from "@/lib/datas";
import { lerValorEmCentavos } from "@/lib/dinheiro";
import { sincronizarSaldoInicial } from "@/lib/lancamentos/saldo-inicial";
import { exigirLogin } from "@/lib/sessao";

const { contaFinanceira: conta, banco } = schema;
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
