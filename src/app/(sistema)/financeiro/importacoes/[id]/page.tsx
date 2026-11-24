import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { carregarImportacao } from "@/lib/importacao/consultas";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { ARTIGOS_IMPORTACAO } from "../artigos";
import { Assistente } from "./assistente";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { recursoAtivo } from "@/lib/parametros/servidor";

export const metadata = { title: "Importação" };

export default async function PaginaImportacao({ params }: { params: Promise<{ id: string }> }) {
  if (!(await recursoAtivo("importacao"))) return <RecursoDesativado titulo="Importações" trilha="Financeiro" />;
  const { id } = await params;
  const [imp, opcoes] = await Promise.all([carregarImportacao(Number(id)), carregarOpcoes()]);
  if (!imp) notFound();
  const larga = imp.etapa === "revisao";
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo={imp.situacao === "rascunho" ? "Importação" : "Importação concluída"} trilha="Financeiro > Importações" />
        <div className="space-y-4 p-6">
          <Assistente imp={imp} opcoes={opcoes} />
        </div>
      </main>
      {!larga && <PainelAjuda artigos={ARTIGOS_IMPORTACAO} />}
    </>
  );
}
