"use client";

import { createContext, useContext } from "react";
import { lerParametrosDe, lerRecursosDe, type Parametros, type Recursos } from "@/lib/parametros/tipos";

export type Sistema = {
  parametros: Parametros;
  recursos: Recursos;
  /** Endereços favoritos da barra da esquerda, na ordem escolhida. */
  favoritos: string[];
};

const padrao: Sistema = { parametros: lerParametrosDe({}), recursos: lerRecursosDe({}), favoritos: [] };
const Contexto = createContext<Sistema>(padrao);

/** Leva os Parâmetros, Recursos e Favoritos (lidos no servidor) a todas as telas. */
export function ProvedorSistema({ valor, children }: { valor: Sistema; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSistema(): Sistema {
  return useContext(Contexto);
}
