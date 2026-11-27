"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { falha, type Resultado } from "@/lib/cadastros/resultado";
import { gravarConfiguracao } from "@/lib/configuracao";
import { chaveInclusoes } from "@/lib/relatorios/inclusoes";
import { lerInclusoes, TELAS_COM_INCLUSOES, type InclusoesRelatorio, type TelaComInclusoes } from "@/lib/relatorios/regras";
import { exigirLogin } from "@/lib/sessao";

const TITULOS: Record<TelaComInclusoes, string> = { "fluxo-de-caixa": "Fluxo de Caixa", "saldo-detalhado": "Saldo Detalhado" };

/** Grava a engrenagem "Incluir as categorias" (Categorias Zeradas, Acerto de Saldo e Transferência) de um relatório. */
export async function salvarInclusoesRelatorio(tela: string, entrada: InclusoesRelatorio): Promise<Resultado> {
  await exigirLogin();
  if (!(TELAS_COM_INCLUSOES as readonly string[]).includes(tela)) return falha("Este relatório não tem essas configurações.");
  const qual = tela as TelaComInclusoes;
  const valor = lerInclusoes(entrada);
  await getDb().transaction(async (tx) => {
    await gravarConfiguracao(tx, chaveInclusoes(qual), valor, { tela: TITULOS[qual], descricao: `as categorias incluídas no ${TITULOS[qual]}` });
  });
  refresh();
  return { ok: true };
}
