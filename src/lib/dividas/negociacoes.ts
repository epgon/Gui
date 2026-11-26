import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { parametro, semAcento, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { carregarTodasDividas } from "./servidor";
import type { DividaParaRenegociar, FiltrosNegociacoes, LinhaDivida, LinhaNegociacao, PropostaLinha } from "./tipos";

const { negociacao, negociacaoDivida, negociacaoProposta, contato, lancamento: l, dividaVinculo, fatura, cartaoCredito: cartao, recorrencia } = schema;

export function lerFiltrosNegociacoes(sp: ParametrosBusca): FiltrosNegociacoes {
  const data = (n: string) => (/^\d{4}-\d{2}-\d{2}$/.test(parametro(sp, n)) ? parametro(sp, n) : "");
  return {
    busca: parametro(sp, "busca").slice(0, 100),
    credor: parametro(sp, "credor"),
    situacao: parametro(sp, "situacao"),
    de: data("de"),
    ate: data("ate"),
    pagina: Math.max(1, Math.floor(Number(parametro(sp, "pagina")) || 1)),
  };
}

const proposta = (p: typeof negociacaoProposta.$inferSelect): PropostaLinha => ({
  id: p.id,
  negociacaoId: p.negociacaoId,
  data: p.data,
  quemPropos: p.quemPropos,
  modalidade: p.modalidade,
  entradaCentavos: Number(p.entradaCentavos),
  parcelas: p.parcelas,
  valorParcelaCentavos: Number(p.valorParcelaCentavos),
  primeiroVencimento: p.primeiroVencimento,
  totalCentavos: Number(p.totalCentavos),
  validade: p.validade,
  situacao: p.situacao,
  observacao: p.observacao,
});

/** As negociações (com dívidas e propostas) filtradas; a mais recente primeiro. */
export async function carregarNegociacoes(f: FiltrosNegociacoes | null, dividas?: LinhaDivida[], filtroId?: number): Promise<{ linhas: LinhaNegociacao[]; credores: { id: number; nome: string }[] }> {
  const db = getDb();
  const todasDividas = dividas ?? (await carregarTodasDividas(hojeIso()));
  const porId = new Map(todasDividas.map((d) => [d.id, d]));
  const condicoes = [
    filtroId ? eq(negociacao.id, filtroId) : undefined,
    f?.credor ? eq(negociacao.contatoId, Number(f.credor) || 0) : undefined,
    f?.situacao ? eq(negociacao.situacao, f.situacao as never) : undefined,
    f?.de ? gte(negociacao.dataInicio, f.de) : undefined,
    f?.ate ? lte(negociacao.dataInicio, f.ate) : undefined,
  ].filter((x) => x !== undefined);
  const [linhas, todosCredores] = await Promise.all([
    db
      .select({ n: negociacao, credor: contato.nome })
      .from(negociacao)
      .innerJoin(contato, eq(contato.id, negociacao.contatoId))
      .where(condicoes.length ? and(...condicoes) : undefined)
      .orderBy(desc(negociacao.dataInicio), desc(negociacao.id)),
    db.selectDistinct({ id: contato.id, nome: contato.nome }).from(negociacao).innerJoin(contato, eq(contato.id, negociacao.contatoId)).orderBy(asc(contato.nome)),
  ]);
  const ids = linhas.map((x) => x.n.id);
  const [vinculos, propostas] = ids.length
    ? await Promise.all([
        db.select().from(negociacaoDivida).where(inArray(negociacaoDivida.negociacaoId, ids)),
        db.select().from(negociacaoProposta).where(inArray(negociacaoProposta.negociacaoId, ids)).orderBy(asc(negociacaoProposta.data), asc(negociacaoProposta.id)),
      ])
    : [[], []];

  const termo = f ? semAcento(f.busca).toLowerCase() : "";
  const resultado: LinhaNegociacao[] = linhas.map(({ n, credor }) => {
    const dividasDela = vinculos
      .filter((v) => v.negociacaoId === n.id)
      .map((v) => porId.get(v.dividaId))
      .filter((d): d is LinhaDivida => !!d)
      .map((d) => ({ id: d.id, descricao: d.descricao, saldoCentavos: d.saldo.exibido, situacao: d.situacao }));
    const props = propostas.filter((p) => p.negociacaoId === n.id).map(proposta);
    const abertas = props.filter((p) => p.situacao === "aberta").sort((a, b) => a.totalCentavos - b.totalCentavos);
    return {
      id: n.id,
      contatoId: n.contatoId,
      credor,
      situacao: n.situacao,
      canal: n.canal,
      protocolo: n.protocolo,
      dataInicio: n.dataInicio,
      prazoResposta: n.prazoResposta,
      sobraMensalCentavos: n.sobraMensalCentavos === null ? null : Number(n.sobraMensalCentavos),
      observacao: n.observacao,
      acordoId: n.acordoId,
      dividas: dividasDela,
      // Saldo de hoje das dívidas que ainda estão ativas (as renegociadas, quitadas e canceladas não entram).
      saldoCentavos: dividasDela.filter((d) => d.situacao !== "renegociada" && d.situacao !== "cancelada" && d.situacao !== "quitada").reduce((s, d) => s + d.saldoCentavos, 0),
      propostas: props,
      melhorPropostaId: abertas[0]?.id ?? null,
    };
  });
  return {
    linhas: termo ? resultado.filter((n) => semAcento(`${n.credor} ${n.protocolo ?? ""} ${n.dividas.map((d) => d.descricao).join(" ")}`).toLowerCase().includes(termo)) : resultado,
    credores: todosCredores,
  };
}

/** Os dados que o assistente de Renegociação mostra: lançamentos (pagos e não pagos) e o que será encerrado. */
export async function carregarParaRenegociar(ids: number[], hoje = hojeIso()): Promise<DividaParaRenegociar[]> {
  if (!ids.length) return [];
  const db = getDb();
  const dividas = (await carregarTodasDividas(hoje)).filter((d) => ids.includes(d.id));
  const [lancamentos, vinculos] = await Promise.all([
    db
      .select({ id: l.id, dividaId: l.dividaId, descricao: l.descricao, vencimento: l.dataVencimento, valor: l.valorCentavos, pagamento: l.dataPagamento })
      .from(l)
      .where(and(inArray(l.dividaId, ids), eq(l.tipo, "despesa"), isNull(l.cartaoId)))
      .orderBy(asc(l.dataVencimento), asc(l.id)),
    db.select().from(dividaVinculo).where(inArray(dividaVinculo.dividaId, ids)),
  ]);
  const idsFaturas = vinculos.map((v) => v.faturaId).filter((x): x is number => x !== null);
  const idsRecorrencias = vinculos.map((v) => v.recorrenciaId).filter((x): x is number => x !== null);
  const [faturas, recorrentes] = await Promise.all([
    idsFaturas.length ? db.select({ id: fatura.id, competencia: fatura.competencia, cartao: cartao.descricao }).from(fatura).innerJoin(cartao, eq(cartao.id, fatura.cartaoId)).where(inArray(fatura.id, idsFaturas)) : Promise.resolve([]),
    idsRecorrencias.length ? db.select({ id: recorrencia.id, descricao: recorrencia.descricao }).from(recorrencia).where(inArray(recorrencia.id, idsRecorrencias)) : Promise.resolve([]),
  ]);
  return dividas.map((d) => ({
    id: d.id,
    descricao: d.descricao,
    contatoId: d.contatoId,
    credor: d.credor,
    saldoCentavos: d.saldo.exibido,
    lancamentos: lancamentos
      .filter((x) => x.dividaId === d.id)
      .map((x) => ({ id: x.id, descricao: x.descricao, vencimento: x.vencimento, valorCentavos: Math.abs(Number(x.valor)), dataPagamento: x.pagamento })),
    faturas: vinculos
      .filter((v) => v.dividaId === d.id && v.faturaId !== null)
      .map((v) => faturas.find((f) => f.id === v.faturaId))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => `${f.cartao} ${f.competencia.slice(0, 7)}`),
    recorrentes: vinculos
      .filter((v) => v.dividaId === d.id && v.recorrenciaId !== null)
      .map((v) => recorrentes.find((r) => r.id === v.recorrenciaId)?.descricao)
      .filter((x): x is string => !!x),
  }));
}
