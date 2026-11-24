import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { ARTIGOS_IMPORTACAO } from "../artigos";
import { EnvioArquivo } from "./envio";

export const metadata = { title: "Nova Importação" };

export default function PaginaNovaImportacao() {
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Nova Importação" trilha="Financeiro > Importações" />
        <div className="space-y-4 p-6">
          <EnvioArquivo />
        </div>
      </main>
      <PainelAjuda artigos={ARTIGOS_IMPORTACAO} />
    </>
  );
}
