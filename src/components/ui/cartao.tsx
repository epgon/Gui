import { cn } from "@/lib/cn";

/** Cartão branco com borda suave e cantos arredondados. */
export function Cartao({ titulo, acoes, className, children }: {
  titulo?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-borda bg-white shadow-cartao", className)}>
      {(titulo || acoes) && (
        <header className="flex items-center justify-between border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          {acoes}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
