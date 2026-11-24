import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { rotuloTipoConta } from "@/lib/cadastros/opcoes";
import { faturasAtuais } from "@/lib/cartoes/servidor";
import { montarArvore } from "@/lib/categorias";
import { lerConfiguracao } from "@/lib/configuracao";
import { hojeIso } from "@/lib/datas";
import { lerFiltros, listarLancamentos, saldosDasContas, valorRealizadoSql } from "@/lib/lancamentos/consultas";
import { somarDias } from "@/lib/lancamentos/regras";
import type { LinhaLista } from "@/lib/lancamentos/tipos";
import {
  fatiasDeCategorias,
  mesesDoPeriodo,
  normalizarOpcoes,
  separarPrazos,
  serieDeSaldo,
  totaisDoMes,
  type LinhaPainel,
  type OpcoesVisaoGeral,
} from "./regras";

const { lancamento: l, lancamentoItem: item, contaFinanceira: conta, banco, categoria } = schema;

export const CHAVE_OPCOES = "visao_geral";

export async function lerOpcoesVisaoGeral(): Promise<OpcoesVisaoGeral> {
  return normalizarOpcoes(await lerConfiguracao(CHAVE_OPCOES));
}

const paraPainel = (x: LinhaLista): LinhaPainel => ({
  chave: x.chave,
  tipo: x.tipo,
  descricao: x.descricao,
  data: x.data,
  situacao: x.situacao,
  valorCentavos: x.valorCentavos,
  contaOuCartao: x.contaOuCartao,
});

export type ContaPainel = {
  id: number;
  descricao: string;
  tipo: string;
  bancoCodigo: string | null;
  bancoNome: string;
  saldoCentavos: number;
  considerarNosSaldos: boolean;
  ativo: boolean;
};

/** Tudo o que a Visão Geral mostra, calculado de uma vez. */
export async function carregarPainel(hoje = hojeIso()) {
  const db = getDb();
  const opcoes = await lerOpcoesVisaoGeral();
  const inicioPrazos = somarDias(hoje, -opcoes.vencidosDias);
  const fimPrazos = somarDias(hoje, opcoes.futuroDias);
  const meses = mesesDoPeriodo({ inicio: inicioPrazos, fim: fimPrazos });

  // A mesma lista da tela de Lançamentos (com faturas e recorrentes previstos), mês a mês.
  const listas = await Promise.all(meses.map((mes) => listarLancamentos(lerFiltros({ mes }, hoje), hoje)));
  const porMes = new Map(meses.map((m, i) => [m, listas[i].linhas.map(paraPainel)]));
  const todas = [...porMes.values()].flat();
  const prazos = separarPrazos(todas, hoje, opcoes);
  const mesAtual = totaisDoMes(porMes.get(hoje.slice(0, 7)) ?? []);

  const [contas, saldos, serie, categorias, faturas] = await Promise.all([
    db
      .select({
        id: conta.id,
        descricao: conta.descricao,
        tipo: conta.tipo,
        bancoCodigo: banco.codigo,
        bancoNome: banco.nome,
        considerarNosSaldos: conta.considerarNosSaldos,
        ativo: conta.ativo,
      })
      .from(conta)
      .leftJoin(banco, eq(banco.id, conta.bancoId))
      .orderBy(asc(conta.ordem), asc(sql`lower(${conta.descricao})`)),
    saldosDasContas(hoje),
    evolucaoDoSaldo(hoje, 30),
    despesasPorCategoria(somarDias(hoje, -(opcoes.categoriasDias - 1)), hoje),
    faturasAtuais(hoje),
  ]);

  const listaContas: ContaPainel[] = contas.map((c) => ({
    ...c,
    tipo: rotuloTipoConta(c.tipo),
    bancoNome: c.bancoNome ?? "Outro",
    saldoCentavos: saldos.get(c.id) ?? 0,
  }));
  const saldoAtual = listaContas.filter((c) => c.considerarNosSaldos).reduce((s, c) => s + c.saldoCentavos, 0);

  return { opcoes, prazos, mesAtual, contas: listaContas, saldoAtual, serie, categorias, faturas };
}

/** Ids das contas marcadas "Considerar nos saldos". */
async function contasDoSaldo(): Promise<number[]> {
  const linhas = await getDb().select({ id: conta.id }).from(conta).where(eq(conta.considerarNosSaldos, true));
  return linhas.map((c) => c.id);
}

/** Saldo no fim de cada um dos últimos "dias" (só o que já foi pago ou recebido). */
async function evolucaoDoSaldo(hoje: string, dias: number) {
  const db = getDb();
  const inicio = somarDias(hoje, -(dias - 1));
  const ids = await contasDoSaldo();
  if (!ids.length) return serieDeSaldo(0, [], { inicio, fim: hoje });
  const nasContas = and(inArray(l.contaId, ids), isNotNull(l.dataPagamento));
  const [[antes], movimentos] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${valorRealizadoSql}), 0)` }).from(l).where(and(nasContas, lt(l.dataPagamento, inicio))),
    db
      .select({ data: sql<string>`${l.dataPagamento}::text`, total: sql<number>`coalesce(sum(${valorRealizadoSql}), 0)` })
      .from(l)
      .where(and(nasContas, gte(l.dataPagamento, inicio), lte(l.dataPagamento, hoje)))
      .groupBy(l.dataPagamento),
  ]);
  return serieDeSaldo(
    Number(antes.total),
    movimentos.map((m) => ({ data: m.data, valorCentavos: Number(m.total) })),
    { inicio, fim: hoje },
  );
}

/**
 * Gastos do período por categoria principal (raiz), para o gráfico de rosca.
 * Compras no cartão contam pela data da compra; lançamentos detalhados, pelos itens.
 */
async function despesasPorCategoria(inicio: string, fim: string) {
  const db = getDb();
  const dataDoGasto = sql`coalesce(${l.dataCompra}, ${l.dataVencimento})`;
  const noPeriodo = and(gte(dataDoGasto, inicio), lte(dataDoGasto, fim));
  const [simples, detalhados, todas] = await Promise.all([
    db
      .select({ categoriaId: l.categoriaId, total: sql<number>`sum(abs(${l.valorCentavos}))` })
      .from(l)
      .where(and(eq(l.tipo, "despesa"), eq(l.formato, "simples"), isNotNull(l.categoriaId), noPeriodo))
      .groupBy(l.categoriaId),
    db
      .select({ categoriaId: item.categoriaId, total: sql<number>`sum(abs(${item.valorCentavos}))` })
      .from(item)
      .innerJoin(l, eq(l.id, item.lancamentoId))
      .where(and(eq(item.tipo, "despesa"), eq(l.formato, "detalhado"), noPeriodo))
      .groupBy(item.categoriaId),
    db
      .select({
        id: categoria.id,
        nome: categoria.nome,
        categoriaPaiId: categoria.categoriaPaiId,
        ordem: categoria.ordem,
        cor: categoria.cor,
        natureza: categoria.natureza,
        especial: categoria.especial,
        ativo: categoria.ativo,
        padraoSistema: categoria.padraoSistema,
      })
      .from(categoria),
  ]);
  const arvore = new Map(montarArvore(todas).map((c) => [c.id, c]));
  const gastos = [...simples, ...detalhados].flatMap((g) => {
    const c = g.categoriaId ? arvore.get(g.categoriaId) : undefined;
    if (!c || c.especial || c.natureza !== "despesa") return [];
    const raiz = arvore.get(c.raizId) ?? c;
    return [{ id: raiz.id, nome: `${raiz.numero} ${raiz.nome}`.trim(), cor: raiz.corEfetiva, valorCentavos: Number(g.total) }];
  });
  const fatias = fatiasDeCategorias(gastos);
  return { inicio, fim, fatias, total: fatias.reduce((s, f) => s + f.valorCentavos, 0) };
}
