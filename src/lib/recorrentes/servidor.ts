import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { hojeIso } from "@/lib/datas";
import { inserirLancamento, type LinhaLancamento } from "@/lib/lancamentos/gravacao";
import { faturaDaCompra, somarDias, totalDetalhado, valorComSinal, type TipoLancamento } from "@/lib/lancamentos/regras";
import { ErroValidacao } from "./validacao";
import { aplicarVariaveis, ehOcorrencia, ocorrencias, proximoDiaUtil, valorDaOcorrencia, type Feriado, type RegraDatas } from "./regras";

const { recorrencia: r, recorrenciaItem, recorrenciaTag, recorrenciaExcecao, lancamento: l, feriado, configuracao, cartaoCredito: cartao, categoria, transferencia } = schema;

type Db = ReturnType<typeof getDb> | Transacao;

export type Regra = typeof r.$inferSelect & { itens: (typeof recorrenciaItem.$inferSelect)[]; tagIds: number[] };

export const regraDatas = (x: Regra): RegraDatas => ({
  intervalo: x.intervalo,
  intervaloDias: x.intervaloDias,
  diaFixo: x.diaFixo,
  dataInicio: x.dataInicio,
  repeticoes: x.repeticoes,
  dataFim: x.dataFim,
  apenasDiaUtil: x.apenasDiaUtil,
});

/** Regras com itens e tags. */
export async function carregarRegras(db: Db, filtro: { ids?: number[]; apenasAtivas?: boolean } = {}): Promise<Regra[]> {
  const regras = await db
    .select()
    .from(r)
    .where(and(filtro.apenasAtivas ? eq(r.ativo, true) : undefined, filtro.ids ? inArray(r.id, filtro.ids.length ? filtro.ids : [0]) : undefined))
    .orderBy(asc(r.id));
  if (!regras.length) return [];
  const ids = regras.map((x) => x.id);
  const [itens, tags] = await Promise.all([
    db.select().from(recorrenciaItem).where(inArray(recorrenciaItem.recorrenciaId, ids)).orderBy(asc(recorrenciaItem.ordem), asc(recorrenciaItem.id)),
    db.select().from(recorrenciaTag).where(inArray(recorrenciaTag.recorrenciaId, ids)),
  ]);
  return regras.map((x) => ({ ...x, itens: itens.filter((i) => i.recorrenciaId === x.id), tagIds: tags.filter((t) => t.recorrenciaId === x.id).map((t) => t.tagId) }));
}

export async function carregarFeriados(db: Db): Promise<Feriado[]> {
  return db.select({ dia: feriado.dia, mes: feriado.mes, ano: feriado.ano }).from(feriado).where(eq(feriado.ativo, true));
}

/** Parâmetro "Previsão Recorrente": por quantos dias à frente os recorrentes aparecem (padrão 360). */
export async function previsaoDias(db: Db): Promise<number> {
  const [linha] = await db.select({ valor: configuracao.valor }).from(configuracao).where(eq(configuracao.chave, "previsao_recorrente_dias"));
  const dias = Number(linha?.valor);
  return Number.isInteger(dias) && dias > 0 && dias <= 3650 ? dias : 360;
}

const chave = (recorrenciaId: number, data: string) => `${recorrenciaId}|${data}`;

/** Ocorrências já gravadas como lançamento ou puladas (não aparecem mais como previstas). */
async function ocorrenciasResolvidas(db: Db, ids: number[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [gravadas, puladas] = await Promise.all([
    db.select({ id: l.recorrenciaId, data: l.dataOcorrencia }).from(l).where(and(inArray(l.recorrenciaId, ids), isNotNull(l.dataOcorrencia))),
    db.select({ id: recorrenciaExcecao.recorrenciaId, data: recorrenciaExcecao.dataOcorrencia }).from(recorrenciaExcecao).where(inArray(recorrenciaExcecao.recorrenciaId, ids)),
  ]);
  return new Set([...gravadas, ...puladas].map((x) => chave(x.id!, x.data!)));
}

/** Valores dos últimos lançamentos realizados de cada recorrente (do mais novo para o mais antigo), para a Média. */
export async function ultimosRealizados(db: Db, ids: number[]): Promise<Map<number, number[]>> {
  const mapa = new Map<number, number[]>();
  if (!ids.length) return mapa;
  const linhas = await db.execute<{ recorrencia_id: number; valor: string }>(sql`
    select recorrencia_id, valor from (
      select ${l.recorrenciaId} as recorrencia_id, abs(coalesce(${l.valorPagoCentavos}, ${l.valorCentavos})) as valor,
             row_number() over (partition by ${l.recorrenciaId} order by ${l.dataVencimento} desc, ${l.id} desc) as posicao
      from ${l}
      where ${inArray(l.recorrenciaId, ids)} and ${l.tipo} <> 'transferencia_entrada'
        and (${l.dataPagamento} is not null or ${l.cartaoId} is not null)
    ) x where posicao <= 12 order by recorrencia_id, posicao`);
  for (const x of linhas.rows) mapa.set(Number(x.recorrencia_id), [...(mapa.get(Number(x.recorrencia_id)) ?? []), Number(x.valor)]);
  return mapa;
}

export type CartaoInfo = { diaFechamento: number; diaVencimento: number; contaPagamentoId: number | null };

export type Contexto = {
  regras: Regra[];
  feriados: Feriado[];
  resolvidas: Set<string>;
  ultimos: Map<number, number[]>;
  cartoes: Map<number, CartaoInfo>;
  /** Último dia em que os recorrentes aparecem (hoje + Previsão Recorrente). */
  horizonte: string;
};

/** Tudo o que é preciso para calcular os recorrentes previstos (só os ativos). */
export async function carregarContexto(db: Db, hoje = hojeIso()): Promise<Contexto> {
  const regras = await carregarRegras(db, { apenasAtivas: true });
  const ids = regras.map((x) => x.id);
  const [feriados, resolvidas, ultimos, cartoes, dias] = await Promise.all([
    carregarFeriados(db),
    ocorrenciasResolvidas(db, ids),
    ultimosRealizados(db, ids),
    db.select({ id: cartao.id, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento, contaPagamentoId: cartao.contaPagamentoId }).from(cartao),
    previsaoDias(db),
  ]);
  return { regras, feriados, resolvidas, ultimos, cartoes: new Map(cartoes.map((c) => [c.id, c])), horizonte: somarDias(hoje, dias) };
}

/** Valor e tipo de uma ocorrência (média, valor fixo ou soma dos itens do detalhado). */
export function valorETipo(regra: Regra, ultimos: number[]): { tipo: "receita" | "despesa"; valorCentavos: number } {
  if (regra.formato === "detalhado") {
    const t = totalDetalhado(regra.itens.map((i) => ({ tipo: i.tipo, valorCentavos: i.valorCentavos })));
    return { tipo: t.tipo, valorCentavos: t.valorCentavos };
  }
  return { tipo: regra.tipo, valorCentavos: valorDaOcorrencia(regra.valorCentavos, regra.mediaUltimos, ultimos) };
}

/** Um lado da ocorrência: uma linha na conta ou no cartão (a transferência tem dois). */
export type Perna = { tipo: TipoLancamento; contaId: number | null; cartaoId: number | null; dataVencimento: string; dataCompra: string | null; valorComSinal: number };

export type Pendente = { regra: Regra; numero: number; data: string; vencimento: string; descricao: string; valorCentavos: number; pernas: Perna[] };

function pernasDe(regra: Regra, vencimento: string, tipo: "receita" | "despesa", valor: number, cartoes: Map<number, CartaoInfo>): Perna[] {
  if (regra.formato === "transferencia") {
    return [
      { tipo: "transferencia_saida", contaId: regra.contaId, cartaoId: null, dataVencimento: vencimento, dataCompra: null, valorComSinal: -valor },
      { tipo: "transferencia_entrada", contaId: regra.contaDestinoId, cartaoId: null, dataVencimento: vencimento, dataCompra: null, valorComSinal: valor },
    ];
  }
  if (regra.cartaoId) {
    const c = cartoes.get(regra.cartaoId);
    const f = c ? faturaDaCompra(vencimento, c.diaFechamento, c.diaVencimento) : null;
    return [{ tipo, contaId: null, cartaoId: regra.cartaoId, dataVencimento: f?.dataVencimento ?? vencimento, dataCompra: vencimento, valorComSinal: valorComSinal(tipo, valor) }];
  }
  return [{ tipo, contaId: regra.contaId, cartaoId: null, dataVencimento: vencimento, dataCompra: null, valorComSinal: valorComSinal(tipo, valor) }];
}

/**
 * Ocorrências previstas (ainda não gravadas nem puladas) cujo vencimento na lista cai entre "de" e "ate".
 * Compras no cartão aparecem no vencimento da fatura.
 */
export function pendentes(ctx: Contexto, ate: string, de?: string): Pendente[] {
  const lista: Pendente[] = [];
  const limite = ate < ctx.horizonte ? ate : ctx.horizonte;
  for (const regra of ctx.regras) {
    const { tipo, valorCentavos } = valorETipo(regra, ctx.ultimos.get(regra.id) ?? []);
    for (const oc of ocorrencias(regraDatas(regra), ctx.feriados, limite)) {
      if (ctx.resolvidas.has(chave(regra.id, oc.data))) continue;
      const pernas = pernasDe(regra, oc.vencimento, tipo, valorCentavos, ctx.cartoes).filter((p) => p.dataVencimento <= ate && (!de || p.dataVencimento >= de));
      if (!pernas.length) continue;
      lista.push({ regra, numero: oc.numero, data: oc.data, vencimento: oc.vencimento, descricao: aplicarVariaveis(regra.descricao, oc.vencimento), valorCentavos, pernas });
    }
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Gravar uma ocorrência (quando é paga, editada ou realizada automaticamente)
// ---------------------------------------------------------------------------


/** Confere se a ocorrência existe e ainda não foi gravada nem pulada. Trava a regra até o fim da transação. */
export async function conferirOcorrencia(tx: Transacao, recorrenciaId: number, data: string): Promise<Regra> {
  const [linha] = await tx.select({ id: r.id }).from(r).where(eq(r.id, recorrenciaId)).for("update");
  if (!linha) throw new ErroValidacao("Este recorrente não existe mais.");
  const [regra] = await carregarRegras(tx, { ids: [recorrenciaId] });
  if (!ehOcorrencia(regraDatas(regra), data)) throw new ErroValidacao("Esta data não é uma ocorrência do recorrente.");
  const resolvidas = await ocorrenciasResolvidas(tx, [recorrenciaId]);
  if (resolvidas.has(chave(recorrenciaId, data))) throw new ErroValidacao("Esta ocorrência já foi lançada ou excluída. Atualize a página.");
  return regra;
}

/** Os dados que uma ocorrência terá ao virar lançamento (o formulário de edição usa os mesmos). */
export async function dadosDaOcorrencia(tx: Db, regra: Regra, data: string) {
  const feriados = regra.apenasDiaUtil ? await carregarFeriados(tx) : [];
  const vencimento = regra.apenasDiaUtil ? proximoDiaUtil(data, feriados) : data;
  const ultimos = (await ultimosRealizados(tx, [regra.id])).get(regra.id) ?? [];
  const { tipo, valorCentavos } = valorETipo(regra, ultimos);
  return { vencimento, tipo, valorCentavos, descricao: aplicarVariaveis(regra.descricao, vencimento) };
}

/** Grava a ocorrência como lançamento (dois na transferência). "dataPagamento" já dá baixa. */
export async function gravarOcorrencia(tx: Transacao, regra: Regra, data: string, dataPagamento: string | null): Promise<number[]> {
  const d = await dadosDaOcorrencia(tx, regra, data);
  const pago = dataPagamento && !regra.cartaoId ? dataPagamento : null;
  const comum: Omit<LinhaLancamento, "tipo" | "contaId"> = {
    formato: regra.formato === "detalhado" ? "detalhado" : "simples",
    descricao: d.descricao,
    observacao: regra.observacao,
    valorCentavos: d.valorCentavos,
    valorPagoCentavos: pago ? d.valorCentavos : null,
    dataVencimento: d.vencimento,
    dataPagamento: pago,
    realizarAutomaticamente: regra.realizarAutomaticamente,
    formaPagamentoId: regra.formaPagamentoId,
    contatoId: regra.contatoId,
    recorrenciaId: regra.id,
    dataOcorrencia: data,
    origem: "recorrente",
  };
  if (regra.formato === "transferencia") {
    const [categoriaTransferencia] = await tx.select({ id: categoria.id }).from(categoria).where(eq(categoria.especial, "transferencia"));
    const [grupo] = await tx.insert(transferencia).values({}).returning();
    const base = { ...comum, cartaoId: null, categoriaId: categoriaTransferencia?.id ?? null, transferenciaId: grupo.id, contatoId: null };
    const saida = await inserirLancamento(tx, { ...base, tipo: "transferencia_saida", contaId: regra.contaId }, regra.tagIds, []);
    const entrada = await inserirLancamento(tx, { ...base, tipo: "transferencia_entrada", contaId: regra.contaDestinoId }, regra.tagIds, []);
    return [saida.id, entrada.id];
  }
  const novo = await inserirLancamento(
    tx,
    {
      ...comum,
      tipo: d.tipo,
      contaId: regra.contaId,
      cartaoId: regra.cartaoId,
      dataCompra: regra.cartaoId ? d.vencimento : null,
      categoriaId: regra.formato === "detalhado" ? null : regra.categoriaId,
    },
    regra.tagIds,
    regra.itens.map((i) => ({ tipo: i.tipo, descricao: i.descricao, valorCentavos: i.valorCentavos, categoriaId: i.categoriaId, ordem: i.ordem })),
  );
  return [novo.id];
}

// ---------------------------------------------------------------------------
// Realizar automaticamente (roda ao abrir as telas; não precisa de tarefa agendada)
// ---------------------------------------------------------------------------

/**
 * Dá baixa no dia do vencimento em tudo que tem "Realizar automaticamente":
 * - lançamentos já gravados (contas), ainda não pagos, com vencimento até hoje;
 * - ocorrências de recorrentes até hoje (contas: gravadas como pagas; cartão: compra lançada na fatura).
 * Pode rodar várias vezes: nunca duplica.
 */
export async function realizarAutomaticos(hoje = hojeIso()): Promise<number> {
  const db = getDb();
  // Atalho barato: nada a fazer na maioria das vezes.
  const [pendente] = await db.execute<{ ha: boolean }>(sql`select (
      exists (select 1 from ${l} where ${l.realizarAutomaticamente} and ${l.dataPagamento} is null and ${l.contaId} is not null and ${l.dataVencimento} <= ${hoje})
      or exists (select 1 from ${r} where ${r.realizarAutomaticamente} and ${r.ativo} and ${r.dataInicio} <= ${hoje})
    ) as ha`).then((x) => x.rows);
  if (!pendente?.ha) return 0;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7340021)`);
    let total = 0;
    const baixados = await tx
      .update(l)
      .set({ dataPagamento: sql`${l.dataVencimento}`, valorPagoCentavos: sql`${l.valorCentavos}` })
      .where(and(eq(l.realizarAutomaticamente, true), isNull(l.dataPagamento), isNotNull(l.contaId), lte(l.dataVencimento, hoje)))
      .returning({ id: l.id, descricao: l.descricao, dataPagamento: l.dataPagamento });
    for (const x of baixados) {
      await registrarAuditoria(tx, { tela: "Lançamentos", entidade: "Lançamento", entidadeId: x.id, acao: "alterou", descricao: `a baixa automática do Lançamento ${x.descricao}`, dados: { dataPagamento: { antes: null, depois: x.dataPagamento } } });
    }
    total += baixados.length;

    const regras = (await carregarRegras(tx, { apenasAtivas: true })).filter((x) => x.realizarAutomaticamente);
    if (regras.length) {
      const feriados = await carregarFeriados(tx);
      const resolvidas = await ocorrenciasResolvidas(tx, regras.map((x) => x.id));
      for (const regra of regras) {
        for (const oc of ocorrencias(regraDatas(regra), feriados, hoje)) {
          if (resolvidas.has(chave(regra.id, oc.data))) continue;
          const ids = await gravarOcorrencia(tx, regra, oc.data, oc.vencimento);
          await registrarAuditoria(tx, { tela: "Recorrentes", entidade: "Lançamento", entidadeId: ids[0], acao: "cadastrou", descricao: `o Lançamento automático do Recorrente ${regra.descricao}`, dados: { recorrenciaId: regra.id, dataOcorrencia: oc.data } });
          total += 1;
        }
      }
    }
    return total;
  });
}
