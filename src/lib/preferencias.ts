/** Preferências do usuário (seguras para o navegador). */

/** Tempo sem atividade até sair sozinho. Padrão do Contas Online: 20 minutos. */
export const TEMPO_SESSAO_PADRAO = 20;
export const TEMPOS_SESSAO = [10, 20, 30, 60, 120, 240] as const;
export const TEMPO_SESSAO_MAXIMO = Math.max(...TEMPOS_SESSAO);
export const CHAVE_TEMPO_SESSAO = "preferencias.tempo_sessao_minutos";

export function rotuloTempo(minutos: number): string {
  if (minutos < 60) return `${minutos} minutos`;
  const horas = minutos / 60;
  return horas === 1 ? "1 hora" : `${horas} horas`;
}

export function tempoSessaoValido(valor: unknown): number {
  return typeof valor === "number" && (TEMPOS_SESSAO as readonly number[]).includes(valor) ? valor : TEMPO_SESSAO_PADRAO;
}
