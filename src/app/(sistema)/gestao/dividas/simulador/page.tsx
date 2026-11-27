import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { carregarSimulador } from "@/lib/dividas/simulador-servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaSimulador, type InicioSimulador } from "./tela";

export const metadata = { title: "Simulador de Dívidas" };

const MODOS = ["quitar", "estrategias", "cenarios", "proposta"] as const;

export default async function PaginaSimulador({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("dividas"))) return <RecursoDesativado titulo="Gestão de Dívidas" trilha="Gestão" />;
  const sp = await searchParams;
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const dados = await carregarSimulador(hoje);
  const numero = (n: string) => (/^\d{1,9}$/.test(parametro(sp, n)) ? parametro(sp, n) : null);
  const modo = (MODOS as readonly string[]).includes(parametro(sp, "modo")) ? (parametro(sp, "modo") as InicioSimulador["modo"]) : null;
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Gestão de Dívidas" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaSimulador dados={dados} inicio={{ modo, divida: numero("divida"), negociacao: numero("negociacao"), proposta: numero("proposta") }} />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
