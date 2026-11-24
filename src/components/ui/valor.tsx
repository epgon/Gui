import { formatarCentavos } from "@/lib/dinheiro";
import { cn } from "@/lib/cn";

/** Valor em reais: azul para entrada, vermelho para saída, centavos menores. */
export function Valor({ centavos, className }: { centavos: number; className?: string }) {
  const [inteiro, decimal] = formatarCentavos(centavos).split(",");
  return (
    <span className={cn("font-semibold tabular-nums", centavos < 0 ? "text-negativo" : "text-receita", className)}>
      {inteiro}
      <span className="text-[0.75em]">,{decimal}</span>
    </span>
  );
}
