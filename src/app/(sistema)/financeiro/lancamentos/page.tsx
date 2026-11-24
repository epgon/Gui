import { FiltroSelecao, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { carregarOpcoes, lerFiltros, listarLancamentos } from "@/lib/lancamentos/consultas";
import { mesDe } from "@/lib/lancamentos/regras";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaLancamentos } from "./tela";

export const metadata = { title: "Lançamentos" };
const CAMINHO = "/financeiro/lancamentos";

export default async function PaginaLancamentos({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const hoje = hojeIso();
  // "Realizar automaticamente": dá baixa no que venceu até hoje (não precisa de tarefa agendada).
  await realizarAutomaticos(hoje);
  const f = lerFiltros(await searchParams, hoje);
  const [{ linhas, resumo }, opcoes] = await Promise.all([listarLancamentos(f, hoje), carregarOpcoes()]);
  const todas = { valor: "", rotulo: "Todas" };
  const mantidos = { mes: f.mes, aba: f.aba === "todos" ? "" : f.aba, destino: f.destino, situacao: f.situacao, busca: f.busca, detalhar: f.detalhar ? "1" : "" };

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Lançamentos" trilha="Financeiro" />
        <div className="space-y-4 p-6">
          <TelaLancamentos linhas={linhas} resumo={resumo} filtros={f} opcoes={opcoes} hoje={hoje} mes={mesDe(f.mes)} caminho={CAMINHO} />
        </div>
      </main>
      <PainelFiltros caminho={CAMINHO}>
        {Object.entries(mantidos)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <FiltroSelecao
          nome="categoria"
          rotulo="Categorias"
          valor={f.categoria}
          opcoes={[todas, ...opcoes.categorias.map((c) => ({ valor: String(c.id), rotulo: "  ".repeat(c.nivel - 1) + c.rotulo }))]}
        />
        <FiltroSelecao nome="forma" rotulo="Formas de Pagamento" valor={f.forma} opcoes={[todas, ...opcoes.formas.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="contato" rotulo="Clientes e Fornecedores" valor={f.contato} opcoes={[{ valor: "", rotulo: "Todos" }, ...opcoes.contatos.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="tag" rotulo="Tags" valor={f.tag} opcoes={[todas, ...opcoes.tags.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
      </PainelFiltros>
    </>
  );
}
