"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { cn } from "@/lib/cn";
import { formatarReais, rotuloMes, type AvisoSimulacao, type DividaSim, type ResultadoSimulacao } from "@/lib/dividas/simulador";

const CORES = ["#0f5132", "#1d6ce0", "#e04f16", "#7c3aed", "#0891b2", "#b45309", "#be185d", "#4d7c0f"];

/** A faixa do topo: o Simulador nunca grava nada. */
export function FaixaSimulacao() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amarelo-borda bg-amarelo px-4 py-2 text-sm font-medium text-amarelo-texto" role="note">
      <Info className="h-4 w-4 shrink-0" />
      Simulação: nenhum dado real é alterado.
    </div>
  );
}

/** Avisos do simulador (mês negativo, reserva abaixo do mínimo, não quita...). */
export function Avisos({ avisos }: { avisos: AvisoSimulacao[] }) {
  if (!avisos.length) return null;
  return (
    <ul className="space-y-2" aria-label="Avisos da simulação">
      {avisos.map((a, i) => (
        <li key={`${a.tipo}-${i}`} className="flex items-start gap-2 rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-sm text-amarelo-texto">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{a.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** Um número grande com título, no estilo dos indicadores do Gui. */
export function Indicador({ titulo, valor, nota, destaque, alerta }: { titulo: string; valor: React.ReactNode; nota?: React.ReactNode; destaque?: boolean; alerta?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-cartao", destaque ? "border-verde-vivo" : "border-borda")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", alerta ? "text-despesa" : "text-gray-900")}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-gray-500">{nota}</p>}
    </div>
  );
}

/** Gráfico do saldo devedor caindo por dívida (linhas) e o total (linha grossa). */
export function GraficoSaldo({ resultado, dividas }: { resultado: ResultadoSimulacao; dividas: DividaSim[] }) {
  const meses = resultado.meses;
  if (meses.length < 2) return null;
  const largura = 640;
  const altura = 200;
  const margem = { esq: 8, dir: 8, topo: 10, base: 22 };
  const maximo = Math.max(1, resultado.saldoInicialCentavos, ...meses.map((m) => m.saldoCentavos));
  const y = (v: number) => altura - margem.base - (v / maximo) * (altura - margem.base - margem.topo);
  const total = [resultado.saldoInicialCentavos, ...meses.map((m) => m.saldoCentavos)];
  // O ponto 0 é o saldo de hoje; os demais, o fim de cada mês.
  const serie = (id: string, ini: number) => [ini, ...meses.map((m) => m.porDivida[id]?.saldoCentavos ?? 0)];
  const pontos = meses.length + 1;
  const xx = (i: number) => margem.esq + (i / (pontos - 1)) * (largura - margem.esq - margem.dir);
  const poli = (valores: number[]) => valores.map((v, i) => `${xx(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const resumo = `Saldo devedor de ${formatarReais(resultado.saldoInicialCentavos)} hoje até ${formatarReais(meses.at(-1)!.saldoCentavos)} em ${rotuloMes(meses.at(-1)!.mes)}.`;
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
        {dividas.map((d, k) => (
          <polyline key={d.id} points={poli(serie(d.id, d.saldoCentavos))} fill="none" stroke={CORES[k % CORES.length]} strokeWidth={1.5} strokeLinejoin="round" strokeDasharray={d.hipotetica ? "4 3" : undefined} />
        ))}
        <polyline points={poli(total)} fill="none" stroke="#111827" strokeWidth={2.5} strokeLinejoin="round" />
        <text x={margem.esq} y={altura - 6} className="fill-gray-500" fontSize={10}>
          {rotuloMes(meses[0].mes)}
        </text>
        <text x={largura - margem.dir} y={altura - 6} textAnchor="end" className="fill-gray-500" fontSize={10}>
          {rotuloMes(meses.at(-1)!.mes)}
        </text>
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-gray-900" style={{ height: 3 }} /> Total
        </li>
        {dividas.map((d, k) => (
          <li key={d.id} className="flex items-center gap-1.5">
            <span className="inline-block w-4" style={{ height: 2, background: CORES[k % CORES.length] }} /> {d.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}

const LINHAS_INICIAIS = 24;

/** Tabela mês a mês, com a faixa amarela de totais. */
export function TabelaMeses({ resultado, dividas }: { resultado: ResultadoSimulacao; dividas: DividaSim[] }) {
  const [tudo, setTudo] = useState(false);
  const [porDivida, setPorDivida] = useState(false);
  const meses = tudo ? resultado.meses : resultado.meses.slice(0, LINHAS_INICIAIS);
  const soma = (f: (m: ResultadoSimulacao["meses"][number]) => number) => resultado.meses.reduce((s, m) => s + f(m), 0);
  const celula = "px-3 py-2 text-right tabular-nums";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Mês a mês</h3>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={porDivida} onChange={(e) => setPorDivida(e.target.checked)} className="h-4 w-4 accent-verde" />
          Saldo de cada dívida
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-borda bg-white shadow-cartao">
        <table className="w-full text-sm">
          <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Mês</th>
              <th className={cn(celula, "font-semibold")}>Parcelas</th>
              <th className={cn(celula, "font-semibold")}>Extra</th>
              <th className={cn(celula, "font-semibold")}>Juros</th>
              <th className={cn(celula, "font-semibold")}>Pago</th>
              <th className={cn(celula, "font-semibold")}>Saldo devedor</th>
              {porDivida && dividas.map((d) => (
                <th key={d.id} className={cn(celula, "font-semibold")}>
                  {d.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.indice} className="border-b border-borda even:bg-gray-50/70">
                <td className="px-3 py-1.5">{rotuloMes(m.mes)}</td>
                <td className={cn(celula, "py-1.5")}>{formatarReais(m.parcelasCentavos)}</td>
                <td className={cn(celula, "py-1.5")}>{m.extraCentavos ? formatarReais(m.extraCentavos) : "-"}</td>
                <td className={cn(celula, "py-1.5 text-despesa")}>{formatarReais(m.jurosCentavos)}</td>
                <td className={cn(celula, "py-1.5 font-medium")}>{formatarReais(m.pagoCentavos)}</td>
                <td className={cn(celula, "py-1.5")}>{formatarReais(m.saldoCentavos)}</td>
                {porDivida && dividas.map((d) => (
                  <td key={d.id} className={cn(celula, "py-1.5 text-gray-600")}>
                    {formatarReais(m.porDivida[d.id]?.saldoCentavos ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-amarelo-borda bg-amarelo font-semibold text-amarelo-texto">
              <td className="px-3 py-2">Total ({resultado.meses.length} {resultado.meses.length === 1 ? "mês" : "meses"})</td>
              <td className={celula}>{formatarReais(soma((m) => m.parcelasCentavos))}</td>
              <td className={celula}>{formatarReais(soma((m) => m.extraCentavos))}</td>
              <td className={celula}>{formatarReais(soma((m) => m.jurosCentavos))}</td>
              <td className={celula}>{formatarReais(soma((m) => m.pagoCentavos))}</td>
              <td className={celula} colSpan={porDivida ? 1 + dividas.length : 1} />
            </tr>
          </tfoot>
        </table>
      </div>
      {resultado.meses.length > LINHAS_INICIAIS && (
        <div className="mt-2 text-center">
          <Botao variante="fantasma" className="h-8" onClick={() => setTudo((t) => !t)}>
            {tudo ? "Mostrar só os primeiros meses" : `Mostrar todos os ${resultado.meses.length} meses`}
          </Botao>
        </div>
      )}
    </div>
  );
}

/** "Como calculei": de onde vêm a sobra, a reserva e a conta de cada mês. */
export function ComoCalculei({ children }: { children: React.ReactNode }) {
  return (
    <details className="rounded-md border border-borda bg-white px-4 py-2 text-sm text-gray-600">
      <summary className="cursor-pointer font-medium text-gray-800">Como calculei</summary>
      <div className="mt-2 space-y-2 pb-1 text-xs leading-relaxed">{children}</div>
    </details>
  );
}
