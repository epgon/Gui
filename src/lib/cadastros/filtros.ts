import { type AnyColumn, type SQL, sql } from "drizzle-orm";

export type Situacao = "todos" | "ativos" | "inativos";
export const POR_PAGINA = 20;

export type ParametrosBusca = Record<string, string | string[] | undefined>;

/** Lê um parâmetro da URL como texto simples. */
export function parametro(sp: ParametrosBusca, nome: string): string {
  const valor = sp[nome];
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

/** Filtros comuns de todas as listas: busca, situação e página. */
export function lerFiltrosComuns(sp: ParametrosBusca) {
  const situacao = parametro(sp, "situacao");
  const pagina = Math.max(1, Math.floor(Number(parametro(sp, "pagina")) || 1));
  return {
    busca: parametro(sp, "busca").slice(0, 100),
    situacao: (["ativos", "inativos"].includes(situacao) ? situacao : "todos") as Situacao,
    pagina,
  };
}

const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn";

/** Compara sem diferenciar maiúsculas nem acentos ("saude" encontra "Saúde"). */
export function contemTexto(coluna: AnyColumn | SQL, busca: string): SQL {
  const termo = "%" + semAcento(busca).toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  return sql`lower(translate(coalesce(${coluna}, ''), ${COM_ACENTO}, ${SEM_ACENTO})) like ${termo}`;
}

/** Condição da situação (ativo/inativo), ou undefined para "todos". */
export function condicaoSituacao(coluna: AnyColumn, situacao: Situacao): SQL | undefined {
  if (situacao === "ativos") return sql`${coluna} = true`;
  if (situacao === "inativos") return sql`${coluna} = false`;
  return undefined;
}

/** "Saúde" -> "Saude" (também usado na tela, para filtrar sem acento). */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
