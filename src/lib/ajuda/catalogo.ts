import { ARTIGOS_DIVIDAS } from "@/lib/ajuda/dividas";
import { artigosDaTela } from "@/lib/ajuda/busca";
import { TELA_DA_ABA } from "@/lib/ajuda/contexto";
import { ASSUNTOS_AJUDA, type ArtigoAjuda, type TelaAjuda } from "@/lib/ajuda/tipos";
import { ABAS_DIVIDAS, MENU_CONFIGURACOES, MENU_PRINCIPAL, type ItemMenu } from "@/lib/menu";

/** Uma tela do sistema na Central de Ajuda. `tela` só existe quando ela já tem artigos. */
export type TelaCatalogo = { id: string; rotulo: string; href: string; tela?: TelaAjuda };
export type ModuloAjuda = { id: string; rotulo: string; telas: TelaCatalogo[] };

const daTela = (i: ItemMenu): TelaCatalogo => ({ id: i.href, rotulo: i.titulo, href: i.href, tela: TELA_DA_ABA[i.href] });
const grupoDoMenu = (titulo: string): TelaCatalogo[] => (MENU_PRINCIPAL.find((g) => g.titulo === titulo)?.itens ?? []).map(daTela);

const ORCAMENTOS = MENU_PRINCIPAL.flatMap((g) => g.itens).find((i) => i.href === "/gestao/orcamentos");

const TELAS_GESTAO: TelaCatalogo[] = [
  ...(ORCAMENTOS ? [daTela(ORCAMENTOS)] : []),
  ...ABAS_DIVIDAS.map((a) => ({ ...daTela(a), rotulo: a.href === "/gestao/dividas" ? "Gestão de Dívidas" : `Gestão de Dívidas - ${a.titulo}` })),
];

export const MODULOS_AJUDA: ModuloAjuda[] = [
  {
    id: "geral",
    rotulo: "Geral",
    telas: [
      { id: "/", rotulo: "Visão Geral", href: "/" },
      { id: "/notificacoes", rotulo: "Notificações", href: "/notificacoes" },
    ],
  },
  { id: "financeiro", rotulo: "Financeiro", telas: grupoDoMenu("Financeiro") },
  { id: "gestao", rotulo: "Gestão", telas: TELAS_GESTAO },
  { id: "relatorios", rotulo: "Relatórios", telas: grupoDoMenu("Relatórios") },
  { id: "cadastros", rotulo: "Cadastros", telas: grupoDoMenu("Cadastros") },
  { id: "administracao", rotulo: "Administração", telas: grupoDoMenu("Administração") },
  { id: "configuracoes", rotulo: "Configurações", telas: MENU_CONFIGURACOES.filter((i) => i.href !== "/notificacoes").map(daTela) },
];

function limpar(caminho: string): string {
  const semParametros = caminho.split(/[?#]/)[0] ?? "";
  return semParametros.length > 1 ? semParametros.replace(/\/+$/, "") : semParametros || "/";
}

/** A tela do catálogo a que o endereço pertence (prefixo mais longo; "/" só vale para "/"), ou null. */
export function telaDoCaminho(caminho: string, modulos: ModuloAjuda[] = MODULOS_AJUDA): { modulo: ModuloAjuda; tela: TelaCatalogo } | null {
  const c = limpar(caminho);
  let melhor: { modulo: ModuloAjuda; tela: TelaCatalogo } | null = null;
  for (const modulo of modulos) {
    for (const tela of modulo.telas) {
      const bate = tela.href === "/" ? c === "/" : c === tela.href || c.startsWith(`${tela.href}/`);
      if (bate && (!melhor || tela.href.length > melhor.tela.href.length)) melhor = { modulo, tela };
    }
  }
  return melhor;
}

export function artigosDaTelaCatalogo(t: TelaCatalogo): ArtigoAjuda[] {
  return t.tela ? artigosDaTela(ARTIGOS_DIVIDAS, t.tela) : [];
}

/** Artigos da tela: os de "Entendendo as telas" sem subtítulo e, depois, um grupo "Sobre ..." por assunto. */
export function agruparArtigos(artigos: ArtigoAjuda[]): { principais: ArtigoAjuda[]; grupos: { rotulo: string; artigos: ArtigoAjuda[] }[] } {
  let principais = artigos.filter((a) => a.assunto === "telas");
  let grupos = ASSUNTOS_AJUDA.filter((s) => s.valor !== "telas")
    .map((s) => ({ rotulo: s.sobre, artigos: artigos.filter((a) => a.assunto === s.valor) }))
    .filter((g) => g.artigos.length > 0);
  if (!principais.length && grupos.length) {
    principais = grupos[0]!.artigos;
    grupos = grupos.slice(1);
  }
  return { principais, grupos };
}
