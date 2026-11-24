/**
 * Filtros das listas de Cadastros, lidos da URL. Usados pela tela (com paginação)
 * e pela Impressão Padrão e exportação (a lista inteira, com os mesmos filtros).
 */
import { and, eq, sql } from "drizzle-orm";
import { schema } from "@/db";
import type { CategoriaNaArvore } from "@/lib/categorias";
import { condicaoSituacao, contemTexto, lerFiltrosComuns, parametro, semAcento, type ParametrosBusca } from "./filtros";
import { DIAS_MES, TIPOS_CONTA, UFS, type TipoConta } from "./opcoes";

const { contaFinanceira: conta, cartaoCredito: cartao, contato: c, formaPagamento: forma, tag } = schema;

export function filtrosContas(sp: ParametrosBusca) {
  const f = lerFiltrosComuns(sp);
  const tipoParam = parametro(sp, "tipo");
  const tipo = TIPOS_CONTA.some((t) => t.valor === tipoParam) ? (tipoParam as TipoConta) : "";
  const onde = and(f.busca ? contemTexto(conta.descricao, f.busca) : undefined, tipo ? eq(conta.tipo, tipo) : undefined, condicaoSituacao(conta.ativo, f.situacao));
  return { f, tipo, onde };
}

export function filtrosCartoes(sp: ParametrosBusca) {
  const f = lerFiltrosComuns(sp);
  const fechamento = DIAS_MES.includes(parametro(sp, "fechamento")) ? parametro(sp, "fechamento") : "";
  const vencimento = DIAS_MES.includes(parametro(sp, "vencimento")) ? parametro(sp, "vencimento") : "";
  const onde = and(
    f.busca ? contemTexto(cartao.descricao, f.busca) : undefined,
    fechamento ? eq(cartao.diaFechamento, Number(fechamento)) : undefined,
    vencimento ? eq(cartao.diaVencimento, Number(vencimento)) : undefined,
    condicaoSituacao(cartao.ativo, f.situacao),
  );
  return { f, fechamento, vencimento, onde };
}

export function filtrosContatos(sp: ParametrosBusca) {
  const f = lerFiltrosComuns(sp);
  const papel = ["clientes", "fornecedores"].includes(parametro(sp, "papel")) ? parametro(sp, "papel") : "";
  const pessoa = ["fisica", "juridica"].includes(parametro(sp, "pessoa")) ? (parametro(sp, "pessoa") as "fisica" | "juridica") : "";
  const cidade = parametro(sp, "cidade").slice(0, 100);
  const uf = (UFS as readonly string[]).includes(parametro(sp, "uf")) ? parametro(sp, "uf") : "";
  const onde = and(
    f.busca
      ? sql`(${contemTexto(c.nome, f.busca)} or ${contemTexto(c.razaoSocial, f.busca)} or ${contemTexto(c.documento, f.busca)} or ${contemTexto(c.email, f.busca)})`
      : undefined,
    papel === "clientes" ? eq(c.eCliente, true) : papel === "fornecedores" ? eq(c.eFornecedor, true) : undefined,
    pessoa ? eq(c.pessoa, pessoa) : undefined,
    cidade ? contemTexto(c.cidade, cidade) : undefined,
    uf ? eq(c.uf, uf) : undefined,
    condicaoSituacao(c.ativo, f.situacao),
  );
  return { f, papel, pessoa, cidade, uf, onde };
}

export function filtrosFormas(sp: ParametrosBusca) {
  const f = lerFiltrosComuns(sp);
  const onde = and(f.busca ? sql`(${contemTexto(forma.descricao, f.busca)} or ${contemTexto(forma.sigla, f.busca)})` : undefined, condicaoSituacao(forma.ativo, f.situacao));
  return { f, onde };
}

export function filtrosTags(sp: ParametrosBusca) {
  const f = lerFiltrosComuns(sp);
  const onde = and(f.busca ? contemTexto(tag.descricao, f.busca) : undefined, condicaoSituacao(tag.ativo, f.situacao));
  return { f, onde };
}

/** Categorias da aba e da busca (a lista é a árvore inteira, filtrada aqui). */
export function filtrarCategorias<T extends CategoriaNaArvore>(arvore: T[], sp: ParametrosBusca) {
  const f = lerFiltrosComuns(sp);
  const raizes = arvore.filter((c) => c.nivel === 1 && !c.especial);
  const abaId = Number(parametro(sp, "aba"));
  const aba = raizes.some((r) => r.id === abaId) ? abaId : null;
  const termo = semAcento(f.busca).toLowerCase();
  const linhas = arvore.filter(
    (c) =>
      (aba === null || (c.raizId === aba && !c.especial)) &&
      (!termo || semAcento(c.nome).toLowerCase().includes(termo) || c.numero.startsWith(termo)) &&
      (f.situacao === "todos" || c.ativo === (f.situacao === "ativos")),
  );
  return { f, aba, raizes, linhas };
}
