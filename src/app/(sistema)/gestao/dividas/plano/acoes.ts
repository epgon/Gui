"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria, type Transacao } from "@/lib/auditoria";
import type { Resultado } from "@/lib/cadastros/resultado";
import { formatarData, hojeIso } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { montarNovaVersao, montarPlano, type ConfigPlano, type ExtraDoPlano, type LinhaPlano, type OpcaoAjuste, type PontoSaldo } from "@/lib/dividas/plano";
import { carregarAnalisePlanoAtivo, configDoPlano, type ParametrosPlano } from "@/lib/dividas/plano-servidor";
import { amortizarReduzindoQuantidade, estaAtiva } from "@/lib/dividas/regras";
import { carregarDividasCompletas, categoriasDeDividas, type DividaCompleta } from "@/lib/dividas/servidor";
import { carregarSituacaoFinanceira } from "@/lib/dividas/simulador-servidor";
import { mesDe, ESTRATEGIAS, formatarReais, rotuloMes, type DividaSim, type Estrategia } from "@/lib/dividas/simulador";
import { conferirConta, erro, executar, exigirRecurso, lerData, lerId, lerTexto, lerValor, lerValorOuZero, registrarEvento } from "@/lib/dividas/validacao";
import { inserirLancamento } from "@/lib/lancamentos/gravacao";

const { planoQuitacao, planoQuitacaoMes, planoAjuste, divida } = schema;
const TELA = "Gestão de Dívidas";
const ENTIDADE = "Plano de Quitação";
const MAXIMO_EXTRAS = 24;

const primeiroDia = (ym: string) => `${ym}-01`;

/** O que a pessoa pagou neste mês em cada dívida (por id), para o planejado de hoje fechar com o que já saiu. */
function pagoNoMes(completas: DividaCompleta[], hoje: string, ids: Set<number>): Record<number, number> {
  const atual = mesDe(hoje);
  const r: Record<number, number> = {};
  for (const c of completas) {
    if (!ids.has(c.linha.id)) continue;
    const soma = c.obrigacoes.filter((o) => o.dataPagamento && mesDe(o.dataPagamento) === atual).reduce((s, o) => s + o.valorCentavos, 0);
    if (soma > 0) r[c.linha.id] = soma;
  }
  return r;
}

async function gravarLinhas(tx: Transacao, planoId: number, linhas: LinhaPlano[]) {
  for (let i = 0; i < linhas.length; i += 500) {
    await tx.insert(planoQuitacaoMes).values(linhas.slice(i, i + 500).map((x) => ({ planoId, competencia: primeiroDia(x.mes), dividaId: x.dividaId, planejadoCentavos: x.planejadoCentavos })));
  }
}

export type DadosAprovarPlano = {
  nome: string;
  origem: "simulacao" | "zero";
  /** Nome da simulação de onde o plano veio (só um texto de lembrete). */
  simulacao: string;
  estrategia: string;
  /** Vazio = pagar só as parcelas. */
  valorMensal: string;
  personalizada: string[];
  dividaIds: number[];
  extras: { mes: string; valor: string }[];
  reservaUsada: string;
};

/**
 * Aprovar plano: grava o plano (a meta de cada dívida em cada mês). Não cria lançamento nenhum:
 * os pagamentos extras só viram lançamento quando a pessoa clica em Agendar. Um plano ativo por vez:
 * o que estava ativo passa a Substituído.
 */
export async function aprovarPlano(d: DadosAprovarPlano): Promise<Resultado & { id?: number }> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const hoje = hojeIso();
      const atual = mesDe(hoje);
      const nome = lerTexto(d.nome, "Nome do Plano", 80, true)!;
      const estrategia = ESTRATEGIAS.find((e) => e.valor === d.estrategia)?.valor ?? erro("Escolha uma **Estratégia** válida.");
      const valorMensal = d.valorMensal?.trim() ? lerValor(d.valorMensal, "Valor Mensal") : null;
      const reservaUsada = lerValorOuZero(d.reservaUsada ?? "", "Reserva a Usar");
      const ids = [...new Set((d.dividaIds ?? []).map((x) => lerId(x)).filter((x): x is number => x !== null))];
      if (!ids.length) return erro("Marque pelo menos uma dívida para o plano.");
      if ((d.extras ?? []).length > MAXIMO_EXTRAS) return erro(`Use no máximo ${MAXIMO_EXTRAS} pagamentos extras.`);
      const extras: ExtraDoPlano[] = (d.extras ?? []).map((x) => {
        if (!/^\d{4}-\d{2}$/.test(x.mes) || x.mes < atual) return erro("Escolha um mês de hoje em diante para o **Pagamento Extra**.");
        return { mes: x.mes, valorCentavos: lerValor(x.valor, "Valor do Pagamento Extra")! };
      });

      const [completas, financeiro] = await Promise.all([carregarDividasCompletas(hoje), carregarSituacaoFinanceira(hoje)]);
      const escolhidas = completas.filter((c) => ids.includes(c.linha.id) && estaAtiva(c.linha.situacao) && c.sim);
      if (escolhidas.length !== ids.length) return erro("Uma das dívidas escolhidas não está mais ativa ou não tem saldo. Volte e confira a lista.");
      const sims = escolhidas.map((c) => c.sim!);
      const personalizada = (d.personalizada ?? []).filter((id) => sims.some((s) => s.id === id));
      const config: ConfigPlano = { estrategia: estrategia as Estrategia, personalizada, valorMensalCentavos: valorMensal, extras, reservaUsadaCentavos: reservaUsada };
      if (reservaUsada > financeiro.situacao.reservaCentavos) return erro("A **Reserva a Usar** passa da reserva que você tem hoje.");

      const montado = montarPlano({ dividas: sims, config, inicioYm: atual, realizadoNoMes: pagoNoMes(completas, hoje, new Set(ids)) });
      if (!montado.quitouTudo || !montado.mesFinal) return erro("Com esse valor as dívidas não terminam em 30 anos: o pagamento não cobre os juros. Aumente o **Valor Mensal**.");

      const parametros: ParametrosPlano = {
        origem: d.origem === "simulacao" ? "simulacao" : "zero",
        simulacao: lerTexto(d.simulacao ?? "", "Simulação", 80),
        personalizada,
        extras,
        reservaUsadaCentavos: reservaUsada,
        sobraNaAprovacaoCentavos: financeiro.situacao.sobraMensalCentavos + financeiro.situacao.despesaMediaCentavos > 0 ? financeiro.situacao.sobraMensalCentavos : null,
        saldoInicialCentavos: montado.saldoInicialCentavos,
        saldoPlanejado: montado.saldoPlanejado,
        mesFinalPlanejado: montado.mesFinal,
        dividaIds: ids,
        acompanharDesde: atual,
      };

      // Um plano ativo por vez.
      const ativos = await tx.select({ id: planoQuitacao.id, nome: planoQuitacao.nome, versao: planoQuitacao.versao }).from(planoQuitacao).where(eq(planoQuitacao.situacao, "ativo")).for("update");
      if (ativos.length) await tx.update(planoQuitacao).set({ situacao: "substituido", encerradoEm: new Date() }).where(eq(planoQuitacao.situacao, "ativo"));
      const [novo] = await tx
        .insert(planoQuitacao)
        .values({ nome, versao: 1, situacao: "ativo", estrategia, valorMensalCentavos: valorMensal, reservaMinimaCentavos: financeiro.situacao.reservaMinimaCentavos, inicio: primeiroDia(atual), parametros, aprovadoEm: new Date() })
        .returning({ id: planoQuitacao.id });
      await gravarLinhas(tx, novo.id, montado.linhas);
      await registrarAuditoria(tx, {
        tela: TELA,
        entidade: ENTIDADE,
        entidadeId: novo.id,
        acao: "aprovou",
        descricao: `o Plano de Quitação ${nome} (${escolhidas.length} ${escolhidas.length === 1 ? "dívida" : "dívidas"}, termina em ${rotuloMes(montado.mesFinal)})${ativos.length ? `; substituiu ${ativos.map((a) => `${a.nome} (versão ${a.versao})`).join(", ")}` : ""}`,
        dados: { estrategia, valorMensalCentavos: valorMensal, dividas: ids, mesFinal: montado.mesFinal },
      });
      refresh();
      return { ok: true as const, id: novo.id };
    }),
  );
}

export type OpcaoEscolhida = "aumentar" | "adiar";

/**
 * Aprovar ajuste: recalcula a proposta no servidor, confere se é a mesma que a pessoa viu e cria a versão nova do plano.
 * A versão anterior fica como Substituído, com os meses e metas como estavam.
 */
export async function aprovarAjuste(planoId: number, opcao: OpcaoEscolhida, assinatura: string): Promise<Resultado & { id?: number }> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const hoje = hojeIso();
      const atual = mesDe(hoje);
      const { analise, completas, situacao } = await carregarAnalisePlanoAtivo(hoje);
      if (!analise || analise.plano.id !== planoId) return erro("Este plano não está mais ativo. Atualize a tela.");
      const proposta = analise.proposta;
      if (!proposta || !analise.propostaVisivel) return erro("Não há mais ajuste a propor: o plano voltou ao rumo. Atualize a tela.");
      if (proposta.assinatura !== assinatura) return erro("O plano mudou desde que você abriu a tela. Confira a nova proposta e aprove de novo.");
      const escolhida: OpcaoAjuste | null = opcao === "aumentar" ? proposta.aumentar : proposta.adiar;
      if (!escolhida) return erro("Esta opção de ajuste não está disponível.");

      const idsPlano = new Set([...analise.plano.parametros.dividaIds, ...analise.linhas.map((x) => x.dividaId)]);
      const idsNovo = new Set([...idsPlano, ...analise.novasDividas.map((n) => n.id)]);
      const sims: DividaSim[] = completas.filter((c) => idsNovo.has(c.linha.id) && estaAtiva(c.linha.situacao) && c.sim).map((c) => c.sim!);
      const nova = montarNovaVersao({ dividas: sims, atual: { linhas: analise.linhas, saldoPlanejado: analise.plano.parametros.saldoPlanejado, config: configDoPlano(analise.plano) }, opcao: escolhida, inicioYm: atual, realizadoNoMes: pagoNoMes(completas, hoje, idsNovo) });
      if (!nova.montado.quitouTudo || !nova.montado.mesFinal) return erro("Com esse ajuste as dívidas não terminam em 30 anos. Escolha a outra opção.");

      const [antigo] = await tx.select().from(planoQuitacao).where(eq(planoQuitacao.id, planoId)).for("update");
      if (!antigo || antigo.situacao !== "ativo") return erro("Este plano não está mais ativo. Atualize a tela.");
      const baseline = analise.plano.parametros.saldoInicialCentavos + analise.novasDividas.reduce((s, n) => s + n.saldoCentavos, 0);
      const parametros: ParametrosPlano = {
        ...analise.plano.parametros,
        origem: "ajuste",
        personalizada: nova.config.personalizada,
        extras: nova.config.extras,
        reservaUsadaCentavos: 0,
        sobraNaAprovacaoCentavos: situacao.sobraMensalCentavos + situacao.despesaMediaCentavos > 0 ? situacao.sobraMensalCentavos : analise.plano.parametros.sobraNaAprovacaoCentavos,
        saldoInicialCentavos: baseline,
        saldoPlanejado: nova.saldoPlanejado as PontoSaldo[],
        mesFinalPlanejado: nova.montado.mesFinal,
        dividaIds: [...idsNovo],
        acompanharDesde: atual,
      };
      await tx.update(planoQuitacao).set({ situacao: "substituido", encerradoEm: new Date() }).where(eq(planoQuitacao.id, planoId));
      const [novo] = await tx
        .insert(planoQuitacao)
        .values({ nome: antigo.nome, versao: antigo.versao + 1, planoAnteriorId: antigo.id, situacao: "ativo", estrategia: antigo.estrategia, valorMensalCentavos: escolhida.valorMensalCentavos, reservaMinimaCentavos: Number(antigo.reservaMinimaCentavos), inicio: antigo.inicio, parametros, aprovadoEm: new Date() })
        .returning({ id: planoQuitacao.id });
      await gravarLinhas(tx, novo.id, nova.linhas);
      await tx.insert(planoAjuste).values({
        planoId,
        motivo: proposta.desvios.map((x) => x.texto).join(" "),
        proposta: { assinatura: proposta.assinatura, titulo: escolhida.titulo, opcao, desvios: proposta.desvios.map((x) => x.texto), calculo: escolhida.calculo },
        situacao: "aprovado",
        opcao,
        decididoEm: new Date(),
        planoNovoId: novo.id,
      });
      await registrarAuditoria(tx, {
        tela: TELA,
        entidade: ENTIDADE,
        entidadeId: novo.id,
        acao: "aprovou",
        descricao: `o ajuste do Plano de Quitação ${antigo.nome} (versão ${antigo.versao + 1}): ${escolhida.titulo}`,
        dados: { anterior: antigo.id, opcao, valorMensalCentavos: escolhida.valorMensalCentavos, mesFinal: nova.montado.mesFinal },
      });
      refresh();
      return { ok: true as const, id: novo.id };
    }),
  );
}

/** Manter como está: registra a recusa. O cartão só volta quando o desvio mudar. */
export async function manterComoEsta(planoId: number, assinatura: string): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const { analise } = await carregarAnalisePlanoAtivo();
      if (!analise || analise.plano.id !== planoId) return erro("Este plano não está mais ativo. Atualize a tela.");
      const proposta = analise.proposta;
      if (!proposta || proposta.assinatura !== assinatura) return erro("O plano mudou desde que você abriu a tela. Atualize a tela.");
      const sugerida = proposta.recomendada === "aumentar" ? proposta.aumentar : proposta.adiar;
      const [a] = await tx
        .insert(planoAjuste)
        .values({ planoId, motivo: proposta.desvios.map((x) => x.texto).join(" "), proposta: { assinatura: proposta.assinatura, titulo: sugerida?.titulo ?? null, desvios: proposta.desvios.map((x) => x.texto) }, situacao: "recusado", decididoEm: new Date() })
        .returning({ id: planoAjuste.id });
      await registrarAuditoria(tx, { tela: TELA, entidade: "Ajuste do Plano", entidadeId: a.id, acao: "cadastrou", descricao: `a decisão de manter o Plano de Quitação ${analise.plano.nome} como está`, dados: { planoId, assinatura } });
      refresh();
      return { ok: true as const };
    }),
  );
}

/** Encerrar o plano (por exemplo, quando as dívidas acabaram ou a pessoa desistiu dele). Nada é apagado. */
export async function encerrarPlano(planoId: number): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const [p] = await tx.select().from(planoQuitacao).where(and(eq(planoQuitacao.id, planoId), eq(planoQuitacao.situacao, "ativo"))).for("update");
      if (!p) return erro("Este plano não está mais ativo.");
      await tx.update(planoQuitacao).set({ situacao: "encerrado", encerradoEm: new Date() }).where(eq(planoQuitacao.id, planoId));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: planoId, acao: "alterou", descricao: `o Plano de Quitação ${p.nome} (versão ${p.versao}) para Encerrado`, dados: { situacao: { antes: "ativo", depois: "encerrado" } } });
      refresh();
      return { ok: true as const };
    }),
  );
}

export type DadosAgendar = { mes: string; dividaId: number; valor: string; vencimento: string; contaId: string };

/**
 * Agendar: cria UM lançamento de despesa ainda não pago, ligado à dívida, com o pagamento extra planejado.
 * Só com o clique da pessoa, um a um, e só para o mês atual e o seguinte. O valor não pode passar do que falta agendar.
 */
export async function agendarExtra(planoId: number, d: DadosAgendar): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const { analise } = await carregarAnalisePlanoAtivo();
      if (!analise || analise.plano.id !== planoId) return erro("Este plano não está mais ativo. Atualize a tela.");
      const item = analise.agendaveis.find((x) => x.mes === d.mes && x.dividaId === d.dividaId);
      if (!item) return erro("Não há mais nada a agendar para esta dívida neste mês. Atualize a tela.");
      const valor = lerValor(d.valor, "Valor")!;
      if (valor > item.agendarCentavos) return erro(`O valor passa do que falta agendar neste mês (${formatarCentavos(item.agendarCentavos)}).`);
      const vencimento = lerData(d.vencimento, "Vencimento")!;
      if (mesDe(vencimento) !== d.mes) return erro(`Escolha um **Vencimento** dentro de ${rotuloMes(d.mes)}.`);
      const contaId = await conferirConta(tx, d.contaId);
      const [dv] = await tx.select().from(divida).where(eq(divida.id, d.dividaId)).for("update");
      if (!dv || dv.situacao !== "ativa") return erro("Esta dívida não está mais ativa.");
      // Dívida com parcelas: o extra agendado já tira o mesmo valor das últimas parcelas em aberto, para o saldo não contar o dinheiro duas vezes.
      const ajustes: { id: number; descricao: string; vencimento: string; antes: number; depois: number; removida: boolean }[] = [];
      if (dv.forma === "parcelas_fixas") {
        const completa = (await carregarDividasCompletas()).find((c) => c.linha.id === dv.id);
        const abertas = (completa?.obrigacoes ?? []).filter((o) => o.origem === "lancamento" && !o.dataPagamento && o.podePagarAqui && !o.encargo);
        const r = amortizarReduzindoQuantidade(abertas.map((o) => ({ id: o.id, vencimento: o.vencimento, valorCentavos: o.valorCentavos })), valor);
        if (!r.ok) return erro(`${r.erro} Para encerrar a dívida, use Quitar em Minhas Dívidas.`);
        const nomes = new Map(abertas.map((o) => [o.id, o.descricao]));
        for (const a of r.ajustes) {
          if (!a.removida && a.depoisCentavos === a.antesCentavos) continue;
          const [antes] = await tx.select().from(schema.lancamento).where(eq(schema.lancamento.id, a.id)).for("update");
          if (!antes || antes.dataPagamento || Number(antes.valorCentavos) !== a.antesCentavos) return erro("Uma das parcelas mudou enquanto você conferia. Atualize a tela.");
          if (a.removida) {
            await tx.delete(schema.lancamento).where(eq(schema.lancamento.id, a.id));
            await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: a.id, acao: "excluiu", descricao: `a parcela ${antes.descricao} (coberta pelo pagamento extra do Plano ${analise.plano.nome})`, dados: antes });
          } else {
            await tx.update(schema.lancamento).set({ valorCentavos: a.depoisCentavos }).where(eq(schema.lancamento.id, a.id));
            await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: a.id, acao: "alterou", descricao: `o valor da parcela ${antes.descricao} (pagamento extra do Plano ${analise.plano.nome})`, dados: { valor: { antes: a.antesCentavos, depois: a.depoisCentavos } } });
          }
          ajustes.push({ id: a.id, descricao: nomes.get(a.id) ?? antes.descricao, vencimento: a.vencimento, antes: a.antesCentavos, depois: a.depoisCentavos, removida: a.removida });
        }
      }
      const categorias = await categoriasDeDividas();
      const novo = await inserirLancamento(
        tx,
        { tipo: "despesa", formato: "simples", descricao: `Pagamento extra do plano (${dv.descricao})`, valorCentavos: valor, dataVencimento: vencimento, contaId, categoriaId: categorias.parcelas ?? dv.categoriaId, formaPagamentoId: dv.formaPagamentoId, contatoId: dv.contatoId, dividaId: dv.id, origem: "manual" },
        [],
        [],
      );
      await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: novo.id, acao: "cadastrou", descricao: `o pagamento extra do Plano ${analise.plano.nome} para a Dívida ${dv.descricao} (${formatarCentavos(valor)}, vence em ${formatarData(vencimento)})`, dados: novo });
      await registrarEvento(tx, dv.id, { data: hojeIso(), tipo: "anotacao", descricao: `Pagamento extra do plano ${analise.plano.nome} agendado: ${formatarReais(valor)}, vence em ${formatarData(vencimento)}`, valorCentavos: valor, lancamentoId: novo.id, dados: { planoExtra: true, planoId: analise.plano.id, ajustes } });
      refresh();
      return { ok: true as const };
    }),
  );
}
