"use server";

import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { dataValida, formatarData, hojeIso } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { amortizarReduzindoQuantidade, amortizarReduzindoValor, dividaQueJaTem, GARANTIAS, primeiroDiaDoLembrete, taxaAnualParaMensal, TIPOS_DIVIDA, type VinculoExistente } from "@/lib/dividas/regras";
import { motivoParaNaoExcluirDivida, SEM_USO_DIVIDA } from "@/lib/dividas/exclusao";
import { carregarDetalheDivida, categoriasDeDividas } from "@/lib/dividas/servidor";
import { usoDasDividas } from "@/lib/dividas/uso";
import type { DetalheDivida } from "@/lib/dividas/tipos";
import { inserirLancamento } from "@/lib/lancamentos/gravacao";
import { gerarParcelas, PERIODICIDADES, type Periodicidade } from "@/lib/lancamentos/regras";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { exigirLogin } from "@/lib/sessao";

const { divida, dividaVinculo, dividaEvento, lancamento: l, parcelamento, contato, contaFinanceira: conta, categoria, formaPagamento, fatura, recorrencia } = schema;
const TELA = "Gestão de Dívidas";
const ENTIDADE = "Dívida";
const MAXIMO_CENTAVOS = 99_999_999_999;
const MAXIMO_PARCELAS = 360;

// ---------------------------------------------------------------------------
// Validação (mesmas mensagens e jeito dos Lançamentos)
// ---------------------------------------------------------------------------

class ErroFormulario extends Error {}
const erro = (mensagem: string): never => {
  throw new ErroFormulario(mensagem);
};

function lerValor(texto: string, campo: string, obrigatorio = true): number | null {
  if (!texto?.trim()) return obrigatorio ? erro(`Preencha o campo **${campo}**.`) : null;
  const centavos = lerValorEmCentavos(texto);
  if (centavos === null || centavos > MAXIMO_CENTAVOS) return erro(`Informe um valor válido no campo **${campo}** (ex.: 1.250,00).`);
  if (centavos <= 0) return erro(`O campo **${campo}** precisa ser maior que zero.`);
  return centavos;
}

function lerData(texto: string, campo: string, obrigatoria = true): string | null {
  if (!texto) return obrigatoria ? erro(`Preencha o campo **${campo}**.`) : null;
  if (!dataValida(texto)) return erro(`Informe uma data válida no campo **${campo}**.`);
  return texto;
}

function lerTexto(texto: string, campo: string, maximo: number, obrigatorio = false): string | null {
  const limpo = (texto ?? "").trim();
  if (!limpo) return obrigatorio ? erro(`Preencha o campo **${campo}**.`) : null;
  if (limpo.length > maximo) return erro(`O campo **${campo}** aceita no máximo ${maximo} caracteres.`);
  return limpo;
}

/** Porcentagem com até 4 casas ("2,99" ou "2.99"). Vazio = não informada. */
function lerPercentual(texto: string, campo: string, maximo = 1000): number | null {
  const limpo = (texto ?? "").trim().replace("%", "").replace(",", ".");
  if (!limpo) return null;
  if (!/^\d+(\.\d{1,4})?$/.test(limpo) || Number(limpo) > maximo) return erro(`Informe uma porcentagem válida no campo **${campo}** (ex.: 2,99).`);
  return Number(limpo);
}

const lerId = (texto: string | number | null | undefined) => {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function conferirCredor(tx: Transacao, id: string): Promise<{ id: number; nome: string }> {
  const n = lerId(id);
  if (!n) return erro("Preencha o campo **Credor**.");
  const [c] = await tx.select({ id: contato.id, nome: contato.nome }).from(contato).where(eq(contato.id, n));
  return c ?? erro("Este **Credor** não existe mais.");
}

async function conferirConta(tx: Transacao, id: string, campo = "Conta de Pagamento"): Promise<number> {
  const n = lerId(id);
  if (!n) return erro(`Preencha o campo **${campo}**.`);
  const [c] = await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, n));
  return c ? n : erro(`Esta **${campo}** não existe mais.`);
}

async function conferirCategoria(tx: Transacao, id: string): Promise<number> {
  const n = lerId(id);
  if (!n) return erro("Preencha o campo **Categoria**.");
  const [c] = await tx.select({ id: categoria.id, natureza: categoria.natureza }).from(categoria).where(eq(categoria.id, n));
  if (!c) return erro("Esta **Categoria** não existe mais.");
  if (c.natureza !== "despesa") return erro("Escolha uma categoria de **despesa** no campo **Categoria**.");
  return n;
}

async function conferirForma(tx: Transacao, id: string): Promise<number | null> {
  if (!id) return null;
  const n = lerId(id);
  if (!n) return erro("Esta **Forma de Pagamento** não existe mais.");
  const [f] = await tx.select({ id: formaPagamento.id }).from(formaPagamento).where(eq(formaPagamento.id, n));
  return f ? n : erro("Esta **Forma de Pagamento** não existe mais.");
}

async function lerDivida(tx: Transacao, id: number) {
  if (!idValido.safeParse(id).success) return erro("Dívida não encontrada.");
  const [d] = await tx.select().from(divida).where(eq(divida.id, id)).for("update");
  return d ?? erro("Esta dívida não existe mais.");
}

const textoPercentual = (n: number | null) => (n === null ? null : n.toFixed(4));

/** Resposta padrão das ações: converte os erros de formulário em faixa amarela. */
async function executar<T extends Resultado>(corpo: () => Promise<T>): Promise<Resultado> {
  try {
    return await corpo();
  } catch (e) {
    if (e instanceof ErroFormulario) return falha(e.message);
    throw e;
  }
}

async function evento(tx: Transacao, dividaId: number, e: { data: string; tipo: (typeof dividaEvento.$inferInsert)["tipo"]; descricao: string; valorCentavos?: number | null; saldoCentavos?: number | null; origemSaldo?: string | null; lancamentoId?: number | null; dados?: unknown }) {
  await tx.insert(dividaEvento).values({ dividaId, data: e.data, tipo: e.tipo, descricao: e.descricao, valorCentavos: e.valorCentavos ?? null, saldoCentavos: e.saldoCentavos ?? null, origemSaldo: e.origemSaldo ?? null, lancamentoId: e.lancamentoId ?? null, dados: e.dados ?? null });
}

async function exigirRecurso() {
  await exigirLogin();
  if (!(await recursoAtivo("dividas"))) throw new Error("A Gestão de Dívidas está desativada em Configurações > Recursos.");
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

export type DadosDivida = {
  descricao: string;
  contatoId: string;
  tipo: string;
  forma: "parcelas_fixas" | "sem_parcelas";
  valorOriginal: string;
  dataContratacao: string;
  /** Parcelas fixas: "parcela" = o valor é de cada parcela; "total" = o valor é dividido entre elas. */
  parcelas: { modo: "parcela" | "total"; valor: string; quantidade: string; primeiroVencimento: string; periodicidade: string; jaPagas: string };
  /** Sem parcelas: o saldo devedor de hoje. */
  saldoHoje: string;
  taxa: string;
  taxaTipo: "mensal" | "anual";
  multa: string;
  mora: string;
  garantia: string;
  contaId: string;
  categoriaId: string;
  formaPagamentoId: string;
  observacao: string;
  registrarEntrada: boolean;
  /** Sem parcelas: "Lembrar todo mês no dia X" cria um recorrente ligado à dívida (só no cadastro). */
  lembrete?: { ativo: boolean; dia: string; valor: string };
};

function lerComuns(d: DadosDivida) {
  const tipo = TIPOS_DIVIDA.find((t) => t.valor === d.tipo)?.valor ?? erro("Selecione o campo **Tipo**.");
  const garantia = GARANTIAS.find((g) => g.valor === d.garantia)?.valor ?? "nenhuma";
  const taxaInformada = lerPercentual(d.taxa, "Taxa de Juros");
  const taxaMensal = taxaInformada === null ? null : d.taxaTipo === "anual" ? taxaAnualParaMensal(taxaInformada) : taxaInformada;
  if (taxaMensal !== null && taxaMensal > 100) erro("A **Taxa de Juros** ao mês não pode passar de 100%.");
  return {
    descricao: lerTexto(d.descricao, "Descrição", 120, true)!,
    tipo,
    garantia,
    valorOriginalCentavos: lerValor(d.valorOriginal, "Valor Original", false),
    dataContratacao: lerData(d.dataContratacao, "Data de Contratação", false),
    taxaMensal: textoPercentual(taxaMensal),
    multaPercentual: textoPercentual(lerPercentual(d.multa, "Multa", 100)),
    moraMensal: textoPercentual(lerPercentual(d.mora, "Juros de Mora", 100)),
    observacao: lerTexto(d.observacao, "Observação", 1000),
  };
}

export async function salvarDivida(id: number | null, d: DadosDivida): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const credor = await conferirCredor(tx, d.contatoId);
      const comuns = lerComuns(d);
      const contaId = await conferirConta(tx, d.contaId);
      const categoriaId = await conferirCategoria(tx, d.categoriaId);
      const formaPagamentoId = await conferirForma(tx, d.formaPagamentoId);
      const hoje = hojeIso();

      if (id !== null) {
        const antes = await lerDivida(tx, id);
        const novos = { ...comuns, contatoId: credor.id, contaId, categoriaId, formaPagamentoId };
        await tx.update(divida).set(novos).where(eq(divida.id, id));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `a Dívida ${comuns.descricao}`, dados: diferencas(antes, novos) });
        refresh();
        return { ok: true as const, id };
      }

      const [nova] = await tx
        .insert(divida)
        .values({ ...comuns, contatoId: credor.id, forma: d.forma === "sem_parcelas" ? "sem_parcelas" : "parcelas_fixas", contaId, categoriaId, formaPagamentoId })
        .returning();
      let resumoParcelas = "";
      let antesCadastro = 0;

      if (nova.forma === "parcelas_fixas") {
        const p = d.parcelas;
        const valor = lerValor(p.valor, p.modo === "total" ? "Valor Total" : "Valor da Parcela")!;
        const quantidade = Number(p.quantidade);
        if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAXIMO_PARCELAS) erro(`Informe de 1 a ${MAXIMO_PARCELAS} no campo **Quantidade de Parcelas**.`);
        const jaPagas = Number(p.jaPagas || 0);
        if (!Number.isInteger(jaPagas) || jaPagas < 0 || jaPagas >= quantidade) erro(`Em **Parcelas já pagas**, informe de 0 a ${quantidade - 1}.`);
        const primeira = lerData(p.primeiroVencimento, "Primeiro Vencimento")!;
        const periodicidade = (PERIODICIDADES.find((x) => x.valor === p.periodicidade)?.valor ?? erro("Selecione o campo **Periodicidade**.")) as Periodicidade;
        const parcelas = gerarParcelas({ descricao: comuns.descricao, valorCentavos: valor!, quantidade, iniciarNaParcela: jaPagas + 1, dividirValor: p.modo === "total", incluirParcelaNaDescricao: true, primeiraData: primeira, periodicidade });
        const [grupo] = await tx
          .insert(parcelamento)
          .values({ descricaoBase: comuns.descricao, valorTotalCentavos: parcelas.reduce((s, x) => s + x.valorCentavos, 0), quantidade, periodicidade, iniciarNaParcela: jaPagas + 1, dividirValor: p.modo === "total", incluirParcelaNaDescricao: true })
          .returning();
        await tx.update(divida).set({ parcelamentoId: grupo.id }).where(eq(divida.id, nova.id));
        for (const parcela of parcelas) {
          await inserirLancamento(
            tx,
            { tipo: "despesa", formato: "simples", descricao: parcela.descricao, valorCentavos: parcela.valorCentavos, dataVencimento: parcela.data, contaId, categoriaId, formaPagamentoId, contatoId: credor.id, dividaId: nova.id, parcelamentoId: grupo.id, parcelaNumero: parcela.numero, parcelaTotal: quantidade, origem: "parcelamento" },
            [],
            [],
          );
        }
        const total = parcelas.reduce((s, x) => s + x.valorCentavos, 0);
        resumoParcelas = `${parcelas.length} ${parcelas.length === 1 ? "parcela" : "parcelas"} (${formatarCentavos(total)}), a partir de ${formatarData(primeira)}`;
        if (jaPagas > 0) {
          // Dívida antiga: o que já foi pago fica só no histórico, sem mexer no saldo das contas (decisão provisória 2).
          antesCadastro = jaPagas * (p.modo === "total" ? Math.floor(valor! / quantidade) : valor!);
          await evento(tx, nova.id, { data: hoje, tipo: "pagamento", descricao: `${jaPagas} ${jaPagas === 1 ? "parcela paga" : "parcelas pagas"} antes do cadastro, total de ${formatarCentavos(antesCadastro)}`, valorCentavos: antesCadastro, dados: { anteriorAoCadastro: true, parcelas: jaPagas } });
        }
      } else {
        const saldo = lerValor(d.saldoHoje, "Saldo devedor hoje")!;
        await evento(tx, nova.id, { data: hoje, tipo: "atualizacao_saldo", descricao: `Saldo inicial de ${formatarCentavos(saldo!)} informado no cadastro`, saldoCentavos: saldo, origemSaldo: "cadastro" });
        resumoParcelas = `sem parcelas, saldo de ${formatarCentavos(saldo!)}`;

        if (d.lembrete?.ativo) {
          if (!(await recursoAtivo("recorrentes"))) erro("Para **Lembrar todo mês**, ligue o recurso Lançamentos Recorrentes em Configurações > Recursos.");
          const dia = Number(d.lembrete.dia);
          if (!Number.isInteger(dia) || dia < 1 || dia > 31) erro("Informe um dia de 1 a 31 em **Lembrar todo mês no dia**.");
          const valorLembrete = lerValor(d.lembrete.valor, "Valor do lembrete")!;
          // Primeira ocorrência: o dia escolhido neste mês, ou no próximo se já passou.
          const dataInicio = primeiroDiaDoLembrete(hoje, dia);
          const [lembrete] = await tx
            .insert(recorrencia)
            .values({ formato: "simples", tipo: "despesa", descricao: `Pagamento: ${comuns.descricao}`, valorCentavos: valorLembrete, intervalo: "mensal", diaFixo: dia, dataInicio, contaId, categoriaId, formaPagamentoId, contatoId: credor.id, observacao: `Lembrete mensal criado pela dívida ${comuns.descricao}.` })
            .returning();
          await tx.insert(dividaVinculo).values({ dividaId: nova.id, recorrenciaId: lembrete.id });
          await registrarAuditoria(tx, { tela: "Lançamentos Recorrentes", entidade: "Recorrente", entidadeId: lembrete.id, acao: "cadastrou", descricao: `o Recorrente Pagamento: ${comuns.descricao} (lembrete da dívida)`, dados: { ...lembrete, dividaId: nova.id } });
          await evento(tx, nova.id, { data: hoje, tipo: "vinculo", descricao: `Lembrete mensal criado: todo dia ${dia}, ${formatarCentavos(valorLembrete)}`, valorCentavos: valorLembrete });
          resumoParcelas += `, lembrete todo dia ${dia}`;
        }
      }

      await evento(tx, nova.id, { data: hoje, tipo: "cadastro", descricao: `Dívida cadastrada com ${credor.nome} (${resumoParcelas})` });

      if (d.registrarEntrada) {
        const valor = comuns.valorOriginalCentavos ?? erro("Para registrar a entrada do dinheiro, preencha o campo **Valor Original**.");
        const [outro] = await tx.select({ id: categoria.id }).from(categoria).where(and(eq(categoria.nome, "Outro"), eq(categoria.natureza, "receita"))).limit(1);
        const data = comuns.dataContratacao ?? hoje;
        const entrada = await inserirLancamento(
          tx,
          { tipo: "receita", formato: "simples", descricao: `Empréstimo: ${comuns.descricao}`, valorCentavos: valor, valorPagoCentavos: valor, dataVencimento: data, dataPagamento: data, contaId, categoriaId: outro?.id ?? null, contatoId: credor.id, origem: "manual" },
          [],
          [],
        );
        await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: entrada.id, acao: "cadastrou", descricao: `a entrada do dinheiro da Dívida ${comuns.descricao} (${formatarCentavos(valor)})`, dados: entrada });
        await evento(tx, nova.id, { data, tipo: "anotacao", descricao: `Entrada de ${formatarCentavos(valor)} registrada na conta`, valorCentavos: valor, lancamentoId: entrada.id });
      }

      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: nova.id, acao: "cadastrou", descricao: `a Dívida ${comuns.descricao} (${resumoParcelas})`, dados: { ...comuns, contatoId: credor.id, forma: nova.forma, contaId, categoriaId } });
      refresh();
      return { ok: true as const, id: nova.id };
    }),
  );
}

// ---------------------------------------------------------------------------
// Consulta (janela Detalhando Dívida)
// ---------------------------------------------------------------------------

export async function detalharDivida(id: number): Promise<DetalheDivida | null> {
  await exigirRecurso();
  if (!idValido.safeParse(id).success) return null;
  return carregarDetalheDivida(id);
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------

export type DadosPagamentoDivida = { valor: string; data: string; contaId: string };

/** Cria o lançamento já pago de um pagamento feito pelo módulo (dívida sem parcelas, amortização, quitação). */
async function lancarPagamento(tx: Transacao, d: typeof divida.$inferSelect, rotulo: string, valorCentavos: number, data: string, contaId: number) {
  const novo = await inserirLancamento(
    tx,
    { tipo: "despesa", formato: "simples", descricao: `${rotulo}: ${d.descricao}`, valorCentavos, valorPagoCentavos: valorCentavos, dataVencimento: data, dataPagamento: data, contaId, categoriaId: d.categoriaId, formaPagamentoId: d.formaPagamentoId, contatoId: d.contatoId, dividaId: d.id, origem: "sistema" },
    [],
    [],
  );
  await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: novo.id, acao: "pagou", descricao: `${rotulo.toLowerCase()} da Dívida ${d.descricao} (${formatarCentavos(valorCentavos)}, em ${formatarData(data)})`, dados: novo });
  return novo;
}

/** Dívida sem parcelas: o botão Pagar cria o lançamento já pago na conta escolhida. */
export async function pagarDivida(id: number, p: DadosPagamentoDivida): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, id);
      if (d.forma !== "sem_parcelas") return erro("Esta dívida tem parcelas. Pague cada parcela pela lista de parcelas.");
      if (d.situacao !== "ativa") return erro("Esta dívida não está ativa.");
      const valor = lerValor(p.valor, "Valor Pago")!;
      const data = lerData(p.data, "Data do Pagamento")!;
      const contaId = await conferirConta(tx, p.contaId);
      const detalhe = await carregarDetalheDivida(id);
      const saldo = detalhe?.divida.saldo.exibido ?? 0;
      if (saldo > 0 && valor! > saldo) return erro(`O valor passa do saldo devedor (${formatarCentavos(saldo)}). Para corrigir o saldo, use **Atualizar saldo**.`);
      const novo = await lancarPagamento(tx, d, "Pagamento", valor!, data, contaId);
      await evento(tx, id, { data, tipo: "pagamento", descricao: `Pagamento de ${formatarCentavos(valor!)}`, valorCentavos: valor, lancamentoId: novo.id });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

export type DadosAmortizacao = DadosPagamentoDivida & { modo: "valor" | "quantidade" };

/** Parcelas em aberto de uma dívida que dá para ajustar (lançamentos de conta, ainda não pagos, que não são encargo). */
async function parcelasAjustaveis(id: number) {
  const detalhe = await carregarDetalheDivida(id);
  if (!detalhe) return erro("Esta dívida não existe mais.");
  return detalhe.obrigacoes.filter((o) => o.origem === "lancamento" && !o.dataPagamento && o.podePagarAqui && !o.encargo).map((o) => ({ id: o.id, vencimento: o.vencimento, valorCentavos: o.valorCentavos, descricao: o.descricao }));
}

export async function amortizarDivida(id: number, p: DadosAmortizacao): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, id);
      if (d.forma !== "parcelas_fixas" || d.situacao !== "ativa") return erro("Só dívidas com parcelas fixas e ativas podem ser amortizadas.");
      const valor = lerValor(p.valor, "Valor do Pagamento Extra")!;
      const data = lerData(p.data, "Data do Pagamento")!;
      const contaId = await conferirConta(tx, p.contaId);
      const abertas = await parcelasAjustaveis(id);
      const r = p.modo === "quantidade" ? amortizarReduzindoQuantidade(abertas, valor!) : amortizarReduzindoValor(abertas, valor!);
      if (!r.ok) return erro(r.erro);
      const pagamento = await lancarPagamento(tx, d, "Amortização", valor!, data, contaId);
      const nomes = new Map(abertas.map((a) => [a.id, a.descricao]));
      for (const a of r.ajustes) {
        if (a.removida) {
          const [antes] = await tx.select().from(l).where(eq(l.id, a.id)).for("update");
          if (!antes || antes.dataPagamento) return erro("Uma das parcelas mudou enquanto você conferia. Abra a janela de novo.");
          await tx.delete(l).where(eq(l.id, a.id));
          await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: a.id, acao: "excluiu", descricao: `a parcela ${antes.descricao} (quitada pela amortização da Dívida ${d.descricao})`, dados: antes });
        } else if (a.depoisCentavos !== a.antesCentavos) {
          const [antes] = await tx.select().from(l).where(eq(l.id, a.id)).for("update");
          if (!antes || antes.dataPagamento || Number(antes.valorCentavos) !== a.antesCentavos) return erro("Uma das parcelas mudou enquanto você conferia. Abra a janela de novo.");
          await tx.update(l).set({ valorCentavos: a.depoisCentavos }).where(eq(l.id, a.id));
          await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: a.id, acao: "alterou", descricao: `o valor da parcela ${antes.descricao} (amortização da Dívida ${d.descricao})`, dados: { valor: { antes: a.antesCentavos, depois: a.depoisCentavos } } });
        }
      }
      const mudadas = r.ajustes.filter((a) => a.removida || a.depoisCentavos !== a.antesCentavos);
      await evento(tx, id, {
        data,
        tipo: "amortizacao",
        descricao: `Pagamento extra de ${formatarCentavos(valor!)}: ${p.modo === "quantidade" ? "reduziu a quantidade de parcelas" : "reduziu o valor das próximas parcelas"} (${mudadas.length} ${mudadas.length === 1 ? "parcela alterada" : "parcelas alteradas"})`,
        valorCentavos: valor,
        lancamentoId: pagamento.id,
        dados: { modo: p.modo, ajustes: mudadas.map((a) => ({ id: a.id, descricao: nomes.get(a.id), vencimento: a.vencimento, antes: a.antesCentavos, depois: a.depoisCentavos, removida: a.removida })) },
      });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

/** Quita a dívida: paga o valor combinado e retira as parcelas que restavam (a cópia fica no histórico e na auditoria). */
export async function quitarDivida(id: number, p: DadosPagamentoDivida): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, id);
      if (d.situacao !== "ativa") return erro("Esta dívida não está ativa.");
      const texto = (p.valor ?? "").trim();
      const valor = texto && lerValorEmCentavos(texto) === 0 ? 0 : lerValor(p.valor, "Valor da Quitação")!;
      const data = lerData(p.data, "Data do Pagamento")!;
      const contaId = valor ? await conferirConta(tx, p.contaId) : null;
      const restantes = await tx.select().from(l).where(and(eq(l.dividaId, id), isNull(l.dataPagamento), isNull(l.cartaoId), eq(l.tipo, "despesa"))).for("update");
      let pagamentoId: number | null = null;
      if (valor && contaId) pagamentoId = (await lancarPagamento(tx, d, "Quitação", valor, data, contaId)).id;
      if (restantes.length) {
        await tx.delete(l).where(inArray(l.id, restantes.map((x) => x.id)));
        for (const x of restantes) await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: x.id, acao: "excluiu", descricao: `a parcela ${x.descricao} (quitação da Dívida ${d.descricao})`, dados: x });
      }
      await tx.update(divida).set({ situacao: "quitada", quitadaEm: data }).where(eq(divida.id, id));
      await evento(tx, id, {
        data,
        tipo: "quitacao",
        descricao: `Dívida quitada${valor ? ` com ${formatarCentavos(valor)}` : ""}${restantes.length ? `; ${restantes.length} ${restantes.length === 1 ? "parcela restante retirada" : "parcelas restantes retiradas"} de Lançamentos` : ""}`,
        valorCentavos: valor || null,
        lancamentoId: pagamentoId,
        dados: { parcelasRetiradas: restantes.map((x) => ({ id: x.id, descricao: x.descricao, vencimento: x.dataVencimento, valorCentavos: x.valorCentavos })) },
      });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `a quitação da Dívida ${d.descricao}`, dados: { situacao: { antes: d.situacao, depois: "quitada" } } });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

// ---------------------------------------------------------------------------
// Saldo, encargos, anotações e cancelamento
// ---------------------------------------------------------------------------

export type DadosSaldo = { saldo: string; data: string; origem: string; observacao: string };
const ORIGENS_SALDO = ["extrato", "aplicativo", "boleto de quitação", "contato com o credor"];

export async function atualizarSaldoDivida(id: number, s: DadosSaldo): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, id);
      if (d.situacao !== "ativa") return erro("Esta dívida não está ativa.");
      const texto = (s.saldo ?? "").trim();
      const saldo = texto && lerValorEmCentavos(texto) === 0 ? 0 : lerValor(s.saldo, "Saldo Devedor")!;
      const data = lerData(s.data, "Data do Saldo")!;
      if (data > hojeIso()) return erro("A **Data do Saldo** não pode ser no futuro.");
      const origem = ORIGENS_SALDO.includes(s.origem) ? s.origem : erro("Escolha de onde veio o saldo no campo **Origem do Saldo**.");
      const nota = lerTexto(s.observacao, "Observação", 300);
      const antes = await carregarDetalheDivida(id);
      const estimado = antes?.divida.saldo.estimado ?? 0;
      const diferenca = saldo! - estimado;
      const comparacao = !antes || !estimado ? "" : diferenca === 0 ? ". Igual ao estimado" : diferenca > 0 ? `. O credor informou ${formatarCentavos(diferenca)} a mais que o estimado` : `. O credor informou ${formatarCentavos(-diferenca)} a menos que o estimado`;
      await evento(tx, id, {
        data,
        tipo: "atualizacao_saldo",
        descricao: `Saldo informado de ${formatarCentavos(saldo!)} (${origem})${comparacao}${nota ? `. ${nota}` : ""}`,
        saldoCentavos: saldo,
        origemSaldo: origem as string,
        dados: { estimadoCentavos: estimado, saldoAnteriorExibidoCentavos: antes?.divida.saldo.exibido ?? null },
      });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o saldo informado da Dívida ${d.descricao} para ${formatarCentavos(saldo!)}`, dados: { saldo: { antes: antes?.divida.saldo.exibido ?? null, depois: saldo } } });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

export type DadosEncargo = { descricao: string; valor: string; vencimento: string; contaId: string };

/** Lança um encargo (tarifa, juro, multa cobrados a mais): uma despesa ainda não paga, ligada à dívida. */
export async function lancarEncargoDivida(id: number, e: DadosEncargo): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, id);
      if (d.situacao !== "ativa") return erro("Esta dívida não está ativa.");
      const descricao = lerTexto(e.descricao, "Descrição", 120, true)!;
      const valor = lerValor(e.valor, "Valor")!;
      const vencimento = lerData(e.vencimento, "Vencimento")!;
      const contaId = await conferirConta(tx, e.contaId);
      const categorias = await categoriasDeDividas();
      const novo = await inserirLancamento(
        tx,
        { tipo: "despesa", formato: "simples", descricao: `${descricao} (${d.descricao})`, valorCentavos: valor!, dataVencimento: vencimento, contaId, categoriaId: categorias.encargos ?? d.categoriaId, formaPagamentoId: d.formaPagamentoId, contatoId: d.contatoId, dividaId: id, origem: "manual" },
        [],
        [],
      );
      await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: novo.id, acao: "cadastrou", descricao: `o encargo ${descricao} da Dívida ${d.descricao} (${formatarCentavos(valor!)})`, dados: novo });
      await evento(tx, id, { data: hojeIso(), tipo: "encargo", descricao: `Encargo lançado: ${descricao}, ${formatarCentavos(valor!)}, vence em ${formatarData(vencimento)}`, valorCentavos: valor, lancamentoId: novo.id });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

export async function anotarDivida(id: number, texto: string): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, id);
      const nota = lerTexto(texto, "Anotação", 500, true)!;
      await evento(tx, id, { data: hojeIso(), tipo: "anotacao", descricao: nota });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `uma anotação na Dívida ${d.descricao}`, dados: { anotacao: nota } });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

/** Cancela a dívida (cadastrada por engano ou perdoada). Com `retirarParcelas`, as não pagas saem de Lançamentos (cópia no histórico). */
export async function cancelarDivida(id: number, retirarParcelas: boolean): Promise<Resultado> {
  await exigirRecurso();
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, id);
      if (d.situacao === "cancelada") return erro("Esta dívida já está cancelada.");
      if (d.situacao === "renegociada") return erro("Esta dívida foi renegociada e não pode ser cancelada.");
      const hoje = hojeIso();
      const restantes = retirarParcelas ? await tx.select().from(l).where(and(eq(l.dividaId, id), isNull(l.dataPagamento), isNull(l.cartaoId), eq(l.tipo, "despesa"))).for("update") : [];
      if (restantes.length) {
        await tx.delete(l).where(inArray(l.id, restantes.map((x) => x.id)));
        for (const x of restantes) await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: x.id, acao: "excluiu", descricao: `a parcela ${x.descricao} (cancelamento da Dívida ${d.descricao})`, dados: x });
      }
      await tx.update(divida).set({ situacao: "cancelada", encerradaEm: hoje }).where(eq(divida.id, id));
      await evento(tx, id, {
        data: hoje,
        tipo: "cancelamento",
        descricao: `Dívida cancelada${restantes.length ? `; ${restantes.length} ${restantes.length === 1 ? "parcela retirada" : "parcelas retiradas"} de Lançamentos` : ""}`,
        dados: { parcelasRetiradas: restantes.map((x) => ({ id: x.id, descricao: x.descricao, vencimento: x.dataVencimento, valorCentavos: x.valorCentavos })) },
      });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o cancelamento da Dívida ${d.descricao}`, dados: { situacao: { antes: d.situacao, depois: "cancelada" } } });
      refresh();
      return { ok: true as const, id };
    }),
  );
}

/**
 * Exclui de vez uma dívida sem nenhum pagamento registrado. Saem junto o histórico, os vínculos e as
 * parcelas e encargos ainda não pagos de Lançamentos (cópia na Auditoria). Lançamentos que a pessoa apenas
 * acompanhava, faturas e recorrentes continuam onde estavam, sem a ligação. O lembrete mensal criado pela
 * própria dívida é inativado. Com pagamento, renegociação, negociação ou plano de quitação, não exclui.
 */
export async function excluirDivida(id: number): Promise<Resultado> {
  await exigirRecurso();
  if (!idValido.safeParse(id).success) return falha("Dívida não encontrada.");
  try {
    return await executar(() =>
      getDb().transaction(async (tx) => {
        const [d] = await tx.select().from(divida).where(eq(divida.id, id)).for("update");
        if (!d) return erro("Esta dívida não existe mais.");
        const uso = (await usoDasDividas(tx, id)).get(id) ?? SEM_USO_DIVIDA;
        const motivo = motivoParaNaoExcluirDivida(uso);
        if (motivo) return erro(`Não é possível excluir a dívida **${d.descricao}**. ${motivo}`);

        // Parcelas e encargos que a dívida criou e ainda não foram pagos. Lançamentos acompanhados só perdem a ligação.
        const encargos = await tx.select({ lancamentoId: dividaEvento.lancamentoId }).from(dividaEvento).where(and(eq(dividaEvento.dividaId, id), eq(dividaEvento.tipo, "encargo")));
        const idsEncargo = encargos.map((e) => e.lancamentoId).filter((x): x is number => x !== null);
        const proprios = await tx.select().from(l).where(and(eq(l.dividaId, id), isNull(l.dataPagamento), isNull(l.cartaoId), idsEncargo.length ? or(eq(l.origem, "parcelamento"), inArray(l.id, idsEncargo)) : eq(l.origem, "parcelamento"))).for("update");
        if (proprios.length) {
          await tx.delete(l).where(inArray(l.id, proprios.map((x) => x.id)));
          for (const x of proprios) await registrarAuditoria(tx, { tela: TELA, entidade: "Lançamento", entidadeId: x.id, acao: "excluiu", descricao: `a parcela ${x.descricao} (exclusão da Dívida ${d.descricao})`, dados: x });
        }

        // O lembrete mensal criado junto com a dívida deixa de avisar.
        const ligados = await tx.select({ id: recorrencia.id, observacao: recorrencia.observacao }).from(dividaVinculo).innerJoin(recorrencia, eq(recorrencia.id, dividaVinculo.recorrenciaId)).where(eq(dividaVinculo.dividaId, id));
        const lembretes = ligados.filter((r) => r.observacao?.startsWith("Lembrete mensal criado pela dívida")).map((r) => r.id);
        if (lembretes.length) await tx.update(recorrencia).set({ ativo: false }).where(inArray(recorrencia.id, lembretes));

        await tx.delete(divida).where(eq(divida.id, id));
        if (d.parcelamentoId) await tx.delete(parcelamento).where(eq(parcelamento.id, d.parcelamentoId));
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "excluiu", descricao: `a Dívida ${d.descricao}${proprios.length ? ` e ${proprios.length} ${proprios.length === 1 ? "parcela não paga" : "parcelas não pagas"}` : ""}`, dados: d });
        refresh();
        return { ok: true as const, id };
      }),
    );
  } catch (e) {
    // A dívida passou a ser usada no mesmo instante (chave estrangeira; o drizzle guarda o erro do banco em cause).
    if ((e as { cause?: { code?: string } })?.cause?.code === "23503") return falha("Esta dívida acabou de ser usada e não pode mais ser excluída. Recarregue a página para ver onde.");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Contas em aberto no Gui: acompanhar como dívida e desligar
// ---------------------------------------------------------------------------

export type AlvoAcompanhar = { tipo: "fatura" | "recorrencia" | "lancamento"; id: number };
export type DestinoAcompanhar = { dividaId: number | null; nova: { descricao: string; contatoId: string; tipo: string } | null };

async function vinculosExistentes(tx: Transacao): Promise<VinculoExistente[]> {
  const linhas = await tx.select().from(dividaVinculo);
  return [
    ...linhas.filter((v) => v.faturaId !== null).map((v) => ({ tipo: "fatura" as const, id: v.faturaId!, dividaId: v.dividaId })),
    ...linhas.filter((v) => v.recorrenciaId !== null).map((v) => ({ tipo: "recorrencia" as const, id: v.recorrenciaId!, dividaId: v.dividaId })),
  ];
}

/**
 * Liga uma fatura, um recorrente ou um lançamento vencido a uma dívida (nova ou existente), sem cadastrar nada em dobro.
 * O registro original não muda: valor, data, categoria e conta continuam os mesmos.
 */
export async function acompanharComoDivida(alvo: AlvoAcompanhar, destino: DestinoAcompanhar): Promise<Resultado> {
  await exigirRecurso();
  if (!alvo || !["fatura", "recorrencia", "lancamento"].includes(alvo.tipo) || !idValido.safeParse(alvo.id).success) return falha("Não encontramos esta conta.");
  return executar(() =>
    getDb().transaction(async (tx) => {
      const hoje = hojeIso();
      let rotulo = "";
      let contaDoAlvo: number | null = null;
      let categoriaDoAlvo: number | null = null;
      let contatoDoAlvo: number | null = null;
      if (alvo.tipo === "lancamento") {
        const [x] = await tx.select().from(l).where(eq(l.id, alvo.id)).for("update");
        if (!x || x.tipo !== "despesa") return erro("Este lançamento não existe mais ou não é uma despesa.");
        if (x.dividaId) return erro("Este lançamento já é acompanhado por uma dívida.");
        if (x.dataPagamento) return erro("Este lançamento já foi pago.");
        if (x.cartaoId) return erro("Compras no cartão são acompanhadas pela fatura.");
        rotulo = `o lançamento ${x.descricao}`;
        contaDoAlvo = x.contaId;
        categoriaDoAlvo = x.categoriaId;
        contatoDoAlvo = x.contatoId;
      } else if (alvo.tipo === "fatura") {
        const [f] = await tx.select({ id: fatura.id, cartaoId: fatura.cartaoId, competencia: fatura.competencia }).from(fatura).where(eq(fatura.id, alvo.id));
        if (!f) return erro("Esta fatura não existe mais.");
        const ja = dividaQueJaTem(await vinculosExistentes(tx), alvo);
        if (ja) return erro("Esta fatura já é acompanhada por uma dívida.");
        rotulo = `a fatura ${f.competencia.slice(0, 7)}`;
      } else {
        const [r] = await tx.select({ id: recorrencia.id, descricao: recorrencia.descricao, contaId: recorrencia.contaId, categoriaId: recorrencia.categoriaId, contatoId: recorrencia.contatoId }).from(recorrencia).where(eq(recorrencia.id, alvo.id));
        if (!r) return erro("Este recorrente não existe mais.");
        const ja = dividaQueJaTem(await vinculosExistentes(tx), alvo);
        if (ja) return erro("Este recorrente já é acompanhado por uma dívida.");
        rotulo = `o recorrente ${r.descricao}`;
        contaDoAlvo = r.contaId;
        categoriaDoAlvo = r.categoriaId;
        contatoDoAlvo = r.contatoId;
      }

      let dividaId = destino?.dividaId ?? null;
      let nomeDivida = "";
      if (dividaId) {
        const d = await lerDivida(tx, dividaId);
        if (d.situacao !== "ativa") return erro("Escolha uma dívida ativa.");
        nomeDivida = d.descricao;
      } else if (destino?.nova) {
        const credor = await conferirCredor(tx, destino.nova.contatoId || (contatoDoAlvo ? String(contatoDoAlvo) : ""));
        const tipo = TIPOS_DIVIDA.find((t) => t.valor === destino.nova!.tipo)?.valor ?? erro("Selecione o campo **Tipo**.");
        const descricao = lerTexto(destino.nova.descricao, "Descrição", 120, true)!;
        const [nova] = await tx.insert(divida).values({ descricao, contatoId: credor.id, tipo, forma: "sem_parcelas", contaId: contaDoAlvo, categoriaId: categoriaDoAlvo }).returning();
        dividaId = nova.id;
        nomeDivida = descricao;
        await evento(tx, nova.id, { data: hoje, tipo: "cadastro", descricao: `Dívida criada ao acompanhar ${rotulo} (sem saldo informado; o saldo é o das contas ligadas)` });
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: nova.id, acao: "cadastrou", descricao: `a Dívida ${descricao} (ao acompanhar ${rotulo})`, dados: nova });
      } else {
        return erro("Escolha a dívida ou crie uma nova.");
      }

      if (alvo.tipo === "lancamento") {
        await tx.update(l).set({ dividaId }).where(eq(l.id, alvo.id));
      } else {
        try {
          await tx.insert(dividaVinculo).values({ dividaId, faturaId: alvo.tipo === "fatura" ? alvo.id : null, recorrenciaId: alvo.tipo === "recorrencia" ? alvo.id : null });
        } catch {
          return erro("Esta conta já é acompanhada por uma dívida.");
        }
      }
      await evento(tx, dividaId, { data: hoje, tipo: "vinculo", descricao: `Passou a acompanhar ${rotulo}` });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: dividaId, acao: "alterou", descricao: `a ligação d${rotulo} à Dívida ${nomeDivida}`, dados: { alvo } });
      refresh();
      return { ok: true as const, id: dividaId };
    }),
  );
}

export async function desligarVinculoDivida(dividaId: number, alvo: AlvoAcompanhar): Promise<Resultado> {
  await exigirRecurso();
  if (!alvo || !["fatura", "recorrencia", "lancamento"].includes(alvo.tipo) || !idValido.safeParse(alvo.id).success) return falha("Não encontramos este vínculo.");
  return executar(() =>
    getDb().transaction(async (tx) => {
      const d = await lerDivida(tx, dividaId);
      if (alvo.tipo === "lancamento") {
        const [x] = await tx.update(l).set({ dividaId: null }).where(and(eq(l.id, alvo.id), eq(l.dividaId, dividaId), eq(l.origem, "manual"))).returning({ descricao: l.descricao, parcelaNumero: l.parcelaNumero });
        if (!x) return erro("Este lançamento não está ligado a esta dívida (ou é uma parcela dela).");
        await evento(tx, dividaId, { data: hojeIso(), tipo: "vinculo", descricao: `Deixou de acompanhar o lançamento ${x.descricao}` });
      } else {
        const coluna = alvo.tipo === "fatura" ? dividaVinculo.faturaId : dividaVinculo.recorrenciaId;
        const apagados = await tx.delete(dividaVinculo).where(and(eq(dividaVinculo.dividaId, dividaId), eq(coluna, alvo.id))).returning({ id: dividaVinculo.id });
        if (!apagados.length) return erro("Este vínculo não existe mais.");
        await evento(tx, dividaId, { data: hojeIso(), tipo: "vinculo", descricao: `Deixou de acompanhar ${alvo.tipo === "fatura" ? "a fatura" : "o recorrente"} (#${alvo.id})` });
      }
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: dividaId, acao: "alterou", descricao: `o desligamento de uma conta da Dívida ${d.descricao}`, dados: { alvo } });
      refresh();
      return { ok: true as const, id: dividaId };
    }),
  );
}

/** Parcelas na ordem em que serão pagas (para "Pagar próxima parcela"). */
export async function proximaParcela(id: number): Promise<{ id: number; descricao: string; valorCentavos: number; vencimento: string } | null> {
  await exigirRecurso();
  const [x] = await getDb().select({ id: l.id, descricao: l.descricao, valorCentavos: l.valorCentavos, vencimento: l.dataVencimento }).from(l).where(and(eq(l.dividaId, id), isNull(l.dataPagamento), isNull(l.cartaoId), eq(l.tipo, "despesa"))).orderBy(asc(l.dataVencimento), asc(l.id)).limit(1);
  return x ? { ...x, valorCentavos: Math.abs(Number(x.valorCentavos)) } : null;
}
