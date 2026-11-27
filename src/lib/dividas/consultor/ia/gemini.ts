import { ErroIA, type PedidoIA, type ProvedorIA } from "./tipos";

/** Google Gemini (plano gratuito do Google AI Studio). A chave vai no cabeçalho, nunca no endereço. */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini exige turnos alternados começando pela pessoa: junta turnos seguidos do mesmo papel e descarta um começo da IA. */
export function turnosParaGemini(pedido: Pick<PedidoIA, "historico" | "mensagem">): { role: "user" | "model"; parts: { text: string }[] }[] {
  const turnos: { role: "user" | "model"; texto: string }[] = [];
  for (const t of [...pedido.historico.map((h) => ({ role: h.papel === "pessoa" ? ("user" as const) : ("model" as const), texto: h.texto })), { role: "user" as const, texto: pedido.mensagem }]) {
    const ultimo = turnos[turnos.length - 1];
    if (ultimo && ultimo.role === t.role) ultimo.texto += `\n${t.texto}`;
    else turnos.push({ ...t });
  }
  while (turnos.length && turnos[0].role === "model") turnos.shift();
  return turnos.map((t) => ({ role: t.role, parts: [{ text: t.texto }] }));
}

export const gemini: ProvedorIA = {
  id: "gemini",
  rotulo: "Google Gemini (plano gratuito do Google AI Studio)",
  precisaChave: true,
  modeloPadrao: "gemini-2.5-flash",
  async gerar(pedido, chave, sinal) {
    if (!chave) throw new ErroIA("falha", "Sem chave de API.");
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(pedido.modelo)) throw new ErroIA("falha", "Nome de modelo inválido.");
    let resposta: Response;
    try {
      resposta = await fetch(`${BASE}/${pedido.modelo}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": chave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: pedido.instrucao }] },
          contents: turnosParaGemini(pedido),
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: "application/json" },
        }),
        signal: sinal,
        cache: "no-store",
      });
    } catch {
      throw new ErroIA("falha", "Não consegui falar com o Gemini (rede ou tempo esgotado).");
    }
    if (resposta.status === 429) throw new ErroIA("limite_provedor", "O limite do plano gratuito do Gemini foi atingido.");
    if (resposta.status === 400 || resposta.status === 401 || resposta.status === 403) throw new ErroIA("falha", "O Gemini recusou a chave ou o modelo. Confira a chave GUI_IA_CHAVE e o modelo em Parâmetros.");
    if (!resposta.ok) throw new ErroIA("falha", `O Gemini respondeu com erro ${resposta.status}.`);
    const corpo = (await resposta.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const texto = corpo?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!texto) throw new ErroIA("resposta_vazia", "O Gemini não devolveu resposta.");
    return texto;
  },
};
