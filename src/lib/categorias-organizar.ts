/**
 * "Organizando Categorias": arrastar muda o nível e a ordem.
 * Funções puras sobre a lista de nós (id, pai e ordem), usadas pela tela e conferidas no servidor.
 */
import { NIVEL_MAXIMO } from "./categorias";

export type No = { id: number; paiId: number | null; ordem: number };
export type Posicao = "antes" | "depois" | "dentro";

const irmasDe = (nos: No[], paiId: number | null) => nos.filter((n) => n.paiId === paiId).sort((a, b) => a.ordem - b.ordem || a.id - b.id);

function descendentesDe(nos: No[], id: number): Set<number> {
  const achados = new Set<number>();
  const fila = [id];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const n of nos) {
      if (n.paiId !== atual || achados.has(n.id)) continue;
      achados.add(n.id);
      fila.push(n.id);
    }
  }
  return achados;
}

/** 1 = principal, 2 = filha, 3 = neta. */
export function nivelDe(nos: No[], id: number): number {
  let nivel = 1;
  let atual = nos.find((n) => n.id === id);
  const vistos = new Set<number>();
  while (atual?.paiId != null && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    nivel++;
    atual = nos.find((n) => n.id === atual!.paiId);
  }
  return nivel;
}

function alturaDe(nos: No[], id: number): number {
  const filhas = nos.filter((n) => n.paiId === id);
  return filhas.length ? 1 + Math.max(...filhas.map((f) => alturaDe(nos, f.id))) : 0;
}

/** Numera de novo (1, 2, 3...) as irmãs de um nível. */
function renumerar(nos: No[], paiId: number | null, ordemIds: number[]): No[] {
  return nos.map((n) => (n.paiId === paiId && ordemIds.includes(n.id) ? { ...n, ordem: ordemIds.indexOf(n.id) + 1 } : n));
}

/**
 * Move a categoria "id" para antes, depois ou dentro (no fim) de "alvoId".
 * Devolve a nova lista, ou um texto explicando por que não dá.
 */
export function moverNo(nos: No[], id: number, alvoId: number, posicao: Posicao): No[] | string {
  const no = nos.find((n) => n.id === id);
  const alvo = nos.find((n) => n.id === alvoId);
  if (!no || !alvo) return "Categoria não encontrada.";
  if (id === alvoId) return nos;
  if (descendentesDe(nos, id).has(alvoId)) return "Uma categoria não pode ficar dentro dela mesma.";
  const novoPai = posicao === "dentro" ? alvo.id : alvo.paiId;
  const nivelNovo = novoPai === null ? 1 : nivelDe(nos, novoPai) + 1;
  if (nivelNovo + alturaDe(nos, id) > NIVEL_MAXIMO) return `As categorias vão até ${NIVEL_MAXIMO} níveis (ex.: 9.4.1.).`;

  const paiAntigo = no.paiId;
  let lista = nos.map((n) => (n.id === id ? { ...n, paiId: novoPai } : n));
  // Tira do lugar antigo e renumera as irmãs que ficaram.
  lista = renumerar(lista, paiAntigo, irmasDe(nos, paiAntigo).filter((n) => n.id !== id).map((n) => n.id));
  // Põe no lugar novo.
  const destino = irmasDe(nos, novoPai)
    .filter((n) => n.id !== id)
    .map((n) => n.id);
  const indice = posicao === "dentro" ? destino.length : destino.indexOf(alvo.id) + (posicao === "depois" ? 1 : 0);
  destino.splice(indice, 0, id);
  return renumerar(lista, novoPai, destino);
}

/** Setas da tela: subir/descer entre as irmãs, recuar (vira irmã da mãe) e avançar (vira filha da irmã de cima). */
export function moverPorSeta(nos: No[], id: number, seta: "subir" | "descer" | "recuar" | "avancar"): No[] | string {
  const no = nos.find((n) => n.id === id);
  if (!no) return "Categoria não encontrada.";
  const irmas = irmasDe(nos, no.paiId);
  const i = irmas.findIndex((n) => n.id === id);
  if (seta === "subir") return i > 0 ? moverNo(nos, id, irmas[i - 1].id, "antes") : nos;
  if (seta === "descer") return i < irmas.length - 1 ? moverNo(nos, id, irmas[i + 1].id, "depois") : nos;
  if (seta === "recuar") return no.paiId === null ? nos : moverNo(nos, id, no.paiId, "depois");
  return i > 0 ? moverNo(nos, id, irmas[i - 1].id, "dentro") : "Não há categoria acima, no mesmo nível, para colocar esta dentro.";
}

/** Confere uma árvore inteira enviada pela tela (sem ciclos, sem pais desconhecidos, até 3 níveis). */
export function conferirArvore(nos: No[]): string | null {
  const ids = new Set(nos.map((n) => n.id));
  if (ids.size !== nos.length) return "A lista tem categorias repetidas.";
  for (const n of nos) {
    if (n.paiId !== null && !ids.has(n.paiId)) return "Uma das categorias está dentro de outra que não existe.";
    if (n.paiId === n.id || descendentesDe(nos, n.id).has(n.id)) return "Uma categoria não pode ficar dentro dela mesma.";
  }
  for (const n of nos) if (nivelDe(nos, n.id) > NIVEL_MAXIMO) return `As categorias vão até ${NIVEL_MAXIMO} níveis (ex.: 9.4.1.).`;
  return null;
}
