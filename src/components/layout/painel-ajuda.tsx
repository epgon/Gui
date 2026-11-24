import { BookOpen, Search } from "lucide-react";

/** Painel da direita: "Central de Ajuda" (nas listas, vira o painel de Filtros). */
export function PainelAjuda({ artigos = [], trilha = [] }: { artigos?: string[]; trilha?: string[] }) {
  return (
    <aside className="hidden w-72 shrink-0 border-l border-borda-painel bg-painel xl:block" aria-label="Central de Ajuda">
      <div className="sticky top-14 space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Central de Ajuda</h2>
          <p className="text-xs text-gray-500">Como podemos ajudá-lo?</p>
        </div>
        {trilha.length > 0 && (
          <nav aria-label="Onde você está" className="text-xs text-gray-500">
            {["Início", ...trilha].join(" > ")}
          </nav>
        )}
        <label className="flex h-9 items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm text-gray-400">
          <Search className="h-4 w-4" />
          <input disabled placeholder="Buscar artigos (em breve)" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
        </label>
        {artigos.length > 0 && (
          <ul className="space-y-1">
            {artigos.map((a) => (
              <li key={a} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-verde" />
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
