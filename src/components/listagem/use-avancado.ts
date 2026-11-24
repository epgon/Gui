"use client";

import { useSearchParams } from "next/navigation";

/** Junta o Filtro Avançado da URL ("av") aos parâmetros que a tela já mantém (busca, situação...). */
export function useComAvancado(parametros: Record<string, string>): Record<string, string> {
  const av = useSearchParams().get("av") ?? "";
  return av && !parametros.av ? { ...parametros, av } : parametros;
}
