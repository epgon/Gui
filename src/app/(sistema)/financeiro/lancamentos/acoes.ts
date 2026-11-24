"use server";

import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { dataValida, formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { garantirFatura, inserirLancamento } from "@/lib/lancamentos/gravacao";
import { calcularPagamento, gerarParcelas, PERIODICIDADES, totalDetalhado, type Periodicidade, type TipoLancamento } from "@/lib/lancamentos/regras";
import type { DadosLancamento, LancamentoEdicao, Ocorrencia } from "@/lib/lancamentos/tipos";
import { aplicarVariaveis, primeiraOcorrencia } from "@/lib/recorrentes/regras";
import { conferirOcorrencia, dadosDaOcorrencia, gravarOcorrencia } from "@/lib/recorrentes/servidor";
import { ErroValidacao, lerDatasRecorrencia } from "@/lib/recorrentes/validacao";
import { lerParametros } from "@/lib/parametros/servidor";
import { exigirLogin } from "@/lib/sessao";

const { lancamento: l, lancamentoItem: item, lancamentoTag, contaFinanceira: conta, cartaoCredito: cartao, fatura, categoria, parcelamento, transferencia, anexo, formaPagamento, contato, tag, recorrencia, recorrenciaItem, recorrenciaTag, recorrenciaExcecao } = schema;
const TELA = "Lançamentos";
const ENTIDADE = "Lançamento";
const MAXIMO_CENTAVOS = 99_999_999_999;
const MAXIMO_PARCELAS = 360;

type Linha = typeof l.$inferInsert;

const COMPRA_PAGA = "Esta compra já foi paga junto com a fatura. Para mudar o valor, o cartão ou a fatura, desfaça antes o pagamento da fatura (em Cadastros > Cartões de Crédito > Faturas).";
const PAGAMENTO_FATURA = "Este é o pagamento de uma fatura de cartão. Para mudar, abra a fatura e use **Desfazer pagamento**.";

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

class ErroFormulario extends Error {}
const erro = (mensagem: string): never => {
  throw new ErroFormulario(mensagem);
};

function lerValor(texto: string, campo: string): number {
  const centavos = lerValorEmCentavos(texto ?? "");
  if (!texto?.trim()) erro(`Preencha o campo **${campo}**.`);
  if (centavos === null || centavos > MAXIMO_CENTAVOS) erro(`Informe um valor válido no campo **${campo}** (ex.: 1.250,00).`);
  if (centavos! <= 0) erro(`O campo **${campo}** precisa ser maior que zero.`);
  return centavos!;
}

function lerData(texto: string, campo: string, obrigatoria = true): string | null {
  if (!texto) return obrigatoria ? erro(`Preencha o campo **${campo}**.`) : null;
  if (!dataValida(texto)) erro(`Informe uma data válida no campo **${campo}**.`);
  return texto;
}

function lerTexto(texto: string, campo: string, maximo: number, obrigatorio = false): string | null {
  const limpo = (texto ?? "").trim();
  if (!limpo) return obrigatorio ? erro(`Preencha o campo **${campo}**.`) : null;
  if (limpo.length > maximo) erro(`O campo **${campo}** aceita no máximo ${maximo} caracteres.`);
  return limpo;
}

const lerId = (texto: string | number | null | undefined) => {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function conferirCategoria(tx: Transacao, id: number | null, campo: string, natureza?: "receita" | "despesa") {
  if (id === null) erro(`Selecione o campo **${campo}**.`);
  const [c] = await tx.select({ id: categoria.id, especial: categoria.especial, natureza: categoria.natureza }).from(categoria).where(eq(categoria.id, id!));
  if (!c || c.especial) erro(`Selecione o campo **${campo}**.`);
  if (natureza && c!.natureza !== natureza) erro(`A categoria escolhida é de ${c!.natureza}. Escolha uma categoria de ${natureza} no campo **${campo}**.`);
  return id!;
}

async function conferirExiste(tx: Transacao, tabela: typeof formaPagamento | typeof contato, id: number | null, campo: string) {
  if (id === null) return null;
  const [linha] = await tx.select({ id: tabela.id }).from(tabela).where(eq(tabela.id, id));
  if (!linha) erro(`Selecione o campo **${campo}**.`);
  return id;
}

/** Conta ou cartão escolhido. */
async function lerDestino(tx: Transacao, destino: string) {
  const m = /^(conta|cartao):(\d+)$/.exec(destino ?? "");
  if (!m) erro("Selecione o campo **Conta ou Cartão**.");
  const id = Number(m![2]);
  if (m![1] === "conta") {
    const [c] = await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, id));
    if (!c) erro("Selecione o campo **Conta ou Cartão**.");
    return { contaId: id, cartaoId: null };
  }
  const [c] = await tx.select({ id: cartao.id }).from(cartao).where(eq(cartao.id, id));
  if (!c) erro("Selecione o campo **Conta ou Cartão**.");
  return { contaId: null, cartaoId: id };
}

type Comum = {
  descricao: string;
  documento: string | null;
  observacao: string | null;
  dataReferencia: string | null;
  formaPagamentoId: number | null;
  contatoId: number | null;
  realizarAutomaticamente: boolean;
};

async function lerComum(tx: Transacao, d: DadosLancamento, descricaoPadrao?: string): Promise<Comum> {
  return {
    descricao: lerTexto(d.descricao || descricaoPadrao || "", "Descrição", 120, true)!,
    documento: lerTexto(d.documento, "Documento", 60),
    observacao: lerTexto(d.observacao, "Observação", 1000),
    dataReferencia: lerData(d.dataReferencia, "Data de Referência", false),
    formaPagamentoId: await conferirExiste(tx, formaPagamento, lerId(d.formaPagamentoId), "Forma de Pagamento"),
    contatoId: await conferirExiste(tx, contato, lerId(d.contatoId), "Cliente ou Fornecedor"),
    realizarAutomaticamente: !!d.realizarAutomaticamente,
  };
}

async function lerTags(tx: Transacao, ids: number[]): Promise<number[]> {
  const unicos = [...new Set((Array.isArray(ids) ? ids : []).map(lerId).filter((x): x is number => x !== null))];
  if (!unicos.length) return [];
  const achadas = await tx.select({ id: tag.id }).from(tag).where(inArray(tag.id, unicos));
  if (achadas.length !== unicos.length) erro("Selecione o campo **Tags** de novo: alguma tag não existe mais.");
  return unicos;
}

async function lerItens(tx: Transacao, d: DadosLancamento) {
  if (!Array.isArray(d.itens) || d.itens.length === 0) erro("Adicione pelo menos um item no campo **Detalhes**.");
  if (d.itens.length > 100) erro("O campo **Detalhes** aceita no máximo 100 itens.");
  const itens = [];
  for (const [i, it] of d.itens.entries()) {
    const n = i + 1;
    itens.push({
      tipo: it.tipo === "receita" ? ("receita" as const) : ("despesa" as const),
      descricao: lerTexto(it.descricao, `Descrição do item ${n}`, 120, true)!,
      valorCentavos: lerValor(it.valor, `Valor do item ${n}`),
      categoriaId: await conferirCategoria(tx, lerId(it.categoriaId), `Categoria do item ${n}`, it.tipo === "receita" ? "receita" : "despesa"),
      ordem: i,
    });
  }
  const total = totalDetalhado(itens);
  if (total.valorCentavos === 0) erro("A soma dos itens do campo **Detalhes** não pode ser zero.");
  return { itens, ...total };
}

// ---------------------------------------------------------------------------
// Salvar
// ---------------------------------------------------------------------------

export async function salvarLancamento(id: number | null, d: DadosLancamento): Promise<Resultado & { ids?: number[] }> {
  await exigirLogin();
  if (id !== null && !idValido.safeParse(id).success) return falha("Lançamento não encontrado.");
  try {
    return await getDb().transaction(async (tx) => {
      const r = d.aba === "transferencia" ? await salvarTransferencia(tx, id, d) : await salvarSimplesOuDetalhado(tx, id, d);
      refresh();
      return r;
    });
  } catch (e) {
    if (e instanceof ErroFormulario || e instanceof ErroValidacao) return falha(e.message);
    throw e;
  }
}

/** Ocorrência válida de recorrente (para editar uma prevista e gravá-la). */
function lerOcorrencia(o: Ocorrencia | null | undefined): Ocorrencia | null {
  if (!o) return null;
  if (!idValido.safeParse(o.recorrenciaId).success || !dataValida(o.data)) erro("Ocorrência do recorrente não encontrada.");
  return { recorrenciaId: o.recorrenciaId, data: o.data };
}

/** "Gerar Recorrente": cria a regra a partir do lançamento. O próprio lançamento é a primeira ocorrência. */
async function criarRegra(tx: Transacao, base: Linha, d: DadosLancamento, tagIds: number[], itens: { tipo: "receita" | "despesa"; descricao: string; valorCentavos: number; categoriaId: number; ordem: number }[], contaDestinoId: number | null = null) {
  const datas = lerDatasRecorrencia(d.recorrente!);
  const [regra] = await tx
    .insert(recorrencia)
    .values({
      formato: base.transferenciaId || contaDestinoId ? "transferencia" : base.formato,
      tipo: base.tipo === "receita" ? "receita" : "despesa",
      descricao: base.descricao,
      valorCentavos: base.valorCentavos,
      ...datas,
      realizarAutomaticamente: !!base.realizarAutomaticamente,
      contaId: base.contaId ?? null,
      cartaoId: base.cartaoId ?? null,
      contaDestinoId,
      categoriaId: contaDestinoId ? null : (base.categoriaId ?? null),
      formaPagamentoId: base.formaPagamentoId ?? null,
      contatoId: contaDestinoId ? null : (base.contatoId ?? null),
      observacao: base.observacao ?? null,
    })
    .returning();
  if (tagIds.length) await tx.insert(recorrenciaTag).values(tagIds.map((tagId) => ({ recorrenciaId: regra.id, tagId })));
  if (itens.length) await tx.insert(recorrenciaItem).values(itens.map((i) => ({ ...i, recorrenciaId: regra.id })));
  await registrarAuditoria(tx, { tela: TELA, entidade: "Recorrente", entidadeId: regra.id, acao: "cadastrou", descricao: `o Recorrente ${regra.descricao}`, dados: { ...regra, tagIds, itens } });
  return { recorrenciaId: regra.id, dataOcorrencia: primeiraOcorrencia(datas), origem: "recorrente" as const };
}

async function salvarSimplesOuDetalhado(tx: Transacao, id: number | null, d: DadosLancamento) {
  const detalhado = d.aba === "detalhado";
  const comum = await lerComum(tx, d);
  let tipo: "receita" | "despesa" = d.tipo === "receita" ? "receita" : "despesa";
  let valorCentavos: number;
  let categoriaId: number | null = null;
  let itens: Awaited<ReturnType<typeof lerItens>>["itens"] = [];
  if (detalhado) {
    const r = await lerItens(tx, d);
    itens = r.itens;
    tipo = r.tipo;
    valorCentavos = r.valorCentavos;
  } else {
    valorCentavos = lerValor(d.valor, "Valor");
  }
  const data = lerData(d.data, "Data de Vencimento")!;
  if (!detalhado) categoriaId = await conferirCategoria(tx, lerId(d.categoriaId), "Categoria", tipo);
  const destino = await lerDestino(tx, d.destino);
  const tagIds = await lerTags(tx, d.tagIds);
  const pago = destino.cartaoId === null && d.pago;
  const dataPagamento = pago ? lerData(d.dataPagamento || data, "Data do Pagamento")! : null;

  const base: Linha = {
    ...comum,
    tipo,
    formato: detalhado ? "detalhado" : "simples",
    valorCentavos,
    valorPagoCentavos: pago ? valorCentavos : null,
    dataVencimento: data,
    dataCompra: destino.cartaoId ? data : null,
    dataPagamento,
    ...destino,
    categoriaId,
  };

  if (id === null) {
    const ocorrencia = lerOcorrencia(d.ocorrencia);
    if (ocorrencia) {
      // Ocorrência prevista editada: vira lançamento ligado ao recorrente.
      const regra = await conferirOcorrencia(tx, ocorrencia.recorrenciaId, ocorrencia.data);
      if (regra.formato === "transferencia") erro("Este recorrente é uma transferência: use a aba **Transferência**.");
      Object.assign(base, { recorrenciaId: regra.id, dataOcorrencia: ocorrencia.data, origem: "recorrente" });
    } else if (d.parcelar) {
      return criarParcelas(tx, base, d, tagIds, itens);
    } else if (d.recorrente) {
      Object.assign(base, await criarRegra(tx, base, d, tagIds, itens));
      base.descricao = aplicarVariaveis(base.descricao, base.dataVencimento);
    }
    const novo = await inserirLancamento(tx, base, tagIds, itens);
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novo.id, acao: "cadastrou", descricao: `o Lançamento ${novo.descricao}`, dados: { ...base, tagIds, itens } });
    return { ok: true as const, id: novo.id, ids: [novo.id] };
  }

  const [antes] = await tx.select().from(l).where(eq(l.id, id)).for("update");
  if (!antes) erro("Este lançamento não existe mais.");
  if (antes.tipo === "saldo_inicial") erro("O Saldo Inicial é alterado no cadastro da Conta Financeira.");
  if (antes.transferenciaId) erro("Este lançamento é uma transferência: edite pela aba **Transferência**.");
  if (antes.tipo === "pagamento_fatura") erro(PAGAMENTO_FATURA);
  if (antes.parcelamentoId) {
    // Parcela: mantém o número e o total.
    base.parcelamentoId = antes.parcelamentoId;
    base.parcelaNumero = antes.parcelaNumero;
    base.parcelaTotal = antes.parcelaTotal;
    base.origem = antes.origem;
  }
  if (antes.cartaoId && destino.cartaoId) {
    // Compra no cartão que já foi paga junto com a fatura continua paga.
    base.dataPagamento = antes.dataPagamento;
    base.valorPagoCentavos = antes.valorPagoCentavos;
  }
  if (base.cartaoId) {
    // Mesmo cartão e mesmo dia de compra: a compra fica na fatura em que está (pode ter sido movida à mão).
    const mesmaFatura = antes.faturaId !== null && antes.cartaoId === base.cartaoId && (antes.dataCompra ?? antes.dataVencimento) === data;
    const f = mesmaFatura
      ? (await tx.select({ id: fatura.id, dataVencimento: fatura.dataVencimento }).from(fatura).where(eq(fatura.id, antes.faturaId!)))[0]
      : await garantirFatura(tx, base.cartaoId, data);
    Object.assign(base, { dataVencimento: f.dataVencimento, faturaId: f.id, realizarAutomaticamente: false });
    if (!antes.cartaoId) Object.assign(base, { dataPagamento: null, valorPagoCentavos: null });
  } else {
    base.faturaId = null;
  }
  // Compra já paga junto com a fatura: valor, tipo, cartão e fatura não mudam (o pagamento já saiu da conta).
  if (
    antes.cartaoId &&
    antes.dataPagamento &&
    (base.cartaoId !== antes.cartaoId || base.faturaId !== antes.faturaId || base.valorCentavos !== antes.valorCentavos || base.tipo !== antes.tipo)
  ) {
    erro(COMPRA_PAGA);
  }
  if (antes.valorOriginalCentavos !== null) {
    // Pago com valor diferente (parcial, desconto ou juros).
    if (!base.dataPagamento) erro("Este lançamento foi pago com outro valor. Para voltar para não pago, use **Voltar para não pago** no menu da linha (o restante volta junto).");
    // Mudou o valor à mão: o novo valor passa a ser o de referência.
    base.valorOriginalCentavos = base.valorCentavos === antes.valorCentavos ? antes.valorOriginalCentavos : null;
  }
  await tx.update(l).set(base).where(eq(l.id, id));
  await tx.delete(lancamentoTag).where(eq(lancamentoTag.lancamentoId, id));
  if (tagIds.length) await tx.insert(lancamentoTag).values(tagIds.map((tagId) => ({ lancamentoId: id, tagId })));
  await tx.delete(item).where(eq(item.lancamentoId, id));
  if (itens.length) await tx.insert(item).values(itens.map((i) => ({ ...i, lancamentoId: id })));
  await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o Lançamento ${base.descricao}`, dados: { antes, depois: { ...base, tagIds, itens } } });
  return { ok: true as const, id, ids: [id] };
}

async function criarParcelas(tx: Transacao, base: Linha, d: DadosLancamento, tagIds: number[], itens: Awaited<ReturnType<typeof lerItens>>["itens"]) {
  const p = d.parcelar!;
  if (base.formato === "detalhado") erro("Para parcelar, use a aba **Simples**.");
  const quantidade = Number(p.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 2 || quantidade > MAXIMO_PARCELAS) erro(`Informe de 2 a ${MAXIMO_PARCELAS} no campo **Parcelas**.`);
  const inicio = Number(p.iniciarNaParcela || 1);
  if (!Number.isInteger(inicio) || inicio < 1 || inicio > quantidade) erro(`Informe de 1 a ${quantidade} no campo **Iniciar na Parcela**.`);
  const periodicidade = PERIODICIDADES.find((x) => x.valor === p.periodicidade)?.valor ?? erro("Selecione o campo **Periodicidade**.");
  const config = {
    descricao: base.descricao,
    valorCentavos: base.valorCentavos,
    quantidade,
    iniciarNaParcela: inicio,
    dividirValor: !!p.dividirValor,
    incluirParcelaNaDescricao: !!p.incluirParcelaNaDescricao,
    primeiraData: base.dataVencimento,
    periodicidade: periodicidade as Periodicidade,
  };
  let parcelas = gerarParcelas(config);
  // Parcelas conferidas e ajustadas em "Ver Parcelas".
  if (Array.isArray(p.parcelas) && p.parcelas.length) {
    if (p.parcelas.length !== parcelas.length) erro("As parcelas mudaram. Clique em **Ver Parcelas** de novo para conferir.");
    parcelas = p.parcelas.map((x, i) => ({
      numero: parcelas[i].numero,
      descricao: lerTexto(x.descricao, `Descrição da parcela ${parcelas[i].numero}`, 120, true)!,
      data: lerData(x.data, `Vencimento da parcela ${parcelas[i].numero}`)!,
      valorCentavos: lerValor(x.valor, `Valor da parcela ${parcelas[i].numero}`),
    }));
  }
  const [grupo] = await tx
    .insert(parcelamento)
    .values({ descricaoBase: base.descricao, valorTotalCentavos: parcelas.reduce((s, x) => s + x.valorCentavos, 0), quantidade, periodicidade: config.periodicidade, iniciarNaParcela: inicio, dividirValor: config.dividirValor, incluirParcelaNaDescricao: config.incluirParcelaNaDescricao })
    .returning();
  const ids: number[] = [];
  for (const [i, parcela] of parcelas.entries()) {
    const primeira = i === 0;
    const novo = await inserirLancamento(
      tx,
      {
        ...base,
        descricao: parcela.descricao,
        valorCentavos: parcela.valorCentavos,
        dataVencimento: parcela.data,
        dataCompra: base.cartaoId ? parcela.data : null,
        // "Pago" vale só para a primeira parcela gerada.
        dataPagamento: primeira ? base.dataPagamento : null,
        valorPagoCentavos: primeira && base.dataPagamento ? parcela.valorCentavos : null,
        parcelamentoId: grupo.id,
        parcelaNumero: parcela.numero,
        parcelaTotal: quantidade,
        origem: "parcelamento",
      },
      tagIds,
      itens,
    );
    ids.push(novo.id);
  }
  await registrarAuditoria(tx, {
    tela: TELA,
    entidade: ENTIDADE,
    entidadeId: ids[0],
    acao: "cadastrou",
    descricao: `o Lançamento parcelado ${base.descricao} (${parcelas.length} parcelas)`,
    dados: { ...base, parcelamentoId: grupo.id, parcelas },
  });
  return { ok: true as const, id: ids[0], ids };
}

async function salvarTransferencia(tx: Transacao, id: number | null, d: DadosLancamento) {
  const contas = await tx.select({ id: conta.id }).from(conta).where(eq(conta.ativo, true));
  if (contas.length < 2 && id === null) erro("Você não possui outra conta para transferir. Cadastre mais uma Conta Financeira.");
  const comum = await lerComum(tx, d, "Transferência");
  const valorCentavos = lerValor(d.valor, "Valor");
  const data = lerData(d.data, "Data de Vencimento")!;
  const origem = /^conta:(\d+)$/.exec(d.destino ?? "");
  const origemId = origem ? Number(origem[1]) : null;
  if (!origemId || !(await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, origemId))).length) erro("Selecione o campo **Conta Financeira** de origem.");
  const destinoId = lerId(d.contaDestinoId);
  if (!destinoId || !(await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, destinoId))).length) erro("Selecione o campo **Conta de Destino**.");
  if (origemId === destinoId) erro("A **Conta de Destino** precisa ser diferente da conta de origem.");
  const tagIds = await lerTags(tx, d.tagIds);
  const dataPagamento = d.pago ? lerData(d.dataPagamento || data, "Data do Pagamento")! : null;
  const [categoriaTransferencia] = await tx.select({ id: categoria.id }).from(categoria).where(eq(categoria.especial, "transferencia"));

  const linha = (tipo: TipoLancamento, contaId: number): Linha => ({
    ...comum,
    tipo,
    formato: "simples",
    valorCentavos,
    valorPagoCentavos: dataPagamento ? valorCentavos : null,
    dataVencimento: data,
    dataPagamento,
    contaId,
    cartaoId: null,
    faturaId: null,
    categoriaId: categoriaTransferencia?.id ?? null,
  });

  if (id === null) {
    let ligacao: Partial<Linha> = {};
    const ocorrencia = lerOcorrencia(d.ocorrencia);
    if (ocorrencia) {
      const regra = await conferirOcorrencia(tx, ocorrencia.recorrenciaId, ocorrencia.data);
      if (regra.formato !== "transferencia") erro("Este recorrente não é uma transferência.");
      ligacao = { recorrenciaId: regra.id, dataOcorrencia: ocorrencia.data, origem: "recorrente" };
    } else if (d.recorrente) {
      ligacao = await criarRegra(tx, linha("transferencia_saida", origemId!), d, tagIds, [], destinoId);
      ligacao.descricao = aplicarVariaveis(comum.descricao, data);
    }
    const [grupo] = await tx.insert(transferencia).values({}).returning();
    const saida = await inserirLancamento(tx, { ...linha("transferencia_saida", origemId!), ...ligacao, transferenciaId: grupo.id }, tagIds, []);
    const entrada = await inserirLancamento(tx, { ...linha("transferencia_entrada", destinoId!), ...ligacao, transferenciaId: grupo.id }, tagIds, []);
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: saida.id, acao: "cadastrou", descricao: `a Transferência ${comum.descricao}`, dados: { ...linha("transferencia_saida", origemId!), contaDestinoId: destinoId } });
    return { ok: true as const, id: saida.id, ids: [saida.id, entrada.id] };
  }

  const [antes] = await tx.select().from(l).where(eq(l.id, id)).for("update");
  if (!antes) erro("Este lançamento não existe mais.");
  if (!antes.transferenciaId) erro("Este lançamento não é uma transferência. Use a aba **Simples** ou **Detalhado**.");
  const par = await tx.select().from(l).where(eq(l.transferenciaId, antes.transferenciaId!)).for("update");
  for (const p of par) {
    const nova = p.tipo === "transferencia_saida" ? linha("transferencia_saida", origemId!) : linha("transferencia_entrada", destinoId!);
    await tx.update(l).set(nova).where(eq(l.id, p.id));
    await tx.delete(lancamentoTag).where(eq(lancamentoTag.lancamentoId, p.id));
    if (tagIds.length) await tx.insert(lancamentoTag).values(tagIds.map((tagId) => ({ lancamentoId: p.id, tagId })));
  }
  await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `a Transferência ${comum.descricao}`, dados: { antes: par, depois: { ...linha("transferencia_saida", origemId!), contaDestinoId: destinoId } } });
  const saida = par.find((p) => p.tipo === "transferencia_saida");
  return { ok: true as const, id: saida?.id ?? id, ids: par.map((p) => p.id) };
}

// ---------------------------------------------------------------------------
// Carregar para editar
// ---------------------------------------------------------------------------

export async function carregarLancamento(id: number): Promise<LancamentoEdicao | null> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return null;
  const db = getDb();
  const [x] = await db.select().from(l).where(eq(l.id, id));
  if (!x || x.tipo === "pagamento_fatura") return null;
  let par = x;
  let contaDestinoId = "";
  if (x.transferenciaId) {
    const ambos = await db.select().from(l).where(eq(l.transferenciaId, x.transferenciaId));
    par = ambos.find((p) => p.tipo === "transferencia_saida") ?? x;
    contaDestinoId = String(ambos.find((p) => p.tipo === "transferencia_entrada")?.contaId ?? "");
  }
  const [tags, itens, anexos] = await Promise.all([
    db.select({ tagId: lancamentoTag.tagId }).from(lancamentoTag).where(eq(lancamentoTag.lancamentoId, par.id)),
    db.select().from(item).where(eq(item.lancamentoId, par.id)).orderBy(asc(item.ordem), asc(item.id)),
    db.select({ id: anexo.id, nomeArquivo: anexo.nomeArquivo, tipoMime: anexo.tipoMime, tamanhoBytes: anexo.tamanhoBytes }).from(anexo).where(eq(anexo.lancamentoId, par.id)).orderBy(asc(anexo.id)),
  ]);
  return {
    id: par.id,
    parcela: par.parcelaNumero && par.parcelaTotal ? `${par.parcelaNumero}/${par.parcelaTotal}` : null,
    parcelamentoId: par.parcelamentoId,
    anexos,
    dados: {
      aba: par.transferenciaId ? "transferencia" : par.formato,
      tipo: par.tipo === "receita" ? "receita" : "despesa",
      descricao: par.descricao,
      valor: formatarCentavos(Math.abs(par.valorCentavos)),
      data: par.cartaoId ? (par.dataCompra ?? par.dataVencimento) : par.dataVencimento,
      pago: !!par.dataPagamento,
      dataPagamento: par.dataPagamento ?? "",
      realizarAutomaticamente: par.realizarAutomaticamente,
      destino: par.contaId ? `conta:${par.contaId}` : `cartao:${par.cartaoId}`,
      contaDestinoId,
      categoriaId: par.categoriaId && !par.transferenciaId ? String(par.categoriaId) : "",
      formaPagamentoId: par.formaPagamentoId ? String(par.formaPagamentoId) : "",
      contatoId: par.contatoId ? String(par.contatoId) : "",
      tagIds: tags.map((t) => t.tagId),
      documento: par.documento ?? "",
      dataReferencia: par.dataReferencia ?? "",
      observacao: par.observacao ?? "",
      itens: itens.map((i) => ({ chave: `i${i.id}`, tipo: i.tipo, descricao: i.descricao, valor: formatarCentavos(i.valorCentavos), categoriaId: String(i.categoriaId) })),
      parcelar: null,
    },
  };
}

/** Ocorrência prevista de um recorrente, pronta para editar (ao salvar, vira lançamento). */
export async function carregarOcorrencia(o: Ocorrencia): Promise<{ dados: DadosLancamento } | { erro: string }> {
  await exigirLogin();
  try {
    const oc = lerOcorrencia(o)!;
    return await getDb().transaction(async (tx) => {
      const regra = await conferirOcorrencia(tx, oc.recorrenciaId, oc.data);
      const x = await dadosDaOcorrencia(tx, regra, oc.data);
      const dados: DadosLancamento = {
        aba: regra.formato,
        tipo: x.tipo,
        descricao: x.descricao,
        valor: formatarCentavos(x.valorCentavos),
        data: x.vencimento,
        pago: false,
        dataPagamento: "",
        realizarAutomaticamente: regra.realizarAutomaticamente,
        destino: regra.contaId ? `conta:${regra.contaId}` : `cartao:${regra.cartaoId}`,
        contaDestinoId: regra.contaDestinoId ? String(regra.contaDestinoId) : "",
        categoriaId: regra.categoriaId && regra.formato === "simples" ? String(regra.categoriaId) : "",
        formaPagamentoId: regra.formaPagamentoId ? String(regra.formaPagamentoId) : "",
        contatoId: regra.contatoId ? String(regra.contatoId) : "",
        tagIds: regra.tagIds,
        documento: "",
        dataReferencia: "",
        observacao: regra.observacao ?? "",
        itens: regra.itens.map((i) => ({ chave: `r${i.id}`, tipo: i.tipo, descricao: i.descricao, valor: formatarCentavos(i.valorCentavos), categoriaId: String(i.categoriaId) })),
        parcelar: null,
        ocorrencia: oc,
      };
      return { dados };
    });
  } catch (e) {
    if (e instanceof ErroFormulario || e instanceof ErroValidacao) return { erro: e.message };
    throw e;
  }
}

const lerOcorrencias = (lista: unknown): Ocorrencia[] | null => {
  if (!Array.isArray(lista) || lista.length > 500) return null;
  const validas = lista.filter((o) => o && idValido.safeParse(o.recorrenciaId).success && typeof o.data === "string" && dataValida(o.data)) as Ocorrencia[];
  if (validas.length !== lista.length) return null;
  const vistas = new Set<string>();
  return validas.filter((o) => !vistas.has(`${o.recorrenciaId}|${o.data}`) && vistas.add(`${o.recorrenciaId}|${o.data}`)).map((o) => ({ recorrenciaId: o.recorrenciaId, data: o.data }));
};

/** Excluir uma ocorrência prevista: ela é pulada e não aparece mais. O recorrente continua. */
export async function pularOcorrencias(lista: Ocorrencia[]): Promise<Resultado> {
  await exigirLogin();
  const ocorrencias = lerOcorrencias(lista);
  if (!ocorrencias?.length) return falha("Selecione pelo menos um lançamento.");
  try {
    return await getDb().transaction(async (tx) => {
      for (const o of ocorrencias) {
        const regra = await conferirOcorrencia(tx, o.recorrenciaId, o.data);
        await tx.insert(recorrenciaExcecao).values({ recorrenciaId: o.recorrenciaId, dataOcorrencia: o.data, motivo: "Excluída da lista" }).onConflictDoNothing();
        await registrarAuditoria(tx, { tela: TELA, entidade: "Recorrente", entidadeId: regra.id, acao: "excluiu", descricao: `a ocorrência de ${formatarData(o.data)} do Recorrente ${regra.descricao}`, dados: o });
      }
      refresh();
      return { ok: true as const };
    });
  } catch (e) {
    if (e instanceof ErroValidacao) return falha(e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Pagar / receber, estornar e excluir
// ---------------------------------------------------------------------------

const lerIds = (ids: unknown): number[] | null => {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) return null;
  const validos = ids.filter((x) => idValido.safeParse(x).success) as number[];
  return validos.length === ids.length ? [...new Set(validos)] : null;
};

/** Inclui o outro lado das transferências escolhidas. */
async function comPares(tx: Transacao, ids: number[]) {
  const linhas = await tx.select({ transferenciaId: l.transferenciaId }).from(l).where(inArray(l.id, ids));
  const grupos = linhas.map((x) => x.transferenciaId).filter((x): x is number => x !== null);
  if (!grupos.length) return ids;
  const pares = await tx.select({ id: l.id }).from(l).where(inArray(l.transferenciaId, grupos));
  return [...new Set([...ids, ...pares.map((p) => p.id)])];
}

/** Valor pago diferente do lançamento (só quando um lançamento é pago sozinho). */
export type PagamentoValor = { valorPago: string; gerarRestante: boolean; vencimentoRestante: string };

export async function realizarLancamentos(ids: number[], dataPagamento: string, ocorrencias: Ocorrencia[] = [], valor?: PagamentoValor | null): Promise<Resultado> {
  await exigirLogin();
  const validos = Array.isArray(ids) && ids.length === 0 ? [] : lerIds(ids);
  const previstas = lerOcorrencias(ocorrencias);
  if (!validos || !previstas || validos.length + previstas.length === 0) return falha("Selecione pelo menos um lançamento.");
  if (!dataValida(dataPagamento)) return falha("Informe uma data válida no campo **Data do Pagamento**.");
  if (valor && validos.length + previstas.length !== 1) return falha("O **Valor Pago** só pode ser alterado quando um lançamento é pago sozinho.");
  try {
    return await getDb().transaction(async (tx) => {
      let unico: number | null = validos.length === 1 && !previstas.length ? validos[0] : null;
      // Recorrentes previstos: gravados já pagos (no cartão, a compra vai para a fatura).
      for (const o of previstas) {
        const regra = await conferirOcorrencia(tx, o.recorrenciaId, o.data);
        const novos = await gravarOcorrencia(tx, regra, o.data, dataPagamento);
        if (previstas.length === 1 && !validos.length) unico = novos[0];
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novos[0], acao: "cadastrou", descricao: `o Lançamento ${regra.descricao} (recorrente${regra.cartaoId ? "" : ", já pago"})`, dados: { ...o, dataPagamento } });
      }
      if (validos.length) {
        const todos = await comPares(tx, validos);
        const alvo = await tx.select().from(l).where(and(inArray(l.id, todos), isNull(l.cartaoId), isNull(l.dataPagamento)));
        const cartao = await tx.select({ id: l.id }).from(l).where(and(inArray(l.id, validos), sql`${l.cartaoId} is not null`));
        if (!alvo.length && !previstas.length) {
          return falha(cartao.length ? "Compras no cartão são pagas junto com a fatura: use **Pagar fatura** na linha Fatura-Cartão." : "Os lançamentos escolhidos já estão pagos ou recebidos.");
        }
        for (const x of alvo) {
          await tx.update(l).set({ dataPagamento, valorPagoCentavos: x.valorCentavos }).where(eq(l.id, x.id));
          await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: x.id, acao: "alterou", descricao: `a baixa do Lançamento ${x.descricao}`, dados: { dataPagamento: { antes: null, depois: dataPagamento } } });
        }
      }
      if (valor && unico !== null) await aplicarValorPago(tx, unico, valor);
      refresh();
      return { ok: true as const };
    });
  } catch (e) {
    if (e instanceof ErroFormulario || e instanceof ErroValidacao) return falha(e.message);
    throw e;
  }
}

export async function estornarLancamentos(ids: number[]): Promise<Resultado> {
  await exigirLogin();
  const validos = lerIds(ids);
  if (!validos) return falha("Selecione pelo menos um lançamento.");
  return getDb().transaction(async (tx) => {
    const todos = await comPares(tx, validos);
    const alvo = await tx
      .select()
      .from(l)
      .where(and(inArray(l.id, todos), isNull(l.cartaoId), ne(l.tipo, "saldo_inicial"), ne(l.tipo, "pagamento_fatura"), sql`${l.dataPagamento} is not null`));
    if (!alvo.length) return falha("Nenhum dos lançamentos escolhidos pode voltar para não pago.");
    // Pagamento parcial: o restante (e o restante do restante) volta para dentro do lançamento.
    const idsAlvo = new Set(alvo.map((x) => x.id));
    const restantes = new Map<number, (typeof alvo)[number][]>();
    for (const x of alvo) {
      if (x.valorOriginalCentavos === null) continue;
      const lista: (typeof alvo)[number][] = [];
      let fronteira = [x.id];
      while (fronteira.length) {
        const filhos = await tx.select().from(l).where(inArray(l.lancamentoOrigemId, fronteira));
        lista.push(...filhos);
        fronteira = filhos.map((f) => f.id);
      }
      const pagoFora = lista.find((f) => f.dataPagamento && !idsAlvo.has(f.id));
      if (pagoFora) {
        return falha(`O restante **${pagoFora.descricao}** (${formatarData(pagoFora.dataVencimento)}) já foi pago. Volte ele para não pago antes, ou escolha os dois juntos.`);
      }
      restantes.set(x.id, lista);
    }
    const apagados = new Set<number>();
    for (const x of alvo) {
      if (apagados.has(x.id)) continue;
      const lista = (restantes.get(x.id) ?? []).filter((f) => !apagados.has(f.id));
      if (lista.length) {
        for (const f of lista) apagados.add(f.id);
        await tx.delete(l).where(inArray(l.id, lista.map((f) => f.id)));
        for (const f of lista) {
          await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: f.id, acao: "excluiu", descricao: `o restante ${f.descricao} (o pagamento parcial foi desfeito)`, dados: f });
        }
      }
      const valorCentavos = x.valorOriginalCentavos ?? x.valorCentavos;
      await tx.update(l).set({ dataPagamento: null, valorPagoCentavos: null, valorCentavos, valorOriginalCentavos: null }).where(eq(l.id, x.id));
      await registrarAuditoria(tx, {
        tela: TELA,
        entidade: ENTIDADE,
        entidadeId: x.id,
        acao: "alterou",
        descricao: `o estorno do Lançamento ${x.descricao}`,
        dados: { dataPagamento: { antes: x.dataPagamento, depois: null }, ...(valorCentavos !== x.valorCentavos ? { valor: { antes: x.valorCentavos, depois: valorCentavos } } : {}) },
      });
    }
    refresh();
    return { ok: true as const };
  });
}

/**
 * Pagou ou recebeu um valor diferente do lançamento (já com a baixa dada).
 * O lançamento passa a valer o que foi pago; no pagamento parcial, o que falta vira um novo lançamento
 * ("restante"), ainda não pago, ligado ao original.
 */
async function aplicarValorPago(tx: Transacao, id: number, v: PagamentoValor) {
  const [x] = await tx.select().from(l).where(eq(l.id, id)).for("update");
  if (!x || !x.dataPagamento) return;
  if (x.cartaoId) erro("Compras no cartão são pagas junto com a fatura, pelo valor da compra.");
  if (x.transferenciaId) erro("Transferências são feitas pelo valor total. Para mudar o valor, edite a transferência.");
  if (x.tipo !== "receita" && x.tipo !== "despesa") erro("Este lançamento só pode ser pago pelo valor total.");
  if (x.formato === "detalhado") erro("Lançamentos detalhados são pagos pelo valor total (a soma dos itens). Para pagar outro valor, ajuste os itens.");
  const pago = lerValor(v.valorPago, "Valor Pago");
  // Parâmetros > Lançamentos > Pagamento Parcial desligado: o que faltar vira desconto.
  const parcialLigado = (await lerParametros()).pagamentoParcial;
  const r = calcularPagamento(x.valorCentavos, pago, parcialLigado && !!v.gerarRestante);
  if (r.tipo === "integral") return;
  const vencimento = r.tipo === "parcial" ? lerData(v.vencimentoRestante, "Vencimento do Restante")! : null;
  await tx.update(l).set({ valorCentavos: r.valorCentavos, valorPagoCentavos: r.valorCentavos, valorOriginalCentavos: x.valorCentavos }).where(eq(l.id, x.id));
  const recebido = x.tipo === "receita" ? "recebido" : "pago";
  const explicacao =
    r.tipo === "parcial"
      ? `${recebido} em parte: ${formatarCentavos(pago)} de ${formatarCentavos(x.valorCentavos)}`
      : r.tipo === "desconto"
        ? `${recebido} com desconto de ${formatarCentavos(r.diferencaCentavos)}`
        : `${recebido} com acréscimo (juros ou multa) de ${formatarCentavos(r.diferencaCentavos)}`;
  await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: x.id, acao: "alterou", descricao: `o valor do Lançamento ${x.descricao} (${explicacao})`, dados: { valor: { antes: x.valorCentavos, depois: r.valorCentavos } } });
  if (r.tipo !== "parcial") return;
  const tags = await tx.select({ tagId: lancamentoTag.tagId }).from(lancamentoTag).where(eq(lancamentoTag.lancamentoId, x.id));
  const restante: Linha = {
    tipo: x.tipo,
    formato: "simples",
    descricao: x.descricao,
    documento: x.documento,
    observacao: x.observacao,
    valorCentavos: r.restanteCentavos,
    dataVencimento: vencimento!,
    dataReferencia: x.dataReferencia,
    contaId: x.contaId,
    categoriaId: x.categoriaId,
    formaPagamentoId: x.formaPagamentoId,
    contatoId: x.contatoId,
    lancamentoOrigemId: x.id,
    origem: "manual",
  };
  const novo = await inserirLancamento(tx, restante, tags.map((t) => t.tagId), []);
  await registrarAuditoria(tx, {
    tela: TELA,
    entidade: ENTIDADE,
    entidadeId: novo.id,
    acao: "cadastrou",
    descricao: `o restante ${novo.descricao} (${formatarCentavos(r.restanteCentavos)}, vence em ${formatarData(vencimento!)})`,
    dados: restante,
  });
}

/** Exclui lançamentos. "proximas" = esta parcela e as seguintes do mesmo parcelamento. */
export async function excluirLancamentos(ids: number[], parcelas: "esta" | "proximas" | "todas" = "esta"): Promise<Resultado> {
  await exigirLogin();
  const validos = lerIds(ids);
  if (!validos) return falha("Selecione pelo menos um lançamento.");
  return getDb().transaction(async (tx) => {
    let todos = await comPares(tx, validos);
    if (parcelas !== "esta") {
      const escolhidos = await tx.select({ parcelamentoId: l.parcelamentoId, parcelaNumero: l.parcelaNumero }).from(l).where(inArray(l.id, todos));
      for (const e of escolhidos) {
        if (!e.parcelamentoId) continue;
        const mais = await tx
          .select({ id: l.id })
          .from(l)
          .where(and(eq(l.parcelamentoId, e.parcelamentoId), parcelas === "proximas" ? sql`${l.parcelaNumero} >= ${e.parcelaNumero}` : undefined));
        todos = [...new Set([...todos, ...mais.map((m) => m.id)])];
      }
    }
    const alvo = await tx.select().from(l).where(inArray(l.id, todos));
    if (alvo.some((x) => x.tipo === "pagamento_fatura")) return falha(PAGAMENTO_FATURA);
    if (alvo.some((x) => x.cartaoId && x.dataPagamento)) {
      return falha("Há compras já pagas junto com a fatura na seleção. Para excluir, desfaça antes o pagamento da fatura (em Cadastros > Cartões de Crédito > Faturas).");
    }
    const saldoInicial = alvo.filter((x) => x.tipo === "saldo_inicial");
    const apagar = alvo.filter((x) => x.tipo !== "saldo_inicial");
    if (!apagar.length) return falha(saldoInicial.length ? "O Saldo Inicial é alterado no cadastro da Conta Financeira." : "Lançamento não encontrado.");
    for (const x of apagar) {
      const [tags, itens] = await Promise.all([
        tx.select({ tagId: lancamentoTag.tagId }).from(lancamentoTag).where(eq(lancamentoTag.lancamentoId, x.id)),
        tx.select().from(item).where(eq(item.lancamentoId, x.id)),
      ]);
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: x.id, acao: "excluiu", descricao: `o Lançamento ${x.descricao}`, dados: { ...x, tags: tags.map((t) => t.tagId), itens } });
    }
    // Ocorrência de recorrente excluída não volta a aparecer como prevista.
    const deRecorrente = apagar.filter((x) => x.recorrenciaId && x.dataOcorrencia);
    if (deRecorrente.length) {
      await tx
        .insert(recorrenciaExcecao)
        .values(deRecorrente.map((x) => ({ recorrenciaId: x.recorrenciaId!, dataOcorrencia: x.dataOcorrencia!, motivo: "Lançamento excluído" })))
        .onConflictDoNothing();
    }
    await tx.delete(l).where(inArray(l.id, apagar.map((x) => x.id)));
    // Transferências e parcelamentos que ficaram vazios.
    await tx.execute(sql`delete from ${transferencia} t where not exists (select 1 from ${l} where ${l.transferenciaId} = t.id)`);
    await tx.execute(sql`delete from ${parcelamento} p where not exists (select 1 from ${l} where ${l.parcelamentoId} = p.id)`);
    refresh();
    return { ok: true as const };
  });
}

export async function excluirAnexo(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Anexo não encontrado.");
  return getDb().transaction(async (tx) => {
    const [x] = await tx.delete(anexo).where(eq(anexo.id, id)).returning({ id: anexo.id, nomeArquivo: anexo.nomeArquivo, lancamentoId: anexo.lancamentoId });
    if (!x) return falha("Este anexo não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: "Anexo", entidadeId: x.id, acao: "excluiu", descricao: `o anexo ${x.nomeArquivo}`, dados: x });
    refresh();
    return { ok: true as const };
  });
}
