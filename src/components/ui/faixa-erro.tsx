import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Faixa amarela de aviso, como no Contas Online: mostra o primeiro erro
 * do formulário (ex.: "Preencha o campo Valor.").
 */
export function FaixaErro({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-sm text-amarelo-texto",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
