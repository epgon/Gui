import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { Demonstracao } from "./demonstracao";

export const metadata = { title: "Componentes" };

/** Vitrine dos componentes base, para conferir o visual. */
export default function PaginaComponentes() {
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Componentes" trilha="Vitrine do visual" />
        <div className="p-6">
          <Demonstracao />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
