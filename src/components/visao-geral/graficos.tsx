import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";

/** Mini gráfico de linha do saldo (últimos dias). */
export function MiniGrafico({ serie, ocultar }: { serie: { data: string; saldo: number }[]; ocultar?: boolean }) {
  if (serie.length < 2) return null;
  const largura = 300;
  const altura = 56;
  const valores = serie.map((p) => p.saldo);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const x = (i: number) => (i / (serie.length - 1)) * largura;
  const y = (v: number) => (max === min ? altura / 2 : altura - 4 - ((v - min) / faixa) * (altura - 8));
  const pontos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.saldo).toFixed(1)}`).join(" ");
  const titulo = ocultar
    ? "Evolução do saldo nos últimos 30 dias"
    : `De R$ ${formatarCentavos(serie[0].saldo)} em ${formatarData(serie[0].data)} para R$ ${formatarCentavos(serie.at(-1)!.saldo)} hoje`;
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={titulo}>
      <title>{titulo}</title>
      <polygon points={`0,${altura} ${pontos} ${largura},${altura}`} className="fill-receita/10" />
      <polyline points={pontos} fill="none" className="stroke-receita" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Gráfico de rosca (Despesas por Categorias). */
export function GraficoRosca({ fatias, centro }: { fatias: { nome: string; cor: string; percentual: number }[]; centro?: React.ReactNode }) {
  const raio = 40;
  const circunferencia = 2 * Math.PI * raio;
  const tamanhos = fatias.map((f) => (f.percentual / 100) * circunferencia);
  const inicios = tamanhos.map((_, i) => tamanhos.slice(0, i).reduce((s, t) => s + t, 0));
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={fatias.map((f) => `${f.nome}: ${f.percentual}%`).join(", ")}>
        <circle cx={50} cy={50} r={raio} fill="none" stroke="#eef0f3" strokeWidth={14} />
        {fatias.map((f, i) => {
          const tamanho = tamanhos[i];
          const deslocamento = -inicios[i];
          return (
            <circle key={f.nome} cx={50} cy={50} r={raio} fill="none" stroke={f.cor} strokeWidth={14} strokeDasharray={`${tamanho} ${circunferencia - tamanho}`} strokeDashoffset={deslocamento}>
              <title>{`${f.nome}: ${f.percentual.toLocaleString("pt-BR")}%`}</title>
            </circle>
          );
        })}
      </svg>
      {centro && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{centro}</div>}
    </div>
  );
}
