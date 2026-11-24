"use client";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Move o item da posição "de" para a posição "para" (usado ao arrastar e nos botões). */
export function mover<T>(lista: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista;
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}

/**
 * Lista que se ordena arrastando (ou pelas setas, no celular e no teclado).
 * "conteudo" desenha cada item; "extra" fica à direita (ex.: lixeira).
 */
export function ListaOrdenavel<T>({ itens, chave, conteudo, extra, aoMudar, vazio }: {
  itens: T[];
  chave: (item: T) => string | number;
  conteudo: (item: T) => React.ReactNode;
  extra?: (item: T, indice: number) => React.ReactNode;
  aoMudar: (nova: T[]) => void;
  vazio?: React.ReactNode;
}) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  if (!itens.length) return <p className="rounded-md border border-dashed border-borda px-3 py-4 text-center text-sm text-gray-500">{vazio ?? "Nenhum item."}</p>;
  return (
    <ul className="divide-y divide-borda rounded-md border border-borda bg-white">
      {itens.map((item, i) => (
        <li
          key={chave(item)}
          draggable
          onDragStart={(e) => {
            setArrastando(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (arrastando === null) return;
            e.preventDefault();
            setSobre(i);
          }}
          onDragLeave={() => setSobre((s) => (s === i ? null : s))}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastando !== null) aoMudar(mover(itens, arrastando, i));
            setArrastando(null);
            setSobre(null);
          }}
          onDragEnd={() => {
            setArrastando(null);
            setSobre(null);
          }}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-sm",
            arrastando === i && "opacity-50",
            sobre === i && arrastando !== i && (arrastando! < i ? "border-b-2 border-b-verde" : "border-t-2 border-t-verde"),
          )}
        >
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-400" aria-hidden />
          <div className="min-w-0 flex-1">{conteudo(item)}</div>
          <button type="button" className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30" disabled={i === 0} onClick={() => aoMudar(mover(itens, i, i - 1))} aria-label="Subir">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            disabled={i === itens.length - 1}
            onClick={() => aoMudar(mover(itens, i, i + 1))}
            aria-label="Descer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          {extra?.(item, i)}
        </li>
      ))}
    </ul>
  );
}
