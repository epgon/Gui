"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { idValido, type Resultado } from "@/lib/cadastros/resultado";
import { erro, executar, exigirRecurso, lerTexto } from "@/lib/dividas/validacao";

const { simulacao } = schema;
const TELA = "Gestão de Dívidas";
const ENTIDADE = "Simulação";
const MODOS = ["quitar", "estrategias", "cenarios", "proposta"];
const MAXIMO_JSON = 40_000;

/**
 * Guardar simulação: grava só o nome, os parâmetros e o resumo na tabela `simulacao`.
 * Não cria lançamento, não mexe em dívida nem em saldo (o Simulador é só cálculo).
 */
export async function guardarSimulacao(nome: string, modo: string, parametros: unknown, resumo: unknown): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const nomeLimpo = lerTexto(nome, "Nome", 80, true)!;
      if (!MODOS.includes(modo)) return erro("Escolha um modo de simulação válido.");
      if (JSON.stringify(parametros ?? null).length > MAXIMO_JSON || JSON.stringify(resumo ?? null).length > MAXIMO_JSON) return erro("A simulação é grande demais para guardar.");
      const [nova] = await tx.insert(simulacao).values({ nome: nomeLimpo, modo, parametros: parametros ?? {}, resumo: resumo ?? {} }).returning({ id: simulacao.id });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: nova.id, acao: "cadastrou", descricao: `a Simulação ${nomeLimpo}`, dados: { nome: nomeLimpo, modo } });
      refresh();
      return { ok: true as const };
    }),
  );
}

export async function excluirSimulacao(id: number): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      if (!idValido.safeParse(id).success) return erro("Simulação não encontrada.");
      const [s] = await tx.select({ id: simulacao.id, nome: simulacao.nome, modo: simulacao.modo }).from(simulacao).where(eq(simulacao.id, id));
      if (!s) return erro("Esta simulação não existe mais.");
      await tx.delete(simulacao).where(eq(simulacao.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "excluiu", descricao: `a Simulação ${s.nome}`, dados: { nome: s.nome, modo: s.modo } });
      refresh();
      return { ok: true as const };
    }),
  );
}
