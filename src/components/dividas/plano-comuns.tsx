"use client";

import { cn } from "@/lib/cn";
import { ROTULO_SITUACAO_MES, type SerieSaldos, type SituacaoMes } from "@/lib/dividas/plano";
import { formatarReais, rotuloMes } from "@/lib/dividas/simulador";

const ESTILO_MES: Record<SituacaoMes, string> = {
  cumprido: "bg-pago-fundo text-pago-texto",
  parcial: "bg-amarelo text-amarelo-texto",
  nao_cumprido: "bg-orange-100 text-despesa",
  em_andamento: "bg-blue-50 text-receita",
  futuro: "bg-gray-100 text-gray-600",
};

/** Pílula da situação do mês do plano (Cumprido, Parcial, Não cumprido, Em andamento, Futuro). */
export function PilulaMes({ situacao }: { situacao: SituacaoMes }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", ESTILO_MES[situacao])}>{ROTULO_SITUACAO_MES[situacao]}</span>;
}

/** Diferença entre realizado e planejado: azul acima do planejado, laranja abaixo. */
export function Diferenca({ centavos, className }: { centavos: number; className?: string }) {
  if (Math.abs(centavos) < 1) return <span className={cn("text-gray-400", className)}>-</span>;
  return (
    <span className={cn("font-medium", centavos > 0 ? "text-receita" : "text-despesa", className)}>
      {centavos > 0 ? "+" : "−"}
      {formatarReais(Math.abs(centavos))}
    </span>
  );
}

/** Saldo devedor planejado (linha cheia) contra o realizado (linha laranja) até hoje. */
export function GraficoPlano({ serie }: { serie: SerieSaldos }) {
  if (serie.length < 2) return null;
  const largura = 640;
  const altura = 200;
  const margem = { esq: 8, dir: 8, topo: 10, base: 22 };
  const valores = serie.flatMap((p) => [p.planejadoCentavos, p.realizadoCentavos ?? 0]);
  const maximo = Math.max(1, ...valores);
  const y = (v: number) => altura - margem.base - (v / maximo) * (altura - margem.base - margem.topo);
  const x = (i: number) => margem.esq + (i / (serie.length - 1)) * (largura - margem.esq - margem.dir);
  const planejado = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.planejadoCentavos).toFixed(1)}`).join(" ");
  const real = serie.map((p, i) => ({ p, i })).filter(({ p }) => p.realizadoCentavos !== null);
  const realizado = real.map(({ p, i }) => `${x(i).toFixed(1)},${y(p.realizadoCentavos!).toFixed(1)}`).join(" ");
  const ultimoReal = real.at(-1);
  const resumo = `Saldo devedor planejado de ${formatarReais(serie[0].planejadoCentavos)} em ${rotuloMes(serie[0].mes)} até ${formatarReais(serie.at(-1)!.planejadoCentavos)} em ${rotuloMes(serie.at(-1)!.mes)}${ultimoReal ? `; realizado de ${formatarReais(ultimoReal.p.realizadoCentavos!)} em ${rotuloMes(ultimoReal.p.mes)}` : ""}.`;
  return (
    <div>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-52 w-full" role="img" aria-label={resumo}>
        <title>{resumo}</title>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={margem.esq} x2={largura - margem.dir} y1={y(maximo * f)} y2={y(maximo * f)} stroke="#e2e8f0" strokeDasharray={f === 0 ? undefined : "3 3"} />
            <text x={largura - margem.dir} y={y(maximo * f) - 3} textAnchor="end" className="fill-gray-400" fontSize={9}>
              {formatarReais(maximo * f)}
            </text>
          </g>
        ))}
        <polyline points={planejado} fill="none" stroke="#111827" strokeWidth={2.5} strokeLinejoin="round" />
        {realizado && <polyline points={realizado} fill="none" stroke="#e04f16" strokeWidth={2.5} strokeLinejoin="round" />}
        {real.map(({ p, i }) => (
          <circle key={p.mes} cx={x(i)} cy={y(p.realizadoCentavos!)} r={3} fill="#e04f16" />
        ))}
        <text x={margem.esq} y={altura - 6} className="fill-gray-500" fontSize={10}>
          {rotuloMes(serie[0].mes)}
        </text>
        <text x={largura - margem.dir} y={altura - 6} textAnchor="end" className="fill-gray-500" fontSize={10}>
          {rotuloMes(serie.at(-1)!.mes)}
        </text>
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <li className="flex items-center gap-1.5">
          <span className="inline-block w-4 bg-gray-900" style={{ height: 3 }} /> Planejado
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block w-4" style={{ height: 3, background: "#e04f16" }} /> Realizado (aproximado: não conta os juros do atraso)
        </li>
      </ul>
    </div>
  );
}
