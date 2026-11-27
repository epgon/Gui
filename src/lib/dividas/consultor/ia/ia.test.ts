import { afterEach, describe, expect, it, vi } from "vitest";
import { lerRecursosDe, lerParametrosDe, RECURSOS } from "@/lib/parametros/tipos";
import { LIMITES_PADRAO, type DividaConsultor } from "../regras";
import type { ContextoPerguntas } from "../perguntas";
import { numerosForaDoResumo } from "./conferencia";
import { gemini, turnosParaGemini } from "./gemini";
import { acoesParaBotoes, lerRespostaIA } from "./prompt";
import { acharProvedor } from "./provedores";
import { desanonimizar, limparTextoLivre, montarResumo } from "./resumo";
import { perguntarParaIA, type DependenciasIA } from "./servico";
import { simulado } from "./simulado";
import { ErroIA, type PedidoIA, type ProvedorIA } from "./tipos";

const divida = (id: number, descricao: string, credor: string, extra: Partial<DividaConsultor> = {}): DividaConsultor => ({
  id,
  descricao,
  credor,
  tipo: "emprestimo_pessoal",
  forma: "parcelas_fixas",
  situacao: "em_dia",
  taxaMensalPct: 2.5,
  saldoCentavos: 1_234_500,
  saldoOrigem: "parcelas",
  informadoEm: null,
  diasAtraso: 0,
  parcelasAtrasadas: 0,
  atrasoCentavos: 0,
  acrescimoCentavos: 0,
  parcelaCentavos: 100_000,
  parcelasAbertas: 12,
  quitadaEm: null,
  sim: null,
  ...extra,
});

const contexto = (extra: Partial<ContextoPerguntas> = {}): ContextoPerguntas => ({
  hoje: "2026-11-27",
  dividas: [divida(1, "Empréstimo do Banco Zeta Maria Souza", "Banco Zeta SA"), divida(2, "Cartão Roxinho", "Nubank Pagamentos", { situacao: "em_atraso", diasAtraso: 20, parcelasAtrasadas: 1, atrasoCentavos: 30_000, saldoCentavos: 500_000 })],
  rendaMensalCentavos: 600_000,
  sobraMensalCentavos: 300_000,
  parcelasDoMesCentavos: 130_000,
  parcelasReferenciaCentavos: 130_000,
  reservaCentavos: 1_000_000,
  reservaMinimaCentavos: 900_000,
  extrasRecentesCentavos: 0,
  caixa: { saldoCentavos: 250_000, parcelasAteProximoMesCentavos: 260_000 },
  faturasVencidas: [{ cartaoId: 1, cartao: "Cartão Ouro Itaú", rotulo: "11/2026", vencimento: "2026-11-10", valorCentavos: 80_000 }],
  limites: LIMITES_PADRAO,
  propostas: [{ negociacaoId: 1, propostaId: 1, credor: "Banco Zeta SA", dividas: "Empréstimo do Banco Zeta Maria Souza", saldoCentavos: 1_234_500, modalidade: "a_vista", entradaCentavos: 800_000, parcelas: 0, valorParcelaCentavos: 0, validade: null }],
  plano: null,
  ...extra,
});

describe("resumo anonimizado", () => {
  const { texto, mapa } = montarResumo(contexto());
  it("não contém nome de credor, descrição de dívida, cartão ou conta", () => {
    for (const proibido of ["Banco Zeta", "Maria Souza", "Roxinho", "Nubank", "Itaú", "Ouro"]) expect(texto).not.toContain(proibido);
  });
  it("chama as dívidas de A, B... e traz os números", () => {
    expect(texto).toContain("Dívida A: tipo");
    expect(texto).toContain("Dívida B: tipo");
    expect(texto).toMatch(/total devido: R\$\s?17\.345,00/);
    expect(texto).toContain("20 dia(s)");
    expect(mapa.get("Dívida B")?.id).toBe(2);
  });
  it("não leva o nome do plano nem os textos de desvio", () => {
    const t = montarResumo(contexto({ plano: { id: 1, nome: "Plano do Zé Carlos", versao: 2, mesAnterior: null, mesFinalPlanejado: "2027-12", previsaoMesFinal: "2028-01", ajustePendente: true, desvios: ["Pagou menos no Banco Zeta"], deficitCentavos: 10_000, ajusteRecomendado: null, novasDividas: [{ id: 9, descricao: "Moto do Zé", saldoCentavos: 500_000 }], comprasParceladas: [] } })).texto;
    expect(t).not.toContain("Zé");
    expect(t).not.toContain("Banco Zeta");
    expect(t).toContain("versão 2");
  });
  it("troca Dívida A pelo nome real só na tela", () => {
    expect(desanonimizar("Comece pela Dívida B e depois a Dívida A.", mapa)).toBe("Comece pela Cartão Roxinho e depois a Empréstimo do Banco Zeta Maria Souza.");
    expect(desanonimizar("Dívida Z", mapa)).toBe("Dívida Z");
  });
});

describe("texto digitado", () => {
  it("tira e-mail, CPF, CNPJ, telefone e números longos", () => {
    const t = limparTextoLivre("meu cpf 123.456.789-09, cnpj 12.345.678/0001-95, fulano@x.com, tel (11) 91234-5678 conta 123456789");
    expect(t).not.toMatch(/123\.456|0001|fulano|91234|123456789/);
    expect(limparTextoLivre("se eu receber R$ 3.000 de bônus?")).toBe("se eu receber R$ 3.000 de bônus?");
  });
});

describe("conferência dos números", () => {
  const enviado = "Total devido: R$ 17.345,00; taxa 2,5% ao mês\nPERGUNTA: se eu receber R$ 3.000?";
  it("aceita números do resumo e da pergunta", () => {
    expect(numerosForaDoResumo("Você deve R$ 17.345,00 a 2,5% e tem R$ 3.000 de bônus.", enviado)).toEqual([]);
  });
  it("marca números que não estão no resumo", () => {
    expect(numerosForaDoResumo("Sobrariam R$ 9.999,99 e a taxa seria 7%.", enviado)).toEqual(["R$ 9.999,99", "7%"]);
  });
  it("aceita valor escrito como '3 mil' na pergunta", () => {
    expect(numerosForaDoResumo("Com R$ 3.000,00 você abate parte.", "PERGUNTA: e se eu receber 3 mil?")).toEqual([]);
  });
});

describe("leitura da resposta e ações", () => {
  const resumo = montarResumo(contexto());
  it("lê o JSON e só aceita ações da lista fechada", () => {
    const r = lerRespostaIA('```json\n{"resposta":"Ok","acoes":[{"acao":"simular","divida":"Dívida B"},{"acao":"pagar","divida":"Dívida A"},{"acao":"excluir_divida"},{"acao":"criar_plano"}]}\n```')!;
    expect(r.texto).toBe("Ok");
    expect(r.acoes.map((a) => a.acao)).toEqual(["simular", "criar_plano"]);
  });
  it("os botões vêm dos endereços do Gui e só abrem telas", () => {
    const botoes = acoesParaBotoes([{ acao: "simular", divida: "Dívida B" }, { acao: "atualizar_saldo", divida: "Dívida A" }, { acao: "negociar", divida: null }, { acao: "criar_plano", divida: null }], resumo);
    expect(botoes.map((b) => b.href)).toEqual(["/gestao/dividas/simulador?modo=quitar&divida=2", "/gestao/dividas/minhas?detalhar=1", "/gestao/dividas/negociacoes", "/gestao/dividas/plano"]);
    for (const b of botoes) expect(b.href.startsWith("/gestao/dividas/")).toBe(true);
  });
  it("texto solto vira resposta sem ações; JSON quebrado é recusado", () => {
    expect(lerRespostaIA("Resposta em texto simples")).toEqual({ texto: "Resposta em texto simples", acoes: [] });
    expect(lerRespostaIA('{"resposta": ')).toBeNull();
    expect(lerRespostaIA("   ")).toBeNull();
  });
});

describe("serviço de IA", () => {
  const resumo = montarResumo(contexto());
  const fabrica = (resposta: string | Error = '{"resposta":"Você deve R$ 17.345,00 e pode somar R$ 8.888,00.","acoes":[{"acao":"simular","divida":"Dívida A"}]}') => {
    const chamadas: PedidoIA[] = [];
    const provedor: ProvedorIA = {
      id: "teste",
      rotulo: "Teste",
      precisaChave: true,
      modeloPadrao: "m",
      async gerar(p) {
        chamadas.push(p);
        if (resposta instanceof Error) throw resposta;
        return resposta;
      },
    };
    return { provedor, chamadas };
  };
  const deps = (p: ProvedorIA, extra: Partial<DependenciasIA> = {}): DependenciasIA => ({ ativo: true, provedor: p, chave: "chave-secreta", modelo: "m", reservar: async () => true, ...extra });
  const entrada = { pergunta: "se eu receber R$ 3.000 de bônus, o que faço?", historico: [], resumo };

  it("recurso desligado: nenhuma chamada sai nem gasta o limite", async () => {
    const { provedor, chamadas } = fabrica();
    const reservar = vi.fn(async () => true);
    const r = await perguntarParaIA(entrada, deps(provedor, { ativo: false, reservar }));
    expect(r).toMatchObject({ ok: false, motivo: "desligada" });
    expect(chamadas).toHaveLength(0);
    expect(reservar).not.toHaveBeenCalled();
  });
  it("sem chave: nenhuma chamada sai nem gasta o limite", async () => {
    const { provedor, chamadas } = fabrica();
    const reservar = vi.fn(async () => true);
    const r = await perguntarParaIA(entrada, deps(provedor, { chave: null, reservar }));
    expect(r).toMatchObject({ ok: false, motivo: "sem_chave" });
    expect(chamadas).toHaveLength(0);
    expect(reservar).not.toHaveBeenCalled();
  });
  it("limite diário estourado: não chama o provedor e avisa", async () => {
    const { provedor, chamadas } = fabrica();
    const r = await perguntarParaIA(entrada, deps(provedor, { reservar: async () => false }));
    expect(r).toMatchObject({ ok: false, motivo: "limite_diario" });
    expect(chamadas).toHaveLength(0);
    if (!r.ok) expect(r.aviso).toMatch(/perguntas prontas/);
  });
  it("limite diário real: só as N primeiras chamadas passam", async () => {
    const { provedor, chamadas } = fabrica();
    let usadas = 0;
    const d = deps(provedor, { reservar: async () => (usadas < 2 ? (usadas++, true) : false) });
    const resultados = [];
    for (let i = 0; i < 4; i++) resultados.push(await perguntarParaIA(entrada, d));
    expect(resultados.map((r) => r.ok)).toEqual([true, true, false, false]);
    expect(chamadas).toHaveLength(2);
  });
  it("manda só o resumo anonimizado e a pergunta, e a instrução fixa", async () => {
    const { provedor, chamadas } = fabrica();
    await perguntarParaIA({ ...entrada, pergunta: "meu cpf é 123.456.789-09, e o bônus de R$ 3.000?" }, deps(provedor));
    const enviado = chamadas[0].mensagem;
    expect(enviado).toContain("Dívida A");
    expect(enviado).not.toMatch(/Banco Zeta|Roxinho|Nubank|123\.456/);
    expect(chamadas[0].instrucao).toMatch(/Nunca diga que fez alguma ação/);
    expect(JSON.stringify(chamadas[0])).not.toContain("chave-secreta");
  });
  it("marca números fora do resumo, troca Dívida A pelo nome e devolve só botões da lista", async () => {
    const { provedor } = fabrica();
    const r = await perguntarParaIA(entrada, deps(provedor));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.numerosFora).toEqual(["R$ 8.888,00"]);
      expect(r.acoes).toEqual([{ rotulo: "Simular (Empréstimo do Banco Zeta Maria Souza)", href: "/gestao/dividas/simulador?modo=quitar&divida=1" }]);
      expect(r.textoAnonimo).not.toContain("Banco Zeta");
    }
  });
  it("falha do provedor, limite do provedor e resposta vazia viram aviso (sem lançar erro)", async () => {
    expect(await perguntarParaIA(entrada, deps(fabrica(new Error("boom")).provedor))).toMatchObject({ ok: false, motivo: "falha" });
    expect(await perguntarParaIA(entrada, deps(fabrica(new ErroIA("limite_provedor", "x")).provedor))).toMatchObject({ ok: false, motivo: "limite_provedor" });
    expect(await perguntarParaIA(entrada, deps(fabrica("   ").provedor))).toMatchObject({ ok: false, motivo: "resposta_vazia" });
  });
  it("tempo esgotado: aborta e avisa", async () => {
    const lento: ProvedorIA = { id: "l", rotulo: "l", precisaChave: false, modeloPadrao: "m", gerar: (_p, _c, sinal) => new Promise((_, rej) => sinal?.addEventListener("abort", () => rej(new Error("abortado")))) };
    const r = await perguntarParaIA(entrada, deps(lento, { chave: null, tempoMaximoMs: 20 }));
    expect(r).toMatchObject({ ok: false, motivo: "falha" });
  });
  it("a IA não tem como gravar nada: o resultado é só texto e links", async () => {
    const r = await perguntarParaIA(entrada, deps(fabrica('{"resposta":"Pronto, paguei tudo.","acoes":[{"acao":"pagar_tudo"},{"acao":"simular"}]}').provedor));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.acoes.every((a) => a.href.startsWith("/gestao/dividas/"))).toBe(true);
    if (r.ok) expect(Object.keys(r).sort()).toEqual(["acoes", "enviado", "numerosFora", "ok", "texto", "textoAnonimo"]);
  });
});

describe("provedor simulado", () => {
  it("responde sem rede e sem chave, usando os números do resumo", async () => {
    const resumo = montarResumo(contexto());
    const r = await perguntarParaIA({ pergunta: "o que faço?", historico: [], resumo }, { ativo: true, provedor: simulado, chave: null, modelo: "simulado", reservar: async () => true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.texto).toMatch(/resposta simulada/i);
      expect(r.numerosFora).toEqual([]);
    }
  });
  it("[falhar] simula uma queda", async () => {
    const resumo = montarResumo(contexto());
    const r = await perguntarParaIA({ pergunta: "teste [falhar]", historico: [], resumo }, { ativo: true, provedor: simulado, chave: null, modelo: "simulado", reservar: async () => true });
    expect(r).toMatchObject({ ok: false, motivo: "falha" });
  });
});

describe("Gemini", () => {
  afterEach(() => vi.unstubAllGlobals());
  const pedido: PedidoIA = { instrucao: "inst", historico: [{ papel: "ia", texto: "solta" }, { papel: "pessoa", texto: "oi" }, { papel: "ia", texto: "olá" }], mensagem: "nova", modelo: "gemini-2.5-flash" };

  it("turnos alternados começando pela pessoa", () => {
    expect(turnosParaGemini(pedido).map((t) => t.role)).toEqual(["user", "model", "user"]);
  });
  it("manda a chave no cabeçalho (nunca no endereço) e lê a resposta", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{\"resposta\":\"ok\"}" }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const t = await gemini.gerar(pedido, "CHAVE-123");
    expect(t).toContain("ok");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("CHAVE-123");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("CHAVE-123");
    expect(String(init.body)).not.toContain("CHAVE-123");
  });
  it("429 vira limite do provedor; chave recusada e erro de rede viram falha", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(gemini.gerar(pedido, "k")).rejects.toMatchObject({ motivo: "limite_provedor" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    await expect(gemini.gerar(pedido, "k")).rejects.toMatchObject({ motivo: "falha" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("rede"); }));
    await expect(gemini.gerar(pedido, "k")).rejects.toMatchObject({ motivo: "falha" });
  });
  it("sem chave nem tenta a rede; modelo inválido é recusado", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(gemini.gerar(pedido, null)).rejects.toBeInstanceOf(ErroIA);
    await expect(gemini.gerar({ ...pedido, modelo: "../x?y=1" }, "k")).rejects.toBeInstanceOf(ErroIA);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("configuração", () => {
  it("o recurso Consultor com IA nasce desligado e os outros continuam ligados", () => {
    const r = lerRecursosDe({});
    expect(r.consultor_ia).toBe(false);
    expect(r.dividas).toBe(true);
    expect(RECURSOS.find((x) => x.chave === "consultor_ia")?.telas).toEqual([]);
    expect(lerRecursosDe({ "recursos.consultor_ia": true }).consultor_ia).toBe(true);
  });
  it("parâmetros da IA têm padrão seguro", () => {
    expect(lerParametrosDe({}).ia).toEqual({ provedor: "gemini", modelo: "gemini-2.5-flash", limiteDiario: 20 });
    expect(lerParametrosDe({ "ia.limite_diario": 9999, "ia.modelo": "../x" }).ia).toMatchObject({ limiteDiario: 20, modelo: "gemini-2.5-flash" });
    expect(acharProvedor("gemini")).not.toBeNull();
    expect(acharProvedor("inexistente")).toBeNull();
  });
});
