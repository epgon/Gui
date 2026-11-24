"use client";

import { useSistema } from "@/components/layout/provedor-sistema";
import type { Coluna } from "@/components/ui/tabela";
import { novoOuAtualizado } from "@/lib/parametros/tipos";

type Registro = { id: number; campoAuxiliar?: string | null; criadoEm?: Date | string; atualizadoEm?: Date | string };

const dataHora = (d: Date | string | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "";

/** Colunas que toda lista de Cadastros pode ligar: Código, Campo Auxiliar, Cadastrado e Atualizado. */
export function colunasComuns<T extends Registro>(rotuloAuxiliar: string): Coluna<T>[] {
  return [
    { chave: "codigo", titulo: "Código", alinhar: "direita", render: (l) => <span className="tabular-nums text-gray-500">{l.id}</span> },
    { chave: "auxiliar", titulo: rotuloAuxiliar, render: (l) => l.campoAuxiliar ?? "" },
    { chave: "cadastrado", titulo: "Cadastrado", render: (l) => <span className="whitespace-nowrap text-gray-500">{dataHora(l.criadoEm)}</span> },
    { chave: "atualizado", titulo: "Atualizado", render: (l) => <span className="whitespace-nowrap text-gray-500">{dataHora(l.atualizadoEm)}</span> },
  ];
}

/** Ícone laranja dos cadastros novos ou alterados (Parâmetros Gerais > Novo ou Atualizado). */
export function MarcaNovo({ registro }: { registro: Registro }) {
  const horas = useSistema().parametros.novoAtualizadoHoras;
  if (!novoOuAtualizado(registro.atualizadoEm, horas)) return null;
  const novo = registro.criadoEm && registro.atualizadoEm && Math.abs(new Date(registro.atualizadoEm).getTime() - new Date(registro.criadoEm).getTime()) < 2000;
  return (
    <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-despesa align-middle" title={novo ? "Cadastro novo" : "Alterado recentemente"} aria-label={novo ? "Novo" : "Atualizado"} />
  );
}

/** Põe as colunas comuns antes do menu de três pontos (que fica sempre no fim). */
export function comComuns<T extends Registro>(colunas: Coluna<T>[], rotuloAuxiliar: string): Coluna<T>[] {
  const menu = colunas.filter((c) => c.chave === "menu");
  return [...colunas.filter((c) => c.chave !== "menu"), ...colunasComuns<T>(rotuloAuxiliar), ...menu];
}
