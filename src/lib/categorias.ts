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

/** Onde uma categoria está sendo usada (para saber se ela pode ser excluída). */
export type UsoCategoria = { lancamentos: number; recorrentes: number; regras: number; importacoes: number };
export const SEM_USO: UsoCategoria = { lancamentos: 0, recorrentes: 0, regras: 0, importacoes: 0 };

const vezes = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Excluir só vale para categoria que não é especial, não tem filhas e não é usada em nada.
 * Devolve o motivo de não poder (para a dica do menu e o erro da ação) ou null quando pode.
 */
export function motivoParaNaoExcluir(c: Pick<CategoriaBase, "especial"> & { quantidadeFilhas: number }, uso: UsoCategoria = SEM_USO): string | null {
  if (c.especial) return "É uma categoria especial, usada pelo sistema.";
  if (c.quantidadeFilhas > 0) return `É categoria pai (tem ${vezes(c.quantidadeFilhas, "subcategoria", "subcategorias")}). Exclua ou mova as filhas antes.`;
  if (uso.lancamentos > 0) return `Tem ${vezes(uso.lancamentos, "lançamento", "lançamentos")}. Se não for mais usá-la, inative-a.`;
  if (uso.recorrentes > 0) return `É usada em ${vezes(uso.recorrentes, "recorrente", "recorrentes")}. Troque a categoria ${uso.recorrentes === 1 ? "nele" : "neles"} antes.`;
  if (uso.regras > 0) return `É usada em ${vezes(uso.regras, "regra de importação", "regras de importação")}. Troque a categoria ${uso.regras === 1 ? "nela" : "nelas"} antes.`;
  if (uso.importacoes > 0) return "É usada em uma importação ainda em rascunho. Conclua ou exclua a importação antes.";
  return null;
}
