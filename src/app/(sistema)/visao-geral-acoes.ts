"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { falha, type Resultado } from "@/lib/cadastros/resultado";
import { gravarConfiguracao } from "@/lib/configuracao";
import { exigirLogin } from "@/lib/sessao";
import { LIMITES, normalizarOpcoes, type OpcoesVisaoGeral } from "@/lib/visao-geral/regras";
import { CHAVE_OPCOES, lerOpcoesVisaoGeral } from "@/lib/visao-geral/servidor";

/** Grava as "Opções" de um ou mais cartões da Visão Geral. */
export async function salvarOpcoesVisaoGeral(mudancas: Partial<OpcoesVisaoGeral>): Promise<Resultado> {
  await exigirLogin();
  if (!mudancas || typeof mudancas !== "object") return falha("Confira as opções.");
  const dias = (v: unknown, max: number, campo: string) =>
    v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= max) ? null : `O campo **${campo}** aceita de 1 a ${max} dias.`;
  const erro =
    dias(mudancas.vencidosDias, LIMITES.prazoDias, "Dias para trás") ??
    dias(mudancas.futuroDias, LIMITES.prazoDias, "Dias à frente") ??
    dias(mudancas.categoriasDias, LIMITES.categoriasDias, "Período");
  if (erro) return falha(erro);

  const atuais = await lerOpcoesVisaoGeral();
  const novas = normalizarOpcoes({ ...atuais, ...mudancas });
  await getDb().transaction((tx) => gravarConfiguracao(tx, CHAVE_OPCOES, novas, { tela: "Visão Geral", descricao: "as Opções da Visão Geral" }));
  refresh();
  return { ok: true };
}

/** Esconde o cartão Dívidas da Visão Geral (volta pelo Parâmetro "Mostrar o cartão Dívidas na Visão Geral"). */
export async function esconderCartaoDividas(): Promise<Resultado> {
  await exigirLogin();
  await getDb().transaction((tx) => gravarConfiguracao(tx, "dividas.cartao_visao_geral", false, { tela: "Visão Geral", descricao: "o Cartão Dívidas da Visão Geral para escondido" }));
  refresh();
  return { ok: true };
}
