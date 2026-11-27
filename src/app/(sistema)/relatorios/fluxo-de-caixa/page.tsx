import { CalendarDays, CalendarRange, CalendarClock, Calendar } from "lucide-react";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { BarraRelatorio } from "@/components/relatorios/barra-relatorio";
import { EscolhaRelatorio, PainelFiltrosRelatorio } from "@/components/relatorios/comuns";
import { TabelaFluxo } from "@/components/relatorios/tabela-fluxo";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { lerPeriodicidade, LIMITE_DIARIO, LIMITES, parametrosDosFiltros, PERIODICIDADES, rotuloIntervalo } from "@/lib/relatorios/regras";
import { calcularFluxoDeCaixa } from "@/lib/relatorios/relatorios";

export const metadata = { title: "Fluxo de Caixa" };
const CAMINHO = "/relatorios/fluxo-de-caixa";

const ICONES = {
  diario: <CalendarDays className="h-5 w-5" />,
  mensal: <Calendar className="h-5 w-5" />,
  trimestral: <CalendarRange className="h-5 w-5" />,
  anual: <CalendarClock className="h-5 w-5" />,
};

export default async function PaginaFluxoDeCaixa({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const hoje = hojeIso();
  const sp = await searchParams;
  const periodicidade = lerPeriodicidade(sp);

  if (!periodicidade) {
    return (
      <>
        <main className="min-w-0 flex-1">
          <CabecalhoPagina titulo="Fluxo de Caixa" trilha="Relatórios" />
          <div className="space-y-4 p-6">
            <EscolhaRelatorio titulo="Escolha um período" caminho={CAMINHO} nome="periodo" opcoes={PERIODICIDADES} icones={ICONES} />
            <p className="text-sm text-gray-500">
              O Fluxo de Caixa mostra quanto entrou (receitas), quanto saiu (despesas) e o saldo de cada período. Os meses futuros já trazem as parcelas e os
              recorrentes previstos.
            </p>
          </div>
        </main>
        <PainelAjuda />
      </>
    );
  }

  await realizarAutomaticos(hoje);
  const [{ filtros, inclusoes, fluxo }, opcoes] = await Promise.all([calcularFluxoDeCaixa(sp, periodicidade, hoje), carregarOpcoes()]);
  const parametros = parametrosDosFiltros(filtros);
  const mantidos = { ...parametros, periodo: periodicidade, categoria: "", forma: "", contato: "", tag: "" };
  const limite = periodicidade === "diario" ? `${LIMITE_DIARIO} dias` : periodicidade === "anual" ? `${LIMITES.ano} anos` : `${LIMITES.mes} meses`;

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Fluxo de Caixa" trilha="Relatórios" />
        <div className="space-y-4 p-6">
          <BarraRelatorio
            caminho={CAMINHO}
            tela="fluxo-de-caixa"
            nomeTipo="periodo"
            tipos={PERIODICIDADES}
            tipoAtual={periodicidade}
            granularidade={periodicidade === "diario" ? "dia" : periodicidade === "anual" ? "ano" : "mes"}
            parametros={parametros}
            destinos={opcoes.destinos}
            inclusoes={inclusoes}
          />
          <TabelaFluxo fluxo={fluxo} />
          <p className="text-xs text-gray-500">
            Período: {rotuloIntervalo(filtros)}. O saldo é só o do período (receitas mais despesas), sem o saldo que as contas já tinham. Compras no cartão
            entram pelas compras (cada uma na sua categoria), e não pelo pagamento da fatura, para não contar duas vezes. Até {limite} por vez.
          </p>
        </div>
      </main>
      <PainelFiltrosRelatorio caminho={CAMINHO} mantidos={mantidos} opcoes={opcoes} valores={filtros} />
    </>
  );
}
