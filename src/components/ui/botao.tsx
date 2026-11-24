import { cn } from "@/lib/cn";

type Variante = "primario" | "secundario" | "perigo" | "fantasma" | "novo";

const estilos: Record<Variante, string> = {
  primario: "bg-verde text-white hover:bg-verde-escuro",
  secundario: "border border-borda bg-white text-gray-700 hover:bg-gray-50",
  perigo: "bg-despesa text-white hover:brightness-95",
  fantasma: "text-gray-600 hover:bg-gray-100",
  novo: "bg-verde-vivo text-white hover:brightness-95",
};

export type BotaoProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  icone?: React.ReactNode;
  carregando?: boolean;
};

/** Botão padrão. "primario" é o verde de Adicionar, Salvar e Filtrar. */
export function Botao({ variante = "primario", icone, carregando, className, children, disabled, ...props }: BotaoProps) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verde",
        "disabled:cursor-not-allowed disabled:opacity-60",
        estilos[variante],
        className,
      )}
    >
      {carregando ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icone
      )}
      {children}
    </button>
  );
}
