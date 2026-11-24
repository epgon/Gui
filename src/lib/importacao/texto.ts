/**
 * Leitura do texto dos arquivos. Bancos brasileiros costumam mandar OFX e CSV
 * em Latin-1 (Windows-1252); outros mandam UTF-8. Tentamos UTF-8 primeiro.
 */
export function decodificar(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  return texto.replace(/^﻿/, "");
}

/** Para comparar textos: sem acento, minúsculo e com espaços simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "1.234,56", "-1234.56", "R$ 1.234,56", "(123,45)" -> centavos com sinal. null se não for número. */
export function lerNumero(texto: string, decimal: "virgula" | "ponto" | "auto" = "auto"): number | null {
  let t = (texto ?? "").trim().replace(/R\$|\s| /g, "");
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (t.endsWith("-")) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (t.startsWith("-")) {
    negativo = !negativo;
    t = t.slice(1);
  } else if (t.startsWith("+")) {
    t = t.slice(1);
  }
  let modo = decimal;
  if (modo === "auto") {
    const virgula = t.lastIndexOf(",");
    const ponto = t.lastIndexOf(".");
    if (virgula >= 0 && ponto >= 0) modo = virgula > ponto ? "virgula" : "ponto";
    else if (virgula >= 0) modo = "virgula";
    // Só ponto: "1.234" ou "1.234.567" é milhar; "12.34" é decimal.
    else if (ponto >= 0) modo = /^\d{1,3}(\.\d{3})+$/.test(t) ? "virgula" : "ponto";
    else modo = "ponto";
  }
  t = modo === "virgula" ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [inteiro, fracao = ""] = t.split(".");
  // Centavos sem passar por número quebrado; a terceira casa (se houver) arredonda.
  const casas = fracao.padEnd(3, "0");
  let centavos = Number(inteiro) * 100 + Number(casas.slice(0, 2));
  if (Number(casas[2]) >= 5) centavos += 1;
  if (!Number.isSafeInteger(centavos) || centavos > 99_999_999_999) return null;
  return negativo ? -centavos : centavos;
}
