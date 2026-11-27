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

/**
 * Máscara de digitação: "10000" -> "10.000", "1500,5" -> "1.500,5".
 * Mantém só dígitos, uma vírgula (até 2 casas) e, se permitido, o "-" inicial.
 */
export function mascararValor(texto: string, permitirNegativo = false): string {
  const negativo = permitirNegativo && texto.trim().startsWith("-");
  const limpo = texto.replace(/[^\d,]/g, "");
  const i = limpo.indexOf(",");
  const inteiroBruto = (i === -1 ? limpo : limpo.slice(0, i)).replace(/^0+(?=\d)/, "");
  const decimal = i === -1 ? null : limpo.slice(i + 1).replace(/,/g, "").slice(0, 2);
  const inteiro = inteiroBruto.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!inteiro && decimal === null) return negativo ? "-" : "";
  return `${negativo ? "-" : ""}${inteiro || "0"}${decimal === null ? "" : `,${decimal}`}`;
}

/** Ao sair do campo: "10000" -> "10.000,00"; texto inválido ou vazio fica como está. */
export function normalizarValor(texto: string): string {
  const centavos = lerValorEmCentavos(texto);
  return centavos === null ? texto : formatarCentavos(centavos);
}
