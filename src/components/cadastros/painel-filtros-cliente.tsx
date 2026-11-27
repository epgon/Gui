"use client";

import { Check } from "lucide-react";
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
          <h2 className="text-lg font-normal text-gray-800">Filtros</h2>
          {avancado && (
            <div className="flex gap-4 border-b border-borda-painel" role="tablist">
              {(["simples", "avancado"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  role="tab"
                  aria-selected={aba === a}
                  onClick={() => setAba(a)}
                  className={cn("-mb-px border-b-2 pb-1.5 text-[13px]", aba === a ? "border-verde font-medium text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900")}
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
          <div className="flex items-center gap-3">
            <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-verde px-4 text-[13px] font-medium text-white hover:bg-verde-escuro">
              <Check className="h-4 w-4" />
              Filtrar
            </button>
            <Link href={limpar ?? caminho} className="text-[13px] text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline">
              Limpar
            </Link>
          </div>
        </Form>
      }
    />
  );
}
