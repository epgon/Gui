"use client";

import Link from "next/link";
import { detalharCategoria } from "@/app/(sistema)/cadastros/categorias/detalhe-acoes";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import type { DetalheCategoria } from "@/lib/relatorios/detalhe-categoria";
import { useEffect, useState } from "react";

/** Gráfico de barras dos 12 meses: receitas (azul) e despesas (vermelho) lado a lado. */
function GraficoMeses({ meses }: { meses: DetalheCategoria["meses"] }) {
  const maior = Math.max(1, ...meses.flatMap((m) => [m.receitas, -m.despesas]));
  const temReceita = meses.some((m) => m.receitas);
  const temDespesa = meses.some((m) => m.despesas);
  const largura = 600;
  const altura = 150;
  const passo = largura / meses.length;
  const barra = temReceita && temDespesa ? passo * 0.3 : passo * 0.55;
  const h = (v: number) => (Math.abs(v) / maior) * (altura - 10);
  return (
    <svg viewBox={`0 0 ${largura} ${altura + 18}`} className="h-auto w-full" role="img" aria-label="Valores dos últimos 12 meses">
      <line x1={0} x2={largura} y1={altura} y2={altura} className="stroke-gray-200" />
      {meses.map((m, i) => {
        const x = i * passo + (passo - (temReceita && temDespesa ? barra * 2 + 2 : barra)) / 2;
        return (
          <g key={m.chave}>
            {temReceita && (
              <rect x={x} y={altura - h(m.receitas)} width={barra} height={h(m.receitas)} rx={2} className="fill-receita">
                <title>{`${m.rotulo}: receitas ${formatarCentavos(m.receitas)}`}</title>
              </rect>
            )}
            {temDespesa && (
              <rect x={temReceita ? x + barra + 2 : x} y={altura - h(m.despesas)} width={barra} height={h(m.despesas)} rx={2} className="fill-despesa">
                <title>{`${m.rotulo}: despesas ${formatarCentavos(m.despesas)}`}</title>
              </rect>
            )}
            <text x={i * passo + passo / 2} y={altura + 13} textAnchor="middle" className="fill-gray-500 text-[10px]">
              {m.rotulo.slice(0, 3)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Janela "Detalhando Categoria": gráfico dos últimos 12 meses e os últimos 10 lançamentos. */
export function DetalhandoCategoria({ id, aoFechar }: { id: number | null; aoFechar: () => void }) {
  const [dados, setDados] = useState<{ id: number; detalhe: DetalheCategoria | null } | null>(null);

  useEffect(() => {
    if (id === null) return;
    let ativo = true;
    detalharCategoria(id).then((detalhe) => ativo && setDados({ id, detalhe }));
    return () => {
      ativo = false;
    };
  }, [id]);

  const atual = dados && dados.id === id ? dados.detalhe : undefined;
  const carregando = id !== null && atual === undefined;

  return (
    <Modal
      aberto={id !== null}
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        atual ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: atual.cor }} />
            Detalhando Categoria: {atual.rotulo}
          </span>
        ) : (
          "Detalhando Categoria"
        )
      }
      resumo={atual ? `${atual.natureza === "receita" ? "Receita" : "Despesa"} · inclui as categorias filhas` : undefined}
      rodape={
        <>
          {atual && (
            <Link href={`/relatorios/fluxo-de-caixa?periodo=mensal&categoria=${atual.id}`} className="mr-auto inline-flex h-9 items-center px-2 text-sm font-semibold text-verde hover:underline">
              Ver no Fluxo de Caixa
            </Link>
          )}
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
        </>
      }
    >
      {carregando && <p className="py-10 text-center text-sm text-gray-500">Carregando...</p>}
      {id !== null && atual === null && <p className="py-10 text-center text-sm text-gray-500">Esta categoria não existe mais.</p>}
      {atual && (
        <div className="space-y-5">
          <section>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-800">Últimos 12 meses</h3>
              <p className="text-sm text-gray-600">
                Total <Valor centavos={atual.total} /> · Média por mês <Valor centavos={atual.media} />
              </p>
            </div>
            <GraficoMeses meses={atual.meses} />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Últimos 10 lançamentos</h3>
            {atual.ultimos.length === 0 ? (
              <p className="rounded-lg bg-subcabecalho px-3 py-4 text-center text-sm text-gray-500">Nenhum lançamento nesta categoria até hoje.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {atual.ultimos.map((u) => (
                    <tr key={u.id} className="border-b border-borda/70 last:border-0">
                      <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">{formatarData(u.data)}</td>
                      <td className="py-1.5 pr-3">
                        {u.descricao}
                        <span className="block text-xs text-gray-500">{u.contaOuCartao}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-xs">{u.pago ? <span className="text-pago-texto">Realizado</span> : <span className="text-gray-500">Não realizado</span>}</td>
                      <td className="py-1.5 text-right">
                        <Valor centavos={u.valorCentavos} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
