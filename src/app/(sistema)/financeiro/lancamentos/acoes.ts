"use server";

import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { dataValida } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { faturaDaCompra, gerarParcelas, PERIODICIDADES, totalDetalhado, type Periodicidade, type TipoLancamento } from "@/lib/lancamentos/regras";
import type { DadosLancamento, LancamentoEdicao } from "@/lib/lancamentos/tipos";
import { exigirLogin } from "@/lib/sessao";

const { lancamento: l, lancamentoItem: item, lancamentoTag, contaFinanceira: conta, cartaoCredito: cartao, categoria, fatura, parcelamento, transferencia, anexo, formaPagamento, contato, tag } = schema;
const TELA = "Lançamentos";
const ENTIDADE = "Lançamento";
const MAXIMO_CENTAVOS = 99_999_999_999;
const MAXIMO_PARCELAS = 360;

type Linha = typeof l.$inferInsert;

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

/** Fatura em que a compra cai (cria a fatura se ainda não existir). */
async function garantirFatura(tx: Transacao, cartaoId: number, dataCompra: string) {
  const [c] = await tx.select({ diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento }).from(cartao).where(eq(cartao.id, cartaoId));
  const f = faturaDaCompra(dataCompra, c.diaFechamento, c.diaVencimento);
  await tx.insert(fatura).values({ cartaoId, ...f }).onConflictDoNothing();
  const [linha] = await tx
    .select({ id: fatura.id, dataVencimento: fatura.dataVencimento })
    .from(fatura)
    .where(and(eq(fatura.cartaoId, cartaoId), eq(fatura.competencia, f.competencia)));
  return linha;
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

/** Grava um lançamento de conta ou cartão (com tags e itens). */
async function inserir(tx: Transacao, linha: Linha, tagIds: number[], itens: Omit<typeof item.$inferInsert, "lancamentoId">[]) {
  if (linha.cartaoId) {
    const dataCompra = linha.dataCompra ?? linha.dataVencimento;
    const f = await garantirFatura(tx, linha.cartaoId, dataCompra);
    linha = { ...linha, dataCompra, dataVencimento: f.dataVencimento, faturaId: f.id, dataPagamento: null, valorPagoCentavos: null, realizarAutomaticamente: false };
  }
  const [novo] = await tx.insert(l).values(linha).returning();
  if (tagIds.length) await tx.insert(lancamentoTag).values(tagIds.map((tagId) => ({ lancamentoId: novo.id, tagId })));
  if (itens.length) await tx.insert(item).values(itens.map((i) => ({ ...i, lancamentoId: novo.id })));
  return novo;
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
    if (e instanceof ErroFormulario) return falha(e.message);
    throw e;
  }
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
    if (d.parcelar) return criarParcelas(tx, base, d, tagIds, itens);
    const novo = await inserir(tx, base, tagIds, itens);
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novo.id, acao: "cadastrou", descricao: `o Lançamento ${novo.descricao}`, dados: { ...base, tagIds, itens } });
    return { ok: true as const, id: novo.id, ids: [novo.id] };
  }

  const [antes] = await tx.select().from(l).where(eq(l.id, id)).for("update");
  if (!antes) erro("Este lançamento não existe mais.");
  if (antes.tipo === "saldo_inicial") erro("O Saldo Inicial é alterado no cadastro da Conta Financeira.");
  if (antes.transferenciaId) erro("Este lançamento é uma transferência: edite pela aba **Transferência**.");
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
    const f = await garantirFatura(tx, base.cartaoId, data);
    Object.assign(base, { dataVencimento: f.dataVencimento, faturaId: f.id, realizarAutomaticamente: false });
    if (!antes.cartaoId) Object.assign(base, { dataPagamento: null, valorPagoCentavos: null });
  } else {
    base.faturaId = null;
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
    const novo = await inserir(
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
    const [grupo] = await tx.insert(transferencia).values({}).returning();
    const saida = await inserir(tx, { ...linha("transferencia_saida", origemId!), transferenciaId: grupo.id }, tagIds, []);
    const entrada = await inserir(tx, { ...linha("transferencia_entrada", destinoId!), transferenciaId: grupo.id }, tagIds, []);
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
  if (!x) return null;
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

export async function realizarLancamentos(ids: number[], dataPagamento: string): Promise<Resultado> {
  await exigirLogin();
  const validos = lerIds(ids);
  if (!validos) return falha("Selecione pelo menos um lançamento.");
  if (!dataValida(dataPagamento)) return falha("Informe uma data válida no campo **Data do Pagamento**.");
  return getDb().transaction(async (tx) => {
    const todos = await comPares(tx, validos);
    const alvo = await tx.select().from(l).where(and(inArray(l.id, todos), isNull(l.cartaoId), isNull(l.dataPagamento)));
    const cartao = await tx.select({ id: l.id }).from(l).where(and(inArray(l.id, validos), sql`${l.cartaoId} is not null`));
    if (!alvo.length) {
      return falha(cartao.length ? "Compras no cartão são pagas junto com a fatura (chega na Fase 5)." : "Os lançamentos escolhidos já estão pagos ou recebidos.");
    }
    for (const x of alvo) {
      await tx.update(l).set({ dataPagamento, valorPagoCentavos: x.valorCentavos }).where(eq(l.id, x.id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: x.id, acao: "alterou", descricao: `a baixa do Lançamento ${x.descricao}`, dados: { dataPagamento: { antes: null, depois: dataPagamento } } });
    }
    refresh();
    return { ok: true as const };
  });
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
      .where(and(inArray(l.id, todos), isNull(l.cartaoId), ne(l.tipo, "saldo_inicial"), sql`${l.dataPagamento} is not null`));
    if (!alvo.length) return falha("Nenhum dos lançamentos escolhidos pode voltar para não pago.");
    for (const x of alvo) {
      await tx.update(l).set({ dataPagamento: null, valorPagoCentavos: null }).where(eq(l.id, x.id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: x.id, acao: "alterou", descricao: `o estorno do Lançamento ${x.descricao}`, dados: { dataPagamento: { antes: x.dataPagamento, depois: null } } });
    }
    refresh();
    return { ok: true as const };
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
