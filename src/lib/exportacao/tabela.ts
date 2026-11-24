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
