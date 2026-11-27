import { describe, expect, it } from "vitest";
import { montarDividaComParcelas, montarDividaSemParcelas, type DividaSim } from "../simulador";
import {
  PERGUNTAS_PRONTAS,
  acharParcelas,
  acharValorEmCentavos,
  dadosFaltando,
  interpretarPergunta,
  lerNumeroBR,
  responder,
  responderCabe,
  responderCompra,
  responderExtra,
  responderLivre,
  responderOrdem,
  responderPlano,
  responderProposta,
  responderReserva,
  responderTotal,
  vereditoProposta,
  type ContextoPerguntas,
} from "./perguntas";
import { LIMITES_PADRAO, type DividaConsultor } from "./regras";
import { analisarProposta } from "../negociacao";

const HOJE = "2026-11-26";

const parcelas = (n: number, valor: number, inicio = 11) =>
  Array.from({ length: n }, (_, i) => ({ vencimento: `${2026 + Math.floor((inicio - 1 + i) / 12)}-${String(((inicio - 1 + i) % 12) + 1).padStart(2, "0")}-10`, valorCentavos: valor, acrescimoCentavos: 0 }));

const comParcelas = (id: number, nome: string, taxa: number, n = 12, valor = 50_000, extra: { atrasoDias?: number; comGarantia?: boolean } = {}): { sim: DividaSim; d: DividaConsultor } => {
  const sim = montarDividaComParcelas({ id: `d${id}`, nome, credor: "Credor", taxaMensalPct: taxa, abertas: parcelas(n, valor), inicioYm: "2026-11", atrasoDias: extra.atrasoDias ?? 0, comGarantia: extra.comGarantia ?? false });
  return {
    sim,
    d: {
      id,
      descricao: nome,
      credor: "Credor",
      tipo: "emprestimo_pessoal",
      forma: "parcelas_fixas",
      situacao: (extra.atrasoDias ?? 0) > 0 ? "em_atraso" : "em_dia",
      taxaMensalPct: taxa,
      saldoCentavos: sim.saldoCentavos,
      saldoOrigem: "parcelas",
      informadoEm: null,
      diasAtraso: extra.atrasoDias ?? 0,
      parcelasAtrasadas: (extra.atrasoDias ?? 0) > 0 ? 1 : 0,
      atrasoCentavos: 0,
      acrescimoCentavos: 0,
      parcelaCentavos: valor,
      parcelasAbertas: n,
      quitadaEm: null,
      sim,
    },
  };
};

const contexto = (extra: Partial<ContextoPerguntas> = {}): ContextoPerguntas => {
  const a = comParcelas(1, "Empréstimo A", 2, 12, 50_000);
  const b = comParcelas(2, "Cartão B", 9, 6, 30_000, { atrasoDias: 20 });
  return {
    hoje: HOJE,
    dividas: [a.d, b.d],
    rendaMensalCentavos: 600_000,
    sobraMensalCentavos: 300_000,
    parcelasDoMesCentavos: 80_000,
    parcelasReferenciaCentavos: 80_000,
    reservaCentavos: 1_000_000,
    reservaMinimaCentavos: 900_000,
    extrasRecentesCentavos: 0,
    caixa: null,
    faturasVencidas: [],
    limites: LIMITES_PADRAO,
    propostas: [],
    ...extra,
  };
};

describe("leitura de números", () => {
  it("entende o formato brasileiro", () => {
    expect(lerNumeroBR("1.500,50")).toBe(1500.5);
    expect(lerNumeroBR("1500")).toBe(1500);
    expect(lerNumeroBR("1.500")).toBe(1500);
    expect(lerNumeroBR("500,5")).toBe(500.5);
    expect(lerNumeroBR("abc")).toBeNull();
  });
  it("acha valores em reais e parcelas no texto", () => {
    expect(acharValorEmCentavos("Cabe uma parcela de R$ 1.500,00?")).toBe(150_000);
    expect(acharValorEmCentavos("pagando r$500 a mais")).toBe(50_000);
    expect(acharValorEmCentavos("se eu receber 3 mil de bônus")).toBe(300_000);
    expect(acharValorEmCentavos("quanto devo")).toBeNull();
    expect(acharParcelas("compra de R$ 2.000 em 10x")).toBe(10);
    expect(acharParcelas("em 12 vezes")).toBe(12);
    expect(acharParcelas("em 6 parcelas")).toBe(6);
    expect(acharParcelas("quanto devo")).toBeNull();
  });
});

describe("reconhecimento das palavras-chave", () => {
  const casos: [string, string | null][] = [
    ["Quanto eu devo no total?", "total"],
    ["qual o total das minhas dívidas", "total"],
    ["Qual dívida pagar primeiro?", "ordem"],
    ["por onde começar a pagar", "ordem"],
    ["Cabe uma parcela de R$ 300?", "cabe"],
    ["Quanto economizo pagando R$ 200 a mais?", "extra"],
    ["Vale a pena usar a reserva?", "reserva"],
    ["Essa proposta é boa?", "proposta"],
    ["Quando fico livre das dívidas?", "livre"],
    ["quando eu termino de pagar tudo", "livre"],
    ["Posso fazer uma compra parcelada de R$ 2.000 em 10x?", "compra"],
    ["qual a capital da França", null],
    ["", null],
  ];
  it.each(casos)("%s", (texto, esperado) => {
    expect(interpretarPergunta(texto).id).toBe(esperado);
  });
  it("já traz o valor e as parcelas do texto", () => {
    expect(interpretarPergunta("compra de R$ 2.400 em 12x")).toEqual({ id: "compra", valorCentavos: 240_000, parcelas: 12 });
  });
  it("diz quais dados faltam antes de calcular", () => {
    expect(dadosFaltando("total", { valorCentavos: null, parcelas: null })).toEqual([]);
    expect(dadosFaltando("cabe", { valorCentavos: null, parcelas: null })).toEqual(["valor"]);
    expect(dadosFaltando("compra", { valorCentavos: 100_000, parcelas: null })).toEqual(["parcelas"]);
    expect(dadosFaltando("compra", { valorCentavos: 100_000, parcelas: 3 })).toEqual([]);
  });
});

describe("respostas", () => {
  it("quanto devo: soma o saldo das dívidas ativas e mostra de onde vem", () => {
    const c = contexto();
    const r = responderTotal(c);
    const total = c.dividas.reduce((s, d) => s + d.saldoCentavos, 0);
    expect(r.conclusao).toContain("2 dívidas ativas");
    expect(r.numeros[0].rotulo).toBe("Total devido");
    expect(r.comoCalculei).toHaveLength(3);
    expect(r.conclusao).toContain(new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(total / 100));
  });
  it("sem dívidas ativas, diz isso e leva a cadastrar", () => {
    const r = responderTotal(contexto({ dividas: [] }));
    expect(r.conclusao).toContain("não tem dívidas ativas");
    expect(r.acoes[0].href).toContain("nova=1");
  });
  it("qual pagar primeiro: o atraso vem antes da maior taxa e o critério é explicado", () => {
    const a = comParcelas(1, "Empréstimo A", 12, 12, 50_000);
    const b = comParcelas(2, "Cartão B", 3, 6, 30_000, { atrasoDias: 40 });
    const r = responderOrdem(contexto({ dividas: [a.d, b.d] }));
    expect(r.conclusao).toContain("comece por Cartão B");
    expect(r.conclusao).toContain("atrasada há 40 dias");
    expect(r.numeros.map((n) => n.rotulo)).toEqual(["1ª Cartão B", "2ª Empréstimo A"]);
    expect(r.criterio).toContain("risco primeiro");
    expect(r.comoCalculei.join(" ")).toContain("Avalanche");
  });
  it("cabe uma parcela: cabe, não cabe e sem histórico", () => {
    const c = contexto({ dividas: [comParcelas(1, "Empréstimo A", 2, 12, 50_000).d], parcelasReferenciaCentavos: 50_000 });
    expect(responderCabe(c, 100_000).cuidado).toBeFalsy();
    expect(responderCabe(c, 100_000).conclusao.startsWith("Cabe")).toBe(true);
    // Com parcela em atraso, mesmo cabendo, o Consultor não recomenda.
    expect(responderCabe(contexto(), 100_000).conclusao).toContain("não recomendo agora");
    // sobra livre = 3000 − 500 = 2500; 2600 passa
    const nao = responderCabe(c, 260_000);
    expect(nao.cuidado).toBe(true);
    expect(nao.conclusao).toContain("Não recomendo");
    const sem = responderCabe(contexto({ sobraMensalCentavos: null }), 1_000);
    expect(sem.conclusao).toContain("faltam meses fechados");
  });
  it("pagando a mais: mostra economia e novo término", () => {
    const a = comParcelas(1, "Empréstimo A", 2, 24, 50_000);
    const r = responderExtra(contexto({ dividas: [a.d] }), 20_000);
    expect(r.conclusao).toContain("economiza cerca de");
    expect(r.conclusao).toContain("meses antes");
    expect(r.comoCalculei.length).toBeGreaterThanOrEqual(4);
  });
  it("pagando a mais acima da sobra livre: não recomenda", () => {
    const a = comParcelas(1, "Empréstimo A", 2, 24, 50_000);
    expect(responderExtra(contexto({ dividas: [a.d] }), 900_000).cuidado).toBe(true);
  });
  it("reserva: não recomenda abaixo do mínimo e indica o valor acima dele", () => {
    const abaixo = responderReserva(contexto({ reservaCentavos: 500_000 }));
    expect(abaixo.cuidado).toBe(true);
    expect(abaixo.conclusao).toContain("Não recomendo");
    const a = comParcelas(1, "Empréstimo A", 8, 12, 50_000);
    const vale = responderReserva(contexto({ dividas: [a.d], reservaCentavos: 1_200_000 }));
    expect(vale.conclusao).toContain("Vale avaliar");
    expect(vale.conclusao).toContain("R$ 3.000,00");
    const barata = comParcelas(1, "Empréstimo A", 0.5, 12, 50_000);
    expect(responderReserva(contexto({ dividas: [barata.d], reservaCentavos: 1_200_000 })).conclusao).toContain("Não vale a pena");
  });
  it("proposta: sem proposta aberta, explica; mais cara que o saldo, não recomenda", () => {
    expect(responderProposta(contexto()).conclusao).toContain("nenhuma proposta em aberto");
    const cara = { negociacaoId: 1, propostaId: 1, credor: "Loja Y", dividas: "Crediário", saldoCentavos: 100_000, modalidade: "parcelada" as const, entradaCentavos: 0, parcelas: 12, valorParcelaCentavos: 10_000, validade: null };
    const r = responderProposta(contexto({ propostas: [cara] }));
    expect(r.cuidado).toBe(true);
    expect(r.conclusao).toContain("Não recomendo");
    expect(r.acoes[0].href).toBe("/gestao/dividas/simulador?modo=proposta&negociacao=1&proposta=1");
  });
  it("veredito da proposta: desconto vale considerar, parcela fora da sobra pede cuidado", () => {
    const boa = analisarProposta({ entradaCentavos: 0, parcelas: 1, valorParcelaCentavos: 70_000, saldoCentavos: 100_000, sobraMensalCentavos: 100_000 });
    expect(vereditoProposta(boa, 6).texto).toContain("Vale considerar");
    const apertada = analisarProposta({ entradaCentavos: 0, parcelas: 10, valorParcelaCentavos: 9_000, saldoCentavos: 100_000, sobraMensalCentavos: 5_000 });
    expect(vereditoProposta(apertada, 6).cuidado).toBe(true);
  });
  it("quando fico livre: dá o mês pagando só as parcelas", () => {
    const a = comParcelas(1, "Empréstimo A", 2, 12, 50_000);
    const r = responderLivre(contexto({ dividas: [a.d], parcelasReferenciaCentavos: 50_000 }));
    expect(r.conclusao).toMatch(/livre das dívidas em [a-z]{3}\/\d{4}/);
    expect(r.numeros[0].valor).toContain("meses");
  });
  it("quando fico livre: dívida sem parcelas dá uma estimativa, avisando do mínimo considerado", () => {
    const sim = montarDividaSemParcelas({ id: "d9", nome: "João", credor: "João", taxaMensalPct: 2, saldoCentavos: 100_000, atrasoDias: 0, comGarantia: false });
    const d: DividaConsultor = { ...comParcelas(9, "João", 2).d, forma: "sem_parcelas", sim, saldoCentavos: 100_000, parcelasAbertas: 0 };
    const r = responderLivre(contexto({ dividas: [d] }));
    expect(r.conclusao).toContain("não tem parcelas definidas");
    expect(r.conclusao).toContain("estimativa");
  });
  it("quando fico livre: pagamento que não cobre os juros não tem previsão", () => {
    const sim = montarDividaSemParcelas({ id: "d9", nome: "João", credor: "João", taxaMensalPct: 5, saldoCentavos: 1_000_000, parcelaMinimaCentavos: 100, atrasoDias: 0, comGarantia: false });
    const d: DividaConsultor = { ...comParcelas(9, "João", 5).d, forma: "sem_parcelas", sim, saldoCentavos: 1_000_000, parcelasAbertas: 0 };
    const r = responderLivre(contexto({ dividas: [d] }));
    expect(r.conclusao).toContain("não terminam em 30 anos");
    expect(r.cuidado).toBe(true);
  });
  it("compra parcelada: cabe, e não recomenda com atraso ou acima da sobra", () => {
    const a = comParcelas(1, "Empréstimo A", 2, 12, 50_000);
    const livre = contexto({ dividas: [a.d] });
    const ok = responderCompra(livre, 120_000, 6);
    expect(ok.conclusao.startsWith("Cabe")).toBe(true);
    expect(responderCompra(contexto(), 120_000, 6).conclusao).toContain("atraso");
    expect(responderCompra(livre, 3_000_000, 6).conclusao).toContain("Não recomendo");
    expect(responderCompra(contexto({ sobraMensalCentavos: null, dividas: [a.d] }), 100_000, 2).cuidado).toBe(true);
  });
  it("toda resposta traz conclusão, critério, como calculei e só links como ação", () => {
    const c = contexto({ propostas: [{ negociacaoId: 1, propostaId: 2, credor: "Loja", dividas: "x", saldoCentavos: 100_000, modalidade: "a_vista", entradaCentavos: 80_000, parcelas: 0, valorParcelaCentavos: 0, validade: null }] });
    for (const p of PERGUNTAS_PRONTAS) {
      const r = responder(p.id, c, { valorCentavos: 50_000, parcelas: 5 });
      expect(r.conclusao.length).toBeGreaterThan(10);
      expect(r.criterio.length).toBeGreaterThan(10);
      expect(r.comoCalculei.length).toBeGreaterThan(0);
      for (const a of r.acoes) {
        // O Consultor nunca grava: a ação é só um endereço de tela do Gui, nunca uma operação.
        expect(Object.keys(a).sort()).toEqual(["href", "rotulo"]);
        expect(a.href.startsWith("/gestao/dividas")).toBe(true);
      }
    }
  });
  it("o texto das respostas não promete resultado nem usa emoji", () => {
    const c = contexto();
    for (const p of PERGUNTAS_PRONTAS) {
      const texto = JSON.stringify(responder(p.id, c, { valorCentavos: 50_000, parcelas: 5 }));
      expect(texto).not.toMatch(/garant(imos|o|ido|ia) (que|o)/i);
      expect(texto).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("perguntas do plano de quitação", () => {
  const plano = {
    id: 3,
    nome: "Plano 2027",
    versao: 1,
    mesAnterior: { mes: "2026-10", planejadoCentavos: 120_000, realizadoCentavos: 60_000, situacao: "parcial" as const },
    mesFinalPlanejado: "2027-06",
    previsaoMesFinal: "2027-08",
    ajustePendente: true,
    desvios: ["O realizado ficou abaixo do planejado nos meses fechados: faltam R$ 600,00."],
    deficitCentavos: 60_000,
    ajusteRecomendado: "Aumentar R$ 80,00 por mês",
    novasDividas: [],
    comprasParceladas: [],
  };
  it("reconhece 'Por que meu plano atrasou?' e frases parecidas", () => {
    expect(interpretarPergunta("Por que meu plano atrasou?").id).toBe("plano");
    expect(interpretarPergunta("meu plano furou, o que houve").id).toBe("plano");
    expect(PERGUNTAS_PRONTAS.some((p) => p.id === "plano")).toBe(true);
  });
  it("sem plano ativo, diz isso e oferece criar um", () => {
    const r = responderPlano(contexto());
    expect(r.conclusao).toContain("não tem um Plano de Quitação ativo");
    expect(r.acoes[0].href).toBe("/gestao/dividas/plano");
  });
  it("com desvio, explica o motivo e a sugestão, sem gravar nada", () => {
    const r = responderPlano(contexto({ plano }));
    expect(r.conclusao).toContain("atrasou");
    expect(r.conclusao).toContain("Nada muda sem a sua aprovação");
    expect(r.numeros.map((n) => n.valor)).toContain("ago/2027");
    expect(r.acoes.every((a) => a.href.startsWith("/gestao/dividas"))).toBe(true);
  });
  it("sem desvio, diz que não atrasou", () => {
    const r = responderPlano(contexto({ plano: { ...plano, desvios: [], deficitCentavos: 0, previsaoMesFinal: "2027-06", ajusteRecomendado: null, ajustePendente: false } }));
    expect(r.conclusao).toContain("não atrasou");
  });
  it("'Quando fico livre' usa a data do plano quando há plano ativo", () => {
    const r = responderLivre(contexto({ plano }));
    expect(r.conclusao).toContain("ago/2027");
    expect(r.numeros[0].rotulo).toContain("Plano 2027");
  });
});
