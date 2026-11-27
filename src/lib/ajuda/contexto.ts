import type { TelaAjuda } from "./tipos";

/** Qual tela (aba) da Gestão de Dívidas cada endereço é. */
export const TELA_DA_ABA: Record<string, TelaAjuda> = {
  "/gestao/dividas": "visao",
  "/gestao/dividas/minhas": "minhas",
  "/gestao/dividas/negociacoes": "negociacoes",
  "/gestao/dividas/simulador": "simulador",
  "/gestao/dividas/plano": "plano",
  "/gestao/dividas/consultor": "consultor",
};

function limpar(caminho: string): string {
  const semParametros = caminho.split(/[?#]/)[0] ?? "";
  return semParametros.length > 1 ? semParametros.replace(/\/+$/, "") : semParametros || "/";
}

/** A tela de ajuda do endereço, ou null quando a tela não tem artigos próprios. */
export function telaAjudaDoCaminho(caminho: string): TelaAjuda | null {
  return TELA_DA_ABA[limpar(caminho)] ?? null;
}
