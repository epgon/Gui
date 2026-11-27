import { ABAS_DIVIDAS, MENU_CONFIGURACOES, MENU_PRINCIPAL } from "@/lib/menu";
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

/** Todos os endereços conhecidos com a trilha de cada um (sem "Início" e sem "Artigos"). */
const TRILHAS: { href: string; trilha: string[] }[] = [
  ...MENU_PRINCIPAL.flatMap((g) => g.itens.map((i) => ({ href: i.href, trilha: [g.titulo, i.titulo] }))),
  ...MENU_CONFIGURACOES.map((i) => ({ href: i.href, trilha: ["Configurações", i.titulo] })),
  ...ABAS_DIVIDAS.filter((a) => a.href !== "/gestao/dividas").map((a) => ({ href: a.href, trilha: ["Gestão", "Gestão de Dívidas", a.titulo] })),
];

/**
 * Trilha de navegação do endereço, sem "Início" nem "Artigos".
 * Subtelas (ex.: /financeiro/importacoes/nova) usam o item de menu mais específico que for prefixo.
 */
export function trilhaDoCaminho(caminho: string): string[] {
  const c = limpar(caminho);
  if (c === "/") return [];
  let melhor: { href: string; trilha: string[] } | null = null;
  for (const t of TRILHAS) {
    if ((c === t.href || c.startsWith(`${t.href}/`)) && (!melhor || t.href.length > melhor.href.length)) melhor = t;
  }
  return melhor ? [...melhor.trilha] : [];
}
