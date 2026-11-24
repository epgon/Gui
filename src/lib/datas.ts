/** Hoje no fuso de Brasília, no formato do banco: "2026-11-24". */
export function hojeIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** "2026-11-24" -> "24/11/2026" */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Confere se "2026-02-30" é uma data que existe. */
export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(iso + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}
