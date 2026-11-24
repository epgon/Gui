import { Calendar, CalendarClock, CalendarDays, CreditCard, Landmark, Shapes, Tag, Users } from "lucide-react";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { BarraRelatorio } from "@/components/relatorios/barra-relatorio";
import { EscolhaRelatorio, PainelFiltrosRelatorio } from "@/components/relatorios/comuns";
import { TabelaSaldo } from "@/components/relatorios/tabela-saldo";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { AGRUPAMENTOS, granularidadeDe, lerAgrupamento, parametrosDosFiltros, rotuloIntervalo } from "@/lib/relatorios/regras";
import { AVISO_TAGS, calcularSaldoDetalhado } from "@/lib/relatorios/relatorios";

export const metadata = { title: "Saldo Detalhado" };
const CAMINHO = "/relatorios/saldo-detalhado";

const ICONES = {
  dia: <CalendarDays className="h-5 w-5" />,
  mes: <Calendar className="h-5 w-5" />,
  ano: <CalendarClock className="h-5 w-5" />,
  categoria: <Shapes className="h-5 w-5" />,
  conta: <Landmark className="h-5 w-5" />,
  contato: <Users className="h-5 w-5" />,
  forma: <CreditCard className="h-5 w-5" />,
  tag: <Tag className="h-5 w-5" />,
};

export default async function PaginaSaldoDetalhado({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const hoje = hojeIso();
  const sp = await searchParams;
  const agrupamento = lerAgrupamento(sp);

  if (!agrupamento) {
    return (
      <>
        <main className="min-w-0 flex-1">
          <CabecalhoPagina titulo="Saldo Detalhado" trilha="Relatórios" />
          <div className="space-y-4 p-6">
            <EscolhaRelatorio titulo="Escolha um relatório" caminho={CAMINHO} nome="relatorio" opcoes={AGRUPAMENTOS} icones={ICONES} />
            <p className="text-sm text-gray-500">O Saldo Detalhado soma receitas, despesas e o resultado do período, agrupados do jeito que você escolher.</p>
          </div>
        </main>
        <PainelAjuda artigos={["Como utilizar o relatório de saldo detalhado", "Como usar os filtros para lançamentos"]} />
      </>
    );
  }

  await realizarAutomaticos(hoje);
  const [{ filtros, saldo }, opcoes] = await Promise.all([calcularSaldoDetalhado(sp, agrupamento, hoje), carregarOpcoes()]);
  const parametros = parametrosDosFiltros(filtros);
  const mantidos = { ...parametros, relatorio: agrupamento, categoria: "", forma: "", contato: "", tag: "" };
  const info = AGRUPAMENTOS.find((a) => a.valor === agrupamento)!;

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Saldo Detalhado" trilha="Relatórios" />
        <div className="space-y-4 p-6">
          <BarraRelatorio
            caminho={CAMINHO}
            tela="saldo-detalhado"
            nomeTipo="relatorio"
            tipos={AGRUPAMENTOS}
            tipoAtual={agrupamento}
            granularidade={granularidadeDe(agrupamento)}
            parametros={parametros}
            destinos={opcoes.destinos}
          />
          <TabelaSaldo saldo={saldo} coluna={info.coluna} aviso={saldo.total ? undefined : AVISO_TAGS} />
          <p className="text-xs text-gray-500">
            Período: {rotuloIntervalo(filtros)}. Inclui as parcelas e os recorrentes previstos. Compras no cartão entram pelas compras, e não pelo pagamento
            da fatura, para não contar duas vezes.
          </p>
        </div>
      </main>
      <PainelFiltrosRelatorio caminho={CAMINHO} mantidos={mantidos} opcoes={opcoes} valores={filtros} />
    </>
  );
}
