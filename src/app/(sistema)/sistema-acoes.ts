"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { falha, type Resultado } from "@/lib/cadastros/resultado";
import { gravarConfiguracao } from "@/lib/configuracao";
import { encontrarItem } from "@/lib/menu";
import { CHAVE_LIDAS, juntarLidas } from "@/lib/notificacoes/tipos";
import { lerFavoritosDe, CHAVE_FAVORITOS, MAXIMO_FAVORITOS } from "@/lib/favoritos";
import { RECURSOS, type Recurso } from "@/lib/parametros/tipos";
import { exigirLogin } from "@/lib/sessao";

/** Marca avisos como lidos (o ponto laranja do sino some quando não sobra nenhum). */
export async function marcarNotificacoesLidas(ids: string[]): Promise<Resultado> {
  await exigirLogin();
  if (!z.array(z.string().min(1).max(120)).max(100).safeParse(ids).success) return falha("Não foi possível marcar como lida.");
  const db = getDb();
  await db.transaction(async (tx) => {
    const [linha] = await tx.select({ valor: schema.configuracao.valor }).from(schema.configuracao).where(eq(schema.configuracao.chave, CHAVE_LIDAS)).for("update");
    const valor = juntarLidas(linha?.valor, ids);
    // Marcar como lida não vai para a auditoria (não é uma mudança nos dados).
    await tx
      .insert(schema.configuracao)
      .values({ chave: CHAVE_LIDAS, valor })
      .onConflictDoUpdate({ target: schema.configuracao.chave, set: { valor, atualizadoEm: new Date() } });
  });
  refresh();
  return { ok: true };
}

/** Liga ou desliga a estrela de uma tela (favoritos da barra da esquerda). */
export async function alternarFavorito(href: string): Promise<Resultado> {
  await exigirLogin();
  if (typeof href !== "string" || !encontrarItem(href)) return falha("Esta tela não pode ser favoritada.");
  const db = getDb();
  await db.transaction(async (tx) => {
    const [linha] = await tx.select({ valor: schema.configuracao.valor }).from(schema.configuracao).where(eq(schema.configuracao.chave, CHAVE_FAVORITOS)).for("update");
    const atuais = lerFavoritosDe(linha?.valor);
    const tinha = atuais.includes(href);
    const novos = tinha ? atuais.filter((x) => x !== href) : [...atuais, href].slice(-MAXIMO_FAVORITOS);
    await gravarConfiguracao(tx, CHAVE_FAVORITOS, novos, { tela: "Favoritos", descricao: `${tinha ? "tirou dos" : "colocou nos"} Favoritos a tela ${encontrarItem(href)!.titulo}` });
  });
  refresh();
  return { ok: true };
}

/** Configurações > Recursos: liga ou desliga um módulo. */
export async function alterarRecurso(chave: Recurso, ligado: boolean): Promise<Resultado> {
  await exigirLogin();
  const recurso = RECURSOS.find((r) => r.chave === chave);
  if (!recurso || typeof ligado !== "boolean") return falha("Recurso não encontrado.");
  await getDb().transaction((tx) =>
    gravarConfiguracao(tx, `recursos.${chave}`, ligado, { tela: "Recursos", descricao: `o recurso ${recurso.rotulo} (${ligado ? "ativado" : "desativado"})` }),
  );
  refresh();
  return { ok: true };
}
