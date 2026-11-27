"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { OpcaoCategoria } from "@/lib/lancamentos/tipos";

/** Minúsculas e sem acento, para a busca não depender de como a pessoa digita. */
function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

type Item = { c: OpcaoCategoria; combina: boolean };

/**
 * Filtra mantendo a árvore: a lista chega na ordem da árvore (pai antes das filhas),
 * então uma filha que combina traz junto os pais dela, mesmo que o pai não combine.
 */
export function filtrarCategorias(lista: OpcaoCategoria[], busca: string): Item[] {
  const q = normalizar(busca);
  if (!q) return lista.map((c) => ({ c, combina: true }));
  const combina = lista.map((c) => normalizar(c.rotulo).includes(q));
  const visivel = lista.map((_, i) => combina[i]);
  const pilha: number[] = []; // índices dos pais do item atual
  lista.forEach((c, i) => {
    while (pilha.length && lista[pilha[pilha.length - 1]].nivel >= c.nivel) pilha.pop();
    if (combina[i]) for (const p of pilha) visivel[p] = true;
    pilha.push(i);
  });
  return lista.flatMap((c, i) => (visivel[i] ? [{ c, combina: combina[i] }] : []));
}

/**
 * Seleção de categoria com hierarquia visual (pai e filhas recuadas) e busca por qualquer parte do texto.
 * `categorias` já deve vir filtrada por natureza, na ordem da árvore.
 */
export function SeletorCategoria({ valor, aoMudar, categorias, vazio = "Selecione", rotulo, desabilitado, alerta, agrupar, id, className }: {
  valor: string;
  aoMudar: (v: string) => void;
  categorias: OpcaoCategoria[];
  vazio?: string;
  rotulo?: string;
  desabilitado?: boolean;
  alerta?: boolean;
  /** Mostra os títulos "Despesas" e "Receitas" (para listas com as duas naturezas). */
  agrupar?: boolean;
  id?: string;
  className?: string;
}) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; acima: boolean } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const escolhida = categorias.find((c) => String(c.id) === valor);
  const itens = useMemo(() => {
    const base = agrupar ? ["despesa", "receita"].flatMap((n) => categorias.filter((c) => c.natureza === n)) : categorias;
    return filtrarCategorias(base, busca);
  }, [categorias, busca, agrupar]);
  // Posição 0 é "limpar" (vazio); as categorias vêm depois.
  const total = itens.length + 1;

  function posicionar() {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const acima = window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom;
    setPos({ top: acima ? r.top : r.bottom, left: r.left, width: Math.max(r.width, 260), acima });
  }

  function abrir() {
    if (desabilitado) return;
    posicionar();
    setBusca("");
    const i = itens.findIndex((x) => String(x.c.id) === valor);
    setAtivo(i >= 0 ? i + 1 : 0);
    setAberto(true);
  }

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  function escolher(v: string) {
    if (v !== valor) aoMudar(v);
    fechar();
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !botao.current?.contains(alvo)) setAberto(false);
    };
    const reposicionar = (e: Event) => {
      if (caixa.current?.contains(e.target as Node)) return;
      posicionar();
    };
    document.addEventListener("mousedown", fora);
    window.addEventListener("resize", reposicionar);
    window.addEventListener("scroll", reposicionar, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("resize", reposicionar);
      window.removeEventListener("scroll", reposicionar, true);
    };
  }, [aberto]);

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-pos="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(ativo === 0 ? "" : String(itens[ativo - 1].c.id));
    } else if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "Tab") {
      setAberto(false);
    }
  }

  const idLista = `${idCampo}-lista`;

  return (
    <>
      <button
        ref={botao}
        id={idCampo}
        type="button"
        role="combobox"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        aria-controls={aberto ? idLista : undefined}
        disabled={desabilitado}
        onClick={() => (aberto ? fechar(false) : abrir())}
        onKeyDown={(e) => {
          if (!aberto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            abrir();
          }
        }}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md border bg-white px-2 text-left text-sm outline-none focus:border-verde disabled:bg-gray-50 disabled:text-gray-500",
          alerta ? "border-despesa/50" : "border-borda",
          className,
        )}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: escolhida?.cor ?? "#d1d5db" }} aria-hidden />
        <span className={cn("min-w-0 flex-1 truncate", !escolhida && "text-gray-500")}>{escolhida ? escolhida.rotulo : vazio}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>
      {aberto &&
        pos &&
        createPortal(
          <div
            ref={caixa}
            style={{ position: "fixed", left: pos.left, width: pos.width, ...(pos.acima ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top + 4 }), zIndex: 60 }}
            className="rounded-md border border-borda bg-white shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-borda px-2">
              <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <input
                autoFocus
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setAtivo(e.target.value.trim() ? 1 : 0);
                }}
                onKeyDown={teclas}
                placeholder="Digite para buscar"
                aria-label="Buscar categoria"
                aria-controls={idLista}
                aria-activedescendant={`${idCampo}-op-${ativo}`}
                className="h-9 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <ul ref={lista} id={idLista} role="listbox" className="max-h-64 overflow-y-auto py-1">
              <li
                id={`${idCampo}-op-0`}
                data-pos={0}
                role="option"
                aria-selected={valor === ""}
                onMouseEnter={() => setAtivo(0)}
                onClick={() => escolher("")}
                className={cn("cursor-pointer px-3 py-1.5 text-sm text-gray-500", ativo === 0 && "bg-gray-100")}
              >
                {vazio}
              </li>
              {itens.map(({ c, combina }, i) => {
                const titulo = agrupar && c.natureza !== itens[i - 1]?.c.natureza ? (c.natureza === "despesa" ? "Despesas" : "Receitas") : null;
                const marcada = String(c.id) === valor;
                return (
                  <li key={c.id} role="presentation">
                    {titulo && <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">{titulo}</div>}
                    <div
                      id={`${idCampo}-op-${i + 1}`}
                      data-pos={i + 1}
                      role="option"
                      aria-selected={marcada}
                      onMouseEnter={() => setAtivo(i + 1)}
                      onClick={() => escolher(String(c.id))}
                      style={{ paddingLeft: 12 + (c.nivel - 1) * 20 }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 py-1.5 pr-3 text-sm",
                        c.nivel === 1 && "font-semibold",
                        !combina && "text-gray-400",
                        ativo === i + 1 && "bg-gray-100",
                      )}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{c.rotulo}</span>
                      {marcada && <Check className="h-4 w-4 shrink-0 text-verde" aria-hidden />}
                    </div>
                  </li>
                );
              })}
              {itens.length === 0 && <li className="px-3 py-3 text-center text-sm text-gray-500">Nenhuma categoria encontrada</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
