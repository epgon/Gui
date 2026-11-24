"use server";

import { getDb } from "@/db";
import { falha, type Resultado } from "@/lib/cadastros/resultado";
import { gravarConfiguracao } from "@/lib/configuracao";
import { chaveImpressoes, lerImpressoesSalvas } from "@/lib/exportacao/impressoes";
import { MAXIMO_IMPRESSOES_SALVAS, normalizarImpressoes, type Personalizacao } from "@/lib/exportacao/tabela";
import { TELAS_LISTAGEM } from "@/lib/listagem/telas";
import { exigirLogin } from "@/lib/sessao";

/** Guarda (ou troca, pelo nome) uma Impressão Personalizada para usar de novo depois. */
export async function salvarImpressao(tela: string, impressao: Personalizacao): Promise<Resultado> {
  await exigirLogin();
  const def = TELAS_LISTAGEM[tela];
  if (!def) return falha("Esta lista não tem Impressão Personalizada.");
  const [nova] = normalizarImpressoes([impressao]);
  if (!nova) return falha("Escolha pelo menos um campo em **Campos**.");
  if (!nova.nome.trim()) return falha("Preencha o campo **Nome da Impressão**.");
  const atuais = await lerImpressoesSalvas(tela);
  const outras = atuais.filter((i) => i.nome.toLowerCase() !== nova.nome.toLowerCase());
  if (outras.length >= MAXIMO_IMPRESSOES_SALVAS) return falha(`Já há ${MAXIMO_IMPRESSOES_SALVAS} impressões guardadas. Apague uma antes de guardar outra.`);
  await getDb().transaction((tx) =>
    gravarConfiguracao(tx, chaveImpressoes(tela), [...outras, nova], { tela: def.titulo, descricao: `a Impressão Personalizada ${nova.nome} de ${def.titulo}` }),
  );
  return { ok: true };
}

export async function excluirImpressao(tela: string, nome: string): Promise<Resultado> {
  await exigirLogin();
  const def = TELAS_LISTAGEM[tela];
  if (!def || typeof nome !== "string") return falha("Impressão não encontrada.");
  const atuais = await lerImpressoesSalvas(tela);
  await getDb().transaction((tx) =>
    gravarConfiguracao(
      tx,
      chaveImpressoes(tela),
      atuais.filter((i) => i.nome !== nome),
      { tela: def.titulo, descricao: `apagou a Impressão Personalizada ${nome} de ${def.titulo}` },
    ),
  );
  return { ok: true };
}
