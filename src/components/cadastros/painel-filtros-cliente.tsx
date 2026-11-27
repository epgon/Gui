"use client";

import Form from "next/form";
import Link from "next/link";
import { useState } from "react";
import { PainelLateral } from "@/components/layout/painel-lateral";
import { FiltroAvancado } from "@/components/listagem/filtro-avancado";
import type { CampoAvancado } from "@/lib/listagem/avancado";
import { cn } from "@/lib/cn";

/**
 * Painel da direita nas listas: "Filtros", com as abas Simples e Avançado (quando a lista tem),
 * o botão Filtrar e o link Limpar. Fica dentro do painel lateral (barra Filtros / Central de Ajuda).
 */
export function PainelFiltrosCliente({ caminho, children, limpar, avancado }: {
  caminho: string;
  children: React.ReactNode;
  /** Para onde "Limpar" leva (padrão: a tela sem filtros). */
  limpar?: string;
  /** Campos do Filtro Avançado e o valor atual ("av" da URL). */
  avancado?: { campos: CampoAvancado[]; valor: string };
}) {
  const [aba, setAba] = useState<"simples" | "avancado">(avancado?.valor ? "avancado" : "simples");
  return (
    <PainelLateral
      inicial="filtros"
      filtros={
        <Form action={caminho} className="space-y-4">
          <h2 className="text-lg text-gray-800">Filtros</h2>
          {avancado && (
            <div className="flex rounded-md border border-borda bg-white p-0.5 text-sm" role="tablist">
              {(["simples", "avancado"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  role="tab"
                  aria-selected={aba === a}
                  onClick={() => setAba(a)}
                  className={cn("flex-1 rounded px-3 py-1.5 font-medium", aba === a ? "bg-verde text-white" : "text-gray-600 hover:bg-gray-50")}
                >
                  {a === "simples" ? "Simples" : "Avançado"}
                </button>
              ))}
            </div>
          )}
          {/* As duas abas ficam montadas: o que estiver preenchido em cada uma vai junto ao filtrar. */}
          <div className={cn("space-y-3", aba !== "simples" && "hidden")}>{children}</div>
          {avancado && (
            <div className={cn(aba !== "avancado" && "hidden")}>
              <FiltroAvancado campos={avancado.campos} valor={avancado.valor} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button type="submit" className="h-9 flex-1 rounded-md bg-verde px-4 text-sm font-semibold text-white hover:bg-verde-escuro">
              Filtrar
            </button>
            <Link href={limpar ?? caminho} className="h-9 rounded-md px-3 text-sm leading-9 text-gray-600 hover:bg-gray-100">
              Limpar
            </Link>
          </div>
        </Form>
      }
    />
  );
}
