"use server";

import { descendentes } from "@/lib/categorias";
import { carregarDetalheCategoria, type DetalheCategoria } from "@/lib/relatorios/detalhe-categoria";
import { carregarArvore, ultimosDaCategoria } from "@/lib/relatorios/servidor";
import { exigirLogin } from "@/lib/sessao";

/** Dados da janela "Detalhando Categoria" (12 meses e últimos 10 lançamentos). */
export async function detalharCategoria(id: number): Promise<DetalheCategoria | null> {
  await exigirLogin();
  if (!Number.isInteger(id) || id <= 0) return null;
  return carregarDetalheCategoria(id);
}

export type LancamentosCategoria = {
  id: number;
  numero: string;
  nome: string;
  cor: string;
  /** "Receita" quando é filha de 1. Receita; nulo nas principais. */
  pai: string | null;
  quantidadeFilhas: number;
  /** Lançamentos até hoje, do mais recente para o mais antigo (inclui os das filhas). */
  itens: Awaited<ReturnType<typeof ultimosDaCategoria>>;
  /** Passou do limite: há mais lançamentos do que os listados. */
  limitado: boolean;
};

const LIMITE = 300;

/** Janela "Lançamentos da Categoria" (menu de três pontos de Cadastros > Categorias). */
export async function lancamentosDaCategoria(id: number): Promise<LancamentosCategoria | null> {
  await exigirLogin();
  if (!Number.isInteger(id) || id <= 0) return null;
  const arvore = await carregarArvore();
  const c = arvore.get(id);
  if (!c) return null;
  const ids = [id, ...descendentes([...arvore.values()].map((x) => ({ id: x.id, categoriaPaiId: x.categoriaPaiId })), id)];
  const itens = await ultimosDaCategoria(ids, undefined, LIMITE + 1);
  const pai = c.categoriaPaiId ? arvore.get(c.categoriaPaiId) : undefined;
  return {
    id,
    numero: c.numero,
    nome: c.nome,
    cor: c.corEfetiva,
    pai: pai?.nome ?? null,
    quantidadeFilhas: c.quantidadeFilhas,
    itens: itens.slice(0, LIMITE),
    limitado: itens.length > LIMITE,
  };
}
