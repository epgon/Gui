"use client";

import { Eye, EyeOff } from "lucide-react";
import { createContext, useContext, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Valor } from "./valor";

/**
 * "Olho" para esconder os valores da tela (ex.: em público).
 * A escolha fica guardada no navegador e vale para a Visão Geral e o Detalhando Conta.
 */
const CHAVE = "gui:ocultar-valores";
const ouvintes = new Set<() => void>();

function ler(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

function gravar(valor: boolean) {
  try {
    window.localStorage.setItem(CHAVE, valor ? "1" : "0");
  } catch {
    // Navegador sem armazenamento: vale só enquanto a tela estiver aberta.
  }
  memoria = valor;
  ouvintes.forEach((f) => f());
}

let memoria: boolean | null = null;

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export function useOcultarValores(): [boolean, () => void] {
  const ocultar = useSyncExternalStore(assinar, () => memoria ?? ler(), () => false);
  return [ocultar, () => gravar(!ocultar)];
}

const Contexto = createContext(false);

/** Tudo dentro dele usa a escolha do olho. */
export function ProvedorOcultar({ children }: { children: React.ReactNode }) {
  const [ocultar] = useOcultarValores();
  return <Contexto.Provider value={ocultar}>{children}</Contexto.Provider>;
}

export function BotaoOlho({ className }: { className?: string }) {
  const [ocultar, alternar] = useOcultarValores();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={ocultar ? "Mostrar valores" : "Ocultar valores"}
      title={ocultar ? "Mostrar valores" : "Ocultar valores"}
      className={cn("rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-verde", className)}
    >
      {ocultar ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}

/** Valor em reais que some quando o olho está fechado. */
export function ValorOcultavel({ centavos, className }: { centavos: number; className?: string }) {
  const ocultar = useContext(Contexto);
  return ocultar ? <span className={cn("font-semibold tracking-widest text-gray-400", className)}>•••••</span> : <Valor centavos={centavos} className={className} />;
}
