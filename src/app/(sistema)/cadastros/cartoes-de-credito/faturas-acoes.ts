"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { carregarDetalheCartao, carregarFatura, listarFaturas, type DetalheCartao, type DetalheFatura } from "@/lib/cartoes/servidor";
import { competenciaVizinha } from "@/lib/cartoes/regras";
import { dataValida, formatarData, hojeIso } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { faturaDaCompetencia, rotuloCompetencia } from "@/lib/lancamentos/regras";
import { exigirLogin } from "@/lib/sessao";

const { fatura, lancamento: l, cartaoCredito: cartao, contaFinanceira: conta, categoria } = schema;
const TELA = "Cartões de Crédito";
const ENTIDADE = "Fatura";

/** Dados da janela "Detalhando Cartão de Crédito". */
export async function detalharCartao(id: number): Promise<DetalheCartao | null> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return null;
  return carregarDetalheCartao(id);
}

/** Dados da janela da fatura (compras, pagamentos e ações). */
export async function abrirFatura(id: number): Promise<DetalheFatura | null> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return null;
  return carregarFatura(id);
}

/** Trava a fatura (para duas ações não rodarem ao mesmo tempo) e devolve os números dela. */
async function travarFatura(tx: Transacao, id: number) {
  const [trava] = await tx.select({ id: fatura.id }).from(fatura).where(eq(fatura.id, id)).for("update");
  if (!trava) return null;
  const [f] = await listarFaturas(eq(fatura.id, id));
  const [c] = await tx.select({ descricao: cartao.descricao }).from(cartao).where(eq(cartao.id, f.cartaoId));
  return { ...f, nome: `a Fatura de ${f.rotulo} do Cartão de Crédito ${c.descricao}`, cartao: c.descricao };
}

/**
 * Paga a fatura: grava uma saída na conta (tipo "pagamento_fatura", categoria especial Cartão de Crédito)
 * com o valor que ainda falta pagar, e marca as compras como pagas. A despesa continua contada
 * pelas compras (cada uma na sua categoria): o pagamento só mexe no saldo da conta.
 */
export async function pagarFatura(id: number, entrada: { contaId: string; data: string }): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Fatura não encontrada.");
  const contaId = Number(entrada?.contaId);
  if (!idValido.safeParse(contaId).success) return falha("Selecione o campo **Conta para Pagamento**.");
  const data = entrada?.data ?? "";
  if (!dataValida(data)) return falha("Informe uma data válida no campo **Data do Pagamento**.");
  return getDb().transaction(async (tx) => {
    const f = await travarFatura(tx, id);
    if (!f) return falha("Esta fatura não existe mais.");
    if (f.pendenteCentavos <= 0) return falha(f.compras ? "Esta fatura não tem valor a pagar." : "Esta fatura ainda não tem compras.");
    const [c] = await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, contaId));
    if (!c) return falha("A conta escolhida em **Conta para Pagamento** não existe mais.");
    const [especial] = await tx.select({ id: categoria.id }).from(categoria).where(eq(categoria.especial, "cartao_credito"));
    const [pagamento] = await tx
      .insert(l)
      .values({
        tipo: "pagamento_fatura",
        descricao: `Fatura-${f.cartao}`,
        valorCentavos: f.pendenteCentavos,
        valorPagoCentavos: f.pendenteCentavos,
        dataVencimento: f.dataVencimento,
        dataPagamento: data,
        contaId,
        categoriaId: especial?.id ?? null,
        faturaPagaId: id,
        origem: "sistema",
      })
      .returning({ id: l.id });
    await tx
      .update(l)
      .set({ dataPagamento: data, valorPagoCentavos: sql`${l.valorCentavos}` })
      .where(and(eq(l.faturaId, id), isNull(l.dataPagamento)));
    await tx.update(fatura).set({ situacao: "paga" }).where(eq(fatura.id, id));
    await registrarAuditoria(tx, {
      tela: TELA,
      entidade: ENTIDADE,
      entidadeId: id,
      acao: "pagou",
      descricao: f.nome,
      dados: { valor: formatarCentavos(f.pendenteCentavos), dataPagamento: formatarData(data), contaId, lancamentoId: pagamento.id },
    });
    refresh();
    return { ok: true as const, id: pagamento.id };
  });
}

/** Desfaz os pagamentos da fatura: apaga a saída da conta e as compras voltam a ficar em aberto. */
export async function desfazerPagamentoFatura(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Fatura não encontrada.");
  return getDb().transaction(async (tx) => {
    const f = await travarFatura(tx, id);
    if (!f) return falha("Esta fatura não existe mais.");
    const pagamentos = await tx.select().from(l).where(eq(l.faturaPagaId, id));
    if (!pagamentos.length) return falha("Esta fatura não tem pagamento para desfazer.");
    await tx.delete(l).where(eq(l.faturaPagaId, id));
    await tx.update(l).set({ dataPagamento: null, valorPagoCentavos: null }).where(eq(l.faturaId, id));
    await tx.update(fatura).set({ situacao: hojeIso() >= f.dataFechamento ? "fechada" : "aberta" }).where(eq(fatura.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o pagamento d${f.nome} (desfeito)`, dados: { pagamentosExcluidos: pagamentos } });
    refresh();
    return { ok: true as const };
  });
}

/** Fecha a fatura antes do dia (as compras novas continuam caindo pela data de fechamento do cartão). */
export async function fecharFatura(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Fatura não encontrada.");
  return getDb().transaction(async (tx) => {
    const f = await travarFatura(tx, id);
    if (!f) return falha("Esta fatura não existe mais.");
    if (f.situacao !== "aberta") return falha("Esta fatura já está fechada.");
    await tx.update(fatura).set({ situacao: "fechada" }).where(eq(fatura.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o fechamento d${f.nome}`, dados: { situacao: { antes: "aberta", depois: "fechada" } } });
    refresh();
    return { ok: true as const };
  });
}

/** Reabre uma fatura fechada à mão antes do dia do fechamento. */
export async function reabrirFatura(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Fatura não encontrada.");
  return getDb().transaction(async (tx) => {
    const f = await travarFatura(tx, id);
    if (!f) return falha("Esta fatura não existe mais.");
    if (f.situacao === "paga") return falha("Esta fatura já foi paga. Desfaça o pagamento antes.");
    if (hojeIso() >= f.dataFechamento) return falha(`Esta fatura fechou em ${formatarData(f.dataFechamento)} e não pode ser reaberta.`);
    await tx.update(fatura).set({ situacao: "aberta" }).where(eq(fatura.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `a reabertura d${f.nome}`, dados: { situacao: { antes: "fechada", depois: "aberta" } } });
    refresh();
    return { ok: true as const };
  });
}

/** Passa uma compra (ainda não paga) para a fatura anterior ou seguinte do mesmo cartão. */
export async function moverCompra(lancamentoId: number, passo: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(lancamentoId).success || (passo !== 1 && passo !== -1)) return falha("Compra não encontrada.");
  return getDb().transaction(async (tx) => {
    const [x] = await tx.select().from(l).where(eq(l.id, lancamentoId)).for("update");
    if (!x || !x.cartaoId || !x.faturaId) return falha("Compra não encontrada.");
    if (x.dataPagamento) return falha("Esta compra já foi paga junto com a fatura. Desfaça o pagamento da fatura antes de mudar.");
    const [origem] = await tx.select().from(fatura).where(eq(fatura.id, x.faturaId));
    const [c] = await tx.select({ diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento }).from(cartao).where(eq(cartao.id, x.cartaoId));
    const datas = faturaDaCompetencia(competenciaVizinha(origem.competencia, passo), c.diaFechamento, c.diaVencimento);
    await tx.insert(fatura).values({ cartaoId: x.cartaoId, ...datas }).onConflictDoNothing();
    const [destino] = await tx.select().from(fatura).where(and(eq(fatura.cartaoId, x.cartaoId), eq(fatura.competencia, datas.competencia)));
    await tx.update(l).set({ faturaId: destino.id, dataVencimento: destino.dataVencimento }).where(eq(l.id, x.id));
    await registrarAuditoria(tx, {
      tela: TELA,
      entidade: "Lançamento",
      entidadeId: x.id,
      acao: "alterou",
      descricao: `a fatura do Lançamento ${x.descricao}`,
      dados: { fatura: { antes: rotuloCompetencia(origem.competencia), depois: rotuloCompetencia(destino.competencia) } },
    });
    refresh();
    return { ok: true as const };
  });
}
