import { z } from "zod";
import { ACOES_IA, type AcaoIA, type AcaoSugerida } from "./tipos";
import type { ResumoIA } from "./resumo";

/** A instrução fixa que acompanha toda chamada. A pessoa não consegue alterá-la. */
export const INSTRUCAO_FIXA = `Você é o Consultor Gui, um assistente de finanças pessoais que explica a situação de dívidas de uma pessoa no Brasil, em português do Brasil.
Regras que valem sempre:
1. Use SOMENTE os números do RESUMO DOS NÚMEROS e os que a pessoa escreveu na pergunta. Nunca invente, estime nem arredonde valores. Se um número não estiver no resumo, diga que não tem essa informação.
2. Você não faz contas novas com valores inventados: explique, compare e oriente com o que está no resumo. Se precisar de uma conta, diga que o Simulador do Gui calcula.
3. Você não paga, não cria, não altera e não exclui nada. Nunca diga que fez alguma ação. A decisão é sempre da pessoa.
4. Seja técnico e didático, prudente, direto e sem emoji. Respostas curtas (até 8 frases). Não prometa resultado e não substitua um profissional.
5. As dívidas aparecem como "Dívida A", "Dívida B" etc. Use esses nomes.
6. Responda SOMENTE com um JSON neste formato, sem texto fora dele:
{"resposta": "texto para a pessoa", "acoes": [{"acao": "simular", "divida": "Dívida A"}]}
7. "acoes" é opcional (no máximo 3). Só pode usar estas ações: ${ACOES_IA.join(", ")}. "divida" é opcional. Não invente outras ações nem links.`;

const esquema = z.object({
  resposta: z.string().min(1),
  acoes: z
    .array(z.object({ acao: z.string(), divida: z.string().optional() }))
    .optional(),
});

export type RespostaLida = { texto: string; acoes: { acao: AcaoIA; divida: string | null }[] };

/** Lê o JSON da IA. Se vier texto solto, usa o texto inteiro como resposta e nenhuma ação. Ações fora da lista fechada são descartadas. */
export function lerRespostaIA(bruto: string): RespostaLida | null {
  const limpo = bruto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!limpo) return null;
  let obj: unknown = null;
  try {
    obj = JSON.parse(limpo);
  } catch {
    obj = null;
  }
  const v = esquema.safeParse(obj);
  if (!v.success) return limpo.startsWith("{") ? null : { texto: limpo.slice(0, 3000), acoes: [] };
  const vistos = new Set<string>();
  const acoes: RespostaLida["acoes"] = [];
  for (const a of v.data.acoes ?? []) {
    if (!(ACOES_IA as readonly string[]).includes(a.acao)) continue;
    const chave = `${a.acao}|${a.divida ?? ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    acoes.push({ acao: a.acao as AcaoIA, divida: a.divida ?? null });
    if (acoes.length === 3) break;
  }
  return { texto: v.data.resposta.trim().slice(0, 3000), acoes };
}

/** Transforma as ações sugeridas em botões. O endereço vem sempre do Gui, nunca do texto da IA; todos só abrem a janela normal. */
export function acoesParaBotoes(acoes: RespostaLida["acoes"], resumo: ResumoIA): AcaoSugerida[] {
  const botoes: AcaoSugerida[] = [];
  for (const a of acoes) {
    const d = a.divida ? resumo.mapa.get(a.divida) : undefined;
    const de = d ? ` (${d.descricao})` : "";
    switch (a.acao) {
      case "simular":
        botoes.push({ rotulo: `Simular${de}`, href: d ? `/gestao/dividas/simulador?modo=quitar&divida=${d.id}` : "/gestao/dividas/simulador" });
        break;
      case "negociar":
        botoes.push({ rotulo: "Abrir negociação", href: "/gestao/dividas/negociacoes" });
        break;
      case "atualizar_saldo":
        botoes.push({ rotulo: `Atualizar saldo${de}`, href: d ? `/gestao/dividas/minhas?detalhar=${d.id}` : "/gestao/dividas/minhas" });
        break;
      case "criar_plano":
        botoes.push({ rotulo: "Criar plano", href: "/gestao/dividas/plano" });
        break;
    }
  }
  return botoes;
}

/** A mensagem enviada junto com a pergunta: o resumo e a pergunta (já sem dados pessoais). */
export function montarMensagem(resumo: ResumoIA, pergunta: string): string {
  return `${resumo.texto}\n\nPERGUNTA DA PESSOA:\n${pergunta}`;
}
