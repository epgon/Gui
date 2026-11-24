"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronLeft, ChevronRight, Plus, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Botao } from "@/components/ui/botao";
import { TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { semAcento } from "@/lib/cadastros/filtros";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { agruparPorDia, gradeDoMes, resumirDia } from "@/lib/agenda/regras";
import type { LinhaLista, Opcoes, Resumo } from "@/lib/lancamentos/tipos";
import { BotaoAtalho, LinhaComFilhos } from "../lancamentos/linhas";
import { SITUACOES } from "../lancamentos/tela";
import { useAcoesLista } from "../lancamentos/use-acoes-lista";

type Mes = { anoMes: string; rotulo: string; anterior: string; seguinte: string; inicio: string; fim: string };

const SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function TelaAgenda({ linhas, resumo, destino, opcoes, hoje, mes, caminho }: {
  linhas: LinhaLista[];
  resumo: Resumo;
  destino: string;
  opcoes: Opcoes;
  hoje: string;
  mes: Mes;
  caminho: string;
}) {
  const router = useRouter();
  const [dia, setDia] = useState<string | null>(null);
  const link = (mudancas: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries({ mes: mes.anoMes, destino, ...mudancas }).filter(([, v]) => v));
    return `${caminho}?${sp.toString()}`;
  };

  const porDia = agruparPorDia(linhas);
  // Semanas de domingo a sábado cobrindo o mês.
  const celulas = gradeDoMes(mes.anoMes);
  const destinoAtual = opcoes.destinos.find((d) => d.valor === destino);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-white px-4 py-3 shadow-cartao">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Conta ou Cartão</span>
          {destinoAtual ? <IconeBanco codigo={destinoAtual.bancoCodigo} nome={destinoAtual.bancoNome ?? "Outro"} className="h-7 w-7 text-[10px]" /> : <Wallet className="h-5 w-5 text-gray-400" />}
          <select value={destino} onChange={(e) => router.push(link({ destino: e.target.value }))} className="h-9 rounded-md border border-borda bg-white px-2 text-sm">
            <option value="">Todas as contas e cartões</option>
            {(["Contas", "Cartões"] as const).map((g) => {
              const itens = opcoes.destinos.filter((d) => d.grupo === g && (d.ativo || d.valor === destino));
              return itens.length ? (
                <optgroup key={g} label={g === "Contas" ? "Contas Financeiras" : "Cartões de Crédito"}>
                  {itens.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.rotulo}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Link href={link({ mes: mes.anterior })} aria-label="Mês anterior" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <label className="relative">
            <span className="block min-w-40 cursor-pointer text-center text-sm font-semibold text-gray-900">{mes.rotulo}</span>
            <input type="month" value={mes.anoMes} onChange={(e) => e.target.value && router.push(link({ mes: e.target.value }))} aria-label="Escolher mês" className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <Link href={link({ mes: mes.seguinte })} aria-label="Próximo mês" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </Link>
          {mes.anoMes !== hoje.slice(0, 7) && (
            <Link href={link({ mes: hoje.slice(0, 7) })} className="ml-1 rounded px-2 py-1 text-xs font-semibold text-verde hover:bg-verde-claro">
              Hoje
            </Link>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Total do mês:</span>
          <Valor centavos={resumo.receitas} />
          <span className="text-gray-400">−</span>
          <Valor centavos={-resumo.despesas} />
          <span className="text-gray-400">=</span>
          <Valor centavos={resumo.total} className="text-base" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-borda bg-white shadow-cartao">
        <div className="grid grid-cols-7 border-b border-borda bg-subcabecalho text-center text-xs font-semibold tracking-wide text-gray-500">
          {SEMANA.map((s) => (
            <div key={s} className="py-2.5">
              {s}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celulas.map((data) => {
            const doMes = data.slice(0, 7) === mes.anoMes;
            const doDia = doMes ? (porDia.get(data) ?? []) : [];
            const r = resumirDia(doDia);
            const comMovimento = doDia.length > 0;
            return (
              <button
                key={data}
                type="button"
                disabled={!doMes}
                onClick={() => setDia(data)}
                aria-label={doMes ? `${formatarData(data)}: ${doDia.length} lançamento(s), total ${formatarCentavos(r.total)}` : undefined}
                className={cn(
                  "flex min-h-24 min-w-0 flex-col items-center justify-center gap-1 border-r border-b border-borda p-1 text-center transition sm:min-h-32 sm:p-2 [&:nth-child(7n)]:border-r-0",
                  !doMes && "cursor-default bg-gray-50 text-gray-300",
                  doMes && "hover:bg-verde-claro/50",
                  comMovimento && "bg-amarelo hover:bg-amarelo/70",
                )}
              >
                <Anel percentual={comMovimento ? r.percentual : 0} hoje={data === hoje} apagado={!doMes}>
                  <span className={cn("text-sm font-semibold sm:text-lg", doMes ? "text-gray-900" : "text-gray-300")}>{Number(data.slice(8, 10))}</span>
                </Anel>
                {comMovimento ? (
                  <>
                    <span className="text-[10px] font-medium text-amarelo-texto sm:text-[11px]">
                      {r.percentual}%<span className="hidden sm:inline"> Realizado</span>
                    </span>
                    <Valor centavos={r.total} className="max-w-full truncate text-[10px] sm:text-xs" />
                  </>
                ) : (
                  <span className={cn("text-[10px] tabular-nums sm:text-xs", doMes ? "text-gray-400" : "text-gray-300")}>0,00</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Dias em amarelo têm lançamentos. O anel mostra quanto do valor do dia já foi pago ou recebido. Recorrentes previstos e faturas de cartão aparecem no dia do vencimento.
      </p>

      {dia && <ModalDia key={dia} dia={dia} linhas={porDia.get(dia) ?? []} opcoes={opcoes} hoje={hoje} destino={destino} aoFechar={() => setDia(null)} />}
    </>
  );
}

/** Círculo do dia: um anel verde que enche conforme o "% Realizado". */
function Anel({ percentual, hoje, apagado, children }: { percentual: number; hoje: boolean; apagado: boolean; children: React.ReactNode }) {
  const raio = 24;
  const circunferencia = 2 * Math.PI * raio;
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center sm:h-14 sm:w-14">
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={raio} fill={apagado ? "transparent" : "white"} stroke={hoje ? "var(--color-verde)" : "var(--color-borda)"} strokeWidth={hoje ? 3 : 4} />
        {percentual > 0 && (
          <circle
            cx="28"
            cy="28"
            r={raio}
            fill="none"
            stroke="var(--color-verde-vivo)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${(circunferencia * percentual) / 100} ${circunferencia}`}
          />
        )}
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** Modal "Lançamentos do Dia". */
function ModalDia({ dia, linhas, opcoes, hoje, destino, aoFechar }: { dia: string; linhas: LinhaLista[]; opcoes: Opcoes; hoje: string; destino: string; aoFechar: () => void }) {
  const router = useRouter();
  const acoes = useAcoesLista({ opcoes, hoje, destino });
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [expandidas, setExpandidas] = useState<string[]>([]);
  const termo = semAcento(busca).toLowerCase();
  const visiveis = linhas.filter(
    (l) =>
      (!termo || semAcento(l.descricao).toLowerCase().includes(termo)) &&
      (!situacao || (situacao === "nao_realizado" ? l.situacao !== "realizado" : l.situacao === situacao)),
  );
  const r = resumirDia(visiveis);
  const [a, m, d] = dia.split("-");
  const semana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][new Date(Date.UTC(+a, +m - 1, +d)).getUTCDay()];

  return (
    <>
      <Modal
        aberto
        aoFechar={aoFechar}
        largura="larga"
        titulo="Lançamentos do Dia"
        resumo={
          <>
            {semana}, {formatarData(dia)} · Total <Valor centavos={resumirDia(linhas).total} />
          </>
        }
        rodape={
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Botao icone={<Plus className="h-4 w-4" />} onClick={() => acoes.novo("simples", "despesa", dia)}>
              Adicionar
            </Botao>
            <BotaoAtalho rotulo="Nova despesa" cor="text-despesa" onClick={() => acoes.novo("simples", "despesa", dia)}>
              <ArrowUp className="h-4 w-4" />
            </BotaoAtalho>
            <BotaoAtalho rotulo="Nova receita" cor="text-receita" onClick={() => acoes.novo("simples", "receita", dia)}>
              <ArrowDown className="h-4 w-4" />
            </BotaoAtalho>
            <BotaoAtalho rotulo="Nova transferência" cor="text-verde" onClick={() => acoes.novo("transferencia", "despesa", dia)}>
              <ArrowLeftRight className="h-4 w-4" />
            </BotaoAtalho>
            {acoes.abrindo && <span className="text-sm text-gray-500">Abrindo...</span>}
            <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm focus-within:border-verde sm:w-56">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar no dia" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
            </label>
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação" className="h-9 rounded-md border border-borda bg-white px-2 text-sm">
              {SITUACOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          </div>

          <FaixaErro>{acoes.aviso && <TextoComDestaque texto={acoes.aviso} />}</FaixaErro>

          <div className="overflow-hidden rounded-lg border border-borda">
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-6 px-1 py-2" />
                    <th className="w-8 px-1 py-2" />
                    <th className="px-3 py-2 text-left font-semibold">Data</th>
                    <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                    <th className="px-3 py-2 text-right font-semibold">Valor</th>
                    <th className="px-3 py-2 text-center font-semibold">Situação</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        {linhas.length ? "Nenhum lançamento com esses filtros." : "Nenhum lançamento neste dia. Use Adicionar para lançar."}
                      </td>
                    </tr>
                  ) : (
                    visiveis.map((l) => (
                      <LinhaComFilhos
                        key={l.chave}
                        linha={l}
                        ocultar={false}
                        marcado={false}
                        aoAbrir={acoes.abrirLinha(l) ?? (() => setExpandidas((e) => (e.includes(l.chave) ? e.filter((x) => x !== l.chave) : [...e, l.chave])))}
                        menu={
                          <MenuLinha
                            rotulo={l.descricao}
                            itens={acoes.menuDe(l, (cartaoId) => {
                              aoFechar();
                              router.push(`/financeiro/lancamentos?mes=${dia.slice(0, 7)}&destino=cartao:${cartaoId}`);
                            })}
                          />
                        }
                        expandida={expandidas.includes(l.chave)}
                        filhos={l.compras}
                        aoEditarFilho={acoes.editar}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borda px-3 py-2.5 text-sm">
              <span className="text-gray-500">{visiveis.length === 0 ? "0 itens" : `1 a ${visiveis.length}`}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-700">Total dos Lançamentos:</span>
                <Valor centavos={r.receitas} />
                <span className="text-gray-400">−</span>
                <Valor centavos={r.despesas} className="text-negativo!" />
                <span className="text-gray-400">=</span>
                <Valor centavos={r.total} className="text-base" />
              </span>
            </div>
          </div>
        </div>
      </Modal>
      {acoes.modais}
    </>
  );
}
