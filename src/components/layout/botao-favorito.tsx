"use client";

import { Star } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { alternarFavorito } from "@/app/(sistema)/sistema-acoes";
import { cn } from "@/lib/cn";
import { encontrarItem } from "@/lib/menu";
import { useSistema } from "./provedor-sistema";

/** Estrela ao lado do título: põe ou tira a tela dos Favoritos (barra da esquerda). */
export function BotaoFavorito() {
  const caminho = usePathname();
  const { favoritos } = useSistema();
  const [ocupado, iniciar] = useTransition();
  if (!encontrarItem(caminho)) return null;
  const marcado = favoritos.includes(caminho);
  return (
    <button
      type="button"
      onClick={() => iniciar(async () => void (await alternarFavorito(caminho)))}
      disabled={ocupado}
      aria-pressed={marcado}
      title={marcado ? "Tirar dos Favoritos" : "Adicionar aos Favoritos"}
      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-dourado disabled:opacity-50"
    >
      <Star className={cn("h-4 w-4", marcado && "fill-dourado text-dourado")} />
    </button>
  );
}
