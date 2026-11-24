/**
 * Formato comum de tudo o que é impresso (PDF) ou exportado (Excel e CSV):
 * as listas e os relatórios montam uma "Tabela" e cada formato só a desenha.
 */
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";

export type TipoColuna = "texto" | "dinheiro" | "data" | "numero";

export type ColunaTabela = {
  titulo: string;
  tipo?: TipoColuna;
  /** Largura relativa no PDF (padrão 1; a descrição costuma ter 3). */
  largura?: number;
  /** Só aparece na Impressão Personalizada (campo a mais para escolher). */
  extra?: boolean;
};

export type Celula = string | number | null;

export type LinhaTabela = {
  celulas: Celula[];
  /** "total": negrito com fundo amarelo; "grupo": negrito (ex.: Receitas). */
  estilo?: "total" | "grupo";
  /** Recuo da primeira coluna (subcategorias). */
  recuo?: number;
  /** Cor de destaque da primeira coluna (bolinha da categoria). */
  cor?: string | null;
};

export type Tabela = {
  titulo: string;
  /** Linhas da faixa "Filtros Utilizados" (ex.: "Período: 01/11/2026 a 30/11/2026"). */
  filtros: string[];
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  orientacao: "retrato" | "paisagem";
  /** Avisos abaixo da tabela. */
  avisos?: string[];
  /** Quantos registros a lista tem (rodapé "12 registros"); null não mostra. */
  registros?: number | null;
  /** Nome do arquivo, sem extensão. */
  arquivo: string;
};

export const FORMATOS = ["pdf", "xlsx", "csv"] as const;
export type Formato = (typeof FORMATOS)[number];

/** Texto de uma célula como aparece na tela e no PDF. */
export function textoCelula(valor: Celula, tipo: TipoColuna = "texto"): string {
  if (valor === null || valor === "") return "";
  if (tipo === "dinheiro" && typeof valor === "number") return formatarCentavos(valor);
  if (tipo === "data" && typeof valor === "string") return formatarData(valor);
  if (tipo === "numero" && typeof valor === "number") return valor.toLocaleString("pt-BR");
  return String(valor);
}

const precisaAspas = /[";\n\r]/;

/** CSV no padrão do Excel em português: separador ";", vírgula nos centavos e acentos (UTF-8 com BOM). */
export function gerarCsv(t: Tabela): string {
  const escapar = (s: string) => (precisaAspas.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const valor = (c: Celula, tipo: TipoColuna = "texto") => {
    if (c === null) return "";
    // Sem separador de milhar no CSV: o Excel lê "1500,00" como número.
    if (tipo === "dinheiro" && typeof c === "number") return (c / 100).toFixed(2).replace(".", ",");
    return textoCelula(c, tipo);
  };
  const linhas = [
    t.colunas.map((c) => escapar(c.titulo)).join(";"),
    ...t.linhas.map((l) => l.celulas.map((c, i) => escapar((i === 0 && l.recuo ? "  ".repeat(l.recuo) : "") + valor(c, t.colunas[i]?.tipo))).join(";")),
  ];
  return "﻿" + linhas.join("\r\n") + "\r\n";
}

/** Nome de arquivo sem acentos nem espaços: "fluxo-de-caixa-2026-11-24". */
export function nomeArquivo(base: string, hoje: string): string {
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${limpo || "gui"}-${hoje}`;
}

// ---------------------------------------------------------------------------
// Impressão Personalizada (listas de Cadastros)
// ---------------------------------------------------------------------------

/** Escolhas da Impressão Personalizada. As colunas são guardadas pelo título (resiste a mudanças de ordem). */
export type Personalizacao = {
  nome: string;
  orientacao: "retrato" | "paisagem";
  colunas: string[];
  /** Largura relativa de cada coluna escolhida (Configurar Layout). */
  larguras: number[];
  ordenar: string | null;
  direcao: "asc" | "desc";
};

export const MAXIMO_COLUNAS_PERSONALIZADA = 12;

/** Impressão Padrão e exportação: só as colunas normais (as "extra" são da personalizada). */
export function semExtras(t: Tabela): Tabela {
  const manter = t.colunas.map((c, i) => (c.extra ? -1 : i)).filter((i) => i >= 0);
  if (manter.length === t.colunas.length) return t;
  return { ...t, colunas: manter.map((i) => t.colunas[i]), linhas: t.linhas.map((l) => ({ ...l, celulas: manter.map((i) => l.celulas[i] ?? null) })) };
}

/** Lê a personalização do endereço (p_cols, p_larg, p_ord...). Sem colunas válidas, devolve null (Impressão Padrão). */
export function lerPersonalizacao(sp: Record<string, string | undefined>, titulos: string[]): Personalizacao | null {
  const colunas = (sp.p_cols ?? "")
    .split("|")
    .map((c) => c.trim())
    .filter((c, i, todas) => c && titulos.includes(c) && todas.indexOf(c) === i)
    .slice(0, MAXIMO_COLUNAS_PERSONALIZADA);
  if (!colunas.length) return null;
  const larg = (sp.p_larg ?? "").split("|").map(Number);
  const larguras = colunas.map((_, i) => (Number.isFinite(larg[i]) && larg[i] >= 0.3 && larg[i] <= 10 ? Math.round(larg[i] * 100) / 100 : 1));
  const ordenar = sp.p_ord && colunas.includes(sp.p_ord) ? sp.p_ord : null;
  return {
    nome: (sp.p_nome ?? "").trim().slice(0, 60) || "Personalizado",
    orientacao: sp.p_orient === "paisagem" ? "paisagem" : "retrato",
    colunas,
    larguras,
    ordenar,
    direcao: sp.p_dir === "desc" ? "desc" : "asc",
  };
}

/** Parâmetros de endereço de uma personalização (o inverso de lerPersonalizacao). */
export function parametrosPersonalizacao(p: Personalizacao): Record<string, string> {
  return {
    p_nome: p.nome,
    p_orient: p.orientacao,
    p_cols: p.colunas.join("|"),
    p_larg: p.larguras.join("|"),
    p_ord: p.ordenar ?? "",
    p_dir: p.direcao,
  };
}

function compararCelulas(a: Celula, b: Celula): number {
  const vazioA = a === null || a === "";
  const vazioB = b === null || b === "";
  if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base", numeric: true });
}

/**
 * Aplica a Impressão Personalizada: colunas escolhidas na ordem escolhida, larguras, ordenação dos dados
 * e orientação. Linhas de total ficam no fim.
 */
export function personalizar(t: Tabela, p: Personalizacao): Tabela {
  const indices = p.colunas.map((titulo) => t.colunas.findIndex((c) => c.titulo === titulo)).filter((i) => i >= 0);
  if (!indices.length) return semExtras(t);
  const colunas = indices.map((i, k) => ({ ...t.colunas[i], largura: p.larguras[k] ?? t.colunas[i].largura ?? 1, extra: false }));
  let corpo = t.linhas.filter((l) => !l.estilo);
  const totais = t.linhas.filter((l) => l.estilo);
  const iOrdem = p.ordenar ? t.colunas.findIndex((c) => c.titulo === p.ordenar) : -1;
  if (iOrdem >= 0) {
    const fator = p.direcao === "desc" ? -1 : 1;
    corpo = corpo.map((l, i) => ({ l, i })).sort((a, b) => compararCelulas(a.l.celulas[iOrdem], b.l.celulas[iOrdem]) * fator || a.i - b.i).map((x) => x.l);
  }
  const escolher = (l: LinhaTabela): LinhaTabela => ({ ...l, celulas: indices.map((i) => l.celulas[i] ?? null), recuo: iOrdem >= 0 ? 0 : l.recuo });
  return {
    ...t,
    titulo: p.nome && p.nome !== "Personalizado" ? p.nome : t.titulo,
    colunas,
    linhas: [...corpo.map(escolher), ...totais.map(escolher)],
    orientacao: p.orientacao,
    registros: t.registros === undefined ? corpo.length : t.registros,
  };
}

export const MAXIMO_IMPRESSOES_SALVAS = 10;

/** Confere a lista de impressões guardada (descarta o que estiver estragado). */
export function normalizarImpressoes(valor: unknown): Personalizacao[] {
  if (!Array.isArray(valor)) return [];
  const lista: Personalizacao[] = [];
  for (const v of valor) {
    if (!v || typeof v !== "object") continue;
    const x = v as Partial<Personalizacao>;
    if (typeof x.nome !== "string" || !Array.isArray(x.colunas) || !x.colunas.every((c) => typeof c === "string") || !x.colunas.length) continue;
    const larguras = Array.isArray(x.larguras) ? x.larguras.map((n) => (typeof n === "number" && n >= 0.3 && n <= 10 ? n : 1)) : [];
    lista.push({
      nome: x.nome.slice(0, 60),
      orientacao: x.orientacao === "paisagem" ? "paisagem" : "retrato",
      colunas: x.colunas.slice(0, MAXIMO_COLUNAS_PERSONALIZADA),
      larguras: x.colunas.slice(0, MAXIMO_COLUNAS_PERSONALIZADA).map((_, i) => larguras[i] ?? 1),
      ordenar: typeof x.ordenar === "string" ? x.ordenar : null,
      direcao: x.direcao === "desc" ? "desc" : "asc",
    });
  }
  return lista.slice(0, MAXIMO_IMPRESSOES_SALVAS);
}
