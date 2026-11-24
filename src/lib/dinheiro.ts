/**
 * Dinheiro é guardado em centavos inteiros (R$ 83,37 = 8337).
 * Estas funções convertem para exibir na tela e de volta.
 */
const formatador = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 8337 -> "83,37"; -150000 -> "-1.500,00" */
export function formatarCentavos(centavos: number): string {
  return formatador.format(centavos / 100);
}

/** "1.500,00" ou "1500,5" -> 150000 / 150050. Retorna null se não for um número. */
export function lerValorEmCentavos(texto: string): number | null {
  const limpo = texto.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, decimal = ""] = limpo.replace("-", "").split(".");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  return limpo.startsWith("-") ? -centavos : centavos;
}
