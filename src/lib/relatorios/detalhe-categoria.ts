import "server-only";
import { descendentes, rotuloCategoria } from "@/lib/categorias";
import { hojeIso } from "@/lib/datas";
import { somarMeses } from "@/lib/lancamentos/regras";
import { colunasDoPeriodo, lerFiltrosRelatorio, montarFluxoDeCaixa } from "./regras";
import { carregarArvore, carregarMovimentos, ultimosDaCategoria } from "./servidor";

export type DetalheCategoria = {
  id: number;
  rotulo: string;
  cor: string;
  natureza: "receita" | "despesa";
  /** Os últimos 12 meses (até o mês atual), com o que entrou e saiu na categoria e nas filhas. */
  meses: { chave: string; rotulo: string; receitas: number; despesas: number }[];
  total: number;
  media: number;
  ultimos: { id: number; descricao: string; data: string; pago: boolean; contaOuCartao: string; valorCentavos: number }[];
};

/** Janela "Detalhar" de Cadastros > Categorias: gráfico dos 12 meses e os últimos 10 lançamentos. */
export async function carregarDetalheCategoria(id: number, hoje = hojeIso()): Promise<DetalheCategoria | null> {
  const arvore = await carregarArvore();
  const c = arvore.get(id);
  if (!c || c.especial) return null;
  const inicio = somarMeses(`${hoje.slice(0, 7)}-01`, -11).slice(0, 7);
  // Compras no cartão contam no mês da compra (como em Despesas por Categorias, na Visão Geral).
  const filtros = lerFiltrosRelatorio({ de: inicio, ate: hoje.slice(0, 7), categoria: String(id), considerar: "compra" }, "mensal", hoje);
  const ids = [id, ...descendentes([...arvore.values()].map((x) => ({ id: x.id, categoriaPaiId: x.categoriaPaiId })), id)];
  const [movimentos, ultimos] = await Promise.all([carregarMovimentos(filtros, arvore, hoje), ultimosDaCategoria(ids, hoje)]);
  const fluxo = montarFluxoDeCaixa(movimentos, "mensal", colunasDoPeriodo("mensal", filtros.inicio, filtros.fim), arvore);
  return {
    id,
    rotulo: rotuloCategoria(c),
    cor: c.corEfetiva,
    natureza: c.natureza,
    meses: fluxo.colunas.map((col, i) => ({ chave: col.chave, rotulo: col.rotulo, receitas: fluxo.receitas.valores[i], despesas: fluxo.despesas.valores[i] })),
    total: fluxo.saldo.total,
    media: fluxo.saldo.media,
    ultimos,
  };
}
