"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { falha, idValido, obrigatorio, primeiroErro, type Resultado } from "@/lib/cadastros/resultado";
import { gravarConfiguracao } from "@/lib/configuracao";
import { diaDoMesValido, feriadosSugeridos } from "@/lib/parametros/feriados";
import { CADASTROS_AUXILIARES, OPCOES_NOVO_ATUALIZADO, OPCOES_PREVISAO, type CadastroAuxiliar, type CampoAuxiliar } from "@/lib/parametros/tipos";
import { exigirLogin } from "@/lib/sessao";

const TELA = "Parâmetros";
const { feriado, contaFinanceira: conta, cartaoCredito: cartao } = schema;

export type DadosGerais = { titulo: string; exibirCores: boolean; exibirNumeracao: boolean; novoAtualizadoHoras: number };

const gerais = z.object({
  titulo: obrigatorio("Título", 60),
  exibirCores: z.boolean(),
  exibirNumeracao: z.boolean(),
  novoAtualizadoHoras: z.number().refine((v) => OPCOES_NOVO_ATUALIZADO.some((o) => o.valor === v), "Escolha uma opção em **Novo ou Atualizado**."),
});

export async function salvarParametrosGerais(entrada: DadosGerais): Promise<Resultado> {
  await exigirLogin();
  const v = gerais.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  const d = v.data;
  await getDb().transaction(async (tx) => {
    const aud = (descricao: string) => ({ tela: TELA, descricao });
    await gravarConfiguracao(tx, "titulo", d.titulo, aud(`o Título para ${d.titulo}`));
    await gravarConfiguracao(tx, "categorias.exibir_cores", d.exibirCores, aud(`Exibir Cores das categorias: ${d.exibirCores ? "Sim" : "Não"}`));
    await gravarConfiguracao(tx, "categorias.exibir_numeracao", d.exibirNumeracao, aud(`Exibir Numeração das categorias: ${d.exibirNumeracao ? "Sim" : "Não"}`));
    await gravarConfiguracao(tx, "novo_ou_atualizado_horas", d.novoAtualizadoHoras, aud("o destaque de Novo ou Atualizado"));
  });
  refresh();
  return { ok: true };
}

export type DadosLancamentos = {
  previsaoRecorrenteDias: number;
  pagamentoParcial: boolean;
  campos: { dataReferencia: boolean; documento: boolean; observacao: boolean; anexos: boolean };
};

const lancamentos = z.object({
  previsaoRecorrenteDias: z.number().refine((v) => (OPCOES_PREVISAO as readonly number[]).includes(v), "Escolha uma opção em **Previsão Recorrente**."),
  pagamentoParcial: z.boolean(),
  campos: z.object({ dataReferencia: z.boolean(), documento: z.boolean(), observacao: z.boolean(), anexos: z.boolean() }),
});

export async function salvarParametrosLancamentos(entrada: DadosLancamentos): Promise<Resultado> {
  await exigirLogin();
  const v = lancamentos.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  const d = v.data;
  const sn = (b: boolean) => (b ? "ligado" : "desligado");
  await getDb().transaction(async (tx) => {
    await gravarConfiguracao(tx, "previsao_recorrente_dias", d.previsaoRecorrenteDias, { tela: TELA, descricao: `a Previsão Recorrente para ${d.previsaoRecorrenteDias} dias` });
    await gravarConfiguracao(tx, "pagamento_parcial.ativo", d.pagamentoParcial, { tela: TELA, descricao: `o Pagamento Parcial (${sn(d.pagamentoParcial)})` });
    await gravarConfiguracao(tx, "campos.data_referencia", d.campos.dataReferencia, { tela: TELA, descricao: `o campo Data de Referência (${sn(d.campos.dataReferencia)})` });
    await gravarConfiguracao(tx, "campos.documento", d.campos.documento, { tela: TELA, descricao: `o campo Documento (${sn(d.campos.documento)})` });
    await gravarConfiguracao(tx, "campos.observacao", d.campos.observacao, { tela: TELA, descricao: `a Observação (${sn(d.campos.observacao)})` });
    await gravarConfiguracao(tx, "campos.anexos", d.campos.anexos, { tela: TELA, descricao: `os Anexos (${sn(d.campos.anexos)})` });
  });
  refresh();
  return { ok: true };
}

/** Contas e Cartões: a ordem arrastada vale em todas as listas de opções. */
export async function salvarOrdemContasCartoes(contas: number[], cartoes: number[]): Promise<Resultado> {
  await exigirLogin();
  const ids = z.array(idValido).max(500);
  if (!ids.safeParse(contas).success || !ids.safeParse(cartoes).success) return falha("Não foi possível ler a nova ordem. Recarregue a página.");
  if (new Set(contas).size !== contas.length || new Set(cartoes).size !== cartoes.length) return falha("A lista tem itens repetidos. Recarregue a página.");
  await getDb().transaction(async (tx) => {
    for (const [i, id] of contas.entries()) await tx.update(conta).set({ ordem: i + 1 }).where(eq(conta.id, id));
    for (const [i, id] of cartoes.entries()) await tx.update(cartao).set({ ordem: i + 1 }).where(eq(cartao.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: "Configuração", entidadeId: null, acao: "alterou", descricao: "a Ordenação das Contas e Cartões", dados: { contas, cartoes } });
  });
  refresh();
  return { ok: true };
}

export async function salvarCamposAuxiliares(entrada: Record<CadastroAuxiliar, CampoAuxiliar>): Promise<Resultado> {
  await exigirLogin();
  if (!entrada || typeof entrada !== "object") return falha("Confira os campos.");
  const valor = {} as Record<CadastroAuxiliar, CampoAuxiliar>;
  for (const { chave, rotulo } of CADASTROS_AUXILIARES) {
    const item = entrada[chave];
    if (!item || typeof item.ativo !== "boolean" || typeof item.rotulo !== "string") return falha(`Confira o campo de **${rotulo}**.`);
    const nome = item.rotulo.trim();
    if (item.ativo && !nome) return falha(`Dê um nome ao campo auxiliar de **${rotulo}**.`);
    if (nome.length > 40) return falha(`O nome do campo auxiliar de **${rotulo}** aceita no máximo 40 caracteres.`);
    valor[chave] = { ativo: item.ativo, rotulo: nome || "Campo Auxiliar" };
  }
  await getDb().transaction((tx) => gravarConfiguracao(tx, "campos_auxiliares", valor, { tela: TELA, descricao: "os Campos Auxiliares" }));
  refresh();
  return { ok: true };
}

export type DadosFeriado = { nome: string; dia: string; mes: string; recorrente: boolean; ano: string };

const formFeriado = z
  .object({
    nome: obrigatorio("Nome", 60),
    dia: z.string().trim().min(1, "Preencha o campo **Dia**.").transform(Number),
    mes: z.string().trim().min(1, "Escolha o **Mês**.").transform(Number),
    recorrente: z.boolean(),
    ano: z.string().trim(),
  })
  .transform((d) => ({ ...d, ano: d.recorrente ? null : Number(d.ano) }))
  .refine((d) => d.recorrente || (Number.isInteger(d.ano) && d.ano! >= 2000 && d.ano! <= 2100), "Preencha o **Ano** (de 2000 a 2100) ou marque **Repete todo ano**.")
  .refine((d) => diaDoMesValido(d.dia, d.mes, d.ano), "Este **Dia** não existe no mês escolhido.");

export async function salvarFeriado(id: number | null, entrada: DadosFeriado): Promise<Resultado> {
  await exigirLogin();
  const v = formFeriado.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  if (id !== null && !idValido.safeParse(id).success) return falha("Feriado não encontrado.");
  const dados = v.data;
  const db = getDb();
  const repetido = await db
    .select({ id: feriado.id, nome: feriado.nome })
    .from(feriado)
    .where(and(eq(feriado.dia, dados.dia), eq(feriado.mes, dados.mes), dados.ano === null ? isNull(feriado.ano) : eq(feriado.ano, dados.ano), id ? ne(feriado.id, id) : undefined))
    .limit(1);
  if (repetido.length) return falha(`Já existe o feriado **${repetido[0].nome}** nesta data.`);
  return db.transaction(async (tx) => {
    if (id === null) {
      const [novo] = await tx.insert(feriado).values(dados).returning();
      await registrarAuditoria(tx, { tela: TELA, entidade: "Feriado", entidadeId: novo.id, acao: "cadastrou", descricao: `o Feriado ${novo.nome}`, dados });
      refresh();
      return { ok: true, id: novo.id } as const;
    }
    const [antes] = await tx.select().from(feriado).where(eq(feriado.id, id)).for("update");
    if (!antes) return falha("Este feriado não existe mais.");
    await tx.update(feriado).set(dados).where(eq(feriado.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: "Feriado", entidadeId: id, acao: "alterou", descricao: `o Feriado ${dados.nome}`, dados: diferencas(antes, dados) });
    refresh();
    return { ok: true, id } as const;
  });
}

export async function alterarSituacaoFeriado(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Feriado não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(feriado).set({ ativo }).where(eq(feriado.id, id)).returning();
    if (!linha) return falha("Este feriado não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: "Feriado", entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: `o Feriado ${linha.nome}` });
    refresh();
    return { ok: true } as const;
  });
}

export async function excluirFeriado(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Feriado não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.delete(feriado).where(eq(feriado.id, id)).returning();
    if (!linha) return falha("Este feriado não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: "Feriado", entidadeId: id, acao: "excluiu", descricao: `o Feriado ${linha.nome}`, dados: linha });
    refresh();
    return { ok: true } as const;
  });
}

/** Adiciona os feriados nacionais que faltam: fixos (todo ano) e móveis do ano escolhido. */
export async function adicionarFeriadosNacionais(ano: number): Promise<Resultado & { adicionados?: number }> {
  await exigirLogin();
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return falha("Escolha um **Ano** de 2000 a 2100.");
  return getDb().transaction(async (tx) => {
    const existentes = await tx.select({ dia: feriado.dia, mes: feriado.mes, ano: feriado.ano }).from(feriado);
    const faltam = feriadosSugeridos(ano).filter((s) => !existentes.some((e) => e.dia === s.dia && e.mes === s.mes && (e.ano === null || e.ano === s.ano)));
    if (faltam.length) {
      await tx.insert(feriado).values(faltam.map((f) => ({ ...f, recorrente: f.ano === null })));
      await registrarAuditoria(tx, { tela: TELA, entidade: "Feriado", entidadeId: null, acao: "cadastrou", descricao: `${faltam.length} feriado(s) nacional(is) de ${ano}`, dados: faltam });
    }
    refresh();
    return { ok: true, adicionados: faltam.length } as const;
  });
}

