import type { ArtigoAjuda, BlocoAjuda, TelaAjuda } from "./tipos";

/** Minúsculas, sem acento e sem pontuação, para comparar "cartão" com "cartao" e "Cheque-especial" com "cheque especial". */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PALAVRAS_VAZIAS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma", "para", "pra", "com", "como", "que", "eu", "meu", "minha", "se", "por", "ou", "ao", "faco", "fazer"]);

function textoDosBlocos(blocos: BlocoAjuda[]): string {
  return blocos
    .map((b) => {
      if (b.tipo === "passos" || b.tipo === "lista") return b.itens.join(" ");
      if (b.tipo === "exemplo") return [b.titulo, ...b.linhas.flat()].join(" ");
      return b.texto;
    })
    .join(" ");
}

/**
 * Busca simples por palavras: cada palavra digitada precisa aparecer em algum lugar do artigo
 * (título, resumo, palavras-chave ou texto). Título vale mais que palavras-chave, que valem mais que o texto.
 * Aceita o começo da palavra ("financ" acha "financiamento"). Sem termo, devolve tudo na ordem original.
 */
export function buscarArtigos(artigos: ArtigoAjuda[], termo: string): ArtigoAjuda[] {
  const palavras = normalizar(termo)
    .split(" ")
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p));
  if (!palavras.length) return termo.trim() ? [] : artigos;
  const pontuados = artigos.map((a, ordem) => {
    const titulo = ` ${normalizar(a.titulo)}`;
    const chaves = ` ${normalizar([a.resumo, ...a.palavras].join(" "))}`;
    const corpo = ` ${normalizar(textoDosBlocos(a.blocos))}`;
    let pontos = 0;
    for (const p of palavras) {
      const inicio = ` ${p}`;
      if (titulo.includes(inicio)) pontos += 10;
      else if (chaves.includes(inicio)) pontos += 5;
      else if (corpo.includes(inicio)) pontos += 1;
      else return { a, ordem, pontos: 0 };
    }
    return { a, ordem, pontos };
  });
  return pontuados
    .filter((x) => x.pontos > 0)
    .sort((x, y) => y.pontos - x.pontos || x.ordem - y.ordem)
    .map((x) => x.a);
}

/** Artigos de uma aba, na ordem da lista. */
export function artigosDaTela(artigos: ArtigoAjuda[], tela: TelaAjuda): ArtigoAjuda[] {
  return artigos.filter((a) => a.telas.includes(tela));
}
