import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { filtrarCategorias, filtrosCartoes, filtrosContas, filtrosContatos, filtrosFormas, filtrosTags } from "@/lib/cadastros/condicoes";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { rotuloTipoConta } from "@/lib/cadastros/opcoes";
import { alturaAbaixo, montarArvore, motivoParaNaoExcluir } from "@/lib/categorias";
import { usoDasCategorias } from "@/lib/categorias-uso";
import { limiteDoCartao } from "@/lib/cartoes/regras";
import { usoDosLimites } from "@/lib/cartoes/servidor";
import { saldosDasContas } from "@/lib/lancamentos/consultas";
import type { Leitores, ValorCampo } from "./avancado";
import { aplicarAvancadoEOrdem } from "./servidor";
import type { PreferenciaListagem } from "./telas";

/**
 * As listas de Cadastros, carregadas inteiras (são pequenas) com os filtros do painel Simples,
 * o Filtro Avançado e a Ordenação. A tela pagina; a impressão e a exportação usam tudo.
 */

const diaSp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
/** Data (aaaa-mm-dd, no fuso de Brasília) de um horário gravado. */
export const diaDe = (d: Date | null | undefined) => (d ? diaSp.format(d) : null);

type Comum = { id: number; ativo: boolean; campoAuxiliar: string | null; criadoEm: Date; atualizadoEm: Date };
function leitoresComuns<T extends Comum>(): Leitores<T> {
  return {
    codigo: (l) => l.id,
    auxiliar: (l) => l.campoAuxiliar,
    cadastrado: (l) => diaDe(l.criadoEm),
    atualizado: (l) => diaDe(l.atualizadoEm),
    situacao: (l) => (l.ativo ? "Ativo" : "Inativo"),
  };
}

const { contaFinanceira: conta, cartaoCredito: cartao, banco, categoria, contato, formaPagamento: forma, tag } = schema;

export async function carregarContas(sp: ParametrosBusca, pref?: PreferenciaListagem) {
  const { f, tipo, onde } = filtrosContas(sp);
  const [linhas, saldos] = await Promise.all([
    getDb()
      .select({
        id: conta.id,
        descricao: conta.descricao,
        tipo: conta.tipo,
        bancoId: conta.bancoId,
        bancoNome: banco.nome,
        bancoCodigo: banco.codigo,
        considerarNosSaldos: conta.considerarNosSaldos,
        saldoInicialCentavos: conta.saldoInicialCentavos,
        saldoInicialData: conta.saldoInicialData,
        ativo: conta.ativo,
        padraoSistema: conta.padraoSistema,
        campoAuxiliar: conta.campoAuxiliar,
        criadoEm: conta.criadoEm,
        atualizadoEm: conta.atualizadoEm,
      })
      .from(conta)
      .leftJoin(banco, eq(banco.id, conta.bancoId))
      .where(onde)
      .orderBy(desc(conta.ativo), asc(conta.ordem), asc(sql`lower(${conta.descricao})`)),
    saldosDasContas(),
  ]);
  const completas = linhas.map((l) => ({ ...l, saldoAtualCentavos: saldos.get(l.id) ?? 0 }));
  type Linha = (typeof completas)[number];
  const leitores: Leitores<Linha> = {
    ...leitoresComuns<Linha>(),
    descricao: (l) => l.descricao,
    banco: (l) => l.bancoNome,
    tipo: (l) => rotuloTipoConta(l.tipo),
    saldoInicial: (l) => l.saldoInicialCentavos,
    saldoAtual: (l) => l.saldoAtualCentavos,
    considerar: (l) => l.considerarNosSaldos,
  };
  return { f, tipo, ...aplicarAvancadoEOrdem("contas-financeiras", completas, sp, leitores, pref), leitores };
}

export async function carregarCartoes(sp: ParametrosBusca, pref?: PreferenciaListagem) {
  const { f, fechamento, vencimento, onde } = filtrosCartoes(sp);
  const contaPg = alias(conta, "conta_pagamento");
  const [linhasDb, usos] = await Promise.all([
    getDb()
      .select({
        id: cartao.id,
        descricao: cartao.descricao,
        bancoId: cartao.bancoId,
        bancoNome: banco.nome,
        bancoCodigo: banco.codigo,
        limiteCentavos: cartao.limiteCentavos,
        ilimitado: cartao.ilimitado,
        diaFechamento: cartao.diaFechamento,
        diaVencimento: cartao.diaVencimento,
        contaPagamentoId: cartao.contaPagamentoId,
        contaPagamentoNome: contaPg.descricao,
        ativo: cartao.ativo,
        padraoSistema: cartao.padraoSistema,
        campoAuxiliar: cartao.campoAuxiliar,
        criadoEm: cartao.criadoEm,
        atualizadoEm: cartao.atualizadoEm,
      })
      .from(cartao)
      .leftJoin(banco, eq(banco.id, cartao.bancoId))
      .leftJoin(contaPg, eq(contaPg.id, cartao.contaPagamentoId))
      .where(onde)
      .orderBy(desc(cartao.ativo), asc(cartao.ordem), asc(sql`lower(${cartao.descricao})`)),
    usoDosLimites(),
  ]);
  const linhas = linhasDb.map((c) => ({ ...c, limite: limiteDoCartao(c, usos.get(c.id) ?? 0) }));
  type Linha = (typeof linhas)[number];
  const leitores: Leitores<Linha> = {
    ...leitoresComuns<Linha>(),
    descricao: (l) => l.descricao,
    banco: (l) => l.bancoNome,
    fechamento: (l) => l.diaFechamento,
    vencimento: (l) => l.diaVencimento,
    conta: (l) => l.contaPagamentoNome,
    limite: (l) => (l.ilimitado ? null : l.limiteCentavos),
    ilimitado: (l) => l.ilimitado,
  };
  return { f, fechamento, vencimento, ...aplicarAvancadoEOrdem("cartoes-de-credito", linhas, sp, leitores, pref), leitores };
}

export async function carregarCategorias(sp: ParametrosBusca) {
  const todas = await getDb()
    .select({
      id: categoria.id,
      nome: categoria.nome,
      categoriaPaiId: categoria.categoriaPaiId,
      ordem: categoria.ordem,
      cor: categoria.cor,
      natureza: categoria.natureza,
      especial: categoria.especial,
      ativo: categoria.ativo,
      padraoSistema: categoria.padraoSistema,
      campoAuxiliar: categoria.campoAuxiliar,
      criadoEm: categoria.criadoEm,
      atualizadoEm: categoria.atualizadoEm,
    })
    .from(categoria);
  const uso = await usoDasCategorias(getDb());
  // motivoNaoExcluir: null quando a categoria pode ser excluída (ver motivoParaNaoExcluir).
  const arvore = montarArvore(todas).map((c) => ({ ...c, altura: alturaAbaixo(todas, c.id), motivoNaoExcluir: motivoParaNaoExcluir(c, uso.get(c.id)) }));
  const { f, aba, raizes, linhas } = filtrarCategorias(arvore, sp);
  type Linha = (typeof arvore)[number];
  const leitores: Leitores<Linha> = {
    ...leitoresComuns<Linha>(),
    nome: (l) => l.nome,
    numero: (l) => l.numero,
    tipo: (l) => (l.especial ? "Especial" : l.natureza === "receita" ? "Receita" : "Despesa"),
    nivel: (l) => l.nivel,
  };
  // Categorias: a ordem é a da árvore (sem Ordenação).
  return { f, aba, raizes, arvore, ...aplicarAvancadoEOrdem("categorias", linhas, sp, leitores), leitores };
}

const SEXO: Record<string, string> = { masculino: "Masculino", feminino: "Feminino", outro: "Outro", nao_informado: "Não informado" };

export async function carregarContatos(sp: ParametrosBusca, pref?: PreferenciaListagem) {
  const { f, papel, pessoa, cidade, uf, onde } = filtrosContatos(sp);
  const linhas = await getDb().select().from(contato).where(onde).orderBy(desc(contato.ativo), asc(sql`lower(${contato.nome})`));
  type Linha = (typeof linhas)[number];
  const leitores: Leitores<Linha> = {
    ...leitoresComuns<Linha>(),
    nome: (l) => l.nome,
    razaoSocial: (l) => l.razaoSocial,
    pessoa: (l) => (l.pessoa === "fisica" ? "Física" : "Jurídica"),
    documento: (l) => l.documento,
    email: (l) => l.email,
    telefone: (l) => l.telefone,
    sexo: (l) => SEXO[l.sexo] ?? null,
    nascimento: (l) => l.nascimento,
    cliente: (l) => l.eCliente,
    fornecedor: (l) => l.eFornecedor,
    cep: (l) => l.cep,
    endereco: (l) => l.logradouro,
    numero: (l) => l.numero,
    complemento: (l) => l.complemento,
    bairro: (l) => l.bairro,
    cidade: (l) => l.cidade,
    uf: (l) => l.uf,
    observacoes: (l) => l.observacoes,
  };
  return { f, papel, pessoa, cidade, uf, ...aplicarAvancadoEOrdem("clientes-e-fornecedores", linhas, sp, leitores, pref), leitores };
}

export async function carregarFormas(sp: ParametrosBusca, pref?: PreferenciaListagem) {
  const { f, onde } = filtrosFormas(sp);
  const linhas = await getDb().select().from(forma).where(onde).orderBy(desc(forma.ativo), asc(sql`lower(${forma.descricao})`));
  type Linha = (typeof linhas)[number];
  const leitores: Leitores<Linha> = { ...leitoresComuns<Linha>(), descricao: (l) => l.descricao, sigla: (l) => l.sigla };
  return { f, ...aplicarAvancadoEOrdem("formas-de-pagamento", linhas, sp, leitores, pref), leitores };
}

export async function carregarTags(sp: ParametrosBusca, pref?: PreferenciaListagem) {
  const { f, onde } = filtrosTags(sp);
  const linhas = await getDb().select().from(tag).where(onde).orderBy(desc(tag.ativo), asc(sql`lower(${tag.descricao})`));
  type Linha = (typeof linhas)[number];
  const leitores: Leitores<Linha> = { ...leitoresComuns<Linha>(), descricao: (l) => l.descricao };
  return { f, ...aplicarAvancadoEOrdem("tags", linhas, sp, leitores, pref), leitores };
}

export type { ValorCampo };
