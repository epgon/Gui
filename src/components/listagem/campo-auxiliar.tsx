"use client";

import { useSistema } from "@/components/layout/provedor-sistema";
import { CampoTexto } from "@/components/ui/campo";
import type { CadastroAuxiliar } from "@/lib/parametros/tipos";

/** O Campo Auxiliar no formulário do cadastro (só aparece se estiver ligado em Parâmetros). */
export function CampoAuxiliarFormulario({ cadastro, valor, aoMudar, className }: { cadastro: CadastroAuxiliar; valor: string; aoMudar: (v: string) => void; className?: string }) {
  const aux = useSistema().parametros.camposAuxiliares[cadastro];
  if (!aux.ativo) return null;
  return <CampoTexto className={className} rotulo={aux.rotulo} maxLength={200} valor={valor} aoMudar={aoMudar} ajuda="Campo Auxiliar: configure o nome em Configurações > Parâmetros." />;
}
