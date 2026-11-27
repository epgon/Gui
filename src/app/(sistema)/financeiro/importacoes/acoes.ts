"use server";

import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { contemTexto } from "@/lib/cadastros/filtros";
import { formatarData } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { aplicarConfiguracao, conferirConfiguracao } from "@/lib/importacao/csv";
import { lerFaturaBb } from "@/lib/importacao/fatura-bb";
import { ErroArquivo, lerOfx } from "@/lib/importacao/ofx";
import { CAMPOS_CONDICAO, OPERADORES } from "@/lib/importacao/regras";
import { ErroImportacao, erro, gravarLinhas, processarLinhas, type Importacao, type LinhaImportacao } from "@/lib/importacao/servidor";
import type { CamposLinha, Candidato, Condicao, ConfiguracaoCsv, DadosDestino, DadosRegra } from "@/lib/importacao/tipos";
import { inserirLancamento } from "@/lib/lancamentos/gravacao";
import { somarDias } from "@/lib/lancamentos/regras";
import { conferirOcorrencia, gravarOcorrencia } from "@/lib/recorrentes/servidor";
import { ErroValidacao } from "@/lib/recorrentes/validacao";
import { exigirLogin } from "@/lib/sessao";

const {
  importacao,
  importacaoLinha: linha,
  mapeamentoCsv,
  regraImportacao,
  lancamento: l,
  contaFinanceira: conta,
  cartaoCredito: cartao,
  categoria,
  contato,
  formaPagamento,
  tag,
  transferencia,
} = schema;
const TELA = "Importações";

type R<T = object> = Resultado & Partial<T>;

/** Roda a ação numa transação e transforma os erros de validação em mensagem para a faixa amarela. */
async function executar<T extends object>(acao: (tx: Transacao) => Promise<T>): Promise<R<T>> {
  await exigirLogin();
  try {
    const r = await getDb().transaction(acao);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroImportacao || e instanceof ErroValidacao || e instanceof ErroArquivo) return falha(e.message);
    throw e;
  }
}

const lerId = (x: unknown) => {
  const n = Number(x);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const lerIds = (ids: unknown): number[] => {
  if (!Array.isArray(ids) || !ids.length || ids.length > 2000) erro("Selecione pelo menos uma linha.");
  const validos = (ids as unknown[]).map(lerId);
  if (validos.some((x) => x === null)) erro("Selecione pelo menos uma linha.");
  return [...new Set(validos as number[])];
};

/** Importação em rascunho, travada até o fim da transação. */
async function rascunho(tx: Transacao, id: number): Promise<Importacao> {
  if (!idValido.safeParse(id).success) erro("Importação não encontrada.");
  const [imp] = await tx.select().from(importacao).where(eq(importacao.id, id)).for("update");
  if (!imp) erro("Esta importação não existe mais.");
  if (imp.situacao !== "rascunho") erro("Esta importação já foi concluída e não pode mais ser alterada.");
  return imp;
}

async function linhasDa(tx: Transacao, imp: Importacao, ids: number[]) {
  const achadas = await tx.select().from(linha).where(and(eq(linha.importacaoId, imp.id), inArray(linha.id, ids))).orderBy(linha.numeroLinha);
  if (!achadas.length) erro("Linha não encontrada. Atualize a página.");
  return achadas;
}

const rotuloLinha = (x: LinhaImportacao) => `linha ${x.numeroLinha} (${x.descricao.slice(0, 40)}, ${formatarCentavos(x.valorCentavos)})`;

// ---------------------------------------------------------------------------
// Passo 2: destino e checagem
// ---------------------------------------------------------------------------

export async function definirDestino(id: number, d: DadosDestino): Promise<R<{ etapa: string }>> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    await semAcoesFeitas(tx, imp);
    const m = /^(conta|cartao):(\d+)$/.exec(d?.destino ?? "");
    if (!m) erro("Selecione a **Conta ou Cartão** que recebe os lançamentos.");
    const destinoId = Number(m![2]);
    const tabela = m![1] === "conta" ? conta : cartao;
    const [existe] = await tx.select({ id: tabela.id }).from(tabela).where(eq(tabela.id, destinoId));
    if (!existe) erro("Selecione a **Conta ou Cartão** que recebe os lançamentos.");
    const tolerancia = Number(d.toleranciaDias);
    if (!Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 30) erro("Informe de 0 a 30 dias no campo **Tolerância da data**.");
    const eConta = m![1] === "conta";
    if (eConta && imp.formato === "pdf") erro("A fatura em PDF é de cartão de crédito: escolha o **cartão** que recebe os lançamentos.");
    const valores = {
      contaId: eConta ? destinoId : null,
      cartaoId: eConta ? null : destinoId,
      toleranciaDias: tolerancia,
      qualquerConta: eConta && !!d.qualquerConta,
      contatoPessoa: d.contatoPessoa === "fisica" ? ("fisica" as const) : ("juridica" as const),
      contatoCliente: !!d.contatoCliente,
      contatoFornecedor: !!d.contatoFornecedor,
    };
    const [atual] = await tx.update(importacao).set(valores).where(eq(importacao.id, id)).returning();
    if (atual.formato === "csv") {
      await tx.delete(linha).where(eq(linha.importacaoId, id));
      await tx.update(importacao).set({ etapa: "vinculo" }).where(eq(importacao.id, id));
      return { etapa: "vinculo" };
    }
    const { transacoes, puladas } = atual.formato === "pdf" ? lerFaturaBb(atual.conteudo) : lerOfx(atual.conteudo);
    await gravarLinhas(tx, atual, transacoes);
    await tx.update(importacao).set({ etapa: "revisao", linhasPuladas: puladas }).where(eq(importacao.id, id));
    return { etapa: "revisao" };
  });
}

/** Não dá para voltar etapas depois de adicionar ou conciliar linhas (seria preciso desfazer antes). */
async function semAcoesFeitas(tx: Transacao, imp: Importacao) {
  const [feita] = await tx
    .select({ id: linha.id })
    .from(linha)
    .where(and(eq(linha.importacaoId, imp.id), inArray(linha.status, ["adicionado", "conciliado"])))
    .limit(1);
  if (feita) erro("Algumas linhas já foram adicionadas ou conciliadas. Para voltar, use **Desfazer** nelas antes.");
}

// ---------------------------------------------------------------------------
// Passo 3 (CSV): vínculos das colunas
// ---------------------------------------------------------------------------

function lerConfiguracao(c: ConfiguracaoCsv): ConfiguracaoCsv {
  const coluna = (x: unknown) => (x === null || x === undefined || x === "" ? null : Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) < 200 ? Number(x) : null);
  const colunas = c?.colunas ?? ({} as ConfiguracaoCsv["colunas"]);
  return {
    separador: c?.separador === "," ? "," : c?.separador === "\t" ? "\t" : ";",
    decimal: c?.decimal === "ponto" ? "ponto" : "virgula",
    formatoData: c?.formatoData === "mm/dd/aaaa" ? "mm/dd/aaaa" : c?.formatoData === "aaaa-mm-dd" ? "aaaa-mm-dd" : "dd/mm/aaaa",
    temCabecalho: !!c?.temCabecalho,
    inverterSinal: !!c?.inverterSinal,
    colunas: {
      data: coluna(colunas.data),
      descricao: coluna(colunas.descricao),
      valor: coluna(colunas.valor),
      valorDebito: coluna(colunas.valorDebito),
      valorCredito: coluna(colunas.valorCredito),
      tipo: coluna(colunas.tipo),
      documento: coluna(colunas.documento),
      contato: coluna(colunas.contato),
      categoria: coluna(colunas.categoria),
    },
  };
}

export async function salvarVinculos(id: number, dados: ConfiguracaoCsv): Promise<R<{ puladas: number }>> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    if (imp.formato !== "csv" || (!imp.contaId && !imp.cartaoId)) erro("Escolha antes a conta ou o cartão.");
    await semAcoesFeitas(tx, imp);
    const cfg = lerConfiguracao(dados);
    const problema = conferirConfiguracao(cfg);
    if (problema) erro(problema);
    const { transacoes, puladas } = aplicarConfiguracao(imp.conteudo, cfg);
    if (!transacoes.length) erro("Nenhuma linha do arquivo tem data e valor válidos com esses vínculos. Confira as colunas de **Data** e **Valor**, o formato da data e o separador decimal.");
    if (transacoes.length > 5000) erro("O arquivo tem mais de 5.000 linhas. Baixe um período menor no banco.");
    // Memoriza os vínculos para o próximo arquivo desta conta ou cartão.
    const onde = imp.contaId ? eq(mapeamentoCsv.contaId, imp.contaId) : eq(mapeamentoCsv.cartaoId, imp.cartaoId!);
    const [existente] = await tx.select({ id: mapeamentoCsv.id }).from(mapeamentoCsv).where(onde).limit(1);
    const destinoNome = imp.contaId
      ? (await tx.select({ d: conta.descricao }).from(conta).where(eq(conta.id, imp.contaId)))[0]?.d
      : (await tx.select({ d: cartao.descricao }).from(cartao).where(eq(cartao.id, imp.cartaoId!)))[0]?.d;
    let mapeamentoId = existente?.id;
    if (existente) await tx.update(mapeamentoCsv).set({ configuracao: cfg }).where(eq(mapeamentoCsv.id, existente.id));
    else [{ id: mapeamentoId }] = await tx.insert(mapeamentoCsv).values({ nome: `Extrato ${destinoNome ?? ""}`.trim(), contaId: imp.contaId, cartaoId: imp.cartaoId, configuracao: cfg }).returning({ id: mapeamentoCsv.id });
    const [atual] = await tx.update(importacao).set({ mapeamentoId, etapa: "revisao", linhasPuladas: puladas }).where(eq(importacao.id, id)).returning();
    await gravarLinhas(tx, atual, transacoes);
    return { puladas };
  });
}

export async function voltarEtapa(id: number, etapa: "destino" | "vinculo"): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    await semAcoesFeitas(tx, imp);
    if (etapa === "vinculo" && imp.formato !== "csv") erro("Só arquivos CSV têm vínculo de colunas.");
    await tx.delete(linha).where(eq(linha.importacaoId, id));
    await tx.update(importacao).set({ etapa: etapa === "vinculo" ? "vinculo" : "destino" }).where(eq(importacao.id, id));
    return {};
  });
}

// ---------------------------------------------------------------------------
// Revisão: adicionar, conciliar, ignorar, editar e desfazer
// ---------------------------------------------------------------------------

/** Cria o lançamento da linha (já pago na conta; no cartão, a compra vai para a fatura). */
async function adicionar(tx: Transacao, imp: Importacao, x: LinhaImportacao) {
  if (!["novo", "encontrado", "pendente"].includes(x.status)) erro(`A ${rotuloLinha(x)} já foi resolvida.`);
  const campos = x.campos as CamposLinha;
  const categoriaId = lerId(campos.categoriaId);
  if (!categoriaId) erro(`Escolha a **Categoria** da ${rotuloLinha(x)}.`);
  const [cat] = await tx.select({ natureza: categoria.natureza, especial: categoria.especial }).from(categoria).where(eq(categoria.id, categoriaId!));
  if (!cat || cat.especial) erro(`Escolha a **Categoria** da ${rotuloLinha(x)}.`);
  if (cat!.natureza !== x.tipo) erro(`A categoria da ${rotuloLinha(x)} é de ${cat!.natureza}, mas a linha é ${x.tipo === "receita" ? "uma entrada" : "uma saída"}. Escolha outra **Categoria**.`);

  let contatoId = lerId(campos.contatoId);
  if (contatoId && !(await tx.select({ id: contato.id }).from(contato).where(eq(contato.id, contatoId))).length) contatoId = null;
  if (!contatoId && campos.contatoNome?.trim()) {
    const nome = campos.contatoNome.trim().slice(0, 120);
    const [mesmo] = await tx.select({ id: contato.id }).from(contato).where(sql`lower(${contato.nome}) = lower(${nome})`).limit(1);
    if (mesmo) contatoId = mesmo.id;
    else {
      const [novo] = await tx.insert(contato).values({ nome, pessoa: imp.contatoPessoa, eCliente: imp.contatoCliente, eFornecedor: imp.contatoFornecedor }).returning();
      contatoId = novo.id;
      await registrarAuditoria(tx, { tela: TELA, entidade: "Cliente ou Fornecedor", entidadeId: novo.id, acao: "cadastrou", descricao: `o Cliente ou Fornecedor ${nome} (importação)`, dados: novo });
    }
  }
  let formaPagamentoId = lerId(campos.formaPagamentoId);
  if (formaPagamentoId && !(await tx.select({ id: formaPagamento.id }).from(formaPagamento).where(eq(formaPagamento.id, formaPagamentoId))).length) formaPagamentoId = null;
  const pedidas = [...new Set((campos.tagIds ?? []).map(lerId).filter((t): t is number => t !== null))];
  const tagIds = pedidas.length ? (await tx.select({ id: tag.id }).from(tag).where(inArray(tag.id, pedidas))).map((t) => t.id) : [];

  const naConta = imp.contaId !== null;
  const base = {
    tipo: x.tipo,
    formato: "simples" as const,
    descricao: (campos.descricao?.trim() || x.descricao).slice(0, 120),
    documento: x.documento?.slice(0, 60) ?? null,
    valorCentavos: x.valorCentavos,
    valorPagoCentavos: naConta ? x.valorCentavos : null,
    dataVencimento: x.data,
    dataPagamento: naConta ? x.data : null,
    dataCompra: naConta ? null : x.data,
    contaId: imp.contaId,
    cartaoId: imp.cartaoId,
    categoriaId,
    contatoId,
    formaPagamentoId,
    origem: "importacao" as const,
  };
  const novo = await inserirLancamento(tx, base, tagIds, []);
  await tx.update(linha).set({ status: "adicionado", lancamentoId: novo.id, conciliacaoAntes: null }).where(eq(linha.id, x.id));
  await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: novo.id, acao: "cadastrou", descricao: `o Lançamento ${novo.descricao} (importação)`, dados: { ...base, tagIds, importacaoId: imp.id, linha: x.numeroLinha } });
  return novo.id;
}

type Antes = { criados?: number[]; lancamentos?: { id: number; dataPagamento: string | null; valorPagoCentavos: number | null; contaId: number | null }[] };

/** Marca o lançamento do sistema como realizado com a data e o valor do extrato (ou grava o recorrente previsto). */
async function conciliarCom(tx: Transacao, imp: Importacao, x: LinhaImportacao, chave: string) {
  if (!["novo", "encontrado", "pendente"].includes(x.status)) erro(`A ${rotuloLinha(x)} já foi resolvida.`);
  const ocorrencia = /^r:(\d+):(\d{4}-\d{2}-\d{2})$/.exec(chave ?? "");
  const gravado = /^l:(\d+)$/.exec(chave ?? "");
  let lancamentoId: number;
  let antes: Antes;
  let descricao: string;

  if (ocorrencia) {
    const regra = await conferirOcorrencia(tx, Number(ocorrencia[1]), ocorrencia[2]);
    const ids = await gravarOcorrencia(tx, regra, ocorrencia[2], imp.contaId ? x.data : null);
    const pernas = await tx.select().from(l).where(inArray(l.id, ids));
    const daqui = pernas.find((p) => (imp.contaId ? p.contaId === imp.contaId : p.cartaoId === imp.cartaoId)) ?? pernas[0];
    // O valor que saiu de fato é o do extrato.
    if (daqui.dataPagamento) await tx.update(l).set({ valorPagoCentavos: x.valorCentavos }).where(eq(l.id, daqui.id));
    lancamentoId = daqui.id;
    antes = { criados: ids };
    descricao = daqui.descricao;
  } else if (gravado) {
    const id = Number(gravado[1]);
    const [alvo] = await tx.select().from(l).where(eq(l.id, id)).for("update");
    if (!alvo) erro("Este lançamento não existe mais. Atualize a página.");
    const [jaUsado] = await tx
      .select({ id: linha.id })
      .from(linha)
      .innerJoin(importacao, eq(importacao.id, linha.importacaoId))
      .where(and(eq(linha.lancamentoId, id), inArray(linha.status, ["adicionado", "conciliado"]), ne(importacao.situacao, "cancelada")))
      .limit(1);
    if (jaUsado) erro("Este lançamento já foi conciliado com outra linha de extrato.");
    const sentido = alvo!.tipo === "receita" || alvo!.tipo === "transferencia_entrada" ? "receita" : "despesa";
    if (sentido !== x.tipo) erro(`O lançamento escolhido é ${sentido === "receita" ? "uma entrada" : "uma saída"}, e a linha do extrato não.`);
    if (["saldo_inicial", "acerto_saldo"].includes(alvo!.tipo)) erro("O Saldo Inicial não pode ser conciliado.");
    const grupo = alvo!.transferenciaId ? await tx.select().from(l).where(eq(l.transferenciaId, alvo!.transferenciaId)).for("update") : [alvo!];
    antes = { lancamentos: grupo.map((g) => ({ id: g.id, dataPagamento: g.dataPagamento, valorPagoCentavos: g.valorPagoCentavos, contaId: g.contaId })) };
    for (const g of grupo) {
      // Compras no cartão são pagas com a fatura: só ficam ligadas à linha.
      if (g.cartaoId || g.tipo === "pagamento_fatura") continue;
      const mudancas: Partial<typeof l.$inferInsert> = {};
      if (g.id === alvo!.id) {
        if (!g.dataPagamento || g.dataPagamento !== x.data || (g.valorPagoCentavos ?? g.valorCentavos) !== x.valorCentavos) Object.assign(mudancas, { dataPagamento: x.data, valorPagoCentavos: x.valorCentavos });
        // Checagem "qualquer conta": o extrato diz em que conta o dinheiro mexeu.
        if (imp.contaId && g.contaId !== imp.contaId && !g.transferenciaId) mudancas.contaId = imp.contaId;
      } else if (!g.dataPagamento) {
        Object.assign(mudancas, { dataPagamento: x.data, valorPagoCentavos: g.valorCentavos });
      }
      if (Object.keys(mudancas).length) await tx.update(l).set(mudancas).where(eq(l.id, g.id));
    }
    lancamentoId = id;
    descricao = alvo!.descricao;
  } else {
    return erro("Escolha o lançamento para conciliar.");
  }
  await tx.update(linha).set({ status: "conciliado", lancamentoId, conciliacaoAntes: antes }).where(eq(linha.id, x.id));
  await registrarAuditoria(tx, {
    tela: TELA,
    entidade: "Lançamento",
    entidadeId: lancamentoId,
    acao: "alterou",
    descricao: `a conciliação do Lançamento ${descricao} com o extrato (${formatarData(x.data)})`,
    dados: { importacaoId: imp.id, linha: x.numeroLinha, data: x.data, valorCentavos: x.valorCentavos, antes },
  });
}

/** Volta a linha para antes de adicionar, conciliar ou ignorar. */
async function desfazer(tx: Transacao, imp: Importacao, x: LinhaImportacao) {
  if (x.status === "adicionado" && x.lancamentoId) {
    const [lanc] = await tx.select().from(l).where(eq(l.id, x.lancamentoId)).for("update");
    if (lanc) {
      if (lanc.cartaoId && lanc.dataPagamento) erro(`A compra da ${rotuloLinha(x)} já foi paga junto com a fatura. Desfaça antes o pagamento da fatura.`);
      await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: lanc.id, acao: "excluiu", descricao: `o Lançamento ${lanc.descricao} (desfeito na importação)`, dados: lanc });
      await tx.delete(l).where(eq(l.id, lanc.id));
    }
  } else if (x.status === "conciliado") {
    const antes = (x.conciliacaoAntes ?? {}) as Antes;
    if (antes.criados?.length) {
      const criados = await tx.select().from(l).where(inArray(l.id, antes.criados));
      if (criados.some((c) => c.cartaoId && c.dataPagamento)) erro(`A compra da ${rotuloLinha(x)} já foi paga junto com a fatura. Desfaça antes o pagamento da fatura.`);
      for (const c of criados) await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: c.id, acao: "excluiu", descricao: `o Lançamento ${c.descricao} (conciliação desfeita)`, dados: c });
      // A ocorrência volta a aparecer como prevista.
      await tx.delete(l).where(inArray(l.id, antes.criados));
      await tx.execute(sql`delete from ${transferencia} t where not exists (select 1 from ${l} where ${l.transferenciaId} = t.id)`);
    }
    for (const a of antes.lancamentos ?? []) {
      await tx.update(l).set({ dataPagamento: a.dataPagamento, valorPagoCentavos: a.valorPagoCentavos, contaId: a.contaId }).where(eq(l.id, a.id));
    }
    if (x.lancamentoId) await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: x.lancamentoId, acao: "alterou", descricao: "a conciliação desfeita com o extrato", dados: antes });
  }
  await tx.update(linha).set({ status: "novo", lancamentoId: null, conciliacaoAntes: null, regraId: null, duplicada: false, candidatos: [] }).where(eq(linha.id, x.id));
}

export async function adicionarLinhas(id: number, ids: number[]): Promise<R<{ feitas: number }>> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const linhas = await linhasDa(tx, imp, lerIds(ids));
    const alvo = linhas.filter((x) => ["novo", "encontrado", "pendente"].includes(x.status));
    if (!alvo.length) erro("As linhas escolhidas já foram resolvidas.");
    for (const x of alvo) await adicionar(tx, imp, x);
    await processarLinhas(tx, imp, { aplicarRegras: false });
    return { feitas: alvo.length };
  });
}

export async function conciliarLinha(id: number, linhaId: number, chave: string): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const [x] = await linhasDa(tx, imp, lerIds([linhaId]));
    await conciliarCom(tx, imp, x, chave);
    await processarLinhas(tx, imp, { aplicarRegras: false });
    return {};
  });
}

/** Conciliar em lote: só as linhas "Encontradas" (com um lançamento certo). */
export async function conciliarEncontradas(id: number, ids: number[]): Promise<R<{ feitas: number }>> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const linhas = (await linhasDa(tx, imp, lerIds(ids))).filter((x) => x.status === "encontrado");
    if (!linhas.length) erro("Nenhuma das linhas escolhidas está como **Encontrado**. As pendentes precisam que você escolha o lançamento.");
    for (const x of linhas) await conciliarCom(tx, imp, x, (x.candidatos as Candidato[])[0]?.chave);
    await processarLinhas(tx, imp, { aplicarRegras: false });
    return { feitas: linhas.length };
  });
}

export async function ignorarLinhas(id: number, ids: number[]): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const linhas = (await linhasDa(tx, imp, lerIds(ids))).filter((x) => ["novo", "encontrado", "pendente"].includes(x.status));
    if (!linhas.length) erro("As linhas escolhidas já foram resolvidas. Use **Desfazer** primeiro.");
    await tx.update(linha).set({ status: "ignorado", regraId: null, candidatos: [] }).where(inArray(linha.id, linhas.map((x) => x.id)));
    // O lançamento que estava reservado para elas fica livre para outras linhas.
    await processarLinhas(tx, imp, { aplicarRegras: false });
    return {};
  });
}

export async function desfazerLinhas(id: number, ids: number[]): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const linhas = (await linhasDa(tx, imp, lerIds(ids))).filter((x) => ["adicionado", "conciliado", "ignorado"].includes(x.status));
    if (!linhas.length) erro("Nada para desfazer nas linhas escolhidas.");
    for (const x of linhas) await desfazer(tx, imp, x);
    await processarLinhas(tx, imp, { aplicarRegras: false });
    return {};
  });
}

/** Lê os campos editáveis de uma linha (descrição, categoria, contato, forma e tags). */
async function lerCampos(tx: Transacao, c: CamposLinha, exigirDescricao: boolean): Promise<CamposLinha> {
  const descricao = (c?.descricao ?? "").trim();
  if (exigirDescricao && !descricao) erro("Preencha o campo **Descrição**.");
  if (descricao.length > 120) erro("O campo **Descrição** aceita no máximo 120 caracteres.");
  const categoriaId = lerId(c?.categoriaId);
  if (categoriaId) {
    const [cat] = await tx.select({ especial: categoria.especial }).from(categoria).where(eq(categoria.id, categoriaId));
    if (!cat || cat.especial) erro("Selecione o campo **Categoria**.");
  }
  const contatoId = lerId(c?.contatoId);
  if (contatoId && !(await tx.select({ id: contato.id }).from(contato).where(eq(contato.id, contatoId))).length) erro("Selecione o campo **Cliente ou Fornecedor**.");
  const formaPagamentoId = lerId(c?.formaPagamentoId);
  if (formaPagamentoId && !(await tx.select({ id: formaPagamento.id }).from(formaPagamento).where(eq(formaPagamento.id, formaPagamentoId))).length) erro("Selecione o campo **Forma de Pagamento**.");
  const tagIds = [...new Set((Array.isArray(c?.tagIds) ? c.tagIds : []).map(lerId).filter((t): t is number => t !== null))];
  if (tagIds.length && (await tx.select({ id: tag.id }).from(tag).where(inArray(tag.id, tagIds))).length !== tagIds.length) erro("Selecione o campo **Tags** de novo: alguma tag não existe mais.");
  const contatoNome = !contatoId && c?.contatoNome?.trim() ? c.contatoNome.trim().slice(0, 120) : null;
  return { descricao, categoriaId, contatoId, contatoNome, formaPagamentoId, tagIds };
}

export async function editarLinha(id: number, linhaId: number, c: CamposLinha): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const [x] = await linhasDa(tx, imp, lerIds([linhaId]));
    if (!["novo", "encontrado", "pendente", "ignorado"].includes(x.status)) erro("Esta linha já virou lançamento. Use **Desfazer** para editar.");
    const novos = await lerCampos(tx, c, true);
    const anteriores = x.campos as CamposLinha;
    const origemCategoria = novos.categoriaId ? (novos.categoriaId === anteriores.categoriaId ? anteriores.origemCategoria : "manual") : null;
    await tx.update(linha).set({ campos: { ...novos, origemCategoria } }).where(eq(linha.id, x.id));
    return {};
  });
}

/** Só a categoria (troca rápida na própria tabela). */
export async function mudarCategoria(id: number, linhaId: number, categoriaId: string): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const [x] = await linhasDa(tx, imp, lerIds([linhaId]));
    if (!["novo", "encontrado", "pendente", "ignorado"].includes(x.status)) erro("Esta linha já virou lançamento. Use **Desfazer** para mudar.");
    const nova = lerId(categoriaId);
    if (nova) {
      const [cat] = await tx.select({ especial: categoria.especial, natureza: categoria.natureza }).from(categoria).where(eq(categoria.id, nova));
      if (!cat || cat.especial) erro("Selecione o campo **Categoria**.");
    }
    await tx.update(linha).set({ campos: { ...(x.campos as CamposLinha), categoriaId: nova, origemCategoria: nova ? "manual" : null } }).where(eq(linha.id, x.id));
    return {};
  });
}

/** Ação em lote: preenche só os campos que estão em branco nas linhas escolhidas. */
export async function preencherEmBranco(id: number, ids: number[], c: CamposLinha): Promise<R<{ feitas: number }>> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const novos = await lerCampos(tx, c, false);
    if (!novos.descricao && !novos.categoriaId && !novos.contatoId && !novos.formaPagamentoId && !novos.tagIds?.length) erro("Escolha pelo menos um campo para preencher.");
    const linhas = (await linhasDa(tx, imp, lerIds(ids))).filter((x) => ["novo", "encontrado", "pendente"].includes(x.status));
    let feitas = 0;
    const categorias = novos.categoriaId ? await tx.select({ natureza: categoria.natureza }).from(categoria).where(eq(categoria.id, novos.categoriaId)) : [];
    for (const x of linhas) {
      const atual = x.campos as CamposLinha;
      const campos = { ...atual };
      // A categoria só serve para linhas do mesmo tipo (despesa ou receita).
      if (novos.categoriaId && !atual.categoriaId && categorias[0]?.natureza === x.tipo) Object.assign(campos, { categoriaId: novos.categoriaId, origemCategoria: "manual" });
      if (novos.descricao && !atual.descricao?.trim()) campos.descricao = novos.descricao;
      if (novos.contatoId && !atual.contatoId && !atual.contatoNome) campos.contatoId = novos.contatoId;
      if (novos.formaPagamentoId && !atual.formaPagamentoId) campos.formaPagamentoId = novos.formaPagamentoId;
      if (novos.tagIds?.length && !atual.tagIds?.length) campos.tagIds = novos.tagIds;
      if (JSON.stringify(campos) !== JSON.stringify(atual)) {
        feitas += 1;
        await tx.update(linha).set({ campos }).where(eq(linha.id, x.id));
      }
    }
    return { feitas };
  });
}

/** "Encontrar Lançamento": busca manual para conciliar (mesmo sentido, perto da data). */
export async function buscarLancamentos(id: number, linhaId: number, filtro: { texto: string; mesmoValor: boolean; dias: number }): Promise<{ candidatos: Candidato[] } | { erro: string }> {
  await exigirLogin();
  const db = getDb();
  if (!idValido.safeParse(id).success || !idValido.safeParse(linhaId).success) return { erro: "Linha não encontrada." };
  const [imp] = await db.select().from(importacao).where(eq(importacao.id, id));
  const [x] = await db.select().from(linha).where(and(eq(linha.id, linhaId), eq(linha.importacaoId, id)));
  if (!imp || !x) return { erro: "Linha não encontrada." };
  const dias = Math.min(Math.max(Math.floor(Number(filtro?.dias) || 30), 1), 120);
  const texto = String(filtro?.texto ?? "").trim().slice(0, 60);
  const eCartao = imp.cartaoId !== null;
  const dataRef = eCartao ? sql`coalesce(${l.dataCompra}, ${l.dataVencimento})` : sql`coalesce(${l.dataPagamento}, ${l.dataVencimento})`;
  const tipos = x.tipo === "receita" ? (["receita", "transferencia_entrada"] as const) : (["despesa", "transferencia_saida", "pagamento_fatura"] as const);
  const linhas = await db
    .select({ id: l.id, descricao: l.descricao, tipo: l.tipo, valor: l.valorCentavos, pago: l.dataPagamento, valorPago: l.valorPagoCentavos, data: sql<string>`${dataRef}`, conta: conta.descricao, cartao: cartao.descricao })
    .from(l)
    .leftJoin(conta, eq(conta.id, l.contaId))
    .leftJoin(cartao, eq(cartao.id, l.cartaoId))
    .where(
      and(
        eCartao ? eq(l.cartaoId, imp.cartaoId!) : imp.qualquerConta ? isNotNull(l.contaId) : eq(l.contaId, imp.contaId!),
        inArray(l.tipo, [...tipos]),
        sql`${dataRef} between ${somarDias(x.data, -dias)} and ${somarDias(x.data, dias)}`,
        filtro?.mesmoValor ? sql`(abs(coalesce(${l.valorPagoCentavos}, ${l.valorCentavos})) = ${x.valorCentavos} or abs(${l.valorCentavos}) = ${x.valorCentavos})` : undefined,
        texto ? contemTexto(l.descricao, texto) : undefined,
        sql`not exists (select 1 from ${linha} il join ${importacao} i on i.id = il.importacao_id where il.lancamento_id = ${l.id} and il.status in ('adicionado', 'conciliado') and i.situacao <> 'cancelada')`,
      ),
    )
    .orderBy(sql`abs(${dataRef} - ${x.data}::date)`, l.id)
    .limit(30);
  return {
    candidatos: linhas.map((c) => ({
      chave: `l:${c.id}`,
      descricao: c.descricao,
      data: String(c.data),
      valorCentavos: Math.abs(c.pago ? (c.valorPago ?? c.valor) : c.valor),
      tipo: x.tipo,
      destino: c.conta ?? c.cartao ?? "",
      realizado: !!c.pago,
      previsto: false,
    })),
  };
}

/** Aplica de novo as regras (depois de criar ou mudar uma regra). */
export async function reaplicarRegras(id: number): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    await processarLinhas(tx, imp, { aplicarRegras: true });
    return {};
  });
}

// ---------------------------------------------------------------------------
// Concluir e excluir
// ---------------------------------------------------------------------------

export async function concluirImportacao(id: number): Promise<R<{ adicionadas: number; conciliadas: number; deFora: number }>> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    if (imp.etapa !== "revisao") erro("Termine as etapas anteriores antes de concluir.");
    const linhas = await tx.select().from(linha).where(eq(linha.importacaoId, id)).orderBy(linha.numeroLinha);
    let adicionadas = 0;
    let conciliadas = 0;
    // O que já está pronto entra sozinho: encontradas são conciliadas e novas com categoria são adicionadas.
    for (const x of linhas) {
      if (x.status !== "encontrado" && !(x.status === "novo" && (x.campos as CamposLinha).categoriaId)) continue;
      try {
        await tx.transaction(async (sp) => {
          if (x.status === "encontrado") {
            await conciliarCom(sp, imp, x, (x.candidatos as Candidato[])[0]?.chave);
            conciliadas += 1;
          } else {
            await adicionar(sp, imp, x);
            adicionadas += 1;
          }
        });
      } catch (e) {
        if (!(e instanceof ErroImportacao || e instanceof ErroValidacao)) throw e;
      }
    }
    const finais = await tx.select({ status: linha.status }).from(linha).where(eq(linha.importacaoId, id));
    const total = (s: string) => finais.filter((f) => f.status === s).length;
    const deFora = total("novo") + total("pendente") + total("encontrado");
    await tx.update(importacao).set({ situacao: "concluida", concluidoEm: new Date() }).where(eq(importacao.id, id));
    await registrarAuditoria(tx, {
      tela: TELA,
      entidade: "Importação",
      entidadeId: id,
      acao: "importou",
      descricao: `o arquivo ${imp.arquivoNome}`,
      dados: { adicionadas: total("adicionado"), conciliadas: total("conciliado"), ignoradas: total("ignorado"), deFora },
    });
    return { adicionadas, conciliadas, deFora };
  });
}

/** Exclui um rascunho: desfaz tudo o que ele já adicionou ou conciliou. */
export async function excluirImportacao(id: number): Promise<R> {
  return executar(async (tx) => {
    const imp = await rascunho(tx, id);
    const feitas = await tx.select().from(linha).where(and(eq(linha.importacaoId, id), inArray(linha.status, ["adicionado", "conciliado"])));
    for (const x of feitas) await desfazer(tx, imp, x);
    await tx.delete(importacao).where(eq(importacao.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: "Importação", entidadeId: id, acao: "excluiu", descricao: `a importação do arquivo ${imp.arquivoNome} (rascunho)`, dados: { arquivoNome: imp.arquivoNome, desfeitas: feitas.length } });
    return {};
  });
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

function lerCondicoes(lista: Condicao[]): Condicao[] {
  if (!Array.isArray(lista) || !lista.length) erro("Adicione pelo menos uma **Condição** (ex.: Descrição contém \"Supermercado\").");
  if (lista.length > 10) erro("Use no máximo 10 condições por regra.");
  return lista.map((c, i) => {
    const n = lista.length > 1 ? ` da condição ${i + 1}` : "";
    const campo = CAMPOS_CONDICAO.find((x) => x.valor === c?.campo)?.valor ?? erro(`Selecione o **Campo**${n}.`);
    const operador = OPERADORES.find((x) => x.valor === c?.operador);
    if (!operador) erro(`Selecione a **Condição**${n}.`);
    if (campo === "valor" && !operador!.numerico) erro(`Para o campo Valor, use "Igual a", "Maior que" ou "Menor que"${n}.`);
    if (campo !== "valor" && campo !== "tipo" && !operador!.texto) erro(`"Maior que" e "Menor que" só valem para o campo **Valor**${n}.`);
    const valor = String(c?.valor ?? "").trim();
    if (!valor) erro(`Preencha o **Valor**${n}.`);
    if (valor.length > 120) erro(`O **Valor**${n} aceita no máximo 120 caracteres.`);
    return { campo: campo as Condicao["campo"], operador: operador!.valor, valor };
  });
}

export async function salvarRegra(idRegra: number | null, d: DadosRegra, importacaoId?: number | null): Promise<Resultado> {
  return executar(async (tx) => {
    if (idRegra !== null && !idValido.safeParse(idRegra).success) erro("Regra não encontrada.");
    const nome = (d?.nome ?? "").trim();
    if (!nome) erro("Preencha o campo **Nome da regra**.");
    if (nome.length > 80) erro("O campo **Nome da regra** aceita no máximo 80 caracteres.");
    const condicoes = lerCondicoes(d.condicoes);
    const m = /^(conta|cartao):(\d+)$/.exec(d.destino ?? "");
    const contaId = m?.[1] === "conta" ? Number(m[2]) : null;
    const cartaoId = m?.[1] === "cartao" ? Number(m[2]) : null;
    if (contaId && !(await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, contaId))).length) erro("Selecione o campo **Vale para**.");
    if (cartaoId && !(await tx.select({ id: cartao.id }).from(cartao).where(eq(cartao.id, cartaoId))).length) erro("Selecione o campo **Vale para**.");
    const acao = d.acao === "ignorar" ? "ignorar" : "preencher";
    let preencher = {};
    if (acao === "preencher") {
      const campos = await lerCampos(tx, { descricao: d.descricao, categoriaId: lerId(d.categoriaId), contatoId: lerId(d.contatoId), formaPagamentoId: lerId(d.formaPagamentoId), tagIds: d.tagIds }, false);
      if (!campos.descricao && !campos.categoriaId && !campos.contatoId && !campos.formaPagamentoId && !campos.tagIds?.length) erro("Escolha pelo menos um campo para **Preencher automaticamente** (ex.: Categoria).");
      preencher = { descricao: campos.descricao || null, categoriaId: campos.categoriaId, contatoId: campos.contatoId, formaPagamentoId: campos.formaPagamentoId, tagIds: campos.tagIds };
    }
    const ordem = Number(d.ordem || 0);
    if (!Number.isInteger(ordem) || ordem < 0 || ordem > 9999) erro("Informe um número de 0 a 9999 no campo **Ordem**.");
    const valores = { nome, contaId, cartaoId, condicoes, acao: acao as "ignorar" | "preencher", preencher, ordem };
    let salvaId: number;
    if (idRegra === null) {
      const [nova] = await tx.insert(regraImportacao).values(valores).returning();
      salvaId = nova.id;
      await registrarAuditoria(tx, { tela: TELA, entidade: "Regra de Importação", entidadeId: nova.id, acao: "cadastrou", descricao: `a Regra ${nome}`, dados: nova });
    } else {
      const [antes] = await tx.select().from(regraImportacao).where(eq(regraImportacao.id, idRegra));
      if (!antes) erro("Esta regra não existe mais.");
      await tx.update(regraImportacao).set(valores).where(eq(regraImportacao.id, idRegra));
      salvaId = idRegra;
      await registrarAuditoria(tx, { tela: TELA, entidade: "Regra de Importação", entidadeId: idRegra, acao: "alterou", descricao: `a Regra ${nome}`, dados: { antes, depois: valores } });
    }
    // "Salvar e Executar": aplica nas linhas da importação aberta.
    if (importacaoId) {
      const imp = await rascunho(tx, importacaoId);
      await processarLinhas(tx, imp, { aplicarRegras: true });
    }
    return { id: salvaId };
  });
}

export async function alterarSituacaoRegra(id: number): Promise<Resultado> {
  return executar(async (tx) => {
    if (!idValido.safeParse(id).success) erro("Regra não encontrada.");
    const [r] = await tx.select().from(regraImportacao).where(eq(regraImportacao.id, id));
    if (!r) erro("Esta regra não existe mais.");
    await tx.update(regraImportacao).set({ ativo: !r!.ativo }).where(eq(regraImportacao.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: "Regra de Importação", entidadeId: id, acao: r!.ativo ? "inativou" : "ativou", descricao: `a Regra ${r!.nome}`, dados: { ativo: !r!.ativo } });
    return {};
  });
}
