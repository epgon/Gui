"use server";

import { carregarDetalheCategoria, type DetalheCategoria } from "@/lib/relatorios/detalhe-categoria";
import { exigirLogin } from "@/lib/sessao";

/** Dados da janela "Detalhando Categoria" (12 meses e últimos 10 lançamentos). */
export async function detalharCategoria(id: number): Promise<DetalheCategoria | null> {
  await exigirLogin();
  if (!Number.isInteger(id) || id <= 0) return null;
  return carregarDetalheCategoria(id);
}
