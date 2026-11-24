/**
 * Árvore de categorias. A numeração (1., 9.4.1.) não fica no banco:
 * é calculada aqui pela posição de cada categoria entre as irmãs.
 */
export type CategoriaBase = {
  id: number;
  nome: string;
  categoriaPaiId: number | null;
  ordem: number;
  cor: string | null;
  natureza: "receita" | "despesa";
  especial: "acerto_saldo" | "cartao_credito" | "transferencia" | null;
  ativo: boolean;
  padraoSistema: boolean;
};

export type CategoriaNaArvore<T extends CategoriaBase = CategoriaBase> = T & {
  /** "9.4.1." (vazio nas especiais) */
  numero: string;
  /** 1 = raiz, 2 = filha, 3 = neta */
  nivel: number;
  /** Cor da raiz (as filhas herdam). */
  corEfetiva: string;
  /** Id da categoria raiz (ela mesma, se for raiz). */
  raizId: number;
  /** Ids dos ancestrais, da raiz até o pai. */
  ancestrais: number[];
  quantidadeFilhas: number;
};

/** Profundidade máxima trabalhada pela tela (como no padrão: 9.4.1.). */
export const NIVEL_MAXIMO = 3;
export const COR_ESPECIAL = "#9CA3AF";

const porOrdem = (a: CategoriaBase, b: CategoriaBase) => a.ordem - b.ordem || a.id - b.id;

/** Devolve as categorias na ordem da árvore, com numeração, nível e cor. Especiais vêm primeiro. */
export function montarArvore<T extends CategoriaBase>(linhas: T[]): CategoriaNaArvore<T>[] {
  const filhasDe = new Map<number | null, T[]>();
  for (const c of linhas) {
    if (c.especial) continue;
    const lista = filhasDe.get(c.categoriaPaiId) ?? [];
    lista.push(c);
    filhasDe.set(c.categoriaPaiId, lista);
  }
  for (const lista of filhasDe.values()) lista.sort(porOrdem);

  const resultado: CategoriaNaArvore<T>[] = linhas
    .filter((c) => c.especial)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ ...c, numero: "", nivel: 1, corEfetiva: COR_ESPECIAL, raizId: c.id, ancestrais: [], quantidadeFilhas: 0 }));

  const visitados = new Set<number>();
  const visitar = (paiId: number | null, prefixo: string, nivel: number, cor: string, raizId: number | null, ancestrais: number[]) => {
    (filhasDe.get(paiId) ?? []).forEach((c, i) => {
      if (visitados.has(c.id)) return; // proteção contra ciclos
      visitados.add(c.id);
      const numero = `${prefixo}${i + 1}.`;
      const corEfetiva = nivel === 1 ? (c.cor ?? "#64748B") : cor;
      const raiz = raizId ?? c.id;
      resultado.push({
        ...c,
        numero,
        nivel,
        corEfetiva,
        raizId: raiz,
        ancestrais,
        quantidadeFilhas: filhasDe.get(c.id)?.length ?? 0,
      });
      visitar(c.id, numero, nivel + 1, corEfetiva, raiz, [...ancestrais, c.id]);
    });
  };
  visitar(null, "", 1, "#64748B", null, []);
  return resultado;
}

/** "9.4.1. Combustível" */
export function rotuloCategoria(c: { numero: string; nome: string }) {
  return c.numero ? `${c.numero} ${c.nome}` : c.nome;
}

/** Ids de todas as descendentes (filhas, netas...) de uma categoria. */
export function descendentes(linhas: Pick<CategoriaBase, "id" | "categoriaPaiId">[], id: number): number[] {
  const encontrados: number[] = [];
  const fila = [id];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const c of linhas) {
      if (c.categoriaPaiId === atual && !encontrados.includes(c.id) && c.id !== id) {
        encontrados.push(c.id);
        fila.push(c.id);
      }
    }
  }
  return encontrados;
}

/** Quantos níveis existem abaixo da categoria (0 = não tem filhas). */
export function alturaAbaixo(linhas: Pick<CategoriaBase, "id" | "categoriaPaiId">[], id: number): number {
  const filhas = linhas.filter((c) => c.categoriaPaiId === id);
  return filhas.length ? 1 + Math.max(...filhas.map((f) => alturaAbaixo(linhas, f.id))) : 0;
}
