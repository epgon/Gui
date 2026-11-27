import { ErroIA, type ProvedorIA } from "./tipos";

/**
 * Provedor de teste: não usa rede nem chave e responde com os números do próprio resumo.
 * Serve para ver o chat funcionando antes de cadastrar a chave. Escreva "[falhar]" na pergunta para simular uma queda.
 */
export const simulado: ProvedorIA = {
  id: "simulado",
  rotulo: "Simulado (teste: não envia nada para fora)",
  precisaChave: false,
  modeloPadrao: "simulado",
  async gerar(pedido) {
    if (pedido.mensagem.includes("[falhar]")) throw new ErroIA("falha", "Falha simulada.");
    if (pedido.mensagem.includes("[limite]")) throw new ErroIA("limite_provedor", "Limite simulado.");
    const total = pedido.mensagem.match(/total devido: (R\$ [\d.]+,\d{2})/)?.[1];
    const sobra = pedido.mensagem.match(/Sobra média por mês[^:]*: (R\$ [\d.]+,\d{2})/)?.[1];
    const frases = ["Esta é uma resposta simulada, só para testar o chat (nenhum serviço de fora foi usado)."];
    if (total) frases.push(`Pelo resumo, o total devido é ${total}.`);
    if (sobra) frases.push(`A sua sobra média por mês é ${sobra}.`);
    frases.push("Com uma IA de verdade, aqui viria a explicação para a sua pergunta.");
    return JSON.stringify({ resposta: frases.join(" "), acoes: [{ acao: "simular", divida: "Dívida A" }] });
  },
};
