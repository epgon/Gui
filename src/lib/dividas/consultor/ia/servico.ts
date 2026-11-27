import { numerosForaDoResumo } from "./conferencia";
import { acoesParaBotoes, INSTRUCAO_FIXA, lerRespostaIA, montarMensagem } from "./prompt";
import { desanonimizar, limparTextoLivre, type ResumoIA } from "./resumo";
import { ErroIA, type AcaoSugerida, type MotivoFalhaIA, type ProvedorIA, type TurnoIA } from "./tipos";

/** Textos mostrados à pessoa quando a IA não responde: o Gui continua funcionando com as perguntas prontas. */
export const AVISO_IA: Record<MotivoFalhaIA, string> = {
  desligada: "O Consultor com IA está desligado em Configurações > Recursos.",
  sem_chave: "O Consultor com IA está ligado, mas ainda não há chave cadastrada (GUI_IA_CHAVE), então nada foi enviado. Use uma das perguntas prontas.",
  limite_diario: "O limite diário de perguntas à IA foi atingido, então nada foi enviado. Use uma das perguntas prontas (elas continuam funcionando) ou tente amanhã.",
  limite_provedor: "O limite do plano gratuito do provedor foi atingido agora. Use uma das perguntas prontas ou tente de novo mais tarde.",
  falha: "A IA não respondeu agora. Use uma das perguntas prontas: elas funcionam sem IA.",
  resposta_vazia: "A IA não devolveu uma resposta útil. Use uma das perguntas prontas ou reescreva a pergunta.",
};

export type EntradaIA = {
  pergunta: string;
  /** Conversa anterior do assunto (só perguntas da pessoa e respostas da IA; nunca o texto calculado pelo Gui, que cita nomes). */
  historico: TurnoIA[];
  resumo: ResumoIA;
};

export type DependenciasIA = {
  ativo: boolean;
  provedor: ProvedorIA | null;
  chave: string | null;
  modelo: string;
  /** Reserva uma chamada no limite diário (false = limite atingido). Só é chamada depois de todas as outras checagens. */
  reservar: () => Promise<boolean>;
  tempoMaximoMs?: number;
};

export type ResultadoIA =
  | { ok: true; texto: string; /** O texto como a IA escreveu (com "Dívida A"): é o que volta ao histórico enviado à IA. */ textoAnonimo: string; acoes: AcaoSugerida[]; numerosFora: string[]; enviado: string }
  | { ok: false; motivo: MotivoFalhaIA; aviso: string };

const falhar = (motivo: MotivoFalhaIA): ResultadoIA => ({ ok: false, motivo, aviso: AVISO_IA[motivo] });

/**
 * Pergunta à IA. A ordem é de segurança: recurso desligado, sem chave e limite diário NUNCA chegam a chamar o provedor.
 * Qualquer falha devolve um aviso (o chamador cai nas perguntas prontas). A resposta só vira texto e botões: nada é gravado.
 */
export async function perguntarParaIA(entrada: EntradaIA, d: DependenciasIA): Promise<ResultadoIA> {
  if (!d.ativo || !d.provedor) return falhar("desligada");
  if (d.provedor.precisaChave && !d.chave) return falhar("sem_chave");
  if (!(await d.reservar())) return falhar("limite_diario");

  const pergunta = limparTextoLivre(entrada.pergunta);
  const mensagem = montarMensagem(entrada.resumo, pergunta);
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), d.tempoMaximoMs ?? 20_000);
  let bruto: string;
  try {
    bruto = await d.provedor.gerar({ instrucao: INSTRUCAO_FIXA, historico: entrada.historico.map((t) => ({ ...t, texto: limparTextoLivre(t.texto) })), mensagem, modelo: d.modelo }, d.chave, controle.signal);
  } catch (e) {
    return falhar(e instanceof ErroIA ? e.motivo : "falha");
  } finally {
    clearTimeout(tempo);
  }
  const lida = lerRespostaIA(bruto);
  if (!lida) return falhar("resposta_vazia");
  return {
    ok: true,
    // Os números são conferidos na resposta como veio (anonimizada); só depois "Dívida A" vira o nome real, na tela da própria pessoa.
    numerosFora: numerosForaDoResumo(lida.texto, mensagem),
    textoAnonimo: lida.texto,
    texto: desanonimizar(lida.texto, entrada.resumo.mapa),
    acoes: acoesParaBotoes(lida.acoes, entrada.resumo),
    enviado: mensagem,
  };
}
