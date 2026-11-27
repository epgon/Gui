import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { listarImportacoes, listarRegras } from "@/lib/importacao/consultas";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { TelaImportacoes } from "./tela";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { recursoAtivo } from "@/lib/parametros/servidor";

export const metadata = { title: "Importações" };

export default async function PaginaImportacoes({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("importacao"))) return <RecursoDesativado titulo="Importações" trilha="Financeiro" />;
  const aba = parametro(await searchParams, "aba") === "regras" ? "regras" : "importacoes";
  const [importacoes, regras, opcoes] = await Promise.all([listarImportacoes(), listarRegras(), carregarOpcoes()]);
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Importações" trilha="Financeiro" />
        <div className="space-y-4 p-6">
          <TelaImportacoes aba={aba} importacoes={importacoes} regras={regras} opcoes={opcoes} />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
