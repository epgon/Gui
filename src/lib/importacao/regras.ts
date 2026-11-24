/**
 * Regras automáticas da importação ("Ignorar registro" ou "Preencher automaticamente"),
 * conciliação e checagem de duplicidade. Sem banco de dados: têm testes em importacao.test.ts.
 */
import { somarDias } from "@/lib/lancamentos/regras";
import { lerNumero, normalizar } from "./texto";
import type { Candidato, CampoCondicao, Condicao, OperadorCondicao, RegraAplicavel, StatusLinha } from "./tipos";

export const CAMPOS_CONDICAO: { valor: CampoCondicao; rotulo: string }[] = [
  { valor: "descricao", rotulo: "Descrição" },
  { valor: "documento", rotulo: "Documento" },
  { valor: "valor", rotulo: "Valor" },
  { valor: "tipo", rotulo: "Tipo (Despesa ou Receita)" },
];

export const OPERADORES: { valor: OperadorCondicao; rotulo: string; numerico?: boolean; texto?: boolean }[] = [
  { valor: "contem", rotulo: "Contém", texto: true },
  { valor: "nao_contem", rotulo: "Não contém", texto: true },
  { valor: "igual", rotulo: "Igual a", texto: true, numerico: true },
  { valor: "comeca", rotulo: "Começa com", texto: true },
  { valor: "termina", rotulo: "Termina com", texto: true },
  { valor: "maior", rotulo: "Maior que", numerico: true },
  { valor: "menor", rotulo: "Menor que", numerico: true },
];

export type DadosParaRegra = { descricao: string; documento: string | null; valorCentavos: number; tipo: "receita" | "despesa" };

/** A condição vale para a linha? Textos sem diferença de acento e maiúsculas. */
export function condicaoAtende(c: Condicao, linha: DadosParaRegra): boolean {
  if (c.campo === "valor") {
    const alvo = lerNumero(c.valor);
    if (alvo === null) return false;
    const v = linha.valorCentavos;
    const a = Math.abs(alvo);
    if (c.operador === "igual") return v === a;
    if (c.operador === "maior") return v > a;
    if (c.operador === "menor") return v < a;
    return false;
  }
  if (c.campo === "tipo") {
    const alvo = normalizar(c.valor);
    const tipo = alvo.startsWith("rec") || alvo.startsWith("ent") || alvo.startsWith("cred") ? "receita" : "despesa";
    return c.operador === "nao_contem" ? linha.tipo !== tipo : linha.tipo === tipo;
  }
  const texto = normalizar((c.campo === "descricao" ? linha.descricao : linha.documento) ?? "");
  const alvo = normalizar(c.valor ?? "");
  if (!alvo) return false;
  switch (c.operador) {
    case "contem":
      return texto.includes(alvo);
    case "nao_contem":
      return !texto.includes(alvo);
    case "igual":
      return texto === alvo;
    case "comeca":
      return texto.startsWith(alvo);
    case "termina":
      return texto.endsWith(alvo);
    default:
      return false;
  }
}

/**
 * A primeira regra ativa (pela ordem) em que todas as condições valem.
 * Regras de uma conta só valem para ela; sem conta, valem para todas.
 */
export function regraQueAtende(regras: RegraAplicavel[], linha: DadosParaRegra, destino: { contaId: number | null; cartaoId: number | null }): RegraAplicavel | null {
  const ordenadas = [...regras].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  for (const r of ordenadas) {
    if (r.contaId !== null && r.contaId !== destino.contaId) continue;
    if (r.cartaoId !== null && r.cartaoId !== destino.cartaoId) continue;
    if (!r.condicoes.length) continue;
    if (r.condicoes.every((c) => condicaoAtende(c, linha))) return r;
  }
  return null;
}

/** Diferença em dias entre duas datas "2026-11-24". */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86_400_000);
}

export type LinhaParaConciliar = { chave: string | number; data: string; valorCentavos: number; tipo: "receita" | "despesa" };

/**
 * Conciliação: procura, para cada linha do extrato, lançamentos do sistema com o mesmo valor,
 * o mesmo sentido (entrada ou saída) e a data dentro da tolerância.
 * - 1 candidato: "encontrado" (e esse lançamento não serve para outra linha);
 * - vários: "pendente" (você escolhe), a não ser que um só tenha a data exata
 *   ou que sejam todos iguais (mesma data, valor e descrição), aí fica com o primeiro;
 * - nenhum: "novo".
 */
export function conciliar<L extends LinhaParaConciliar>(
  linhas: L[],
  candidatos: Candidato[],
  toleranciaDias: number,
): Map<L["chave"], { status: Extract<StatusLinha, "novo" | "encontrado" | "pendente">; candidatos: Candidato[] }> {
  const usados = new Set<string>();
  const resultado = new Map<L["chave"], { status: "novo" | "encontrado" | "pendente"; candidatos: Candidato[] }>();
  // Primeiro as linhas com só um candidato possível, para elas não perderem o par para outra.
  const possiveis = linhas.map((l) => ({
    l,
    lista: candidatos.filter((c) => c.tipo === l.tipo && c.valorCentavos === l.valorCentavos && Math.abs(diasEntre(c.data, l.data)) <= toleranciaDias),
  }));
  const ordem = [...possiveis].sort((a, b) => a.lista.length - b.lista.length);
  for (const { l, lista } of ordem) {
    const livres = lista
      .filter((c) => !usados.has(c.chave))
      .sort((a, b) => Math.abs(diasEntre(a.data, l.data)) - Math.abs(diasEntre(b.data, l.data)) || Number(a.previsto) - Number(b.previsto) || a.chave.localeCompare(b.chave, "en", { numeric: true }));
    if (!livres.length) {
      resultado.set(l.chave, { status: "novo", candidatos: [] });
      continue;
    }
    let escolhido: Candidato | null = null;
    if (livres.length === 1) escolhido = livres[0];
    else {
      const exatos = livres.filter((c) => c.data === l.data);
      const iguais = livres.every((c) => c.data === livres[0].data && normalizar(c.descricao) === normalizar(livres[0].descricao) && c.previsto === livres[0].previsto);
      if (exatos.length === 1) escolhido = exatos[0];
      else if (iguais) escolhido = livres[0];
    }
    if (escolhido) {
      usados.add(escolhido.chave);
      resultado.set(l.chave, { status: "encontrado", candidatos: [escolhido] });
    } else {
      resultado.set(l.chave, { status: "pendente", candidatos: livres.slice(0, 10) });
    }
  }
  return resultado;
}

/** Janela de datas para buscar candidatos: da menor data menos a tolerância até a maior mais a tolerância. */
export function janela(datas: string[], toleranciaDias: number): { de: string; ate: string } | null {
  if (!datas.length) return null;
  const ordenadas = [...datas].sort();
  return { de: somarDias(ordenadas[0], -toleranciaDias), ate: somarDias(ordenadas[ordenadas.length - 1], toleranciaDias) };
}

/** Chave de duplicidade: o FITID do OFX; no CSV (sem FITID), data + valor + tipo + descrição. */
export function chaveDuplicidade(t: { fitid: string | null; data: string; valorCentavos: number; tipo: string; descricao: string }): string {
  return t.fitid ? `f:${t.fitid}` : `c:${t.data}|${t.valorCentavos}|${t.tipo}|${normalizar(t.descricao)}`;
}
