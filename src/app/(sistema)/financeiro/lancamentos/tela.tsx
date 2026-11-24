"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, RotateCcw, Search, Trash2, Wallet } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Botao } from "@/components/ui/botao";
import { TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { cn } from "@/lib/cn";
import type { Filtros, LinhaLista, Opcoes, Resumo } from "@/lib/lancamentos/tipos";
import { BotaoAtalho, FaixaSaldo, LinhaComFilhos, ValorOculto } from "./linhas";
import { alvoDe, useAcoesLista } from "./use-acoes-lista";

type Mes = { anoMes: string; rotulo: string; anterior: string; seguinte: string; inicio: string; fim: string };

const ABAS: { valor: Filtros["aba"]; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "receitas", rotulo: "Receitas" },
  { valor: "despesas", rotulo: "Despesas" },
  { valor: "transferencias", rotulo: "Transferências" },
];

export const SITUACOES = [
  { valor: "", rotulo: "Todas as situações" },
  { valor: "nao_realizado", rotulo: "Não Realizado" },
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "a_vencer", rotulo: "A Vencer" },
  { valor: "vencido", rotulo: "Vencido" },
];

/** Linhas que podem ser marcadas: lançamentos gravados e recorrentes previstos (não a linha da fatura). */
export const selecionavel = (l: LinhaLista) => l.id !== null || l.previsto !== null;

export function TelaLancamentos({ linhas, resumo, filtros, opcoes, hoje, mes, caminho, abrirNovo }: {
  /** "despesa", "receita" ou "transferencia": abre o Novo Lançamento ao entrar (vindo da Visão Geral). */
  abrirNovo?: string;
  linhas: LinhaLista[];
  resumo: Resumo;
  filtros: Filtros;
  opcoes: Opcoes;
  hoje: string;
  mes: Mes;
  caminho: string;
}) {
  const router = useRouter();
  const acoes = useAcoesLista({
    opcoes,
    hoje,
    destino: filtros.destino,
    abrirNovo: abrirNovo === "transferencia" ? { aba: "transferencia" } : abrirNovo === "receita" || abrirNovo === "despesa" ? { aba: "simples", tipo: abrirNovo } : null,
  });
  // A seleção vale para a lista que está na tela; quando a lista muda (salvou, filtrou), ela é limpa.
  const [selecao, setSelecao] = useState<{ base: LinhaLista[]; chaves: string[] }>({ base: linhas, chaves: [] });
  const selecionados = selecao.base === linhas ? selecao.chaves : [];
  const setSelecionados = (f: string[] | ((s: string[]) => string[])) => setSelecao({ base: linhas, chaves: typeof f === "function" ? f(selecionados) : f });
  const [ocultar, setOcultar] = useState(false);
  const [expandidas, setExpandidas] = useState<string[]>([]);

  const parametros: Record<string, string> = {
    mes: filtros.mes,
    aba: filtros.aba === "todos" ? "" : filtros.aba,
    destino: filtros.destino,
    situacao: filtros.situacao,
    busca: filtros.busca,
    detalhar: filtros.detalhar ? "1" : "",
    categoria: filtros.categoria,
    forma: filtros.forma,
    contato: filtros.contato,
    tag: filtros.tag,
  };
  const link = (mudancas: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries({ ...parametros, ...mudancas }).filter(([, v]) => v));
    const qs = sp.toString();
    return qs ? `${caminho}?${qs}` : caminho;
  };
  const ir = (mudancas: Record<string, string>) => {
    setSelecionados([]);
    router.push(link(mudancas));
  };

  // Tira o "?novo=" do endereço (a janela já abriu), para não abrir de novo ao recarregar.
  useEffect(() => {
    if (abrirNovo) router.replace(link({}), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { novo, abrindo, aviso, ocupado } = acoes;
  const selecionaveis = linhas.filter(selecionavel).map((l) => l.chave);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((c) => selecionados.includes(c));
  const marcar = (c: string) => setSelecionados((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const escolhidas = linhas.filter((l) => selecionavel(l) && selecionados.includes(l.chave));
  const destinoAtual = opcoes.destinos.find((d) => d.valor === filtros.destino);
  const rotuloEscolhidas = `${escolhidas.length} lançamentos`;

  const temSaldo = resumo.saldoAnterior !== null;

  return (
    <>
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-2">
        <Botao icone={<Plus className="h-4 w-4" />} onClick={() => novo("simples", "despesa")}>
          Adicionar
        </Botao>
        <BotaoAtalho rotulo="Nova despesa" cor="text-despesa" onClick={() => novo("simples", "despesa")}>
          <ArrowUp className="h-4 w-4" />
        </BotaoAtalho>
        <BotaoAtalho rotulo="Nova receita" cor="text-receita" onClick={() => novo("simples", "receita")}>
          <ArrowDown className="h-4 w-4" />
        </BotaoAtalho>
        <BotaoAtalho rotulo="Nova transferência" cor="text-verde" onClick={() => novo("transferencia")}>
          <ArrowLeftRight className="h-4 w-4" />
        </BotaoAtalho>
        {abrindo && <span className="text-sm text-gray-500">Abrindo...</span>}
        <Form action={caminho} className="ml-auto flex w-full items-center sm:w-72" role="search">
          {Object.entries(parametros)
            .filter(([k, v]) => k !== "busca" && v)
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <label className="flex h-9 w-full items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm focus-within:border-verde">
            <Search className="h-4 w-4 text-gray-400" />
            <input name="busca" defaultValue={filtros.busca} key={filtros.busca} placeholder="Descrição, documento ou valor" aria-label="Buscar lançamento" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
          </label>
        </Form>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-white px-4 py-3 shadow-cartao">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Conta ou Cartão</span>
          {destinoAtual ? <IconeBanco codigo={destinoAtual.bancoCodigo} nome={destinoAtual.bancoNome ?? "Outro"} className="h-7 w-7 text-[10px]" /> : <Wallet className="h-5 w-5 text-gray-400" />}
          <select value={filtros.destino} onChange={(e) => ir({ destino: e.target.value })} className="h-9 rounded-md border border-borda bg-white px-2 text-sm">
            <option value="">Todas as contas e cartões</option>
            {(["Contas", "Cartões"] as const).map((g) => {
              const itens = opcoes.destinos.filter((d) => d.grupo === g && (d.ativo || d.valor === filtros.destino));
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
        <select value={filtros.situacao} onChange={(e) => ir({ situacao: e.target.value })} aria-label="Situação" className="h-9 rounded-md border border-borda bg-white px-2 text-sm">
          {SITUACOES.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <Link href={link({ mes: mes.anterior })} onClick={() => setSelecionados([])} aria-label="Mês anterior" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <label className="relative">
            <span className="block min-w-40 cursor-pointer text-center text-sm font-semibold text-gray-900">{mes.rotulo}</span>
            <input
              type="month"
              value={mes.anoMes}
              onChange={(e) => e.target.value && ir({ mes: e.target.value })}
              aria-label="Escolher mês"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <Link href={link({ mes: mes.seguinte })} onClick={() => setSelecionados([])} aria-label="Próximo mês" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </Link>
          {mes.anoMes !== hoje.slice(0, 7) && (
            <Link href={link({ mes: hoje.slice(0, 7) })} className="ml-1 rounded px-2 py-1 text-xs font-semibold text-verde hover:bg-verde-claro">
              Hoje
            </Link>
          )}
        </div>
        <div className="ml-auto" title="Exibe os itens dos lançamentos detalhados e as compras das faturas">
          <Chave ligada={filtros.detalhar} aoMudar={(v) => ir({ detalhar: v ? "1" : "" })} rotulo="Detalhar" />
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-borda" role="tablist">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={link({ aba: a.valor === "todos" ? "" : a.valor })}
            role="tab"
            aria-selected={filtros.aba === a.valor}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-semibold",
              filtros.aba === a.valor ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {a.rotulo}
          </Link>
        ))}
      </div>

      <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>

      {/* Ações em lote */}
      {escolhidas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-verde/30 bg-verde-claro px-4 py-2 text-sm">
          <strong>{escolhidas.length === 1 ? "1 selecionado" : `${escolhidas.length} selecionados`}</strong>
          <Botao variante="secundario" className="h-8" disabled={ocupado} onClick={() => acoes.pedirPagamento(escolhidas, rotuloEscolhidas)} icone={<CheckCircle2 className="h-4 w-4" />}>
            Pagar / Receber
          </Botao>
          <Botao variante="secundario" className="h-8" disabled={ocupado} onClick={() => acoes.estornar(alvoDe(escolhidas, rotuloEscolhidas))} icone={<RotateCcw className="h-4 w-4" />}>
            Voltar para não pago
          </Botao>
          <Botao variante="secundario" className="h-8 text-negativo" disabled={ocupado} onClick={() => acoes.pedirExclusao(escolhidas, rotuloEscolhidas)} icone={<Trash2 className="h-4 w-4" />}>
            Excluir
          </Botao>
          <button type="button" onClick={() => setSelecionados([])} className="ml-auto text-gray-600 hover:underline">
            Limpar seleção
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-borda bg-white shadow-cartao">
        {temSaldo && (
          <FaixaSaldo rotulo="Saldo Anterior" dica="Resultado acumulado até o fim do mês anterior (inclui o que ainda não foi pago)." centavos={resumo.saldoAnterior!} ocultar={ocultar} />
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={todosMarcados}
                    onChange={() => setSelecionados(todosMarcados ? [] : selecionaveis)}
                    className="h-4 w-4 accent-verde"
                  />
                </th>
                <th className="w-8 px-1 py-2.5" />
                <th className="px-3 py-2.5 text-left font-semibold">Data</th>
                <th className="px-3 py-2.5 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-3 py-2.5 text-center font-semibold">Situação</th>
                <th className="w-10 px-3 py-2.5">
                  <span className="sr-only">Opções</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    {opcoes.destinos.length === 0 ? (
                      <>
                        Cadastre primeiro uma{" "}
                        <Link href="/cadastros/contas-financeiras" className="font-semibold text-verde hover:underline">
                          Conta Financeira
                        </Link>
                        .
                      </>
                    ) : (
                      `Nenhum lançamento em ${mes.rotulo}${filtros.busca || filtros.situacao || filtros.aba !== "todos" ? " com esses filtros" : ""}.`
                    )}
                  </td>
                </tr>
              ) : (
                linhas.map((l) => {
                  const expandida = filtros.detalhar || expandidas.includes(l.chave);
                  return (
                    <LinhaComFilhos
                      key={l.chave}
                      linha={l}
                      ocultar={ocultar}
                      marcado={selecionados.includes(l.chave)}
                      aoMarcar={selecionavel(l) ? () => marcar(l.chave) : undefined}
                      aoAbrir={acoes.abrirLinha(l) ?? (() => setExpandidas((e) => (e.includes(l.chave) ? e.filter((x) => x !== l.chave) : [...e, l.chave])))}
                      menu={<MenuLinha rotulo={l.descricao} itens={acoes.menuDe(l, (cartaoId) => ir({ destino: `cartao:${cartaoId}` }))} />}
                      expandida={expandida}
                      filhos={l.compras}
                      aoEditarFilho={acoes.editar}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borda px-4 py-3 text-sm">
          <span className="text-gray-500">{linhas.length === 0 ? "0 itens" : `1 a ${linhas.length}`}</span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-700">Total dos Lançamentos:</span>
            <ValorOculto centavos={resumo.receitas} ocultar={ocultar} />
            <span className="text-gray-400">−</span>
            <ValorOculto centavos={resumo.despesas} ocultar={ocultar} className="text-negativo!" />
            <span className="text-gray-400">=</span>
            <ValorOculto centavos={resumo.total} ocultar={ocultar} className="text-base" />
          </span>
        </div>
        {temSaldo && (
          <div className="grid border-t border-amarelo-borda bg-amarelo sm:grid-cols-2">
            <FaixaSaldo rotulo="Saldo Previsto" dica="Saldo anterior mais todos os lançamentos do mês, pagos ou não." centavos={resumo.saldoPrevisto!} ocultar={ocultar} embutida />
            <FaixaSaldo
              rotulo="Saldo Atual"
              dica="Só o que já foi pago ou recebido até o fim deste mês. É o número que deve bater com o extrato do banco."
              centavos={resumo.saldoAtual!}
              ocultar={ocultar}
              embutida
              acao={
                <button type="button" onClick={() => setOcultar((o) => !o)} aria-label={ocultar ? "Mostrar valores" : "Ocultar valores"} className="rounded p-1 text-amarelo-texto hover:bg-white/50">
                  {ocultar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>
        )}
        {!temSaldo && (
          <p className="border-t border-borda bg-subcabecalho px-4 py-2 text-xs text-gray-500">
            Filtrando por cartão: aparecem as compras separadas, pela data de vencimento da fatura. Para pagar, use o menu da linha Fatura-Cartão (sem filtro) ou Cadastros &gt; Cartões de Crédito &gt; Faturas.
          </p>
        )}
      </div>

      {acoes.modais}
    </>
  );
}

