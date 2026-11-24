"use client";

import { CalendarClock, CheckCircle2, CreditCard, FileText, Pencil, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ItemMenuLinha } from "@/components/cadastros/menu-linha";
import { JanelaFatura } from "@/components/cartoes/janela-fatura";
import type { LinhaLista, Ocorrencia, Opcoes } from "@/lib/lancamentos/tipos";
import { carregarLancamento, carregarOcorrencia, estornarLancamentos, excluirLancamentos, pularOcorrencias, realizarLancamentos } from "./acoes";
import { dadosVazios, ModalLancamento, type Aba, type Pedido } from "./formulario";
import { ModalExcluir, ModalPagar, type PagamentoUnico } from "./linhas";

/** Lançamentos gravados (ids) e ocorrências previstas de recorrentes escolhidos numa lista. */
export type Alvo = { ids: number[]; ocorrencias: Ocorrencia[]; titulo: string; unico?: PagamentoUnico | null };

export function alvoDe(linhas: LinhaLista[], titulo: string): Alvo {
  const ids = linhas.filter((l) => l.id !== null).map((l) => l.id!);
  const vistas = new Set<string>();
  const ocorrencias = linhas
    .map((l) => l.previsto)
    .filter((o): o is Ocorrencia => !!o && !vistas.has(`${o.recorrenciaId}|${o.data}`) && !!vistas.add(`${o.recorrenciaId}|${o.data}`));
  return { ids, ocorrencias, titulo };
}

type Resposta = { ok: boolean; erro?: string };

/**
 * Ações da lista de lançamentos (novo, editar, pagar, voltar para não pago, excluir),
 * com as janelas que elas abrem. Usado na tela Lançamentos e na Agenda.
 */
export function useAcoesLista({ opcoes, hoje, destino, abrirNovo }: {
  opcoes: Opcoes;
  hoje: string;
  destino: string;
  /** Abre o Novo Lançamento assim que a tela aparece (botões Adicionar da Visão Geral). */
  abrirNovo?: { aba: Aba; tipo?: "receita" | "despesa" } | null;
}) {
  const router = useRouter();
  const montarPedido = (chave: number, aba: Aba, tipo: "receita" | "despesa" = "despesa", data?: string): Pedido => {
    const inicial = dadosVazios(opcoes, hoje, aba, tipo);
    if (data) inicial.data = data;
    // Filtrando por conta ou cartão, o novo lançamento já nasce nela.
    if (destino && (aba !== "transferencia" || destino.startsWith("conta:"))) inicial.destino = destino;
    if (aba === "transferencia") inicial.contaDestinoId = opcoes.destinos.find((d) => d.grupo === "Contas" && d.ativo && d.valor !== inicial.destino)?.valor.slice(6) ?? "";
    return { chave, inicial };
  };
  const [pedido, setPedido] = useState<Pedido | null>(() => (abrirNovo ? montarPedido(0, abrirNovo.aba, abrirNovo.tipo) : null));
  const [aviso, setAviso] = useState("");
  const [pagar, setPagar] = useState<Alvo | null>(null);
  const [faturaAberta, setFaturaAberta] = useState<number | null>(null);
  const [excluir, setExcluir] = useState<(Alvo & { parcelado: boolean; recorrente: boolean }) | null>(null);
  const [abrindo, iniciarAbertura] = useTransition();
  const [ocupado, iniciar] = useTransition();

  const novo = (aba: Aba, tipo: "receita" | "despesa" = "despesa", data?: string) => setPedido(montarPedido(Date.now(), aba, tipo, data));

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

  const editarOcorrencia = (o: Ocorrencia) =>
    iniciarAbertura(async () => {
      setAviso("");
      const r = await carregarOcorrencia(o);
      if ("erro" in r) {
        setAviso(r.erro);
        router.refresh();
        return;
      }
      setPedido({ chave: Date.now(), inicial: r.dados, ocorrencia: true });
    });

  const executar = (acao: () => Promise<Resposta>, depois?: () => void) =>
    iniciar(async () => {
      setAviso("");
      try {
        const r = await acao();
        if (!r.ok) setAviso(r.erro ?? "Não foi possível concluir.");
        else depois?.();
      } catch {
        setAviso("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });

  const estornar = (alvo: Alvo, depois?: () => void) => {
    if (!alvo.ids.length) {
      setAviso("Lançamentos previstos ainda não foram pagos.");
      return;
    }
    executar(() => estornarLancamentos(alvo.ids), depois);
  };

  const pedirExclusao = (linhas: LinhaLista[], titulo: string) =>
    setExcluir({ ...alvoDe(linhas, titulo), parcelado: linhas.length === 1 && !!linhas[0].parcelamentoId, recorrente: linhas.some((l) => l.recorrenciaId) });

  /** Pagar / receber. Previstos no cartão só precisam ser confirmados (a compra vai para a fatura). */
  const pedirPagamento = (linhas: LinhaLista[], titulo: string) => {
    const alvo = alvoDe(linhas, titulo);
    if (!alvo.ids.length && linhas.every((l) => l.eCartao)) return executar(() => realizarLancamentos([], hoje, alvo.ocorrencias));
    // Um lançamento simples sozinho (receita ou despesa na conta): dá para pagar outro valor.
    const [l] = linhas;
    const simples = linhas.length === 1 && !l.eCartao && l.formato === "simples" && (l.tipo === "receita" || l.tipo === "despesa") && !l.transferenciaId;
    setAviso("");
    setPagar({ ...alvo, unico: simples ? { valorCentavos: Math.abs(l.valorCentavos), vencimento: l.data, receita: l.tipo === "receita" } : null });
  };

  /** O que acontece ao clicar na descrição. null = não abre nada (linha de fatura). */
  const abrirLinha = (l: LinhaLista): (() => void) | null => {
    if (l.previsto) return () => editarOcorrencia(l.previsto!);
    if (l.id !== null && l.tipo !== "saldo_inicial") return () => editar(l.id!);
    return null;
  };

  const menuDe = (l: LinhaLista, aoVerFatura?: (cartaoId: number) => void): ItemMenuLinha[] => {
    const verRecorrente = l.recorrenciaId
      ? [{ rotulo: "Editar o recorrente", icone: <CalendarClock className="h-4 w-4" />, aoClicar: () => router.push(`/financeiro/recorrentes?editar=${l.recorrenciaId}`) }]
      : [];
    if (l.previsto) {
      const o = l.previsto;
      return [
        { rotulo: "Editar esta ocorrência", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editarOcorrencia(o) },
        {
          rotulo: l.eCartao ? "Confirmar compra" : l.valorCentavos > 0 ? "Receber" : "Pagar",
          icone: <CheckCircle2 className="h-4 w-4" />,
          aoClicar: () => pedirPagamento([l], l.descricao),
        },
        ...verRecorrente,
        { rotulo: "Excluir esta ocorrência", icone: <Trash2 className="h-4 w-4" />, aoClicar: () => pedirExclusao([l], l.descricao) },
      ];
    }
    if (l.id === null) {
      const faturaId = l.faturaId;
      const itens: ItemMenuLinha[] = [];
      if (faturaId !== null) {
        if (l.situacao !== "realizado") itens.push({ rotulo: "Pagar fatura", icone: <Wallet className="h-4 w-4" />, aoClicar: () => setFaturaAberta(faturaId) });
        itens.push({ rotulo: "Abrir fatura (fechar, desfazer pagamento)", icone: <FileText className="h-4 w-4" />, aoClicar: () => setFaturaAberta(faturaId) });
      }
      if (aoVerFatura) itens.push({ rotulo: "Ver compras desta fatura", icone: <CreditCard className="h-4 w-4" />, aoClicar: () => aoVerFatura(l.cartaoId!) });
      return itens;
    }
    if (l.tipo === "saldo_inicial") {
      return [{ rotulo: "Alterar na Conta Financeira", icone: <Pencil className="h-4 w-4" />, aoClicar: () => router.push("/cadastros/contas-financeiras") }];
    }
    const id = l.id;
    const itens: ItemMenuLinha[] = [{ rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(id) }];
    if (!l.eCartao) {
      itens.push(
        l.dataPagamento
          ? { rotulo: "Voltar para não pago", icone: <RotateCcw className="h-4 w-4" />, aoClicar: () => executar(() => estornarLancamentos([id])) }
          : { rotulo: l.valorCentavos > 0 ? "Receber" : "Pagar", icone: <CheckCircle2 className="h-4 w-4" />, aoClicar: () => pedirPagamento([l], l.descricao) },
      );
    }
    itens.push(...verRecorrente);
    itens.push({ rotulo: "Excluir", icone: <Trash2 className="h-4 w-4" />, aoClicar: () => pedirExclusao([l], l.descricao) });
    return itens;
  };

  const modais = (
    <>
      {faturaAberta !== null && <JanelaFatura key={faturaAberta} faturaId={faturaAberta} aoFechar={() => setFaturaAberta(null)} aoMudar={() => router.refresh()} />}
      {pedido && <ModalLancamento key={pedido.chave} pedido={pedido} opcoes={opcoes} hoje={hoje} aoFechar={() => setPedido(null)} />}
      {pagar && (
        <ModalPagar
          titulo={pagar.titulo}
          hoje={hoje}
          ocupado={ocupado}
          unico={pagar.unico}
          erro={aviso}
          aoFechar={() => {
            setPagar(null);
            setAviso("");
          }}
          aoConfirmar={(e) => executar(() => realizarLancamentos(pagar.ids, e.data, pagar.ocorrencias, e.valor), () => setPagar(null))}
        />
      )}
      {excluir && (
        <ModalExcluir
          titulo={excluir.titulo}
          parcelado={excluir.parcelado}
          recorrente={excluir.recorrente}
          ocupado={ocupado}
          aoFechar={() => setExcluir(null)}
          aoConfirmar={(escopo) =>
            executar(
              async () => {
                if (excluir.ids.length) {
                  const r = await excluirLancamentos(excluir.ids, escopo);
                  if (!r.ok) return r;
                }
                return excluir.ocorrencias.length ? pularOcorrencias(excluir.ocorrencias) : { ok: true };
              },
              () => setExcluir(null),
            )
          }
        />
      )}
    </>
  );

  return { novo, editar, editarOcorrencia, executar, estornar, pedirExclusao, pedirPagamento, abrirLinha, menuDe, aviso, setAviso, abrindo, ocupado, modais };
}
