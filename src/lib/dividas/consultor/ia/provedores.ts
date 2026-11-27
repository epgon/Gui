import { gemini } from "./gemini";
import { simulado } from "./simulado";
import type { ProvedorIA } from "./tipos";

/** Provedores disponíveis. Para acrescentar outro (ex.: Groq), crie o arquivo dele e liste aqui: o resto do Gui não muda. */
export const PROVEDORES: ProvedorIA[] = [gemini, simulado];
export const PROVEDOR_PADRAO = "gemini";

export const acharProvedor = (id: string): ProvedorIA | null => PROVEDORES.find((p) => p.id === id) ?? null;
