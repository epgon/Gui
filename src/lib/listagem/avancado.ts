/**
 * Filtro Avançado das listas: uma ou mais condições "Campo, Condição e Valor"
 * (em Lançamentos, antes do Campo vem a Origem: Lançamento, Categoria, Conta...).
 * Vai na URL num parâmetro só, "av": "campo~condicao~valor|campo~condicao~valor".
 */
import { lerValorEmCentavos } from "@/lib/dinheiro";

export type TipoCampo = "texto" | "numero" | "dinheiro" | "data" | "booleano" | "lista";

export type CampoAvancado = {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  /** Agrupa os campos no Filtro Avançado de Lançamentos ("Lançamento", "Categoria"...). */
  origem?: string;
  /** Para o tipo "lista". */
  opcoes?: { valor: string; rotulo: string }[];
};

export type Condicao =
  | "igual"
  | "diferente"
  | "contem"
  | "nao_contem"
  | "comeca"
  | "termina"
  | "maior"
  | "maior_igual"
  | "menor"
  | "menor_igual"
  | "preenchido"
  | "vazio";

export const ROTULO_CONDICAO: Record<Condicao, string> = {
  igual: "Igual",
  diferente: "Diferente",
  contem: "Contém",
  nao_contem: "Não contém",
  comeca: "Começa com",
  termina: "Termina com",
  maior: "Maior que",
  maior_igual: "Maior ou igual a",
  menor: "Menor que",
  menor_igual: "Menor ou igual a",
  preenchido: "Preenchido",
  vazio: "Em branco",
};

export const CONDICOES_POR_TIPO: Record<TipoCampo, Condicao[]> = {
  texto: ["contem", "nao_contem", "igual", "diferente", "comeca", "termina", "preenchido", "vazio"],
  numero: ["igual", "diferente", "maior", "maior_igual", "menor", "menor_igual", "preenchido", "vazio"],
  dinheiro: ["igual", "diferente", "maior", "maior_igual", "menor", "menor_igual"],
  data: ["igual", "diferente", "maior", "maior_igual", "menor", "menor_igual", "preenchido", "vazio"],
  booleano: ["igual"],
  lista: ["igual", "diferente"],
};

/** Condições que não pedem Valor. */
export const SEM_VALOR: Condicao[] = ["preenchido", "vazio"];

export type FiltroAvancado = { campo: string; condicao: Condicao; valor: string };

/** Valor de um campo numa linha: texto, número (dinheiro em centavos), data "aaaa-mm-dd", sim/não ou uma lista (tags). */
export type ValorCampo = string | number | boolean | null | undefined | string[];
export type Leitores<T> = Record<string, (linha: T) => ValorCampo>;

export const MAXIMO_CONDICOES = 5;

export function codificarFiltros(filtros: FiltroAvancado[]): string {
  return filtros.map((f) => `${f.campo}~${f.condicao}~${encodeURIComponent(f.valor)}`).join("|");
}

/** Lê o "av" da URL, descartando o que não for um campo ou condição válida desta lista. */
export function lerFiltrosAvancados(av: string | undefined | null, campos: CampoAvancado[]): FiltroAvancado[] {
  if (!av) return [];
  const lista: FiltroAvancado[] = [];
  for (const parte of av.split("|").slice(0, MAXIMO_CONDICOES)) {
    const [campo, condicao, valorCodificado = ""] = parte.split("~");
    const def = campos.find((c) => c.chave === campo);
    if (!def || !(CONDICOES_POR_TIPO[def.tipo] as string[]).includes(condicao)) continue;
    let valor = "";
    try {
      valor = decodeURIComponent(valorCodificado).slice(0, 100);
    } catch {
      continue;
    }
    if (!SEM_VALOR.includes(condicao as Condicao) && !valor.trim()) continue;
    lista.push({ campo, condicao: condicao as Condicao, valor });
  }
  return lista;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function vazio(v: ValorCampo): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Valor digitado convertido para comparar (dinheiro "1.234,56" vira 123456 centavos). */
function alvo(tipo: TipoCampo, valor: string): string | number | boolean | null {
  if (tipo === "dinheiro") return lerValorEmCentavos(valor);
  if (tipo === "numero") {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (tipo === "booleano") return valor === "sim";
  if (tipo === "data") return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
  return valor;
}

function compararUm(tipo: TipoCampo, condicao: Condicao, v: string | number | boolean, a: string | number | boolean): boolean {
  if (tipo === "texto" || tipo === "lista") {
    const x = semAcento(String(v));
    const y = semAcento(String(a));
    switch (condicao) {
      case "igual":
        return x === y;
      case "diferente":
        return x !== y;
      case "contem":
        return x.includes(y);
      case "nao_contem":
        return !x.includes(y);
      case "comeca":
        return x.startsWith(y);
      case "termina":
        return x.endsWith(y);
      default:
        return false;
    }
  }
  if (tipo === "booleano") return condicao === "igual" && Boolean(v) === a;
  // Dinheiro compara o tamanho do valor (sem o sinal de entrada ou saída).
  const x = tipo === "dinheiro" ? Math.abs(Number(v)) : v;
  const y = tipo === "dinheiro" ? Math.abs(Number(a)) : a;
  switch (condicao) {
    case "igual":
      return x === y;
    case "diferente":
      return x !== y;
    case "maior":
      return x > y;
    case "maior_igual":
      return x >= y;
    case "menor":
      return x < y;
    case "menor_igual":
      return x <= y;
    default:
      return false;
  }
}

/** A linha passa em uma condição? Num campo com vários valores (tags), basta um deles passar ("Não contém" e "Diferente" exigem todos). */
export function passaCondicao(f: FiltroAvancado, def: CampoAvancado, valor: ValorCampo): boolean {
  if (f.condicao === "vazio") return vazio(valor);
  if (f.condicao === "preenchido") return !vazio(valor);
  const a = alvo(def.tipo, f.valor);
  if (a === null) return true; // valor impossível de ler: a condição é ignorada
  if (vazio(valor)) return f.condicao === "diferente" || f.condicao === "nao_contem";
  if (Array.isArray(valor)) {
    const negativa = f.condicao === "diferente" || f.condicao === "nao_contem";
    return negativa ? valor.every((v) => compararUm(def.tipo, f.condicao, v, a)) : valor.some((v) => compararUm(def.tipo, f.condicao, v, a));
  }
  return compararUm(def.tipo, f.condicao, valor as string | number | boolean, a);
}

/** Filtra as linhas por todas as condições (todas precisam passar). */
export function filtrarAvancado<T>(linhas: T[], filtros: FiltroAvancado[], campos: CampoAvancado[], leitores: Leitores<T>): T[] {
  const ativos = filtros.filter((f) => leitores[f.campo] && campos.some((c) => c.chave === f.campo));
  if (!ativos.length) return linhas;
  return linhas.filter((l) => ativos.every((f) => passaCondicao(f, campos.find((c) => c.chave === f.campo)!, leitores[f.campo](l))));
}

/** Texto para a faixa "Filtros Utilizados" da impressão: "Nome contém João". */
export function descreverFiltro(f: FiltroAvancado, campos: CampoAvancado[]): string {
  const def = campos.find((c) => c.chave === f.campo);
  if (!def) return "";
  const nome = def.origem && def.origem !== "Lançamento" ? `${def.origem} > ${def.rotulo}` : def.rotulo;
  if (SEM_VALOR.includes(f.condicao)) return `${nome}: ${ROTULO_CONDICAO[f.condicao]}`;
  let valor = f.valor;
  if (def.tipo === "lista") valor = def.opcoes?.find((o) => o.valor === f.valor)?.rotulo ?? f.valor;
  if (def.tipo === "booleano") valor = f.valor === "sim" ? "Sim" : "Não";
  if (def.tipo === "data" && /^\d{4}-\d{2}-\d{2}$/.test(f.valor)) valor = f.valor.split("-").reverse().join("/");
  return `${nome} ${ROTULO_CONDICAO[f.condicao].toLowerCase()} ${valor}`;
}

/** Ordena pela coluna escolhida (texto sem diferenciar acento; vazios sempre no fim). */
export function ordenarPor<T>(linhas: T[], leitor: ((l: T) => ValorCampo) | undefined, direcao: "asc" | "desc"): T[] {
  if (!leitor) return linhas;
  const fator = direcao === "desc" ? -1 : 1;
  const chave = (v: ValorCampo) => (Array.isArray(v) ? v.join(", ") : v);
  return linhas
    .map((l, i) => ({ l, i, v: chave(leitor(l)) }))
    .sort((a, b) => {
      const av = a.v;
      const bv = b.v;
      const aVazio = av === null || av === undefined || av === "";
      const bVazio = bv === null || bv === undefined || bv === "";
      if (aVazio || bVazio) return aVazio === bVazio ? a.i - b.i : aVazio ? 1 : -1;
      let r: number;
      if (typeof av === "number" && typeof bv === "number") r = av - bv;
      else if (typeof av === "boolean" && typeof bv === "boolean") r = Number(av) - Number(bv);
      else r = String(av).localeCompare(String(bv), "pt-BR", { sensitivity: "base", numeric: true });
      return r * fator || a.i - b.i;
    })
    .map((x) => x.l);
}
