import "server-only";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { rotuloCategoria } from "@/lib/categorias";
import { hojeIso } from "@/lib/datas";
import { nomeArquivo, type LinhaTabela, type Tabela } from "@/lib/exportacao/tabela";
import {
  AGRUPAMENTOS,
  categoriasZeradas,
  colunasDoPeriodo,
  DATAS_CONSIDERADAS,
  lerFiltrosRelatorio,
  montarFluxoDeCaixa,
  montarSaldoDetalhado,
  PERIODICIDADES,
  rotuloIntervalo,
  SITUACOES_RELATORIO,
  type Agrupamento,
  type FiltrosRelatorio,
  type NoCategoria,
  type Nomes,
  type Periodicidade,
} from "./regras";
import { lerInclusoesSalvas } from "./inclusoes";
import { carregarArvore, carregarMovimentos, carregarNomes } from "./servidor";

/** Os filtros em palavras, para a faixa "Filtros Utilizados" do PDF e da planilha. */
export function descreverFiltros(f: FiltrosRelatorio, nomes: Nomes, tipo: string, temZeradas = true): string[] {
  const linhas = [`${tipo} · Período: ${rotuloIntervalo(f)}`, `Considerar: ${DATAS_CONSIDERADAS.find((d) => d.valor === f.considerar)?.rotulo}`];
  if (f.destino) {
    const [qual, id] = f.destino.split(":");
    const nome = qual === "conta" ? nomes.contas.get(Number(id)) : nomes.cartoes.get(Number(id));
    linhas.push(`${qual === "conta" ? "Conta Financeira" : "Cartão de Crédito"}: ${nome ?? "?"}`);
  }
  if (f.situacao) linhas.push(`Situação: ${SITUACOES_RELATORIO.find((s) => s.valor === f.situacao)?.rotulo}`);
  if (f.categoria) {
    const c = nomes.arvore.get(Number(f.categoria));
    linhas.push(`Categoria: ${c ? rotuloCategoria(c) : "?"} (com as filhas)`);
  }
  if (f.forma) linhas.push(`Forma de Pagamento: ${nomes.formas.get(Number(f.forma)) ?? "?"}`);
  if (f.contato) linhas.push(`Cliente ou Fornecedor: ${nomes.contatos.get(Number(f.contato)) ?? "?"}`);
  if (f.tag) linhas.push(`Tag: ${nomes.tags.get(Number(f.tag)) ?? "?"}`);
  const incluidas = [f.incluirAcerto && "Acerto de Saldo", f.incluirTransferencia && "Transferência"].filter(Boolean);
  linhas.push(incluidas.length ? `Incluindo as categorias: ${incluidas.join(" e ")}` : "Sem Acerto de Saldo e Transferência");
  if (temZeradas && f.incluirZeradas) linhas.push("Com as categorias zeradas");
  return linhas;
}

export async function calcularFluxoDeCaixa(sp: ParametrosBusca, periodicidade: Periodicidade, hoje = hojeIso()) {
  const [inclusoes, arvore] = await Promise.all([lerInclusoesSalvas("fluxo-de-caixa"), carregarArvore()]);
  const filtros = lerFiltrosRelatorio(sp, periodicidade, hoje, inclusoes);
  const [movimentos, nomes] = await Promise.all([carregarMovimentos(filtros, arvore, hoje), carregarNomes(arvore)]);
  const colunas = colunasDoPeriodo(periodicidade, filtros.inicio, filtros.fim);
  const zeradas = filtros.incluirZeradas ? categoriasZeradas(arvore, filtros.categoria) : [];
  const fluxo = montarFluxoDeCaixa(movimentos, periodicidade, colunas, arvore, zeradas);
  const rotulo = PERIODICIDADES.find((p) => p.valor === periodicidade)!.rotulo;
  return { filtros, inclusoes, fluxo, nomes, descricao: descreverFiltros(filtros, nomes, rotulo) };
}

export async function calcularSaldoDetalhado(sp: ParametrosBusca, agrupamento: Agrupamento, hoje = hojeIso()) {
  const [inclusoes, arvore] = await Promise.all([lerInclusoesSalvas("saldo-detalhado"), carregarArvore()]);
  const filtros = lerFiltrosRelatorio(sp, agrupamento, hoje, inclusoes);
  const [movimentos, nomes] = await Promise.all([carregarMovimentos(filtros, arvore, hoje), carregarNomes(arvore)]);
  // Categorias Zeradas só muda o relatório por Categorias (nos outros, as linhas não são categorias).
  const zeradas = filtros.incluirZeradas && agrupamento === "categoria" ? categoriasZeradas(arvore, filtros.categoria) : [];
  const saldo = montarSaldoDetalhado(movimentos, agrupamento, nomes, filtros, zeradas);
  const rotulo = AGRUPAMENTOS.find((a) => a.valor === agrupamento)!.rotulo;
  return { filtros, inclusoes, saldo, nomes, descricao: descreverFiltros(filtros, nomes, rotulo, agrupamento === "categoria") };
}

export const AVISO_TAGS = "Não é possível calcular o Total do Período para Tags, pois o mesmo lançamento pode conter várias tags.";

/** Fluxo de Caixa para PDF, Excel e CSV: Receitas e Despesas abertas por categoria, Saldo, Média e Total. */
export async function tabelaFluxoDeCaixa(sp: ParametrosBusca, periodicidade: Periodicidade, hoje = hojeIso()): Promise<Tabela> {
  const { fluxo, descricao } = await calcularFluxoDeCaixa(sp, periodicidade, hoje);
  const linhas: LinhaTabela[] = [];
  const abrir = (nos: NoCategoria[]) => {
    for (const no of nos) {
      linhas.push({ celulas: [no.rotulo, ...no.valores, no.media, no.total], recuo: no.nivel, cor: no.cor });
      abrir(no.filhos);
    }
  };
  linhas.push({ celulas: ["Receitas", ...fluxo.receitas.valores, fluxo.receitas.media, fluxo.receitas.total], estilo: "grupo" });
  abrir(fluxo.receitas.filhos);
  linhas.push({ celulas: ["Despesas", ...fluxo.despesas.valores, fluxo.despesas.media, fluxo.despesas.total], estilo: "grupo" });
  abrir(fluxo.despesas.filhos);
  linhas.push({ celulas: ["Saldo", ...fluxo.saldo.valores, fluxo.saldo.media, fluxo.saldo.total], estilo: "total" });
  return {
    titulo: "Fluxo de Caixa",
    filtros: descricao,
    colunas: [{ titulo: "", largura: 3 }, ...fluxo.colunas.map((c) => ({ titulo: c.rotulo, tipo: "dinheiro" as const })), { titulo: "Média", tipo: "dinheiro" }, { titulo: "Total", tipo: "dinheiro" }],
    linhas,
    orientacao: "paisagem",
    registros: null,
    avisos: ["O saldo é só o do período (receitas mais despesas); não inclui o saldo que as contas já tinham. Inclui os recorrentes e parcelas previstos."],
    arquivo: nomeArquivo("fluxo de caixa", hoje),
  };
}

/** Saldo Detalhado para PDF, Excel e CSV. */
export async function tabelaSaldoDetalhado(sp: ParametrosBusca, agrupamento: Agrupamento, hoje = hojeIso()): Promise<Tabela> {
  const { saldo, descricao } = await calcularSaldoDetalhado(sp, agrupamento, hoje);
  const info = AGRUPAMENTOS.find((a) => a.valor === agrupamento)!;
  const linhas: LinhaTabela[] = saldo.linhas.map((l) => ({ celulas: [l.rotulo, l.receitas, l.despesas, l.resultado], cor: l.cor }));
  if (saldo.total) linhas.push({ celulas: ["Total do Período", saldo.total.receitas, saldo.total.despesas, saldo.total.resultado], estilo: "total" });
  return {
    titulo: `Saldo Detalhado · ${info.rotulo}`,
    filtros: descricao,
    colunas: [{ titulo: info.coluna, largura: 3 }, { titulo: "Receitas", tipo: "dinheiro" }, { titulo: "Despesas", tipo: "dinheiro" }, { titulo: "Resultado", tipo: "dinheiro" }],
    linhas,
    orientacao: "paisagem",
    registros: saldo.linhas.length,
    avisos: saldo.total ? [] : [AVISO_TAGS],
    arquivo: nomeArquivo(`saldo detalhado ${info.rotulo}`, hoje),
  };
}
