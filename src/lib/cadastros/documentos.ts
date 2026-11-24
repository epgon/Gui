/** Máscaras de CPF, CNPJ, CEP e telefone (seguras para o navegador e o servidor). */

export const somenteDigitos = (texto: string) => texto.replace(/\D/g, "");

/** "12345678901" -> "123.456.789-01"; "12345678000199" -> "12.345.678/0001-99" */
export function formatarDocumento(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** "01310100" -> "01310-100" */
export function formatarCep(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** "11987654321" -> "(11) 98765-4321"; "1133334444" -> "(11) 3333-4444" */
export function formatarTelefone(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const meio = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, meio)}-${resto.slice(meio)}`;
}

/** Confere os dígitos verificadores do CPF. */
export function cpfValido(texto: string): boolean {
  const d = somenteDigitos(texto);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** Confere os dígitos verificadores do CNPJ. */
export function cnpjValido(texto: string): boolean {
  const d = somenteDigitos(texto);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
