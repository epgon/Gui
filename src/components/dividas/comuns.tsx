"use client";

import Link from "next/link";
import { BotaoAjuda } from "@/components/ajuda/central-ajuda";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { rotuloSituacaoNegociacao, type SituacaoNegociacao } from "@/lib/dividas/negociacao";
import { ROTULO_SITUACAO_DIVIDA, type ResumoSaldo, type SituacaoDivida } from "@/lib/dividas/regras";
import { formatarReais } from "@/lib/dividas/simulador";
import { TELA_DA_ABA } from "@/lib/ajuda/contexto";
import { ABAS_DIVIDAS } from "@/lib/menu";

/** Abas do módulo, no estilo das abas de Lançamentos. Cada uma tem endereço próprio. */
export function AbasDividas({ ativa }: { ativa: string }) {
  return (
    <div className="flex gap-1 border-b border-borda" role="tablist">
      {ABAS_DIVIDAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          role="tab"
          aria-selected={ativa === a.href}
          className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", ativa === a.href ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}
        >
          {a.titulo}
        </Link>
      ))}
      {/* Do xl para cima a ajuda fica na barra do painel lateral; o botão só serve a telas menores. */}
      <BotaoAjuda tela={TELA_DA_ABA[ativa] ?? "visao"} className="xl:hidden" />
    </div>
  );
}

const ESTILO_SITUACAO: Record<SituacaoDivida, string> = {
  em_dia: "bg-pago-fundo text-pago-texto",
  em_atraso: "bg-orange-100 text-despesa",
  em_negociacao: "bg-amarelo text-amarelo-texto",
  quitada: "bg-blue-50 text-receita",
  renegociada: "bg-gray-100 text-gray-600",
  cancelada: "bg-gray-100 text-gray-500",
};

/** Pílula da situação da dívida (Em dia, Em atraso, Quitada...). */
export function PilulaSituacao({ situacao, diasAtraso }: { situacao: SituacaoDivida; diasAtraso?: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", ESTILO_SITUACAO[situacao])} title={situacao === "em_atraso" && diasAtraso ? `Parcela mais antiga vencida há ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"}.` : undefined}>
      {ROTULO_SITUACAO_DIVIDA[situacao]}
      {situacao === "em_atraso" && diasAtraso ? ` há ${diasAtraso} d` : ""}
    </span>
  );
}

const ESTILO_NEGOCIACAO: Record<SituacaoNegociacao, string> = {
  em_andamento: "bg-amarelo text-amarelo-texto",
  proposta_recebida: "bg-blue-50 text-receita",
  aguardando_resposta: "bg-amarelo text-amarelo-texto",
  aceita: "bg-pago-fundo text-pago-texto",
  recusada: "bg-orange-100 text-despesa",
  desistida: "bg-gray-100 text-gray-500",
};

/** Pílula da situação da negociação. */
export function PilulaNegociacao({ situacao }: { situacao: SituacaoNegociacao }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", ESTILO_NEGOCIACAO[situacao])}>{rotuloSituacaoNegociacao(situacao)}</span>;
}

/** De onde vem o saldo mostrado: "informado em 10/11", "estimado" (com atraso) ou nada (pelas parcelas). */
export function NotaSaldo({ saldo }: { saldo: ResumoSaldo }) {
  if (saldo.origem === "informado" && saldo.informadoEm) {
    return (
      <span className={cn("block text-xs", saldo.informadoAntigo ? "text-amarelo-texto" : "text-gray-400")} title={saldo.informadoAntigo ? "Este saldo foi informado há mais de 60 dias. Vale atualizar com o credor." : "Saldo que o credor informou, menos o que foi pago depois."}>
        informado em {formatarData(saldo.informadoEm)}
        {saldo.informadoAntigo ? " (antigo)" : ""}
      </span>
    );
  }
  if (saldo.origem === "estimado") {
    return (
      <span className="block text-xs text-gray-400" title="Parcelas mais a estimativa de multa e juros de atraso. O valor certo é o que o credor informar.">
        estimado
      </span>
    );
  }
  return null;
}

const COR_BARRA = { verde: "bg-verde-vivo", amarelo: "bg-dourado", laranja: "bg-despesa" } as const;

/** Barra de progresso no estilo dos Orçamentos (verde por padrão; amarela e laranja para os alertas de limite). */
export function BarraProgresso({ percentual, className, cor = "verde", rotulo = "Quanto já foi pago" }: { percentual: number; className?: string; cor?: keyof typeof COR_BARRA; rotulo?: string }) {
  const largura = Math.min(100, Math.max(percentual > 0 ? 3 : 0, percentual));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-100", className)} role="progressbar" aria-valuenow={Math.min(100, percentual)} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}>
      <div className={cn("h-full rounded-full", COR_BARRA[cor])} style={{ width: `${largura}%` }} />
    </div>
  );
}

/** Mini gráfico de linha da evolução do total devido, nos últimos meses (no mesmo estilo do mini gráfico do saldo). */
export function MiniEvolucao({ serie, ocultar }: { serie: { mes: string; totalCentavos: number }[]; ocultar?: boolean }) {
  if (serie.length < 2) return null;
  const largura = 300;
  const altura = 48;
  const valores = serie.map((p) => p.totalCentavos);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const x = (i: number) => (i / (serie.length - 1)) * largura;
  const y = (v: number) => (max === min ? altura / 2 : altura - 4 - ((v - min) / faixa) * (altura - 8));
  const pontos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.totalCentavos).toFixed(1)}`).join(" ");
  const rotuloMes = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
  const titulo = ocultar ? "Evolução do total devido nos últimos meses" : `De ${formatarReais(serie[0].totalCentavos)} em ${rotuloMes(serie[0].mes)} para ${formatarReais(serie.at(-1)!.totalCentavos)} agora`;
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" className="h-12 w-full" role="img" aria-label={titulo}>
      <title>{titulo}</title>
      <polygon points={`0,${altura} ${pontos} ${largura},${altura}`} className="fill-verde/10" />
      <polyline points={pontos} fill="none" className="stroke-verde" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
