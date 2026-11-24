/** Favoritos da barra da esquerda: endereços de telas do menu, guardados em "configuracao". */
import { encontrarItem } from "./menu";

export const CHAVE_FAVORITOS = "favoritos";
export const MAXIMO_FAVORITOS = 12;

/** Só telas que existem no menu, sem repetir, no máximo 12. */
export function lerFavoritosDe(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const unicos = [...new Set(valor.filter((x): x is string => typeof x === "string" && !!encontrarItem(x)))];
  return unicos.slice(0, MAXIMO_FAVORITOS);
}
