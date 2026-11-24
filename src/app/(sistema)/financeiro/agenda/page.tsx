import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { carregarOpcoes, lerFiltros, listarLancamentos } from "@/lib/lancamentos/consultas";
import { mesDe } from "@/lib/lancamentos/regras";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaAgenda } from "./tela";

export const metadata = { title: "Agenda" };
const CAMINHO = "/financeiro/agenda";

export default async function PaginaAgenda({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const sp = await searchParams;
  // A agenda usa a mesma lista de Lançamentos do mês (com recorrentes previstos e faturas), sem os outros filtros.
  const base = lerFiltros(sp, hoje);
  const f = { ...base, aba: "todos" as const, situacao: "" as const, busca: "", detalhar: false, categoria: "", forma: "", contato: "", tag: "" };
  const [{ linhas, resumo }, opcoes] = await Promise.all([listarLancamentos(f, hoje), carregarOpcoes()]);
  return (
    <main className="min-w-0 flex-1">
      <CabecalhoPagina titulo="Agenda" trilha="Financeiro" />
      <div className="space-y-4 p-6">
        <TelaAgenda linhas={linhas} resumo={resumo} destino={f.destino} opcoes={opcoes} hoje={hoje} mes={mesDe(f.mes)} caminho={CAMINHO} />
      </div>
    </main>
  );
}
