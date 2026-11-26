"use server";

import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { idValido, type Resultado } from "@/lib/cadastros/resultado";
import { formatarData, hojeIso } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { CANAIS_NEGOCIACAO, negociacaoAberta, planejarRenegociacao, podeDesfazerRenegociacao, totalDoAcordo, validarCondicoes, validarRenegociacao, type CondicoesRenegociacao, type DividaOriginal } from "@/lib/dividas/negociacao";
import { carregarNegociacoes, carregarParaRenegociar } from "@/lib/dividas/negociacoes";
import { carregarDetalheDivida } from "@/lib/dividas/servidor";
import type { DividaParaRenegociar, LinhaNegociacao } from "@/lib/dividas/tipos";
import {
  conferirCategoria,
  conferirConta,
  conferirCredor,
  conferirForma,
  erro,
  executar,
  exigirRecurso,
  lerData,
  lerInteiro,
  lerPercentual,
  lerTexto,
  lerValor,
  lerValorOuZero,
  registrarEvento,
} from "@/lib/dividas/validacao";
import { inserirLancamento } from "@/lib/lancamentos/gravacao";
import { PERIODICIDADES, type Periodicidade } from "@/lib/lancamentos/regras";

const { divida, dividaVinculo, dividaRenegociacao, negociacao, negociacaoDivida, negociacaoProposta, lancamento: l, lancamentoTag, parcelamento, recorrencia } = schema;
const TELA = "Gestão de Dívidas";
const ENTIDADE_NEGOCIACAO = "Negociação";

const textoPercentual = (n: number | null) => (n === null ? null : n.toFixed(4));

// ---------------------------------------------------------------------------
// Negociação
// ---------------------------------------------------------------------------

export type DadosNegociacao = {
  contatoId: string;
  dividaIds: number[];
  canal: string;
  protocolo: string;
  dataInicio: string;
  prazoResposta: string;
  sobraMensal: string;
  observacao: string;
  /** Só na edição. */
  situacao: string;
};

async function lerNegociacao(tx: Transacao, id: number) {
  if (!idValido.safeParse(id).success) return erro("Negociação não encontrada.");
  const [n] = await tx.select().from(negociacao).where(eq(negociacao.id, id)).for("update");
  return n ?? erro("Esta negociação não existe mais.");
}

const SITUACOES_EDITAVEIS = ["em_andamento", "proposta_recebida", "aguardando_resposta", "recusada", "desistida"] as const;

export async function salvarNegociacao(id: number | null, d: DadosNegociacao): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const credor = await conferirCredor(tx, d.contatoId);
      const canal = CANAIS_NEGOCIACAO.find((c) => c.valor === d.canal)?.valor ?? erro("Selecione o campo **Canal**.");
      const dataInicio = lerData(d.dataInicio, "Data de Início")!;
      const prazoResposta = lerData(d.prazoResposta, "Prazo de Resposta", false);
      if (prazoResposta && prazoResposta < dataInicio) erro("O **Prazo de Resposta** não pode ser antes da data de início.");
      const sobra = d.sobraMensal?.trim() ? lerValorOuZero(d.sobraMensal, "Sobra Mensal") : null;
      const protocolo = lerTexto(d.protocolo, "Protocolo", 60);
      const observacao = lerTexto(d.observacao, "Observação", 1000);
      const dividaIds = [...new Set((d.dividaIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
      if (!dividaIds.length) erro("Escolha pelo menos uma **dívida** da negociação.");

      const dividas = await tx.select().from(divida).where(inArray(divida.id, dividaIds));
      if (dividas.length !== dividaIds.length) erro("Uma das dívidas escolhidas não existe mais.");
      if (dividas.some((x) => x.contatoId !== credor.id)) erro("Uma negociação junta só dívidas do **mesmo credor**.");

      if (id !== null) {
        const antes = await lerNegociacao(tx, id);
        if (antes.situacao === "aceita") return erro("Esta negociação já foi aceita e virou acordo. Veja o acordo em Minhas Dívidas.");
        const jaTinha = new Set((await tx.select({ dividaId: negociacaoDivida.dividaId }).from(negociacaoDivida).where(eq(negociacaoDivida.negociacaoId, id))).map((x) => x.dividaId));
        const nova = dividas.find((x) => !jaTinha.has(x.id) && x.situacao !== "ativa");
        if (nova) return erro(`A dívida ${nova.descricao} não está ativa.`);
        const situacao = SITUACOES_EDITAVEIS.find((s) => s === d.situacao) ?? erro("Selecione o campo **Situação**.");
        const novos = { contatoId: credor.id, canal, protocolo, dataInicio, prazoResposta, sobraMensalCentavos: sobra, observacao, situacao };
        await tx.update(negociacao).set(novos).where(eq(negociacao.id, id));
        await tx.delete(negociacaoDivida).where(eq(negociacaoDivida.negociacaoId, id));
        await tx.insert(negociacaoDivida).values(dividaIds.map((dividaId) => ({ negociacaoId: id, dividaId })));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: id, acao: "alterou", descricao: `a Negociação com ${credor.nome}`, dados: { ...diferencas(antes, novos), dividas: dividaIds } });
        refresh();
        return { ok: true as const, id };
      }

      const inativa = dividas.find((x) => x.situacao !== "ativa");
      if (inativa) return erro(`A dívida ${inativa.descricao} não está ativa.`);
      const [nova] = await tx.insert(negociacao).values({ contatoId: credor.id, canal, protocolo, dataInicio, prazoResposta, sobraMensalCentavos: sobra, observacao }).returning();
      await tx.insert(negociacaoDivida).values(dividaIds.map((dividaId) => ({ negociacaoId: nova.id, dividaId })));
      for (const x of dividas) await registrarEvento(tx, x.id, { data: hojeIso(), tipo: "anotacao", descricao: `Negociação aberta com ${credor.nome} (${CANAIS_NEGOCIACAO.find((c) => c.valor === canal)?.rotulo.toLowerCase()}${protocolo ? `, protocolo ${protocolo}` : ""})` });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: nova.id, acao: "cadastrou", descricao: `a Negociação com ${credor.nome} (${dividas.length} ${dividas.length === 1 ? "dívida" : "dívidas"})`, dados: { ...nova, dividas: dividaIds } });
      refresh();
      return { ok: true as const, id: nova.id };
    }),
  );
}

export async function detalharNegociacao(id: number): Promise<LinhaNegociacao | null> {
  await exigirRecurso();
  if (!idValido.safeParse(id).success) return null;
  return (await carregarNegociacoes(null, undefined, id)).linhas[0] ?? null;
}

async function encerrarNegociacao(id: number, situacao: "recusada" | "desistida"): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const n = await lerNegociacao(tx, id);
      if (!negociacaoAberta(n.situacao)) return erro("Esta negociação já foi encerrada.");
      await tx.update(negociacao).set({ situacao }).where(eq(negociacao.id, id));
      if (situacao === "recusada") await tx.update(negociacaoProposta).set({ situacao: "recusada" }).where(and(eq(negociacaoProposta.negociacaoId, id), eq(negociacaoProposta.situacao, "aberta")));
      const dividas = await tx.select({ id: negociacaoDivida.dividaId }).from(negociacaoDivida).where(eq(negociacaoDivida.negociacaoId, id));
      for (const x of dividas) await registrarEvento(tx, x.id, { data: hojeIso(), tipo: "anotacao", descricao: situacao === "recusada" ? "Negociação recusada: as condições não foram aceitas" : "Negociação encerrada: desistência" });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: id, acao: "alterou", descricao: `a Negociação para ${situacao === "recusada" ? "Recusada" : "Desistida"}`, dados: { situacao: { antes: n.situacao, depois: situacao } } });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

export async function recusarNegociacao(id: number): Promise<Resultado> {
  return encerrarNegociacao(id, "recusada");
}

export async function desistirNegociacao(id: number): Promise<Resultado> {
  return encerrarNegociacao(id, "desistida");
}

export async function excluirNegociacao(id: number): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const n = await lerNegociacao(tx, id);
      if (n.situacao === "aceita") return erro("Esta negociação virou acordo e não pode ser excluída. Para voltar atrás, desfaça a renegociação no acordo.");
      const propostas = await tx.select().from(negociacaoProposta).where(eq(negociacaoProposta.negociacaoId, id));
      const dividas = await tx.select().from(negociacaoDivida).where(eq(negociacaoDivida.negociacaoId, id));
      await tx.delete(negociacao).where(eq(negociacao.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: id, acao: "excluiu", descricao: `a Negociação (${propostas.length} ${propostas.length === 1 ? "proposta" : "propostas"})`, dados: { ...n, propostas, dividas } });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

// ---------------------------------------------------------------------------
// Propostas
// ---------------------------------------------------------------------------

export type DadosProposta = {
  data: string;
  quemPropos: string;
  modalidade: string;
  /** À vista: o valor à vista. Parcelada: a entrada (pode ficar vazia). */
  entrada: string;
  parcelas: string;
  valorParcela: string;
  primeiroVencimento: string;
  validade: string;
  observacao: string;
};

export async function salvarProposta(negociacaoId: number, id: number | null, d: DadosProposta): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const n = await lerNegociacao(tx, negociacaoId);
      if (!negociacaoAberta(n.situacao)) return erro("Esta negociação já foi encerrada. Reabra pela edição para incluir propostas.");
      const quem: "credor" | "eu" = d.quemPropos === "credor" ? "credor" : d.quemPropos === "eu" ? "eu" : erro("Selecione o campo **Quem Propôs**.");
      const modalidade: "a_vista" | "parcelada" = d.modalidade === "a_vista" ? "a_vista" : d.modalidade === "parcelada" ? "parcelada" : erro("Selecione a **Modalidade**.");
      const data = lerData(d.data, "Data da Proposta")!;
      const validade = lerData(d.validade, "Validade", false);
      let entrada: number;
      let parcelas = 0;
      let valorParcela = 0;
      let primeiroVencimento: string | null = null;
      if (modalidade === "a_vista") {
        entrada = lerValor(d.entrada, "Valor à Vista")!;
      } else {
        entrada = lerValorOuZero(d.entrada, "Entrada");
        parcelas = lerInteiro(d.parcelas, "Quantidade de Parcelas", 1, 360);
        valorParcela = lerValor(d.valorParcela, "Valor da Parcela")!;
        primeiroVencimento = lerData(d.primeiroVencimento, "Primeiro Vencimento")!;
      }
      const total = totalDoAcordo({ entradaCentavos: entrada, parcelas, valorParcelaCentavos: valorParcela });
      const mensagem = validarCondicoes({ entradaCentavos: entrada, parcelas, valorParcelaCentavos: valorParcela, modalidade });
      if (mensagem) return erro(mensagem);
      const valores = { negociacaoId, data, quemPropos: quem, modalidade, entradaCentavos: entrada, parcelas, valorParcelaCentavos: valorParcela, primeiroVencimento, totalCentavos: total, validade, observacao: lerTexto(d.observacao, "Observação", 500) };
      const resumo = modalidade === "a_vista" ? `à vista por ${formatarCentavos(total)}` : `${entrada ? `entrada de ${formatarCentavos(entrada)} e ` : ""}${parcelas} × ${formatarCentavos(valorParcela)} (total de ${formatarCentavos(total)})`;

      let propostaId = id;
      if (id !== null) {
        const [antes] = await tx.select().from(negociacaoProposta).where(and(eq(negociacaoProposta.id, id), eq(negociacaoProposta.negociacaoId, negociacaoId))).for("update");
        if (!antes) return erro("Esta proposta não existe mais.");
        if (antes.situacao !== "aberta") return erro("Só propostas em aberto podem ser editadas.");
        await tx.update(negociacaoProposta).set(valores).where(eq(negociacaoProposta.id, id));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: negociacaoId, acao: "alterou", descricao: `a proposta ${resumo}`, dados: diferencas(antes, valores) });
      } else {
        const [nova] = await tx.insert(negociacaoProposta).values(valores).returning();
        propostaId = nova.id;
        // Proposta do credor: a bola está com a pessoa. Proposta da pessoa: aguarda a resposta do credor.
        const situacao = quem === "credor" ? "proposta_recebida" : "aguardando_resposta";
        await tx.update(negociacao).set({ situacao }).where(eq(negociacao.id, negociacaoId));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: negociacaoId, acao: "cadastrou", descricao: `a proposta ${quem === "credor" ? "do credor" : "da pessoa"}: ${resumo}`, dados: nova });
        const dividas = await tx.select({ id: negociacaoDivida.dividaId }).from(negociacaoDivida).where(eq(negociacaoDivida.negociacaoId, negociacaoId));
        for (const x of dividas) await registrarEvento(tx, x.id, { data, tipo: "anotacao", descricao: `Proposta ${quem === "credor" ? "recebida do credor" : "enviada ao credor"}: ${resumo}`, valorCentavos: total });
      }
      refresh();
      return { ok: true as const, id: propostaId ?? undefined };
    }),
  );
}

export async function recusarProposta(negociacaoId: number, id: number): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      await lerNegociacao(tx, negociacaoId);
      const [p] = await tx.select().from(negociacaoProposta).where(and(eq(negociacaoProposta.id, id), eq(negociacaoProposta.negociacaoId, negociacaoId))).for("update");
      if (!p) return erro("Esta proposta não existe mais.");
      if (p.situacao !== "aberta") return erro("Só propostas em aberto podem ser recusadas.");
      await tx.update(negociacaoProposta).set({ situacao: "recusada" }).where(eq(negociacaoProposta.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: negociacaoId, acao: "alterou", descricao: `a proposta de ${formatarCentavos(Number(p.totalCentavos))} para Recusada`, dados: { situacao: { antes: p.situacao, depois: "recusada" } } });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

export async function excluirProposta(negociacaoId: number, id: number): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      await lerNegociacao(tx, negociacaoId);
      const [p] = await tx.select().from(negociacaoProposta).where(and(eq(negociacaoProposta.id, id), eq(negociacaoProposta.negociacaoId, negociacaoId))).for("update");
      if (!p) return erro("Esta proposta não existe mais.");
      if (p.situacao === "aceita") return erro("Esta proposta foi aceita e virou acordo.");
      await tx.delete(negociacaoProposta).where(eq(negociacaoProposta.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: negociacaoId, acao: "excluiu", descricao: `a proposta de ${formatarCentavos(Number(p.totalCentavos))}`, dados: p });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

// ---------------------------------------------------------------------------
// Renegociação
// ---------------------------------------------------------------------------

/** O que o assistente mostra na revisão: lançamentos de cada dívida e o que será encerrado. */
export async function prepararRenegociacao(ids: number[]): Promise<DividaParaRenegociar[]> {
  await exigirRecurso();
  const limpos = [...new Set((ids ?? []).filter((x) => idValido.safeParse(x).success))];
  return carregarParaRenegociar(limpos);
}

export type DadosRenegociacao = {
  dividaIds: number[];
  negociacaoId: number | null;
  propostaId: number | null;
  descricao: string;
  entrada: string;
  dataEntrada: string;
  parcelas: string;
  valorParcela: string;
  primeiroVencimento: string;
  periodicidade: string;
  /** Taxa de juros do acordo ao mês (opcional). */
  taxa: string;
  contaId: string;
  categoriaId: string;
  formaPagamentoId: string;
  observacao: string;
};

type LinhaLancamento = typeof l.$inferSelect;
type CopiaLancamento = LinhaLancamento & { tagIds: number[] };

/** Lança o acordo e encerra as dívidas originais, tudo na mesma transação. */
export async function renegociarDividas(d: DadosRenegociacao): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const ids = [...new Set((d.dividaIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
      if (!ids.length) return erro("Escolha pelo menos uma dívida para renegociar.");
      const originais = await tx.select().from(divida).where(inArray(divida.id, ids)).orderBy(asc(divida.id)).for("update");
      if (originais.length !== ids.length) return erro("Uma das dívidas escolhidas não existe mais.");

      const descricao = lerTexto(d.descricao, "Descrição do Acordo", 120, true)!;
      const entrada = lerValorOuZero(d.entrada, "Entrada");
      const parcelas = lerInteiro(d.parcelas, "Quantidade de Parcelas", 0, 360);
      const valorParcela = parcelas > 0 ? lerValor(d.valorParcela, "Valor da Parcela")! : 0;
      const periodicidade = (PERIODICIDADES.find((p) => p.valor === d.periodicidade)?.valor ?? erro("Selecione o campo **Periodicidade**.")) as Periodicidade;
      const condicoes: CondicoesRenegociacao = {
        entradaCentavos: entrada,
        parcelas,
        valorParcelaCentavos: valorParcela,
        dataEntrada: entrada > 0 ? lerData(d.dataEntrada, "Vencimento da Entrada")! : null,
        primeiroVencimento: parcelas > 0 ? lerData(d.primeiroVencimento, "Primeiro Vencimento")! : null,
        periodicidade,
      };
      const problema = validarRenegociacao({ originais: originais.map((o) => ({ id: o.id, contatoId: o.contatoId, ativa: o.situacao === "ativa", descricao: o.descricao })), condicoes });
      if (problema) return erro(problema);
      const taxa = lerPercentual(d.taxa, "Taxa de Juros", 100);
      const contaId = await conferirConta(tx, d.contaId);
      const categoriaId = await conferirCategoria(tx, d.categoriaId);
      const formaPagamentoId = await conferirForma(tx, d.formaPagamentoId);
      const observacao = lerTexto(d.observacao, "Observação", 1000);
      const credor = await conferirCredor(tx, String(originais[0].contatoId));
      const hoje = hojeIso();

      // Negociação e proposta (quando o acordo nasce de uma negociação).
      let neg: typeof negociacao.$inferSelect | null = null;
      if (d.negociacaoId) {
        neg = await lerNegociacao(tx, d.negociacaoId);
        if (!negociacaoAberta(neg.situacao)) return erro("Esta negociação já foi encerrada.");
        if (neg.contatoId !== credor.id) return erro("A negociação é de outro credor.");
        const dela = new Set((await tx.select({ id: negociacaoDivida.dividaId }).from(negociacaoDivida).where(eq(negociacaoDivida.negociacaoId, neg.id))).map((x) => x.id));
        if (ids.some((x) => !dela.has(x))) return erro("Uma das dívidas não faz parte desta negociação.");
      }

      // O que sai de Lançamentos: as parcelas e demais lançamentos não pagos de cada dívida (com cópia completa).
      const retiradas = await tx.select().from(l).where(and(inArray(l.dividaId, ids), isNull(l.dataPagamento), isNull(l.cartaoId), eq(l.tipo, "despesa"))).orderBy(asc(l.dataVencimento), asc(l.id)).for("update");
      const tags = retiradas.length ? await tx.select().from(lancamentoTag).where(inArray(lancamentoTag.lancamentoId, retiradas.map((x) => x.id))) : [];
      const copias: CopiaLancamento[] = retiradas.map((x) => ({ ...x, tagIds: tags.filter((t) => t.lancamentoId === x.id).map((t) => t.tagId) }));

      const saldos = new Map<number, number>();
      for (const o of originais) saldos.set(o.id, (await carregarDetalheDivida(o.id, hoje))?.divida.saldo.exibido ?? 0);
      const paraPlano: DividaOriginal[] = originais.map((o) => ({
        id: o.id,
        descricao: o.descricao,
        saldoCentavos: saldos.get(o.id) ?? 0,
        lancamentos: retiradas.filter((x) => x.dividaId === o.id).map((x) => ({ id: x.id, descricao: x.descricao, vencimento: x.dataVencimento, valorCentavos: Math.abs(Number(x.valorCentavos)), dataPagamento: null })),
      }));
      const plano = planejarRenegociacao({ originais: paraPlano, condicoes, descricaoAcordo: descricao, sobraMensalCentavos: neg?.sobraMensalCentavos ?? null });

      // Faturas e recorrentes acompanhados: o vínculo termina (o registro original não é tocado) e o recorrente é inativado.
      const vinculos = await tx.select().from(dividaVinculo).where(inArray(dividaVinculo.dividaId, ids));
      const idsRecorrentes = vinculos.map((v) => v.recorrenciaId).filter((x): x is number => x !== null);
      const recorrentesAtivos = idsRecorrentes.length ? await tx.select({ id: recorrencia.id, descricao: recorrencia.descricao }).from(recorrencia).where(and(inArray(recorrencia.id, idsRecorrentes), eq(recorrencia.ativo, true))) : [];

      // 1. O acordo: uma dívida nova com as parcelas.
      const [grupo] = await tx
        .insert(parcelamento)
        .values({ descricaoBase: descricao, valorTotalCentavos: plano.abertoDepoisCentavos, quantidade: plano.parcelasAcordo.length, periodicidade, iniciarNaParcela: 1, dividirValor: false, incluirParcelaNaDescricao: true })
        .returning();
      const [acordo] = await tx
        .insert(divida)
        .values({
          descricao,
          contatoId: credor.id,
          tipo: "acordo",
          forma: "parcelas_fixas",
          valorOriginalCentavos: plano.totalAcordoCentavos,
          dataContratacao: hoje,
          taxaMensal: textoPercentual(taxa),
          contaId,
          categoriaId,
          formaPagamentoId,
          parcelamentoId: grupo.id,
          observacao,
        })
        .returning();
      for (const p of plano.parcelasAcordo) {
        await inserirLancamento(
          tx,
          { tipo: "despesa", formato: "simples", descricao: p.descricao, valorCentavos: p.valorCentavos, dataVencimento: p.data, contaId, categoriaId, formaPagamentoId, contatoId: credor.id, dividaId: acordo.id, parcelamentoId: grupo.id, parcelaNumero: p.numero, parcelaTotal: p.total, origem: "parcelamento" },
          [],
          [],
        );
      }

      // 2. As originais: lançamentos não pagos saem (a cópia fica no histórico e na auditoria); vínculos terminam.
      if (retiradas.length) {
        await tx.delete(l).where(inArray(l.id, retiradas.map((x) => x.id)));
        for (const x of retiradas) await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: x.id, acao: "excluiu", descricao: `a parcela ${x.descricao} (renegociação da Dívida no acordo ${descricao})`, dados: x });
      }
      if (vinculos.length) await tx.delete(dividaVinculo).where(inArray(dividaVinculo.id, vinculos.map((v) => v.id)));
      if (recorrentesAtivos.length) {
        await tx.update(recorrencia).set({ ativo: false }).where(inArray(recorrencia.id, recorrentesAtivos.map((r) => r.id)));
        for (const r of recorrentesAtivos) await registrarAuditoria(tx, { tela: TELA, entidade: "Recorrente", entidadeId: r.id, acao: "inativou", descricao: `o recorrente ${r.descricao} (renegociação da dívida no acordo ${descricao})`, dados: { ativo: { antes: true, depois: false } } });
      }

      for (const o of originais) {
        const minhas = copias.filter((x) => x.dividaId === o.id);
        const total = minhas.reduce((s, x) => s + Math.abs(Number(x.valorCentavos)), 0);
        await tx.update(divida).set({ situacao: "renegociada", encerradaEm: hoje }).where(eq(divida.id, o.id));
        await tx.insert(dividaRenegociacao).values({ acordoId: acordo.id, originalId: o.id, negociacaoId: neg?.id ?? null });
        await registrarEvento(tx, o.id, {
          data: hoje,
          tipo: "renegociacao",
          descricao: `Renegociada no acordo ${descricao}: ${minhas.length} ${minhas.length === 1 ? "parcela não paga retirada" : "parcelas não pagas retiradas"} de Lançamentos (${formatarCentavos(total)})`,
          valorCentavos: total,
          dados: {
            acordoId: acordo.id,
            parcelasRetiradas: minhas,
            vinculosEncerrados: vinculos.filter((v) => v.dividaId === o.id).map((v) => ({ faturaId: v.faturaId, recorrenciaId: v.recorrenciaId })),
            recorrentesInativados: recorrentesAtivos.filter((r) => vinculos.some((v) => v.dividaId === o.id && v.recorrenciaId === r.id)).map((r) => r.id),
            saldoCentavos: saldos.get(o.id) ?? 0,
          },
        });
        await registrarAuditoria(tx, { tela: TELA, entidade: "Dívida", entidadeId: o.id, acao: "renegociou", descricao: `a Dívida ${o.descricao} no acordo ${descricao}`, dados: { situacao: { antes: o.situacao, depois: "renegociada" }, acordoId: acordo.id, parcelasRetiradas: minhas.length } });
      }

      // 3. O acordo ganha o histórico.
      await registrarEvento(tx, acordo.id, {
        data: hoje,
        tipo: "cadastro",
        descricao: `Acordo criado com ${credor.nome} renegociando ${originais.map((o) => o.descricao).join(", ")} (${plano.frases[plano.frases.length - 1]})`,
        valorCentavos: plano.totalAcordoCentavos,
        dados: { originais: ids, negociacaoId: neg?.id ?? null, propostaId: d.propostaId },
      });
      await registrarAuditoria(tx, { tela: TELA, entidade: "Dívida", entidadeId: acordo.id, acao: "cadastrou", descricao: `o acordo ${descricao} (${plano.parcelasAcordo.length} ${plano.parcelasAcordo.length === 1 ? "parcela" : "parcelas"}, ${formatarCentavos(plano.totalAcordoCentavos)}, a partir de ${formatarData(plano.parcelasAcordo[0].data)})`, dados: { ...acordo, originais: ids } });

      // 4. A negociação vira Aceita.
      if (neg) {
        await tx.update(negociacao).set({ situacao: "aceita", acordoId: acordo.id }).where(eq(negociacao.id, neg.id));
        if (d.propostaId) await tx.update(negociacaoProposta).set({ situacao: "aceita" }).where(and(eq(negociacaoProposta.id, d.propostaId), eq(negociacaoProposta.negociacaoId, neg.id)));
        await tx.update(negociacaoProposta).set({ situacao: "recusada" }).where(and(eq(negociacaoProposta.negociacaoId, neg.id), eq(negociacaoProposta.situacao, "aberta"), d.propostaId ? ne(negociacaoProposta.id, d.propostaId) : undefined));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: neg.id, acao: "aprovou", descricao: `a Negociação com ${credor.nome}, que virou o acordo ${descricao}`, dados: { situacao: { antes: neg.situacao, depois: "aceita" }, acordoId: acordo.id, propostaId: d.propostaId } });
      }
      refresh();
      return { ok: true as const, id: acordo.id };
    }),
  );
}

const RECRIAR = (c: CopiaLancamento): typeof l.$inferInsert => {
  const { tagIds: _tags, ...linha } = c;
  void _tags;
  return { ...linha, criadoEm: new Date(c.criadoEm), atualizadoEm: new Date(c.atualizadoEm) };
};

/** Desfaz a renegociação (só enquanto nenhuma parcela do acordo foi paga): volta as parcelas originais e apaga o acordo. */
export async function desfazerRenegociacao(acordoId: number): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      if (!idValido.safeParse(acordoId).success) return erro("Acordo não encontrado.");
      const [acordo] = await tx.select().from(divida).where(eq(divida.id, acordoId)).for("update");
      if (!acordo) return erro("Este acordo não existe mais.");
      const ligacoes = await tx.select().from(dividaRenegociacao).where(eq(dividaRenegociacao.acordoId, acordoId));
      if (!ligacoes.length) return erro("Esta dívida não é um acordo de renegociação.");
      const doAcordo = await tx.select().from(l).where(eq(l.dividaId, acordoId)).for("update");
      const pode = podeDesfazerRenegociacao({ acordoSituacao: acordo.situacao, lancamentosAcordo: doAcordo.map((x) => ({ dataPagamento: x.dataPagamento })) });
      if (!pode.ok) return erro(pode.motivo);

      const hoje = hojeIso();
      const originais = await tx.select().from(divida).where(inArray(divida.id, ligacoes.map((x) => x.originalId))).orderBy(asc(divida.id)).for("update");
      for (const o of originais) {
        const eventos = await tx.select().from(schema.dividaEvento).where(and(eq(schema.dividaEvento.dividaId, o.id), eq(schema.dividaEvento.tipo, "renegociacao"))).orderBy(asc(schema.dividaEvento.id));
        const evento = [...eventos].reverse().find((e) => (e.dados as { acordoId?: number } | null)?.acordoId === acordoId);
        if (!evento) return erro(`Não encontramos a cópia das parcelas da dívida ${o.descricao}. A renegociação não pode ser desfeita automaticamente.`);
        const dados = evento.dados as { parcelasRetiradas: CopiaLancamento[]; vinculosEncerrados: { faturaId: number | null; recorrenciaId: number | null }[]; recorrentesInativados: number[] };

        for (const c of [...dados.parcelasRetiradas].sort((a, b) => a.id - b.id)) {
          await tx.insert(l).values(RECRIAR(c));
          if (c.tagIds?.length) await tx.insert(lancamentoTag).values(c.tagIds.map((tagId) => ({ lancamentoId: c.id, tagId })));
          await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: c.id, acao: "cadastrou", descricao: `a parcela ${c.descricao} (desfazer a renegociação da Dívida ${o.descricao})`, dados: c });
        }
        for (const v of dados.vinculosEncerrados ?? []) await tx.insert(dividaVinculo).values({ dividaId: o.id, faturaId: v.faturaId, recorrenciaId: v.recorrenciaId });
        if (dados.recorrentesInativados?.length) await tx.update(recorrencia).set({ ativo: true }).where(inArray(recorrencia.id, dados.recorrentesInativados));
        await tx.update(divida).set({ situacao: "ativa", encerradaEm: null }).where(eq(divida.id, o.id));
        await registrarEvento(tx, o.id, {
          data: hoje,
          tipo: "desfeito",
          descricao: `Renegociação desfeita: ${dados.parcelasRetiradas.length} ${dados.parcelasRetiradas.length === 1 ? "parcela voltou" : "parcelas voltaram"} para Lançamentos e o acordo ${acordo.descricao} foi apagado`,
          dados: { acordoId },
        });
        await registrarAuditoria(tx, { tela: TELA, entidade: "Dívida", entidadeId: o.id, acao: "renegociou", descricao: `o desfazer da renegociação da Dívida ${o.descricao}`, dados: { situacao: { antes: o.situacao, depois: "ativa" }, acordoId } });
      }

      // Apaga o acordo: primeiro as parcelas dele, depois a dívida e o grupo de parcelamento.
      if (doAcordo.length) {
        await tx.delete(l).where(inArray(l.id, doAcordo.map((x) => x.id)));
        for (const x of doAcordo) await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: x.id, acao: "excluiu", descricao: `a parcela ${x.descricao} (desfazer a renegociação)`, dados: x });
      }
      // A negociação volta a ficar aberta, com a proposta aceita de novo em aberto.
      const negociacaoIds = [...new Set(ligacoes.map((x) => x.negociacaoId).filter((x): x is number => x !== null))];
      for (const nid of negociacaoIds) {
        const [n] = await tx.select().from(negociacao).where(eq(negociacao.id, nid)).for("update");
        if (!n) continue;
        await tx.update(negociacaoProposta).set({ situacao: "aberta" }).where(and(eq(negociacaoProposta.negociacaoId, nid), eq(negociacaoProposta.situacao, "aceita")));
        const propostas = await tx.select().from(negociacaoProposta).where(eq(negociacaoProposta.negociacaoId, nid));
        const situacao = propostas.some((p) => p.situacao === "aberta" && p.quemPropos === "credor") ? "proposta_recebida" : propostas.some((p) => p.situacao === "aberta") ? "aguardando_resposta" : "em_andamento";
        await tx.update(negociacao).set({ situacao, acordoId: null }).where(eq(negociacao.id, nid));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE_NEGOCIACAO, entidadeId: nid, acao: "alterou", descricao: "a Negociação, que voltou a ficar aberta ao desfazer o acordo", dados: { situacao: { antes: n.situacao, depois: situacao } } });
      }
      await tx.delete(divida).where(eq(divida.id, acordoId));
      if (acordo.parcelamentoId) await tx.delete(parcelamento).where(eq(parcelamento.id, acordo.parcelamentoId));
      await registrarAuditoria(tx, { tela: TELA, entidade: "Dívida", entidadeId: acordoId, acao: "excluiu", descricao: `o acordo ${acordo.descricao} (renegociação desfeita)`, dados: acordo });
      refresh();
      return { ok: true as const, id: originais[0]?.id };
    }),
  );
}
