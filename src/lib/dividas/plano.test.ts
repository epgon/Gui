import { describe, expect, it } from "vitest";
import {
  compararPlano,
  deficitAcumulado,
  detectarDesvios,
  extrasParaAgendar,
  gerarPropostaAjuste,
  idDaDivida,
  mesAnteriorDoPlano,
  mesesAcompanhados,
  montarNovaVersao,
  montarPlano,
  preverPlano,
  serieDeSaldos,
  situacaoDoMes,
  simularPlano,
  type ConfigPlano,
  type Pagamento,
} from "./plano";
import { montarDividaComParcelas, montarDividaSemParcelas, type DividaSim } from "./simulador";

const INICIO = "2026-11";
const HOJE = "2027-01-15";

/** Empréstimo de 6 parcelas de R$ 500 (nov a abr, 2% a.m.) e um cartão sem parcelas de R$ 2.000 a 8% a.m. */
function dividas(inicio = INICIO): DividaSim[] {
  const emprestimo = montarDividaComParcelas({
    id: "d1",
    nome: "Empréstimo",
    credor: "Banco",
    taxaMensalPct: 2,
    abertas: ["2026-11-10", "2026-12-10", "2027-01-10", "2027-02-10", "2027-03-10", "2027-04-10"].map((v) => ({ vencimento: v, valorCentavos: 50_000, acrescimoCentavos: 0 })),
    inicioYm: inicio,
    atrasoDias: 0,
    comGarantia: false,
  });
  const cartao = montarDividaSemParcelas({ id: "d2", nome: "Cartão", credor: "Banco", taxaMensalPct: 8, saldoCentavos: 200_000, parcelaMinimaCentavos: 20_000, atrasoDias: 0, comGarantia: false });
  return [emprestimo, cartao];
}

const config = (extra: Partial<ConfigPlano> = {}): ConfigPlano => ({ estrategia: "avalanche", personalizada: [], valorMensalCentavos: 120_000, extras: [], reservaUsadaCentavos: 0, ...extra });

describe("montarPlano", () => {
  it("gera a meta de cada dívida em cada mês e fecha o saldo", () => {
    const p = montarPlano({ dividas: dividas(), config: config(), inicioYm: INICIO });
    expect(p.quitouTudo).toBe(true);
    expect(p.mesFinal).not.toBeNull();
    const primeiro = p.linhas.filter((l) => l.mes === INICIO).reduce((s, l) => s + l.planejadoCentavos, 0);
    expect(primeiro).toBe(120_000);
    expect(p.saldoPlanejado.at(-1)!.saldoCentavos).toBe(0);
    expect(p.saldoPlanejado).toHaveLength(p.resultado.meses.length);
  });

  it("no meio do mês, o que já foi pago entra no planejado e sai do que falta pagar", () => {
    const d = dividas();
    // O empréstimo de novembro já foi pago (R$ 500): a parcela aberta de novembro não existe mais.
    const abertas = d[0].cronograma.slice(1);
    const semNov = { ...d[0], cronograma: [0, ...abertas], saldoCentavos: d[0].saldoCentavos - 50_000 };
    const p = montarPlano({ dividas: [semNov, d[1]], config: config(), inicioYm: INICIO, realizadoNoMes: { 1: 50_000 } });
    const nov = p.linhas.filter((l) => l.mes === INICIO);
    expect(nov.reduce((s, l) => s + l.planejadoCentavos, 0)).toBe(120_000);
    expect(nov.find((l) => l.dividaId === 1)!.planejadoCentavos).toBeGreaterThanOrEqual(50_000);
  });

  it("não inclui dívida hipotética", () => {
    const h: DividaSim = { ...dividas()[1], id: "h1", hipotetica: true };
    const p = montarPlano({ dividas: [...dividas(), h], config: config(), inicioYm: INICIO });
    expect(p.linhas.every((l) => !Number.isNaN(l.dividaId))).toBe(true);
    expect(new Set(p.linhas.map((l) => l.dividaId))).toEqual(new Set([1, 2]));
  });
});

describe("planejado x realizado", () => {
  const linhas = [
    { mes: "2026-11", dividaId: 1, planejadoCentavos: 80_000 },
    { mes: "2026-12", dividaId: 1, planejadoCentavos: 80_000 },
    { mes: "2027-01", dividaId: 1, planejadoCentavos: 80_000 },
    { mes: "2027-02", dividaId: 1, planejadoCentavos: 80_000 },
  ];
  const pagamentos: Pagamento[] = [
    { dividaId: 1, data: "2026-11-10", valorCentavos: 80_000 },
    // dezembro: parcial (R$ 300 pagos e R$ 200 do restante depois = R$ 500 de R$ 800)
    { dividaId: 1, data: "2026-12-10", valorCentavos: 30_000 },
    { dividaId: 1, data: "2026-12-28", valorCentavos: 20_000 },
  ];

  it("calcula o realizado dos pagamentos, inclusive parcial e restante, e a situação de cada mês", () => {
    const m = compararPlano({ linhas, pagamentos, hoje: HOJE });
    expect(m.map((x) => x.situacao)).toEqual(["cumprido", "parcial", "em_andamento", "futuro"]);
    expect(m[1].realizadoCentavos).toBe(50_000);
    expect(m[1].diferencaCentavos).toBe(-30_000);
    expect(m[0].diferencaCentavos).toBe(0);
  });

  it("mês fechado sem pagamento é não cumprido; pagar a mais cumpre", () => {
    expect(situacaoDoMes("2026-10", "2026-11", 10_000, 0)).toBe("nao_cumprido");
    expect(situacaoDoMes("2026-10", "2026-11", 10_000, 9_950)).toBe("cumprido");
    expect(situacaoDoMes("2026-10", "2026-11", 10_000, 20_000)).toBe("cumprido");
    expect(situacaoDoMes("2026-12", "2026-11", 10_000, 0)).toBe("futuro");
  });

  it("dívida encerrada não cobra os meses seguintes ao encerramento", () => {
    const m = compararPlano({ linhas, pagamentos, hoje: HOJE, encerramentos: new Map([[1, "2026-12"]]) });
    expect(m.map((x) => x.mes)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(m[2].planejadoCentavos).toBe(0);
    expect(m[3].planejadoCentavos).toBe(0);
  });

  it("deficit só conta meses fechados e o mês anterior é o último fechado", () => {
    const m = compararPlano({ linhas, pagamentos, hoje: HOJE });
    expect(deficitAcumulado(m, HOJE)).toBe(30_000);
    expect(mesAnteriorDoPlano(m, HOJE)!.mes).toBe("2026-12");
    expect(mesAnteriorDoPlano(m, "2026-11-20")).toBeNull();
  });

  it("depois de um ajuste, os meses anteriores ficam só no histórico e não geram mais desvio", () => {
    const m = compararPlano({ linhas, pagamentos, hoje: HOJE });
    const depois = mesesAcompanhados(m, "2027-01");
    expect(depois.map((x) => x.mes)).toEqual(["2027-01", "2027-02"]);
    expect(deficitAcumulado(depois, HOJE)).toBe(0);
    expect(mesAnteriorDoPlano(depois, HOJE)).toBeNull();
    expect(mesesAcompanhados(m, null)).toHaveLength(4);
  });

  it("série de saldos: o realizado dos meses fechados soma o que ficou sem pagar", () => {
    const m = compararPlano({ linhas, pagamentos, hoje: HOJE });
    const serie = serieDeSaldos(
      [{ mes: "2026-11", saldoCentavos: 300_000 }, { mes: "2026-12", saldoCentavos: 220_000 }, { mes: "2027-01", saldoCentavos: 140_000 }, { mes: "2027-02", saldoCentavos: 60_000 }],
      m,
      HOJE,
      190_000,
    );
    expect(serie[1].realizadoCentavos).toBe(250_000);
    expect(serie[2].realizadoCentavos).toBe(190_000);
    expect(serie[3].realizadoCentavos).toBeNull();
  });
});

describe("desvios e ajuste", () => {
  /** Plano criado em nov/2026 (R$ 1.200 por mês), com dezembro pago pela metade. Hoje é jan/2027. */
  function cenario() {
    const plano = montarPlano({ dividas: dividas(), config: config(), inicioYm: INICIO });
    const pagamentos: Pagamento[] = plano.linhas
      .filter((l) => l.mes === "2026-11")
      .map((l) => ({ dividaId: l.dividaId, data: "2026-11-10", valorCentavos: l.planejadoCentavos }))
      .concat(plano.linhas.filter((l) => l.mes === "2026-12").map((l) => ({ dividaId: l.dividaId, data: "2026-12-10", valorCentavos: Math.round(l.planejadoCentavos / 2) })));
    const meses = compararPlano({ linhas: plano.linhas, pagamentos, hoje: HOJE });
    return { plano, pagamentos, meses };
  }

  /** O que falta pagar em jan/2027: o saldo do plano ao fim de dez/2026 mais o que ficou sem pagar. */
  function dividasHoje(): DividaSim[] {
    const { plano, meses } = cenario();
    const fimDez = plano.resultado.meses.find((m) => m.mes === "2026-12")!;
    const falta = meses.find((m) => m.mes === "2026-12")!.planejadoCentavos - meses.find((m) => m.mes === "2026-12")!.realizadoCentavos;
    return [
      { ...dividas()[0], id: "d1", cronograma: [], parcelaMinimaCentavos: 0, saldoCentavos: Math.round(fimDez.porDivida.d1.saldoCentavos + falta / 2), parcelaReferenciaCentavos: 0 },
      { ...dividas()[1], id: "d2", saldoCentavos: Math.round(fimDez.porDivida.d2.saldoCentavos + falta / 2) },
    ];
  }

  it("pagar menos que o planejado aparece como desvio com o cálculo", () => {
    const { plano, meses } = cenario();
    const desvios = detectarDesvios({ meses, hoje: HOJE, mesFinalPlanejado: plano.mesFinal, previsao: null, sobraNaAprovacaoCentavos: null, sobraAtualCentavos: null, novasDividas: [] });
    expect(desvios).toHaveLength(1);
    expect(desvios[0].tipo).toBe("realizado_abaixo");
    expect(desvios[0].texto).toMatch(/dez\/2026/);
  });

  it("sem desvio quando o realizado cumpre o plano", () => {
    const { plano } = cenario();
    const pagamentos = plano.linhas.filter((l) => l.mes < "2027-01").map((l) => ({ dividaId: l.dividaId, data: `${l.mes}-10`, valorCentavos: l.planejadoCentavos }));
    const meses = compararPlano({ linhas: plano.linhas, pagamentos, hoje: HOJE });
    expect(detectarDesvios({ meses, hoje: HOJE, mesFinalPlanejado: plano.mesFinal, previsao: null, sobraNaAprovacaoCentavos: 300_000, sobraAtualCentavos: 290_000, novasDividas: [] })).toEqual([]);
  });

  it("detecta previsão atrasada, queda da sobra e dívida nova", () => {
    const { plano, meses } = cenario();
    const previsao = preverPlano(dividasHoje(), config({ valorMensalCentavos: 60_000 }), "2027-01", 0);
    const desvios = detectarDesvios({ meses, hoje: HOJE, mesFinalPlanejado: plano.mesFinal, previsao, sobraNaAprovacaoCentavos: 200_000, sobraAtualCentavos: 100_000, novasDividas: [{ id: 9, descricao: "Loja", saldoCentavos: 50_000 }] });
    expect(desvios.map((d) => d.tipo).sort()).toEqual(["divida_nova", "previsao_atrasada", "realizado_abaixo", "sobra_caiu"]);
  });

  it("o ajuste de aumentar fecha o saldo no prazo e o de adiar mostra o mês novo", () => {
    const { plano, meses } = cenario();
    const hoje = dividasHoje();
    const sem = preverPlano(hoje, config(), "2027-01", 0);
    const desvios = detectarDesvios({ meses, hoje: HOJE, mesFinalPlanejado: plano.mesFinal, previsao: sem, sobraNaAprovacaoCentavos: null, sobraAtualCentavos: 300_000, novasDividas: [] });
    const proposta = gerarPropostaAjuste({ dividas: hoje, config: config(), inicioYm: "2027-01", mesFinalPlanejado: plano.mesFinal, sobraAtualCentavos: 300_000, jaPagoNoInicioCentavos: 0, desvios, deficitCentavos: deficitAcumulado(meses, HOJE) });
    expect(proposta.aumentar).not.toBeNull();
    expect(proposta.aumentar!.valorMensalCentavos).toBeGreaterThanOrEqual(120_000);
    const r = simularPlano(hoje, config({ valorMensalCentavos: proposta.aumentar!.valorMensalCentavos }), "2027-01");
    expect(r.quitouTudo).toBe(true);
    expect(r.mesFinal! <= plano.mesFinal!).toBe(true);
    // um centavo a menos já não fecha no prazo (quando precisou aumentar)
    if (proposta.aumentar!.aumentoCentavos > 0) {
      const menos = simularPlano(hoje, config({ valorMensalCentavos: proposta.aumentar!.valorMensalCentavos! - 1 }), "2027-01");
      expect(!menos.quitouTudo || menos.mesFinal! > plano.mesFinal!).toBe(true);
    }
    expect(proposta.adiar).not.toBeNull();
    expect(proposta.adiar!.mesFinal! >= plano.mesFinal!).toBe(true);
    expect(proposta.assinatura).toContain("realizado_abaixo");
  });

  it("recomenda adiar quando o valor novo não cabe na sobra", () => {
    const { plano, meses } = cenario();
    const hoje = dividasHoje();
    const proposta = gerarPropostaAjuste({ dividas: hoje, config: config(), inicioYm: "2027-01", mesFinalPlanejado: plano.mesFinal, sobraAtualCentavos: 120_000, jaPagoNoInicioCentavos: 0, desvios: [], deficitCentavos: deficitAcumulado(meses, HOJE) });
    if (proposta.aumentar && proposta.aumentar.aumentoCentavos > 0) {
      expect(proposta.aumentar.cabeNaSobra).toBe(false);
      expect(proposta.recomendada).toBe("adiar");
    }
  });

  it("aprovar o ajuste preserva os meses fechados e recalcula do mês atual em diante", () => {
    const { plano } = cenario();
    const hoje = dividasHoje();
    const proposta = gerarPropostaAjuste({ dividas: hoje, config: config(), inicioYm: "2027-01", mesFinalPlanejado: plano.mesFinal, sobraAtualCentavos: 500_000, jaPagoNoInicioCentavos: 0, desvios: [], deficitCentavos: 30_000 });
    const nova = montarNovaVersao({ dividas: hoje, atual: { linhas: plano.linhas, saldoPlanejado: plano.saldoPlanejado, config: config() }, opcao: proposta.aumentar!, inicioYm: "2027-01", realizadoNoMes: {} });
    expect(nova.linhas.filter((l) => l.mes < "2027-01")).toEqual(plano.linhas.filter((l) => l.mes < "2027-01"));
    expect(nova.linhas.some((l) => l.mes >= "2027-01")).toBe(true);
    expect(nova.config.valorMensalCentavos).toBe(proposta.aumentar!.valorMensalCentavos);
    expect(nova.saldoPlanejado.filter((p) => p.mes < "2027-01")).toEqual(plano.saldoPlanejado.filter((p) => p.mes < "2027-01"));
    expect(nova.saldoPlanejado.at(-1)!.saldoCentavos).toBe(0);
  });
});

describe("agendar extras", () => {
  const linhas = [
    { mes: "2026-11", dividaId: 1, planejadoCentavos: 90_000 },
    { mes: "2026-12", dividaId: 1, planejadoCentavos: 90_000 },
    { mes: "2027-01", dividaId: 1, planejadoCentavos: 90_000 },
    { mes: "2026-12", dividaId: 2, planejadoCentavos: 30_000 },
  ];
  it("só o mês atual e o seguinte, descontando o que já está em Lançamentos", () => {
    const lanc = new Map([["2026-11|1", 50_000], ["2026-12|1", 90_000]]);
    const r = extrasParaAgendar({ linhas, lancamentosPorMesEDivida: lanc, hoje: "2026-11-20" });
    expect(r).toEqual([
      { mes: "2026-11", dividaId: 1, planejadoCentavos: 90_000, jaNosLancamentosCentavos: 50_000, agendarCentavos: 40_000 },
      { mes: "2026-12", dividaId: 2, planejadoCentavos: 30_000, jaNosLancamentosCentavos: 0, agendarCentavos: 30_000 },
    ]);
  });
  it("não oferece dívida encerrada", () => {
    const r = extrasParaAgendar({ linhas, lancamentosPorMesEDivida: new Map(), hoje: "2026-11-20", encerramentos: new Map([[2, "2026-11"]]) });
    expect(r.some((x) => x.dividaId === 2)).toBe(false);
  });
});

describe("ids", () => {
  it("converte o id do Simulador", () => {
    expect(idDaDivida("d12")).toBe(12);
  });
});
