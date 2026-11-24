import { cn } from "@/lib/cn";

/**
 * Logotipo "Gui": letras em ardósia (ou branco, sobre a barra verde)
 * e uma moedinha dourada no lugar do pingo do "i".
 */
export function LogoGui({ variante = "escuro", className }: { variante?: "escuro" | "claro"; className?: string }) {
  return (
    <span
      aria-label="Gui"
      className={cn(
        "inline-flex items-end font-extrabold leading-none tracking-tight select-none",
        variante === "claro" ? "text-white" : "text-ardosia",
        className,
      )}
    >
      <span aria-hidden>Gu</span>
      <span aria-hidden className="relative inline-block">
        ı
        <span className="absolute left-1/2 top-[-0.18em] h-[0.34em] w-[0.34em] -translate-x-1/2 rounded-full border border-amber-600/40 bg-dourado shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]" />
      </span>
    </span>
  );
}
