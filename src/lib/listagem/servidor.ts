import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { descreverFiltro, filtrarAvancado, lerFiltrosAvancados, ordenarPor, type FiltroAvancado, type Leitores } from "./avancado";
import { lerParametros } from "@/lib/parametros/servidor";
import type { CampoAvancado } from "./avancado";
import { normalizarPreferencia, TELAS_LISTAGEM, type PreferenciaListagem } from "./telas";

/** Campos do Filtro Avançado da tela, com o Campo Auxiliar (só se estiver ligado, e com o nome escolhido). */
export async function camposAvancados(tela: string): Promise<CampoAvancado[]> {
  const def = TELAS_LISTAGEM[tela];
  if (!def) return [];
  const aux = def.auxiliar ? (await lerParametros()).camposAuxiliares[def.auxiliar] : null;
  return def.campos.filter((c) => c.chave !== "auxiliar" || aux?.ativo).map((c) => (c.chave === "auxiliar" && aux ? { ...c, rotulo: aux.rotulo } : c));
}

/** Configurações da Listagem gravadas para a tela (ou o padrão). */
export async function lerPreferencia(tela: string): Promise<PreferenciaListagem> {
  const [linha] = await getDb().select().from(schema.preferenciaListagem).where(eq(schema.preferenciaListagem.tela, tela)).limit(1);
  if (!linha) return normalizarPreferencia(tela, null);
  return normalizarPreferencia(tela, {
    colunas: linha.colunas,
    ordenacao: Array.isArray(linha.ordenacao) ? linha.ordenacao[0] : linha.ordenacao,
    porPagina: linha.registrosPorPagina,
    destacarPares: linha.destacarPares,
    compactar: linha.compactar,
  });
}

/**
 * Aplica o Filtro Avançado e a Ordenação escolhida a uma lista já filtrada pelo painel Simples.
 * Sem ordenação escolhida, mantém a ordem que veio do banco.
 */
export function aplicarAvancadoEOrdem<T>(tela: string, linhas: T[], sp: ParametrosBusca, leitores: Leitores<T>, pref?: PreferenciaListagem) {
  const def = TELAS_LISTAGEM[tela];
  const avancados: FiltroAvancado[] = lerFiltrosAvancados(parametro(sp, "av"), def?.campos ?? []);
  let resultado = filtrarAvancado(linhas, avancados, def?.campos ?? [], leitores);
  if (pref?.ordenacao) resultado = ordenarPor(resultado, leitores[pref.ordenacao.campo], pref.ordenacao.direcao);
  return { linhas: resultado, avancados, descricoes: avancados.map((f) => descreverFiltro(f, def?.campos ?? [])).filter(Boolean) };
}

/** Uma página da lista (com o "Registros por página" das Configurações da Listagem). */
export function paginar<T>(linhas: T[], pagina: number, porPagina: number) {
  const ultima = Math.max(1, Math.ceil(linhas.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), ultima);
  return { linhas: linhas.slice((atual - 1) * porPagina, atual * porPagina), total: linhas.length, pagina: atual };
}
