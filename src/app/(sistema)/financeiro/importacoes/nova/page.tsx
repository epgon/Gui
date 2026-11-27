import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { EnvioArquivo } from "./envio";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { recursoAtivo } from "@/lib/parametros/servidor";

export const metadata = { title: "Nova Importação" };

export default async function PaginaNovaImportacao() {
  if (!(await recursoAtivo("importacao"))) return <RecursoDesativado titulo="Importações" trilha="Financeiro" />;
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Nova Importação" trilha="Financeiro > Importações" />
        <div className="space-y-4 p-6">
          <EnvioArquivo />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
