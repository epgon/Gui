import { Home, Star } from "lucide-react";
import Link from "next/link";

/** Barra estreita da esquerda. Os favoritos de verdade chegam na Fase 11. */
export function BarraFavoritos() {
  return (
    <aside className="hidden w-11 shrink-0 flex-col items-center gap-2 border-r border-borda bg-white py-3 md:flex" aria-label="Favoritos">
      <Link href="/" className="rounded-md p-2 text-gray-500 hover:bg-verde-claro hover:text-verde" title="Visão Geral">
        <Home className="h-4.5 w-4.5" />
      </Link>
      <span className="rounded-md p-2 text-gray-400" title="Favoritos (em breve)">
        <Star className="h-4.5 w-4.5" />
      </span>
    </aside>
  );
}
