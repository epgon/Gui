"use server";

import { carregarDetalheConta, type DetalheConta } from "@/lib/contas/detalhe";
import { exigirLogin } from "@/lib/sessao";

/** Dados da janela "Detalhando Conta Financeira" (Resumo e Lançamentos do mês). */
export async function detalharConta(id: number, mes?: string): Promise<DetalheConta | null> {
  await exigirLogin();
  if (!Number.isInteger(id) || id <= 0) return null;
  return carregarDetalheConta(id, typeof mes === "string" ? mes : undefined);
}
