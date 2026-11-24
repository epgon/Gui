import { FiltroSelecao, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { lerFiltrosRecorrentes, listarRecorrentes } from "@/lib/recorrentes/lista";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaRecorrentes } from "./tela";

export const metadata = { title: "Recorrentes" };
const CAMINHO = "/financeiro/recorrentes";

export default async function PaginaRecorrentes({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const sp = await searchParams;
  const f = lerFiltrosRecorrentes(sp);
  const editar = Number(parametro(sp, "editar")) || null;
  const { linhas, opcoes, planos } = await listarRecorrentes(f, hoje);
  const todas = { valor: "", rotulo: "Todas" };
  const mantidos = { aba: f.aba === "todos" ? "" : f.aba, destino: f.destino, intervalo: f.intervalo, busca: f.busca, detalhar: f.detalhar ? "1" : "" };

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Recorrentes" trilha="Financeiro" />
        <div className="space-y-4 p-6">
          <TelaRecorrentes linhas={linhas} filtros={f} opcoes={opcoes} planos={planos} hoje={hoje} caminho={CAMINHO} editarId={editar} />
        </div>
      </main>
      <PainelFiltros caminho={CAMINHO}>
        {Object.entries(mantidos)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <FiltroSelecao
          nome="situacao"
          rotulo="Situação"
          valor={f.situacao}
          opcoes={[
            { valor: "ativos", rotulo: "Ativos" },
            { valor: "inativos", rotulo: "Inativos" },
            { valor: "todos", rotulo: "Todos" },
          ]}
        />
        <FiltroSelecao
          nome="categoria"
          rotulo="Categorias"
          valor={f.categoria}
          opcoes={[todas, ...opcoes.categorias.map((c) => ({ valor: String(c.id), rotulo: "  ".repeat(c.nivel - 1) + c.rotulo }))]}
        />
        <FiltroSelecao nome="forma" rotulo="Formas de Pagamento" valor={f.forma} opcoes={[todas, ...opcoes.formas.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="contato" rotulo="Clientes e Fornecedores" valor={f.contato} opcoes={[{ valor: "", rotulo: "Todos" }, ...opcoes.contatos.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="tag" rotulo="Tags" valor={f.tag} opcoes={[todas, ...opcoes.tags.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="plano" rotulo="Planos" valor={f.plano} opcoes={[{ valor: "", rotulo: "Todos" }, ...planos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))]} />
      </PainelFiltros>
    </>
  );
}
