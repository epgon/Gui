/**
 * Consultor com IA (fase D6): tipos em comum. O código de cada provedor fica isolado nesta pasta,
 * para trocar de provedor sem mexer no resto do Gui. Nada aqui acessa banco ou rede por conta própria.
 */

export type TurnoIA = { papel: "pessoa" | "ia"; texto: string };

/** O que um provedor recebe: a instrução fixa, a conversa até aqui e a mensagem nova (resumo anonimizado + pergunta). */
export type PedidoIA = {
  instrucao: string;
  historico: TurnoIA[];
  mensagem: string;
  modelo: string;
};

export type MotivoFalhaIA = "desligada" | "sem_chave" | "limite_diario" | "limite_provedor" | "falha" | "resposta_vazia";

/** Erro de um provedor, já com o motivo (sem nunca carregar a chave ou o conteúdo enviado). */
export class ErroIA extends Error {
  constructor(
    public readonly motivo: Exclude<MotivoFalhaIA, "desligada" | "sem_chave" | "limite_diario">,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export type ProvedorIA = {
  id: string;
  rotulo: string;
  /** Provedor de teste não precisa de chave e não envia nada para fora. */
  precisaChave: boolean;
  /** Modelo sugerido (editável em Parâmetros). */
  modeloPadrao: string;
  /** Devolve o texto bruto da resposta do modelo. */
  gerar(pedido: PedidoIA, chave: string | null, sinal?: AbortSignal): Promise<string>;
};

/** Ações que a IA pode SUGERIR. É uma lista fechada: cada uma vira só um botão que abre a janela normal do Gui. */
export const ACOES_IA = ["simular", "negociar", "atualizar_saldo", "criar_plano"] as const;
export type AcaoIA = (typeof ACOES_IA)[number];

export type AcaoSugerida = { rotulo: string; href: string };
