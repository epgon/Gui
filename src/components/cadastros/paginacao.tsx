"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useComAvancado } from "@/components/listagem/use-avancado";
import { cn } from "@/lib/cn";

/** "1 a 20 de 54" e setas de página. Mantém os filtros na URL. */
export function Paginacao({ caminho, parametros: proprios, pagina, porPagina, total, semPaginacao }: {
  caminho: string;
  parametros: Record<string, string>;
  pagina: number;
  porPagina: number;
  total: number;
  /** "Sem Paginação" das Configurações da Listagem: não mostra as páginas. */
  semPaginacao?: boolean;
}) {
  const parametros = useComAvancado(proprios);
  if (total === 0 || semPaginacao) return null;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  const link = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...parametros, pagina: String(p) }).filter(([, v]) => v));
    if (p === 1) sp.delete("pagina");
    const qs = sp.toString();
    return qs ? `${caminho}?${qs}` : caminho;
  };
  const seta = (p: number, habilitada: boolean, rotulo: string, icone: React.ReactNode) =>
    habilitada ? (
      <Link href={link(p)} aria-label={rotulo} className="rounded-md border border-borda bg-white p-1.5 text-gray-600 hover:bg-gray-50">
        {icone}
      </Link>
    ) : (
      <span aria-hidden className={cn("rounded-md border border-borda bg-white p-1.5 text-gray-300")}>{icone}</span>
    );

  return (
    <div className="flex items-center justify-end gap-3 text-sm text-gray-600">
      <span>
        {inicio} a {fim} de {total}
      </span>
      {seta(pagina - 1, pagina > 1, "Página anterior", <ChevronLeft className="h-4 w-4" />)}
      {seta(pagina + 1, pagina < paginas, "Próxima página", <ChevronRight className="h-4 w-4" />)}
    </div>
  );
}
