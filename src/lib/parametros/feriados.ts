/**
 * Feriados nacionais que não vêm na carga inicial: os fixos que faltavam e os móveis
 * (que mudam de data todo ano, calculados a partir da Páscoa).
 */
export type FeriadoSugerido = { nome: string; dia: number; mes: number; ano: number | null };

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como "aaaa-mm-dd". */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function deslocar(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return { dia: d.getUTCDate(), mes: d.getUTCMonth() + 1 };
}

/** Fixos que se repetem todo ano e os móveis do ano pedido. */
export function feriadosSugeridos(ano: number): FeriadoSugerido[] {
  const p = pascoa(ano);
  return [
    { nome: "Finados", dia: 2, mes: 11, ano: null },
    { nome: "Proclamação da República", dia: 15, mes: 11, ano: null },
    { nome: "Dia Nacional de Zumbi e da Consciência Negra", dia: 20, mes: 11, ano: null },
    { nome: "Carnaval (segunda-feira)", ...deslocar(p, -48), ano },
    { nome: "Carnaval (terça-feira)", ...deslocar(p, -47), ano },
    { nome: "Sexta-feira Santa", ...deslocar(p, -2), ano },
    { nome: "Corpus Christi", ...deslocar(p, 60), ano },
  ];
}

/** Dia e mês existem? (29/02 vale; 31/04 não.) */
export function diaDoMesValido(dia: number, mes: number, ano: number | null): boolean {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || mes < 1 || mes > 12 || dia < 1) return false;
  const anoBase = ano ?? 2024; // ano bissexto: 29/02 recorrente é aceito
  return dia <= new Date(Date.UTC(anoBase, mes, 0)).getUTCDate();
}
