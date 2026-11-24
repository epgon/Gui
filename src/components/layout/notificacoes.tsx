"use client";

import { AlertTriangle, BellRing, Info } from "lucide-react";
import { useTransition } from "react";
import { marcarNotificacoesLidas } from "@/app/(sistema)/sistema-acoes";
import { cn } from "@/lib/cn";
import type { Notificacao } from "@/lib/notificacoes/tipos";

export function IconeNotificacao({ tipo, className }: { tipo: Notificacao["tipo"]; className?: string }) {
  const Icone = tipo === "alerta" ? AlertTriangle : tipo === "aviso" ? BellRing : Info;
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        tipo === "alerta" ? "bg-red-50 text-negativo" : tipo === "aviso" ? "bg-amarelo text-amarelo-texto" : "bg-verde-claro text-verde",
        className,
      )}
    >
      <Icone className="h-4 w-4" />
    </span>
  );
}

export function useMarcarLidas() {
  const [ocupado, iniciar] = useTransition();
  return { ocupado, executar: (ids: string[]) => iniciar(async () => void (await marcarNotificacoesLidas(ids))) };
}
