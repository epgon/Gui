import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { montarArvore, rotuloCategoria } from "@/lib/categorias";
import { hojeIso } from "@/lib/datas";
import { valorComSinalSql } from "@/lib/lancamentos/sql";
import { rotuloCompetencia } from "@/lib/lancamentos/regras";
import { escolherFaturaAtual, limiteDoCartao, podePagar, situacaoDaFatura, totalProximas, type FaturaResumo, type SituacaoFatura } from "./regras";

const { lancamento: l, fatura, cartaoCredito: cartao, contaFinanceira: conta, banco, categoria } = schema;

export type FaturaLista = FaturaResumo & {
  id: number;
  cartaoId: number;
  situacao: SituacaoFatura;
  rotulo: string;
  ultimoPagamento: string | null;
};

/** Total a pagar (compras − estornos), em SQL, só das linhas que passarem no filtro. */
const aPagar = (filtro?: SQL) => sql<number>`coalesce(-sum(${valorComSinalSql})${filtro ? sql` filter (where ${filtro})` : sql``}, 0)`;

/** Coluna id da fatura escrita com o nome da tabela (sem join, o Drizzle não qualifica e a subconsulta pegaria o id do lançamento). */
const faturaIdExterno = sql.raw(`"fatura"."id"`);

/** Faturas com os totais das compras e dos pagamentos. */
export async function listarFaturas(onde: SQL | undefined, hoje = hojeIso()): Promise<FaturaLista[]> {
  const db = getDb();
  const linhas = await db
    .select({
      id: fatura.id,
      cartaoId: fatura.cartaoId,
      competencia: fatura.competencia,
      dataFechamento: fatura.dataFechamento,
      dataVencimento: fatura.dataVencimento,
      situacaoGravada: fatura.situacao,
      compras: sql<number>`(select count(*)::int from ${l} where ${l.faturaId} = ${faturaIdExterno})`,
      totalCentavos: sql<number>`(select ${aPagar()} from ${l} where ${l.faturaId} = ${faturaIdExterno})`,
      pendenteCentavos: sql<number>`(select ${aPagar(isNull(l.dataPagamento))} from ${l} where ${l.faturaId} = ${faturaIdExterno})`,
      pagoCentavos: sql<number>`(select coalesce(sum(abs(${l.valorCentavos})), 0) from ${l} where ${l.faturaPagaId} = ${faturaIdExterno})`,
      ultimoPagamento: sql<string | null>`(select max(${l.dataPagamento})::text from ${l} where ${l.faturaPagaId} = ${faturaIdExterno})`,
    })
    .from(fatura)
    .where(onde)
    .orderBy(asc(fatura.competencia));
  return linhas.map((f) => {
    const numeros = {
      ...f,
      compras: Number(f.compras),
      totalCentavos: Number(f.totalCentavos),
      pendenteCentavos: Number(f.pendenteCentavos),
      pagoCentavos: Number(f.pagoCentavos),
    };
    return { ...numeros, situacao: situacaoDaFatura(numeros, hoje), rotulo: rotuloCompetencia(f.competencia) };
  });
}

/** Quanto do limite cada cartão está usando: compras ainda não pagas, de todas as faturas. */
export async function usoDosLimites(): Promise<Map<number, number>> {
  const linhas = await getDb()
    .select({ cartaoId: l.cartaoId, usado: aPagar() })
    .from(l)
    .where(and(isNotNull(l.cartaoId), isNull(l.dataPagamento)))
    .groupBy(l.cartaoId);
  return new Map(linhas.map((x) => [x.cartaoId!, Number(x.usado)]));
}

const camposCartao = {
  id: cartao.id,
  descricao: cartao.descricao,
  limiteCentavos: cartao.limiteCentavos,
  ilimitado: cartao.ilimitado,
  diaFechamento: cartao.diaFechamento,
  diaVencimento: cartao.diaVencimento,
  contaPagamentoId: cartao.contaPagamentoId,
  ativo: cartao.ativo,
  bancoCodigo: banco.codigo,
  bancoNome: sql<string>`coalesce(${banco.nome}, 'Outro')`,
};

/** Janela "Detalhando Cartão de Crédito": resumo do limite, fatura atual, próximas e todas as faturas. */
export async function carregarDetalheCartao(id: number, hoje = hojeIso()) {
  const db = getDb();
  const [c] = await db
    .select({ ...camposCartao, contaPagamento: conta.descricao })
    .from(cartao)
    .leftJoin(banco, eq(banco.id, cartao.bancoId))
    .leftJoin(conta, eq(conta.id, cartao.contaPagamentoId))
    .where(eq(cartao.id, id));
  if (!c) return null;
  const [faturas, usos] = await Promise.all([listarFaturas(eq(fatura.cartaoId, id), hoje), usoDosLimites()]);
  const atual = escolherFaturaAtual(faturas, c, hoje);
  return {
    hoje,
    cartao: c,
    limite: limiteDoCartao(c, usos.get(id) ?? 0),
    atual: { ...atual, situacao: situacaoDaFatura(atual, hoje), rotulo: rotuloCompetencia(atual.competencia) },
    proximas: totalProximas(faturas, atual),
    faturas: faturas.slice().reverse(),
  };
}
export type DetalheCartao = NonNullable<Awaited<ReturnType<typeof carregarDetalheCartao>>>;

/** Uma fatura com as compras e os pagamentos, para a janela da fatura. */
export async function carregarFatura(faturaId: number, hoje = hojeIso()) {
  const db = getDb();
  const [f] = await listarFaturas(eq(fatura.id, faturaId), hoje);
  if (!f) return null;
  const [[c], compras, pagamentos, contas, categorias] = await Promise.all([
    db.select(camposCartao).from(cartao).leftJoin(banco, eq(banco.id, cartao.bancoId)).where(eq(cartao.id, f.cartaoId)),
    db
      .select({
        id: l.id,
        descricao: l.descricao,
        dataCompra: sql<string>`coalesce(${l.dataCompra}, ${l.dataVencimento})::text`,
        valorCentavos: valorComSinalSql,
        categoriaId: l.categoriaId,
        formato: l.formato,
        parcelaNumero: l.parcelaNumero,
        parcelaTotal: l.parcelaTotal,
        pago: sql<boolean>`${l.dataPagamento} is not null`,
      })
      .from(l)
      .where(eq(l.faturaId, faturaId))
      .orderBy(asc(sql`coalesce(${l.dataCompra}, ${l.dataVencimento})`), asc(l.id)),
    db
      .select({ id: l.id, dataPagamento: l.dataPagamento, valorCentavos: l.valorCentavos, conta: conta.descricao })
      .from(l)
      .innerJoin(conta, eq(conta.id, l.contaId))
      .where(eq(l.faturaPagaId, faturaId))
      .orderBy(desc(l.dataPagamento), desc(l.id)),
    db.select({ id: conta.id, descricao: conta.descricao, ativo: conta.ativo }).from(conta).orderBy(asc(conta.ordem), asc(conta.descricao)),
    db
      .select({ id: categoria.id, nome: categoria.nome, categoriaPaiId: categoria.categoriaPaiId, ordem: categoria.ordem, cor: categoria.cor, natureza: categoria.natureza, especial: categoria.especial, ativo: categoria.ativo, padraoSistema: categoria.padraoSistema })
      .from(categoria),
  ]);
  const arvore = new Map(montarArvore(categorias).map((x) => [x.id, x]));
  return {
    hoje,
    fatura: { ...f, podePagar: podePagar(f), podeFechar: f.situacao === "aberta", podeReabrir: f.situacaoGravada === "fechada" && hoje < f.dataFechamento && f.situacao !== "paga" },
    cartao: c,
    compras: compras.map((x) => {
      const cat = x.categoriaId ? arvore.get(x.categoriaId) : undefined;
      return {
        id: x.id,
        descricao: x.descricao,
        dataCompra: x.dataCompra,
        valorCentavos: Number(x.valorCentavos),
        categoria: x.formato === "detalhado" ? "Detalhado" : cat ? rotuloCategoria(cat) : null,
        categoriaCor: cat?.corEfetiva ?? null,
        parcela: x.parcelaNumero && x.parcelaTotal ? `${x.parcelaNumero}/${x.parcelaTotal}` : null,
        pago: x.pago,
      };
    }),
    pagamentos: pagamentos.map((p) => ({ ...p, valorCentavos: Math.abs(p.valorCentavos) })),
    contas: contas.filter((x) => x.ativo || x.id === c?.contaPagamentoId),
  };
}
export type DetalheFatura = NonNullable<Awaited<ReturnType<typeof carregarFatura>>>;

/** Cartão "Faturas Atuais" da Visão Geral: a fatura atual de cada cartão ativo. */
export async function faturasAtuais(hoje = hojeIso()) {
  const db = getDb();
  const cartoes = await db
    .select(camposCartao)
    .from(cartao)
    .leftJoin(banco, eq(banco.id, cartao.bancoId))
    .where(eq(cartao.ativo, true))
    .orderBy(asc(cartao.ordem), asc(sql`lower(${cartao.descricao})`));
  if (!cartoes.length) return [];
  const [faturas, usos] = await Promise.all([listarFaturas(inArray(fatura.cartaoId, cartoes.map((c) => c.id)), hoje), usoDosLimites()]);
  return cartoes.map((c) => {
    const atual = escolherFaturaAtual(
      faturas.filter((f) => f.cartaoId === c.id),
      c,
      hoje,
    );
    return {
      cartao: c,
      fatura: { ...atual, situacao: situacaoDaFatura(atual, hoje), rotulo: rotuloCompetencia(atual.competencia) },
      limite: limiteDoCartao(c, usos.get(c.id) ?? 0),
    };
  });
}
export type FaturaAtualPainel = Awaited<ReturnType<typeof faturasAtuais>>[number];
