"use client";

import { cn } from "@/lib/cn";

/** Chave liga/desliga (usada em Recursos, "Pago", filtros etc.). */
export function Chave({ ligada, aoMudar, rotulo, desabilitada, tamanho = "m" }: {
  ligada: boolean;
  aoMudar: (valor: boolean) => void;
  rotulo: React.ReactNode;
  desabilitada?: boolean;
  /** "p" é a chave pequena do painel de Configurações da Listagem. */
  tamanho?: "m" | "p";
}) {
  const p = tamanho === "p";
  return (
    <label className={cn("inline-flex items-center", p ? "gap-2.5" : "gap-2 text-sm", desabilitada ? "cursor-not-allowed" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={ligada}
        disabled={desabilitada}
        onClick={() => aoMudar(!ligada)}
        className={cn(
          "relative shrink-0 rounded-full transition",
          p ? "h-3.5 w-7" : "h-5 w-9",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verde",
          ligada ? "bg-verde" : "bg-gray-300",
          desabilitada && "opacity-60",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform",
            p ? "h-2.5 w-2.5" : "h-4 w-4",
            ligada && (p ? "translate-x-3.5" : "translate-x-4"),
          )}
        />
      </button>
      <span>{rotulo}</span>
    </label>
  );
}
