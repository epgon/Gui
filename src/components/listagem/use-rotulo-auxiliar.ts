"use client";

import { useSistema } from "@/components/layout/provedor-sistema";
import { TELAS_LISTAGEM } from "@/lib/listagem/telas";

/** Nome do Campo Auxiliar escolhido em Parâmetros (ex.: "Agência e conta"). */
export function useRotuloAuxiliar(tela: string): string {
  const { parametros } = useSistema();
  const aux = TELAS_LISTAGEM[tela]?.auxiliar;
  return aux ? parametros.camposAuxiliares[aux].rotulo : "Campo Auxiliar";
}
