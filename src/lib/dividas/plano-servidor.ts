import "server-only";
import { and, asc, desc, eq, gt, gte, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hojeIso } from "@/lib/datas";
import { estaAtiva } from "./regras";
import {
  compararPlano,
  deficitAcumulado,
  detectarDesvios,
  extrasParaAgendar,
  gerarPropostaAjuste,
  mesAnteriorDoPlano,
  mesesAcompanhados,
  percentualDoPlano,
  preverPlano,
  serieDeSaldos,
  type ConfigPlano,
  type Desvio,
  type ExtraAgendavel,
  type ExtraDoPlano,
  type LinhaPlano,
  type MesComparado,
  type NovaDivida,
  type Pagamento,
  type PontoSaldo,
  type PropostaAjuste,
  type SerieSaldos,
  type SituacaoPlano,
} from "./plano";
import type { PlanoParaConsultor } from "./consultor/regras";
import { carregarDividasCompletas, type DividaCompleta } from "./servidor";
import { carregarSituacaoFinanceira } from "./simulador-servidor";
import { mesDe, type DividaSim, type Estrategia, type ResultadoSimulacao, type SituacaoFinanceira } from "./simulador";

const { planoQuitacao, planoQuitacaoMes, planoAjuste, parcelamento, lancamento: l } = schema;

/** O que fica guardado em `plano_quitacao.parametros`. */
export type ParametrosPlano = {
  origem: "simulacao" | "zero" | "ajuste";
  /** Nome da simulação de onde o plano veio (só texto). */
  simulacao: string | null;
  personalizada: string[];
  extras: ExtraDoPlano[];
  reservaUsadaCentavos: number;
  /** A sobra mensal no dia da aprovação (para ver se ela mudou muito depois). */
  sobraNaAprovacaoCentavos: number | null;
  /** O saldo de partida do plano, para a barra de progresso. */
  saldoInicialCentavos: number;
  saldoPlanejado: PontoSaldo[];
  mesFinalPlanejado: string | null;
  /** As dívidas que o plano cobre. */
  dividaIds: number[];
  /** Primeiro mês cujo realizado conta para desvio e para o R9. Ao aprovar um ajuste, os meses anteriores ficam só no histórico. */
  acompanharDesde: string | null;
};

export type PlanoLinha = {
  id: number;
  nome: string;
  versao: number;
  planoAnteriorId: number | null;
  situacao: SituacaoPlano;
  estrategia: Estrategia;
  valorMensalCentavos: number | null;
  reservaMinimaCentavos: number;
  inicio: string;
  parametros: ParametrosPlano;
  aprovadoEm: string | null;
  encerradoEm: string | null;
  criadoEm: string;
};

export type AjusteLinha = { id: number; planoId: number; criadoEm: string; motivo: string; situacao: "pendente" | "aprovado" | "recusado"; opcao: string | null; decididoEm: string | null; planoNovoId: number | null; assinatura: string | null; titulo: string | null };

const numeroOu = (v: unknown, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Lê o JSON guardado com cuidado: um plano antigo ou alterado à mão não derruba a tela. */
export function lerParametrosPlano(v: unknown): ParametrosPlano {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const extras = Array.isArray(o.extras) ? o.extras.filter((x): x is ExtraDoPlano => !!x && typeof (x as ExtraDoPlano).mes === "string" && /^\d{4}-\d{2}$/.test((x as ExtraDoPlano).mes) && typeof (x as ExtraDoPlano).valorCentavos === "number") : [];
  const saldos = Array.isArray(o.saldoPlanejado) ? o.saldoPlanejado.filter((x): x is PontoSaldo => !!x && typeof (x as PontoSaldo).mes === "string" && typeof (x as PontoSaldo).saldoCentavos === "number") : [];
  return {
    origem: o.origem === "simulacao" || o.origem === "ajuste" ? o.origem : "zero",
    simulacao: typeof o.simulacao === "string" ? o.simulacao : null,
    personalizada: textos(o.personalizada),
    extras,
    reservaUsadaCentavos: numeroOu(o.reservaUsadaCentavos, 0),
    sobraNaAprovacaoCentavos: typeof o.sobraNaAprovacaoCentavos === "number" ? o.sobraNaAprovacaoCentavos : null,
    saldoInicialCentavos: numeroOu(o.saldoInicialCentavos, 0),
    saldoPlanejado: saldos,
    mesFinalPlanejado: typeof o.mesFinalPlanejado === "string" ? o.mesFinalPlanejado : null,
    dividaIds: Array.isArray(o.dividaIds) ? o.dividaIds.filter((x): x is number => Number.isInteger(x)) : [],
    acompanharDesde: typeof o.acompanharDesde === "string" && /^\d{4}-\d{2}$/.test(o.acompanharDesde) ? o.acompanharDesde : null,
  };
}

const ESTRATEGIAS = new Set(["bola_de_neve", "avalanche", "risco", "personalizada"]);

function paraLinha(p: typeof planoQuitacao.$inferSelect): PlanoLinha {
  return {
    id: p.id,
    nome: p.nome,
    versao: p.versao,
    planoAnteriorId: p.planoAnteriorId,
    situacao: (["rascunho", "ativo", "substituido", "encerrado"].includes(p.situacao) ? p.situacao : "encerrado") as SituacaoPlano,
    estrategia: (ESTRATEGIAS.has(p.estrategia) ? p.estrategia : "avalanche") as Estrategia,
    valorMensalCentavos: p.valorMensalCentavos === null ? null : Number(p.valorMensalCentavos),
    reservaMinimaCentavos: Number(p.reservaMinimaCentavos),
    inicio: p.inicio,
    parametros: lerParametrosPlano(p.parametros),
    aprovadoEm: p.aprovadoEm ? p.aprovadoEm.toISOString() : null,
    encerradoEm: p.encerradoEm ? p.encerradoEm.toISOString() : null,
    criadoEm: p.criadoEm.toISOString(),
  };
}

export const configDoPlano = (p: PlanoLinha): ConfigPlano => ({ estrategia: p.estrategia, personalizada: p.parametros.personalizada, valorMensalCentavos: p.valorMensalCentavos, extras: p.parametros.extras, reservaUsadaCentavos: p.parametros.reservaUsadaCentavos });

/** O plano ativo (um só por vez) e as linhas dele. */
export async function lerPlanoAtivo(): Promise<{ plano: PlanoLinha; linhas: LinhaPlano[] } | null> {
  const db = getDb();
  const [p] = await db.select().from(planoQuitacao).where(eq(planoQuitacao.situacao, "ativo")).orderBy(desc(planoQuitacao.id)).limit(1);
  if (!p) return null;
  return { plano: paraLinha(p), linhas: await lerLinhasDoPlano(p.id) };
}

export async function lerLinhasDoPlano(planoId: number): Promise<LinhaPlano[]> {
  const rows = await getDb().select().from(planoQuitacaoMes).where(eq(planoQuitacaoMes.planoId, planoId)).orderBy(asc(planoQuitacaoMes.competencia), asc(planoQuitacaoMes.dividaId));
  return rows.map((r) => ({ mes: r.competencia.slice(0, 7), dividaId: r.dividaId, planejadoCentavos: Number(r.planejadoCentavos) }));
}

/** Todas as versões e planos (do mais novo ao mais antigo) e os ajustes propostos, para o histórico. */
export async function lerHistoricoPlanos(): Promise<{ planos: PlanoLinha[]; ajustes: AjusteLinha[] }> {
  const db = getDb();
  const [planos, ajustes] = await Promise.all([db.select().from(planoQuitacao).orderBy(desc(planoQuitacao.id)).limit(100), db.select().from(planoAjuste).orderBy(desc(planoAjuste.id)).limit(200)]);
  return {
    planos: planos.map(paraLinha),
    ajustes: ajustes.map((a) => {
      const prop = a.proposta && typeof a.proposta === "object" && !Array.isArray(a.proposta) ? (a.proposta as Record<string, unknown>) : {};
      return {
        id: a.id,
        planoId: a.planoId,
        criadoEm: a.criadoEm.toISOString(),
        motivo: a.motivo,
        situacao: a.situacao === "aprovado" || a.situacao === "recusado" ? a.situacao : "pendente",
        opcao: a.opcao,
        decididoEm: a.decididoEm ? a.decididoEm.toISOString() : null,
        planoNovoId: a.planoNovoId,
        assinatura: typeof prop.assinatura === "string" ? prop.assinatura : null,
        titulo: typeof prop.titulo === "string" ? prop.titulo : null,
      };
    }),
  };
}

/** A assinatura do último ajuste recusado do plano: se o desvio é o mesmo, o cartão não volta a aparecer. */
async function assinaturaRecusada(planoId: number): Promise<string | null> {
  const [a] = await getDb().select().from(planoAjuste).where(and(eq(planoAjuste.planoId, planoId), eq(planoAjuste.situacao, "recusado"))).orderBy(desc(planoAjuste.id)).limit(1);
  const prop = a?.proposta && typeof a.proposta === "object" && !Array.isArray(a.proposta) ? (a.proposta as Record<string, unknown>) : null;
  return prop && typeof prop.assinatura === "string" ? prop.assinatura : null;
}

/** Compras parceladas no cartão feitas depois da aprovação e grandes em relação à sobra (regra R10). */
export async function carregarComprasParceladas(aprovadoEm: Date | null, sobraMensalCentavos: number | null): Promise<PlanoParaConsultor["comprasParceladas"]> {
  if (!aprovadoEm) return [];
  const rows = await getDb()
    .selectDistinct({ id: parcelamento.id, descricao: parcelamento.descricaoBase, total: parcelamento.valorTotalCentavos, quantidade: parcelamento.quantidade, dividir: parcelamento.dividirValor })
    .from(parcelamento)
    .innerJoin(l, eq(l.parcelamentoId, parcelamento.id))
    .where(and(isNotNull(l.cartaoId), eq(l.tipo, "despesa"), isNull(l.dividaId), gte(parcelamento.criadoEm, aprovadoEm), gt(parcelamento.quantidade, 1)));
  const limite = sobraMensalCentavos !== null && sobraMensalCentavos > 0 ? sobraMensalCentavos : 100_000;
  return rows
    .map((r) => {
      const total = r.dividir ? Number(r.total) : Number(r.total) * r.quantidade;
      return { parcelamentoId: r.id, descricao: r.descricao, totalCentavos: total, parcelas: r.quantidade, parcelaCentavos: Math.round(total / r.quantidade) };
    })
    .filter((x) => x.totalCentavos >= limite)
    .sort((a, b) => b.totalCentavos - a.totalCentavos)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// A análise do plano ativo
// ---------------------------------------------------------------------------

export type AnalisePlano = {
  plano: PlanoLinha;
  config: ConfigPlano;
  linhas: LinhaPlano[];
  meses: MesComparado[];
  /** Nome de cada dívida do plano (e das novas). */
  nomes: Record<number, string>;
  /** O que falta pagar das dívidas do plano. */
  saldoHojeCentavos: number;
  progressoGeralPct: number;
  /** % do que o plano previu até agora que foi pago. */
  cumprimentoPct: number;
  previsao: ResultadoSimulacao | null;
  /** Todas as dívidas do plano já acabaram. */
  concluido: boolean;
  desvios: Desvio[];
  deficitCentavos: number;
  /** A proposta (sempre calculada que há desvio) e se ela deve aparecer (não foi recusada igual). */
  proposta: PropostaAjuste | null;
  propostaVisivel: boolean;
  novasDividas: NovaDivida[];
  serie: SerieSaldos;
  agendaveis: ExtraAgendavel[];
  /** Para as regras R9 e R10 do Consultor. */
  paraConsultor: PlanoParaConsultor;
};

/** A chave "AAAA-MM|dívida" do lançamento, no mês em que ele pesa (vencidas e não pagas pesam no mês atual). */
function mesDoLancamento(o: { vencimento: string; dataPagamento: string | null }, atual: string): string {
  if (o.dataPagamento) return mesDe(o.dataPagamento);
  const m = mesDe(o.vencimento);
  return m < atual ? atual : m;
}

/**
 * Compara o plano com o que aconteceu e calcula desvios, previsão e proposta de ajuste (só leitura).
 * Recebe as dívidas já carregadas, para o painel do Consultor e a tela do Plano usarem os mesmos números.
 */
export async function analisarPlano(p: {
  ativo: { plano: PlanoLinha; linhas: LinhaPlano[] };
  completas: DividaCompleta[];
  situacao: SituacaoFinanceira;
  temHistorico: boolean;
  hoje: string;
}): Promise<AnalisePlano> {
  const { plano, linhas } = p.ativo;
  const { hoje } = p;
  const atual = mesDe(hoje);
  const config = configDoPlano(plano);
  const idsPlano = new Set([...plano.parametros.dividaIds, ...linhas.map((x) => x.dividaId)]);
  const nomes: Record<number, string> = {};
  for (const c of p.completas) nomes[c.linha.id] = c.linha.descricao;

  const pagamentos: Pagamento[] = p.completas.flatMap((c) => c.obrigacoes.filter((o) => o.dataPagamento).map((o) => ({ dividaId: c.linha.id, data: o.dataPagamento!, valorCentavos: o.valorCentavos })));
  const pagamentosDoPlano = pagamentos.filter((x) => idsPlano.has(x.dividaId));
  const encerramentos = new Map<number, string | null>();
  for (const c of p.completas) {
    if (!idsPlano.has(c.linha.id) || estaAtiva(c.linha.situacao)) continue;
    const quando = c.encerradaEm ?? c.quitadaEm;
    encerramentos.set(c.linha.id, quando ? mesDe(quando) : null);
  }
  const meses = compararPlano({ linhas, pagamentos: pagamentosDoPlano, hoje, encerramentos });
  // Depois de um ajuste aprovado, os meses anteriores ficam só no histórico: o desvio deles já foi tratado.
  const acompanhados = mesesAcompanhados(meses, plano.parametros.acompanharDesde);
  const deficit = deficitAcumulado(acompanhados, hoje);

  const simsDoPlano: DividaSim[] = p.completas.filter((c) => idsPlano.has(c.linha.id) && c.sim).map((c) => c.sim!);
  const novasDividas: NovaDivida[] = p.completas
    .filter((c) => estaAtiva(c.linha.situacao) && !idsPlano.has(c.linha.id) && plano.aprovadoEm && c.linha.criadoEm.toISOString() > plano.aprovadoEm && c.linha.saldo.exibido > 0)
    .map((c) => ({ id: c.linha.id, descricao: c.linha.descricao, saldoCentavos: c.linha.saldo.exibido }));
  const simsTodas: DividaSim[] = p.completas.filter((c) => (idsPlano.has(c.linha.id) || novasDividas.some((n) => n.id === c.linha.id)) && c.sim).map((c) => c.sim!);

  const pagoNoMes = (ids: (id: number) => boolean) => pagamentos.filter((x) => ids(x.dividaId) && mesDe(x.data) === atual).reduce((s, x) => s + x.valorCentavos, 0);
  const jaPagoPlano = pagoNoMes((id) => idsPlano.has(id));
  const jaPagoTodas = pagoNoMes((id) => idsPlano.has(id) || novasDividas.some((n) => n.id === id));

  const concluido = simsDoPlano.length === 0;
  const previsao = concluido ? null : preverPlano(simsDoPlano, config, atual, jaPagoPlano);
  const sobraAtual = p.temHistorico ? p.situacao.sobraMensalCentavos : null;
  const desvios = concluido ? [] : detectarDesvios({ meses: acompanhados, hoje, mesFinalPlanejado: plano.parametros.mesFinalPlanejado, previsao, sobraNaAprovacaoCentavos: plano.parametros.sobraNaAprovacaoCentavos, sobraAtualCentavos: sobraAtual, novasDividas });
  const proposta = desvios.length
    ? gerarPropostaAjuste({ dividas: simsTodas, config, inicioYm: atual, mesFinalPlanejado: plano.parametros.mesFinalPlanejado, sobraAtualCentavos: sobraAtual, jaPagoNoInicioCentavos: jaPagoTodas, desvios, deficitCentavos: deficit })
    : null;
  const recusada = proposta ? await assinaturaRecusada(plano.id) : null;
  const propostaVisivel = !!proposta && proposta.assinatura !== recusada;

  const saldoHoje = simsDoPlano.reduce((s, d) => s + d.saldoCentavos, 0);
  const baseline = plano.parametros.saldoInicialCentavos;
  const serie = serieDeSaldos(plano.parametros.saldoPlanejado, meses, hoje, saldoHoje);

  // O que já existe em Lançamentos por mês e dívida (para só oferecer agendar o que falta).
  const lancamentos = new Map<string, number>();
  for (const c of p.completas) {
    if (!idsPlano.has(c.linha.id)) continue;
    for (const o of c.obrigacoes) {
      const k = `${mesDoLancamento(o, atual)}|${c.linha.id}`;
      lancamentos.set(k, (lancamentos.get(k) ?? 0) + o.valorCentavos);
    }
  }
  const agendaveis = concluido ? [] : extrasParaAgendar({ linhas, lancamentosPorMesEDivida: lancamentos, hoje, encerramentos });

  const anterior = mesAnteriorDoPlano(acompanhados, hoje);
  const resumoRecomendado = proposta ? (proposta.recomendada === "aumentar" ? proposta.aumentar : proposta.adiar) : null;
  return {
    plano,
    config,
    linhas,
    meses,
    nomes,
    saldoHojeCentavos: saldoHoje,
    progressoGeralPct: baseline > 0 ? Math.max(0, Math.min(100, Math.round(((baseline - saldoHoje) / baseline) * 100))) : concluido ? 100 : 0,
    cumprimentoPct: percentualDoPlano(acompanhados, hoje),
    previsao,
    concluido,
    desvios,
    deficitCentavos: deficit,
    proposta,
    propostaVisivel,
    novasDividas,
    serie,
    agendaveis,
    paraConsultor: {
      id: plano.id,
      nome: plano.nome,
      versao: plano.versao,
      mesAnterior: anterior && anterior.situacao !== "futuro" && anterior.situacao !== "em_andamento" ? { mes: anterior.mes, planejadoCentavos: anterior.planejadoCentavos, realizadoCentavos: anterior.realizadoCentavos, situacao: anterior.situacao } : null,
      mesFinalPlanejado: plano.parametros.mesFinalPlanejado,
      previsaoMesFinal: previsao?.quitouTudo ? previsao.mesFinal : null,
      ajustePendente: propostaVisivel,
      desvios: desvios.map((d) => d.texto),
      deficitCentavos: deficit,
      ajusteRecomendado: propostaVisivel && resumoRecomendado ? resumoRecomendado.titulo : null,
      novasDividas,
      comprasParceladas: [],
    },
  };
}

/** Tudo da tela Plano de Quitação, calculado na hora. */
export async function carregarAnalisePlanoAtivo(hoje = hojeIso()): Promise<{ analise: AnalisePlano | null; completas: DividaCompleta[]; situacao: SituacaoFinanceira; base: Awaited<ReturnType<typeof carregarSituacaoFinanceira>>["base"] }> {
  const [ativo, completas, financeiro] = await Promise.all([lerPlanoAtivo(), carregarDividasCompletas(hoje), carregarSituacaoFinanceira(hoje)]);
  const temHistorico = financeiro.situacao.sobraMensalCentavos + financeiro.situacao.despesaMediaCentavos > 0 || financeiro.situacao.despesaMediaCentavos > 0;
  const analise = ativo ? await analisarPlano({ ativo, completas, situacao: financeiro.situacao, temHistorico, hoje }) : null;
  if (analise && ativo) {
    const aprovado = ativo.plano.aprovadoEm ? new Date(ativo.plano.aprovadoEm) : null;
    analise.paraConsultor.comprasParceladas = await carregarComprasParceladas(aprovado, temHistorico ? financeiro.situacao.sobraMensalCentavos : null);
  }
  return { analise, completas, situacao: financeiro.situacao, base: financeiro.base };
}
