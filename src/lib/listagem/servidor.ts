import "server-only";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { descreverFiltro, filtrarAvancado, lerFiltrosAvancados, ordenarPorVarios, type FiltroAvancado, type Leitores } from "./avancado";
import { lerParametros } from "@/lib/parametros/servidor";
import type { CampoAvancado } from "./avancado";
import { normalizarPreferencia, TELA_GLOBAL, TELAS_LISTAGEM, type PreferenciaListagem } from "./telas";

/** Campos do Filtro Avançado da tela, com o Campo Auxiliar (só se estiver ligado, e com o nome escolhido). */
export async function camposAvancados(tela: string): Promise<CampoAvancado[]> {
  const def = TELAS_LISTAGEM[tela];
  if (!def) return [];
  const aux = def.auxiliar ? (await lerParametros()).camposAuxiliares[def.auxiliar] : null;
  return def.campos.filter((c) => c.chave !== "auxiliar" || aux?.ativo).map((c) => (c.chave === "auxiliar" && aux ? { ...c, rotulo: aux.rotulo } : c));
}

/**
 * Configurações da Listagem gravadas para a tela (ou o padrão). A aparência (Destacar Linhas Pares,
 * Compactar Linhas) vale para todas as listas: se houver a linha global, ela vence a da tela.
 */
export async function lerPreferencia(tela: string): Promise<PreferenciaListagem> {
  const linhas = await getDb().select().from(schema.preferenciaListagem).where(inArray(schema.preferenciaListagem.tela, [tela, TELA_GLOBAL]));
  const linha = linhas.find((l) => l.tela === tela);
  const global = linhas.find((l) => l.tela === TELA_GLOBAL);
  const pref = normalizarPreferencia(tela, linha && {
    colunas: linha.colunas,
    ordenacao: linha.ordenacao,
    porPagina: linha.registrosPorPagina,
    semPaginacao: linha.semPaginacao,
    destacarPares: linha.destacarPares,
    compactar: linha.compactar,
    destaques: linha.destaques,
  });
  return global ? { ...pref, destacarPares: global.destacarPares, compactar: global.compactar } : pref;
}

/**
 * Aplica o Filtro Avançado e a Ordenação escolhida a uma lista já filtrada pelo painel Simples.
 * Sem ordenação escolhida, mantém a ordem que veio do banco.
 */
export function aplicarAvancadoEOrdem<T>(tela: string, linhas: T[], sp: ParametrosBusca, leitores: Leitores<T>, pref?: PreferenciaListagem) {
  const def = TELAS_LISTAGEM[tela];
  const avancados: FiltroAvancado[] = lerFiltrosAvancados(parametro(sp, "av"), def?.campos ?? []);
  let resultado = filtrarAvancado(linhas, avancados, def?.campos ?? [], leitores);
  if (pref?.ordenacao.length) resultado = ordenarPorVarios(resultado, pref.ordenacao.map((o) => ({ leitor: leitores[o.campo], direcao: o.direcao })));
  return { linhas: resultado, avancados, descricoes: avancados.map((f) => descreverFiltro(f, def?.campos ?? [])).filter(Boolean) };
}

/** Uma página da lista (com o "Registros por Página" das Configurações da Listagem; sem paginação, tudo). */
export function paginar<T>(linhas: T[], pagina: number, porPagina: number, semPaginacao = false) {
  if (semPaginacao) return { linhas, total: linhas.length, pagina: 1 };
  const ultima = Math.max(1, Math.ceil(linhas.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), ultima);
  return { linhas: linhas.slice((atual - 1) * porPagina, atual * porPagina), total: linhas.length, pagina: atual };
}
