/**
 * Conferência dos números: valores em reais e porcentagens da resposta da IA que não aparecem no resumo
 * (nem na pergunta) são marcados para a pessoa conferir. A IA não é a fonte dos números: o Gui é.
 */

const REAIS = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;
const PERCENTUAIS = /(\d+(?:[.,]\d+)?)\s*%/g;

const emCentavos = (t: string) => Math.round(Number(t.replace(/\./g, "").replace(",", ".")) * 100);
const emDecimos = (t: string) => Math.round(Number(t.replace(",", ".")) * 100);

function coletar(texto: string) {
  const reais = new Set<number>();
  const pcts = new Set<number>();
  for (const m of texto.matchAll(REAIS)) reais.add(emCentavos(m[1]));
  for (const m of texto.matchAll(PERCENTUAIS)) pcts.add(emDecimos(m[1]));
  // Valores que a pessoa escreveu por extenso na pergunta ("3 mil", "500 reais").
  for (const m of texto.matchAll(/(\d+(?:[.,]\d+)?)\s*mil\b/gi)) reais.add(Math.round(Number(m[1].replace(",", ".")) * 1000 * 100));
  for (const m of texto.matchAll(/(\d[\d.]*(?:,\d{1,2})?)\s*reais\b/gi)) reais.add(emCentavos(m[1]));
  return { reais, pcts };
}

/** Devolve os trechos da resposta (ex.: "R$ 1.234,00", "12%") que não estão nos números enviados. */
export function numerosForaDoResumo(resposta: string, enviado: string): string[] {
  const base = coletar(enviado);
  const fora: string[] = [];
  for (const m of resposta.matchAll(REAIS)) {
    const c = emCentavos(m[1]);
    if (c !== 0 && !base.reais.has(c) && !fora.includes(m[0].trim())) fora.push(m[0].trim());
  }
  for (const m of resposta.matchAll(PERCENTUAIS)) {
    const p = emDecimos(m[1]);
    if (p !== 0 && !base.pcts.has(p) && !fora.includes(m[0].trim())) fora.push(m[0].trim());
  }
  return fora;
}
