import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

/** Moldura das telas de Cadastros: faixa do título e área da lista. */
export function MolduraLista({ titulo, children, filtros }: { titulo: string; children: React.ReactNode; filtros: React.ReactNode }) {
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo={titulo} trilha="Cadastros" />
        <div className="space-y-4 p-6">{children}</div>
      </main>
      {filtros}
    </>
  );
}
