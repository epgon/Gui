/** Notificações: avisos calculados na hora a partir dos dados (nada é gravado, só o "lida"). */
export type Notificacao = {
  /** Identificador estável; os avisos do dia levam a data (voltam no dia seguinte se continuarem valendo). */
  id: string;
  tipo: "alerta" | "aviso" | "info";
  titulo: string;
  texto: string;
  href: string;
  rotuloLink: string;
};

export const CHAVE_LIDAS = "notificacoes.lidas";
/** Quantas marcações de "lida" ficam guardadas (as mais antigas saem). */
export const MAXIMO_LIDAS = 200;

/** Junta as novas lidas às antigas, sem repetir e sem passar do máximo. */
export function juntarLidas(antigas: unknown, novas: string[]): string[] {
  const lista = Array.isArray(antigas) ? antigas.filter((x): x is string => typeof x === "string") : [];
  const juntas = [...lista.filter((x) => !novas.includes(x)), ...novas];
  return juntas.slice(-MAXIMO_LIDAS);
}
