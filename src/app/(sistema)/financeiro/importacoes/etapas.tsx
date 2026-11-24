import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Passos do assistente de importação. O de vínculos só aparece para CSV. */
export function Etapas({ atual, csv }: { atual: number; csv: boolean }) {
  const passos = csv ? ["Arquivo", "Destino e checagem", "Vínculo das colunas", "Revisão e conciliação"] : ["Arquivo", "Destino e checagem", "Revisão e conciliação"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Etapas da importação">
      {passos.map((p, i) => {
        const n = i + 1;
        const feito = n < atual;
        return (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-borda" aria-hidden />}
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                feito ? "bg-verde text-white" : n === atual ? "bg-dourado text-gray-900" : "bg-gray-200 text-gray-500",
              )}
            >
              {feito ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={cn(n === atual ? "font-semibold text-gray-900" : "text-gray-500")} aria-current={n === atual ? "step" : undefined}>
              {p}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
