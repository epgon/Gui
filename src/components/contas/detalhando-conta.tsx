"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { detalharConta } from "@/app/(sistema)/cadastros/contas-financeiras/detalhe-acoes";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { Modal } from "@/components/ui/modal";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { cn } from "@/lib/cn";
import type { DetalheConta } from "@/lib/contas/detalhe";
import { formatarData } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";

type Aba = "resumo" | "lancamentos";

/**
 * Janela "Detalhando Conta Financeira", com as abas Resumo e Lançamentos.
 * Quem usa mostra a janela só quando há conta escolhida: {id && <DetalhandoConta key={id} contaId={id} ... />}
 */
export function DetalhandoConta({ contaId, aoFechar }: { contaId: number; aoFechar: () => void }) {
  const [dados, setDados] = useState<DetalheConta | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<Aba>("resumo");
  const [carregando, iniciar] = useTransition();

  const carregar = (id: number, mes?: string) =>
    iniciar(async () => {
      try {
        const d = await detalharConta(id, mes);
        if (d) {
          setDados(d);
          setErro("");
        } else setErro("Conta não encontrada.");
      } catch {
        setErro("Não foi possível carregar a conta agora. Tente de novo.");
      }
    });

  useEffect(() => {
    carregar(contaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = dados?.conta;
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        <span className="flex items-center gap-3">
          <IconeBanco codigo={c?.bancoCodigo ?? null} nome={c?.bancoNome ?? "Outro"} />
          <span>
            Detalhando Conta Financeira
            {c && <span className="block text-sm font-normal text-gray-500">{[...new Set([`#${c.id}`, c.descricao, c.bancoNome, c.tipo])].join(" · ")}</span>}
          </span>
        </span>
      }
    >
      <ProvedorOcultar>
        {!dados ? (
          <p className="py-10 text-center text-sm text-gray-500">{erro || "Carregando..."}</p>
        ) : (
          <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
            <div role="tablist" className="flex gap-1 border-b border-borda">
              {(["resumo", "lancamentos"] as const).map((a) => (
                <button
                  key={a}
                  role="tab"
                  type="button"
                  aria-selected={aba === a}
                  onClick={() => setAba(a)}
                  className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", aba === a ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}
                >
                  {a === "resumo" ? "Resumo" : "Lançamentos"}
                </button>
              ))}
            </div>
            {aba === "resumo" ? <Resumo d={dados} /> : <Lancamentos d={dados} aoMudarMes={(m) => carregar(dados.conta.id, m)} />}
          </div>
        )}
      </ProvedorOcultar>
    </Modal>
  );
}

function Quadro({ titulo, dica, children, destaque }: { titulo: string; dica?: string; children: React.ReactNode; destaque?: boolean }) {
  return (
    <div title={dica} className={cn("rounded-lg border p-3", destaque ? "border-blue-100 bg-blue-50/70" : "border-borda bg-white")}>
      <p className="text-xs font-medium text-gray-500">{titulo}</p>
      <div className="mt-1 text-lg">{children}</div>
    </div>
  );
}

function Resumo({ d }: { d: DetalheConta }) {
  const maior = Math.max(1, ...d.historico.map((h) => Math.abs(h.saldoFim)));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Quadro titulo="Saldo Atual" dica="Tudo o que já foi pago ou recebido nesta conta até hoje." destaque>
          <ValorOcultavel centavos={d.saldoAtual} className="text-2xl" />
        </Quadro>
        <Quadro titulo={`Saldo Previsto no fim de ${d.mes.rotulo.split(" ")[0].toLowerCase()}`} dica="Saldo atual mais o que ainda falta pagar e receber no mês (inclui recorrentes e faturas).">
          <ValorOcultavel centavos={d.resumo.saldoPrevisto ?? 0} />
        </Quadro>
        <Quadro titulo="Nos saldos da Visão Geral">
          <span className={cn("text-base font-semibold", d.conta.considerarNosSaldos ? "text-pago-texto" : "text-gray-400")}>
            {d.conta.considerarNosSaldos ? "Sim, entra no Saldo Atual" : "Não entra"}
          </span>
        </Quadro>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Quadro titulo={`Entradas em ${d.mes.rotulo}`} dica="Receitas e transferências recebidas no mês, pagas ou não.">
          <span className="flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-receita" />
            <ValorOcultavel centavos={d.resumo.receitas} />
          </span>
        </Quadro>
        <Quadro titulo={`Saídas em ${d.mes.rotulo}`} dica="Despesas, faturas e transferências enviadas no mês, pagas ou não.">
          <span className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4 text-despesa" />
            <ValorOcultavel centavos={-d.resumo.despesas} />
          </span>
        </Quadro>
      </div>

      <div className="rounded-lg border border-borda p-4">
        <h3 className="text-sm font-semibold text-gray-800">Saldo no fim de cada mês</h3>
        <p className="text-xs text-gray-500">Últimos 6 meses, só com o que já foi pago ou recebido.</p>
        <div className="mt-4 grid grid-cols-6 items-end gap-3" style={{ height: 120 }}>
          {d.historico.map((h) => (
            <div key={h.anoMes} className="flex h-full flex-col items-center justify-end gap-1" title={`Entradas R$ ${formatarCentavos(h.entradas)} · Saídas R$ ${formatarCentavos(h.saidas)}`}>
              <div
                className={cn("w-full max-w-10 rounded-t", h.saldoFim < 0 ? "bg-negativo/70" : "bg-receita/70")}
                style={{ height: `${Math.max(2, (Math.abs(h.saldoFim) / maior) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-6 gap-3 text-center text-xs text-gray-500">
          {d.historico.map((h) => (
            <div key={h.anoMes}>
              <p className="font-medium text-gray-700">{h.rotulo}</p>
              <ValorOcultavel centavos={h.saldoFim} className="text-xs" />
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Saldo inicial de <ValorOcultavel centavos={d.conta.saldoInicialCentavos} className="text-xs" />
        {d.conta.saldoInicialData && <> em {formatarData(d.conta.saldoInicialData)}</>}.
        {!d.conta.ativo && " Esta conta está inativa."}
      </p>
    </div>
  );
}

function Lancamentos({ d, aoMudarMes }: { d: DetalheConta; aoMudarMes: (mes: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => aoMudarMes(d.mes.anterior)} aria-label="Mês anterior" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-40 text-center text-sm font-semibold text-gray-800">{d.mes.rotulo}</span>
          <button type="button" onClick={() => aoMudarMes(d.mes.seguinte)} aria-label="Mês seguinte" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Link
          href={`/financeiro/lancamentos?destino=conta:${d.conta.id}&mes=${d.mes.anoMes}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-verde hover:underline"
        >
          Abrir em Lançamentos <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-borda">
        <div className="flex justify-between border-b border-amarelo-borda bg-amarelo px-3 py-2 text-sm font-semibold text-amarelo-texto">
          <span>Saldo Anterior</span>
          <ValorOcultavel centavos={d.resumo.saldoAnterior ?? 0} />
        </div>
        <ul className="max-h-80 divide-y divide-borda overflow-y-auto text-sm">
          {d.linhas.length === 0 && <li className="px-3 py-8 text-center text-gray-500">Nenhum lançamento nesta conta em {d.mes.rotulo}.</li>}
          {d.linhas.map((x) => (
            <li key={x.chave} className="flex items-center gap-3 px-3 py-2">
              <span className="w-12 shrink-0 text-xs text-gray-500">{formatarData(x.data).slice(0, 5)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate font-medium text-gray-800">
                  {x.eFatura && <CreditCard className="h-3.5 w-3.5 shrink-0 text-despesa" />}
                  <span className="truncate">{x.descricao}</span>
                  {x.previsto && <span className="rounded bg-gray-100 px-1.5 text-[10px] font-semibold uppercase text-gray-500">Previsto</span>}
                </span>
                {x.categoria && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: x.categoriaCor ?? "#9CA3AF" }} />
                    {x.categoria}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  x.situacao === "realizado" ? "bg-pago-fundo text-pago-texto" : x.situacao === "vencido" ? "bg-orange-100 text-despesa" : "bg-blue-50 text-receita",
                )}
              >
                {x.situacao === "realizado" ? (x.valorCentavos >= 0 ? "Recebido" : "Pago") : x.situacao === "vencido" ? "Vencido" : "A Vencer"}
              </span>
              <ValorOcultavel centavos={x.valorCentavos} className="w-28 shrink-0 text-right" />
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-amarelo-borda bg-amarelo px-3 py-2 text-sm font-semibold text-amarelo-texto">
          <span>Saldo Previsto</span>
          <ValorOcultavel centavos={d.resumo.saldoPrevisto ?? 0} />
        </div>
      </div>
    </div>
  );
}
