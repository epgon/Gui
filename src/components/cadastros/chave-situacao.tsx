"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** O "check de situação" das listas: marcado = ativo. Clicar ativa ou inativa. */
export function ChaveSituacao({ ativo, aoMudar, ocupado, bloqueado, rotulo }: {
  ativo: boolean;
  aoMudar: () => void;
  ocupado?: boolean;
  bloqueado?: string;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={aoMudar}
      disabled={ocupado || !!bloqueado}
      title={bloqueado ?? (ativo ? `Ativo. Clique para inativar ${rotulo}.` : `Inativo. Clique para ativar ${rotulo}.`)}
      aria-pressed={ativo}
      aria-label={ativo ? `Inativar ${rotulo}` : `Ativar ${rotulo}`}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded border transition",
        ativo ? "border-verde bg-verde text-white" : "border-gray-300 bg-white text-transparent hover:border-verde",
        (ocupado || bloqueado) && "cursor-not-allowed opacity-60",
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}
