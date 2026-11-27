/**
 * Central de Ajuda: artigos escritos como dados (sem banco), mostrados no painel da direita
 * e na janela "Ajuda" das abas. Textos aceitam **negrito** (TextoComDestaque).
 */

/** As telas (abas) da Gestão de Dívidas. Um artigo pode servir a várias. */
export type TelaAjuda = "visao" | "minhas" | "negociacoes" | "simulador" | "plano" | "consultor";

/** Assunto, para agrupar a lista "Todos os artigos". A ordem aqui é a ordem na tela. */
export const ASSUNTOS_AJUDA = [
  { valor: "comecar", rotulo: "Primeiros passos", sobre: "Sobre Primeiros Passos" },
  { valor: "casos", rotulo: "Como lançar cada caso", sobre: "Sobre Casos" },
  { valor: "dia_a_dia", rotulo: "Pagamentos e saldo no dia a dia", sobre: "Sobre Pagamentos e Saldo" },
  { valor: "telas", rotulo: "Entendendo as telas", sobre: "Sobre as Telas" },
] as const;
export type AssuntoAjuda = (typeof ASSUNTOS_AJUDA)[number]["valor"];

export type BlocoAjuda =
  /** Parágrafo comum. */
  | { tipo: "p"; texto: string }
  /** Subtítulo dentro do artigo. */
  | { tipo: "titulo"; texto: string }
  /** Passo a passo numerado. */
  | { tipo: "passos"; itens: string[] }
  /** Lista com marcadores. */
  | { tipo: "lista"; itens: string[] }
  /** Caixa verde-clara com uma dica. */
  | { tipo: "dica"; texto: string }
  /** Caixa amarela: cuidado para não errar (ex.: lançar em dobro). */
  | { tipo: "atencao"; texto: string }
  /** Exemplo preenchido: pares "Campo" → "o que colocar". */
  | { tipo: "exemplo"; titulo: string; linhas: [string, string][] };

export type ArtigoAjuda = {
  /** Identificador estável, em minúsculas com hífen (vai no endereço ?ajuda=). */
  id: string;
  titulo: string;
  /** Uma frase que aparece na lista e na busca. */
  resumo: string;
  assunto: AssuntoAjuda;
  /** Em quais abas o artigo aparece em "Nesta tela" (na ordem em que forem listados por aba). */
  telas: TelaAjuda[];
  /** Palavras que as pessoas digitam na busca e que não estão no título (sinônimos, termos do banco). */
  palavras: string[];
  blocos: BlocoAjuda[];
  /** Ids de outros artigos para "Veja também". */
  relacionados?: string[];
};
