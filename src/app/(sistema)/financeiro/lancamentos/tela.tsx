"use client";

import {
  AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, CreditCard, Eye, EyeOff,
  Landmark, MessageSquareText, Paperclip, Pencil, Plus, RotateCcw, Search, Trash2, Wallet,
} from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Botao } from "@/components/ui/botao";
import { CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import type { Filtros, LinhaLista, Opcoes, Resumo } from "@/lib/lancamentos/tipos";
import { carregarLancamento, estornarLancamentos, excluirLancamentos, realizarLancamentos } from "./acoes";
import { dadosVazios, ModalLancamento, type Aba, type Pedido } from "./formulario";

type Mes = { anoMes: string; rotulo: string; anterior: string; seguinte: string; inicio: string; fim: string };

const ABAS: { valor: Filtros["aba"]; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "receitas", rotulo: "Receitas" },
  { valor: "despesas", rotulo: "Despesas" },
  { valor: "transferencias", rotulo: "Transferências" },
];

const SITUACOES = [
  { valor: "", rotulo: "Todas as situações" },
  { valor: "nao_realizado", rotulo: "Não Realizado" },
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "a_vencer", rotulo: "A Vencer" },
  { valor: "vencido", rotulo: "Vencido" },
];

export function TelaLancamentos({ linhas, resumo, filtros, opcoes, hoje, mes, caminho }: {
  linhas: LinhaLista[];
  resumo: Resumo;
  filtros: Filtros;
  opcoes: Opcoes;
  hoje: string;
  mes: Mes;
  caminho: string;
}) {
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [aviso, setAviso] = useState("");
  const [ocultar, setOcultar] = useState(false);
  const [pagar, setPagar] = useState<{ ids: number[]; titulo: string } | null>(null);
  const [excluir, setExcluir] = useState<{ ids: number[]; parcelado: boolean; titulo: string } | null>(null);
  const [abrindo, iniciarAbertura] = useTransition();
  const [ocupado, iniciar] = useTransition();
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

  const novo = (aba: Aba, tipo: "receita" | "despesa" = "despesa") => {
    const inicial = dadosVazios(opcoes, hoje, aba, tipo);
    // Filtrando por conta ou cartão, o novo lançamento já nasce nela.
    if (filtros.destino && (aba !== "transferencia" || filtros.destino.startsWith("conta:"))) inicial.destino = filtros.destino;
    if (aba === "transferencia") inicial.contaDestinoId = opcoes.destinos.find((d) => d.grupo === "Contas" && d.ativo && d.valor !== inicial.destino)?.valor.slice(6) ?? "";
    setPedido({ chave: Date.now(), inicial });
  };

  const editar = (id: number) =>
    iniciarAbertura(async () => {
      setAviso("");
      const edicao = await carregarLancamento(id);
      if (!edicao) {
        setAviso("Este lançamento não existe mais.");
        router.refresh();
        return;
      }
      setPedido({ chave: Date.now(), inicial: edicao.dados, edicao });
    });

  const executar = (acao: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) =>
    iniciar(async () => {
      setAviso("");
      try {
        const r = await acao();
        if (!r.ok) setAviso(r.erro ?? "Não foi possível concluir.");
        else {
          setSelecionados([]);
          depois?.();
        }
      } catch {
        setAviso("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });

  const selecionaveis = linhas.filter((l) => l.id !== null).map((l) => l.id!);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((id) => selecionados.includes(id));
  const marcar = (id: number) => setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const escolhidas = linhas.filter((l) => l.id !== null && selecionados.includes(l.id));
  const destinoAtual = opcoes.destinos.find((d) => d.valor === filtros.destino);

  const menuDe = (l: LinhaLista) => {
    if (l.id === null) {
      return [{ rotulo: "Ver compras desta fatura", icone: <CreditCard className="h-4 w-4" />, aoClicar: () => ir({ destino: `cartao:${l.cartaoId}` }) }];
    }
    if (l.tipo === "saldo_inicial") {
      return [{ rotulo: "Alterar na Conta Financeira", icone: <Pencil className="h-4 w-4" />, aoClicar: () => router.push("/cadastros/contas-financeiras") }];
    }
    const id = l.id;
    const itens = [{ rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(id) }];
    if (!l.eCartao) {
      itens.push(
        l.dataPagamento
          ? { rotulo: "Voltar para não pago", icone: <RotateCcw className="h-4 w-4" />, aoClicar: () => executar(() => estornarLancamentos([id])) }
          : { rotulo: l.valorCentavos > 0 ? "Receber" : "Pagar", icone: <CheckCircle2 className="h-4 w-4" />, aoClicar: () => setPagar({ ids: [id], titulo: l.descricao }) },
      );
    }
    itens.push({ rotulo: "Excluir", icone: <Trash2 className="h-4 w-4" />, aoClicar: () => setExcluir({ ids: [id], parcelado: !!l.parcelamentoId, titulo: l.descricao }) });
    return itens;
  };

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
          <Botao variante="secundario" className="h-8" disabled={ocupado} onClick={() => setPagar({ ids: escolhidas.map((l) => l.id!), titulo: `${escolhidas.length} lançamentos` })} icone={<CheckCircle2 className="h-4 w-4" />}>
            Pagar / Receber
          </Botao>
          <Botao variante="secundario" className="h-8" disabled={ocupado} onClick={() => executar(() => estornarLancamentos(escolhidas.map((l) => l.id!)))} icone={<RotateCcw className="h-4 w-4" />}>
            Voltar para não pago
          </Botao>
          <Botao
            variante="secundario"
            className="h-8 text-negativo"
            disabled={ocupado}
            onClick={() => setExcluir({ ids: escolhidas.map((l) => l.id!), parcelado: false, titulo: `${escolhidas.length} lançamentos` })}
            icone={<Trash2 className="h-4 w-4" />}
          >
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
                  const filhos = l.id === null ? l.compras : [];
                  return (
                    <LinhaComFilhos
                      key={l.chave}
                      linha={l}
                      ocultar={ocultar}
                      marcado={l.id !== null && selecionados.includes(l.id)}
                      aoMarcar={l.id !== null ? () => marcar(l.id!) : undefined}
                      aoAbrir={l.id !== null && l.tipo !== "saldo_inicial" ? () => editar(l.id!) : () => setExpandidas((e) => (e.includes(l.chave) ? e.filter((x) => x !== l.chave) : [...e, l.chave]))}
                      menu={<MenuLinha rotulo={l.descricao} itens={menuDe(l)} />}
                      expandida={expandida}
                      filhos={filhos}
                      aoEditarFilho={editar}
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
            Filtrando por cartão: aparecem as compras separadas, pela data de vencimento da fatura. O pagamento da fatura chega na Fase 5.
          </p>
        )}
      </div>

      {pedido && <ModalLancamento key={pedido.chave} pedido={pedido} opcoes={opcoes} hoje={hoje} aoFechar={() => setPedido(null)} />}
      {pagar && (
        <ModalPagar
          titulo={pagar.titulo}
          hoje={hoje}
          ocupado={ocupado}
          aoFechar={() => setPagar(null)}
          aoConfirmar={(data) => executar(() => realizarLancamentos(pagar.ids, data), () => setPagar(null))}
        />
      )}
      {excluir && (
        <ModalExcluir
          {...excluir}
          ocupado={ocupado}
          aoFechar={() => setExcluir(null)}
          aoConfirmar={(escopo) => executar(() => excluirLancamentos(excluir.ids, escopo), () => setExcluir(null))}
        />
      )}
    </>
  );
}

function BotaoAtalho({ rotulo, cor, onClick, children }: { rotulo: string; cor: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={rotulo} aria-label={rotulo} className={cn("h-9 rounded-md border border-borda bg-white px-2.5 hover:bg-gray-50", cor)}>
      {children}
    </button>
  );
}

function ValorOculto({ centavos, ocultar, className }: { centavos: number; ocultar: boolean; className?: string }) {
  return ocultar ? <span className="font-semibold tracking-widest text-gray-400">•••••</span> : <Valor centavos={centavos} className={className} />;
}

function FaixaSaldo({ rotulo, dica, centavos, ocultar, embutida, acao }: { rotulo: string; dica: string; centavos: number; ocultar: boolean; embutida?: boolean; acao?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-amarelo-texto", !embutida && "border-b border-amarelo-borda bg-amarelo")} title={dica}>
      <span className="font-semibold">{rotulo}</span>
      <span className="flex items-center gap-2">
        <ValorOculto centavos={centavos} ocultar={ocultar} className="text-base" />
        {acao}
      </span>
    </div>
  );
}

function IconeTipo({ l }: { l: LinhaLista }) {
  if (l.tipo === "transferencia_saida" || l.tipo === "transferencia_entrada") return <ArrowLeftRight className="h-4 w-4 text-verde" aria-label="Transferência" />;
  if (l.id === null) return <CreditCard className="h-4 w-4 text-despesa" aria-label="Fatura" />;
  if (l.tipo === "saldo_inicial") return <Landmark className="h-4 w-4 text-gray-400" aria-label="Saldo inicial" />;
  return l.valorCentavos >= 0 ? <ArrowDown className="h-4 w-4 text-receita" aria-label="Receita" /> : <ArrowUp className="h-4 w-4 text-despesa" aria-label="Despesa" />;
}

function EtiquetaSituacao({ l }: { l: LinhaLista }) {
  if (l.id === null) {
    return l.situacao === "realizado" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-pago-fundo px-2 py-0.5 text-xs font-semibold text-pago-texto">
        <CheckCircle2 className="h-3.5 w-3.5" /> Paga
      </span>
    ) : (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", l.situacao === "vencido" ? "bg-orange-100 text-despesa" : "bg-gray-100 text-gray-600")}>
        <CreditCard className="h-3.5 w-3.5" /> {l.situacao === "vencido" ? "Vencida" : "Em aberto"}
      </span>
    );
  }
  if (l.situacao === "realizado") {
    const texto = l.tipo.startsWith("transferencia") ? "Transferido" : l.valorCentavos >= 0 ? "Recebido" : "Pago";
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-pago-fundo px-2 py-0.5 text-xs font-semibold text-pago-texto" title={l.dataPagamento ? `Em ${formatarData(l.dataPagamento)}` : undefined}>
        <CheckCircle2 className="h-3.5 w-3.5" /> {texto}
      </span>
    );
  }
  if (l.situacao === "vencido") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-despesa">
        <AlertTriangle className="h-3.5 w-3.5" /> Vencido
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-receita" title={l.realizarAutomaticamente ? "Será realizado automaticamente" : undefined}>
      {l.realizarAutomaticamente ? <Clock className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />} A Vencer
    </span>
  );
}

function LinhaComFilhos({ linha: l, ocultar, marcado, aoMarcar, aoAbrir, menu, expandida, filhos, aoEditarFilho }: {
  linha: LinhaLista;
  ocultar: boolean;
  marcado: boolean;
  aoMarcar?: () => void;
  aoAbrir: () => void;
  menu: React.ReactNode;
  expandida: boolean;
  filhos: LinhaLista[];
  aoEditarFilho: (id: number) => void;
}) {
  const fatura = l.id === null;
  return (
    <>
      <tr className={cn("border-b border-borda last:border-0 even:bg-gray-50/70 hover:bg-verde-claro/50", marcado && "bg-verde-claro/60")}>
        <td className="px-3 py-2.5 text-center">
          {aoMarcar && <input type="checkbox" aria-label={`Selecionar ${l.descricao}`} checked={marcado} onChange={aoMarcar} className="h-4 w-4 accent-verde" />}
        </td>
        <td className="px-1 py-2.5">
          <IconeTipo l={l} />
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
          {formatarData(l.data).slice(0, 5)}
          {l.dataCompra && l.dataCompra !== l.data && <span className="block text-xs text-gray-400">compra {formatarData(l.dataCompra).slice(0, 5)}</span>}
        </td>
        <td className="px-3 py-2.5">
          <button type="button" onClick={aoAbrir} className="flex w-full items-center gap-3 text-left">
            <IconeBanco codigo={l.bancoCodigo} nome={l.bancoNome ?? "Outro"} className="h-7 w-7 shrink-0 text-[10px]" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-gray-900">{l.descricao}</span>
                {(l.parcelamentoId || l.parcela) && <span className="text-despesa" title="Parcelado">*</span>}
                {l.parcela && !l.descricao.includes(l.parcela) && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{l.parcela}</span>}
                {l.formato === "detalhado" && <span className="rounded bg-verde-claro px-1.5 text-xs text-verde">Detalhado</span>}
                {l.observacao && <MessageSquareText className="h-3.5 w-3.5 text-amarelo-texto" aria-label="Tem observação" />}
                {l.anexos > 0 && <Paperclip className="h-3.5 w-3.5 text-gray-500" aria-label={`${l.anexos} anexo(s)`} />}
                {l.tags.map((t) => (
                  <span key={t} className="rounded-full bg-verde-claro px-2 text-xs text-verde">
                    {t}
                  </span>
                ))}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                {l.categoriaCor && <span className="h-2 w-2 rounded-full" style={{ background: l.categoriaCor }} />}
                {[fatura ? `${l.compras.length} ${l.compras.length === 1 ? "compra" : "compras"}` : l.categoria, l.contaOuCartao, l.contato, l.forma].filter(Boolean).join(" · ")}
              </span>
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <ValorOculto centavos={l.valorCentavos} ocultar={ocultar} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <EtiquetaSituacao l={l} />
        </td>
        <td className="px-3 py-2.5 text-right">{menu}</td>
      </tr>
      {expandida &&
        l.itens.map((i) => (
          <tr key={`i${i.id}`} className="border-b border-borda bg-subcabecalho/60 text-xs">
            <td colSpan={3} />
            <td className="py-1.5 pr-3 pl-13">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: i.categoriaCor }} />
                <span className="text-gray-800">{i.descricao}</span>
                <span className="text-gray-500">· {i.categoria}</span>
              </span>
            </td>
            <td className="px-3 py-1.5 text-right">
              <ValorOculto centavos={i.valorCentavos} ocultar={ocultar} />
            </td>
            <td colSpan={2} />
          </tr>
        ))}
      {expandida &&
        filhos.map((c) => (
          <tr key={c.chave} className="border-b border-borda bg-subcabecalho/60 text-xs">
            <td colSpan={2} />
            <td className="px-3 py-1.5 text-gray-500">{c.dataCompra ? formatarData(c.dataCompra).slice(0, 5) : ""}</td>
            <td className="py-1.5 pr-3 pl-13">
              <button type="button" onClick={() => aoEditarFilho(c.id!)} className="flex items-center gap-1.5 text-left hover:underline">
                {c.categoriaCor && <span className="h-2 w-2 rounded-full" style={{ background: c.categoriaCor }} />}
                <span className="text-gray-800">{c.descricao}</span>
                <span className="text-gray-500">· {c.categoria}</span>
              </button>
            </td>
            <td className="px-3 py-1.5 text-right">
              <ValorOculto centavos={c.valorCentavos} ocultar={ocultar} />
            </td>
            <td colSpan={2} />
          </tr>
        ))}
    </>
  );
}

function ModalPagar({ titulo, hoje, ocupado, aoFechar, aoConfirmar }: { titulo: string; hoje: string; ocupado: boolean; aoFechar: () => void; aoConfirmar: (data: string) => void }) {
  const [data, setData] = useState(hoje);
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Pagar / Receber"
      resumo={titulo}
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="button" carregando={ocupado} onClick={() => aoConfirmar(data)} icone={<CheckCircle2 className="h-4 w-4" />}>
            Confirmar
          </Botao>
        </>
      }
    >
      <CampoTexto rotulo="Data do Pagamento" type="date" valor={data} aoMudar={setData} ajuda="Dia em que o dinheiro saiu ou entrou na conta." />
      <p className="mt-2 text-xs text-gray-500">O valor pago é o valor do lançamento. Compras no cartão são pagas junto com a fatura.</p>
    </Modal>
  );
}

function ModalExcluir({ titulo, parcelado, ocupado, aoFechar, aoConfirmar }: {
  titulo: string;
  parcelado: boolean;
  ocupado: boolean;
  aoFechar: () => void;
  aoConfirmar: (escopo: "esta" | "proximas" | "todas") => void;
}) {
  const [escopo, setEscopo] = useState<"esta" | "proximas" | "todas">("esta");
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Excluir lançamento"
      resumo={titulo}
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao variante="perigo" type="button" carregando={ocupado} onClick={() => aoConfirmar(escopo)} icone={<Trash2 className="h-4 w-4" />}>
            Excluir
          </Botao>
        </>
      }
    >
      <p className="text-sm text-gray-700">Tem certeza? Transferências são excluídas nas duas contas. A exclusão fica registrada na auditoria.</p>
      {parcelado && (
        <fieldset className="mt-4 space-y-2 text-sm">
          <legend className="mb-1 font-semibold text-gray-800">Este lançamento é uma parcela. Excluir:</legend>
          {(
            [
              ["esta", "Só esta parcela"],
              ["proximas", "Esta e as próximas"],
              ["todas", "Todas as parcelas"],
            ] as const
          ).map(([v, r]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="escopo" checked={escopo === v} onChange={() => setEscopo(v)} className="accent-verde" /> {r}
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
}
