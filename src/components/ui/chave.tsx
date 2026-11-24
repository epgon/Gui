"use client";

import { cn } from "@/lib/cn";

/** Chave liga/desliga (usada em Recursos, "Pago", filtros etc.). */
export function Chave({ ligada, aoMudar, rotulo, desabilitada }: {
  ligada: boolean;
  aoMudar: (valor: boolean) => void;
  rotulo: string;
  desabilitada?: boolean;
}) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm", desabilitada ? "opacity-60" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={ligada}
        disabled={desabilitada}
        onClick={() => aoMudar(!ligada)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verde",
          ligada ? "bg-verde" : "bg-gray-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            ligada && "translate-x-4",
          )}
        />
      </button>
      <span>{rotulo}</span>
    </label>
  );
}
