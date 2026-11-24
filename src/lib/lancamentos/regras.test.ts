import { describe, expect, it } from "vitest";
import { calcularPagamento, faturaDaCompra, gerarParcelas, mesDe, situacaoDe, somarMeses, somarPeriodo, totalDetalhado, valorComSinal } from "./regras";

describe("parcelas", () => {
  const base = {
    descricao: "Geladeira",
    valorCentavos: 100000,
    quantidade: 12,
    iniciarNaParcela: 1,
    dividirValor: true,
    incluirParcelaNaDescricao: true,
    primeiraData: "2026-11-23",
    periodicidade: "mensal" as const,
  };

  it("1.000,00 em 12 vezes dá 83,37 + 11 × 83,33 e fecha o total", () => {
    const p = gerarParcelas(base);
    expect(p).toHaveLength(12);
    expect(p[0].valorCentavos).toBe(8337);
    expect(p.slice(1).every((x) => x.valorCentavos === 8333)).toBe(true);
    expect(p.reduce((s, x) => s + x.valorCentavos, 0)).toBe(100000);
    expect(p[0].descricao).toBe("Geladeira 1/12");
    expect(p[1].data).toBe("2026-12-23");
    expect(p[11].data).toBe("2027-10-23");
  });

  it("sem dividir, repete o valor em cada parcela", () => {
    const p = gerarParcelas({ ...base, dividirValor: false, quantidade: 3, valorCentavos: 5000 });
    expect(p.map((x) => x.valorCentavos)).toEqual([5000, 5000, 5000]);
  });

  it("iniciar na parcela 4 gera da 4 à 12, começando na data informada", () => {
    const p = gerarParcelas({ ...base, iniciarNaParcela: 4 });
    expect(p).toHaveLength(9);
    expect(p[0]).toMatchObject({ numero: 4, data: "2026-11-23", valorCentavos: 8333, descricao: "Geladeira 4/12" });
  });

  it("sem a parcela na descrição", () => {
    expect(gerarParcelas({ ...base, incluirParcelaNaDescricao: false })[2].descricao).toBe("Geladeira");
  });

  it("dia 31 em mês curto vira o último dia, sem perder o dia 31 nos meses seguintes", () => {
    const p = gerarParcelas({ ...base, primeiraData: "2026-01-31", quantidade: 3 });
    expect(p.map((x) => x.data)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});

describe("datas", () => {
  it("soma meses e períodos", () => {
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2026-12-15", 1)).toBe("2027-01-15");
    expect(somarPeriodo("2026-11-24", "semanal", 2)).toBe("2026-12-08");
    expect(somarPeriodo("2026-11-24", "quinzenal", 1)).toBe("2026-12-09");
    expect(somarPeriodo("2026-11-24", "anual", 1)).toBe("2027-11-24");
  });

  it("mês: início, fim, rótulo e navegação", () => {
    expect(mesDe("2026-02")).toMatchObject({ inicio: "2026-02-01", fim: "2026-02-28", rotulo: "Fevereiro de 2026", anterior: "2026-01", seguinte: "2026-03" });
    expect(mesDe("2026-12").seguinte).toBe("2027-01");
  });
});

describe("fatura do cartão (fecha dia 5, vence dia 12)", () => {
  it("compra antes do fechamento cai na fatura do mês", () => {
    expect(faturaDaCompra("2026-11-04", 5, 12)).toEqual({ competencia: "2026-11-01", dataFechamento: "2026-11-05", dataVencimento: "2026-11-12" });
  });
  it("compra no dia do fechamento ou depois cai na próxima", () => {
    expect(faturaDaCompra("2026-11-05", 5, 12).competencia).toBe("2026-12-01");
    expect(faturaDaCompra("2026-12-20", 5, 12)).toEqual({ competencia: "2027-01-01", dataFechamento: "2027-01-05", dataVencimento: "2027-01-12" });
  });
  it("vencimento antes do fechamento vai para o mês seguinte", () => {
    expect(faturaDaCompra("2026-11-10", 25, 3)).toEqual({ competencia: "2026-11-01", dataFechamento: "2026-11-25", dataVencimento: "2026-12-03" });
  });
  it("fechamento dia 31 em fevereiro", () => {
    expect(faturaDaCompra("2026-02-28", 31, 10)).toEqual({ competencia: "2026-03-01", dataFechamento: "2026-03-31", dataVencimento: "2026-04-10" });
    expect(faturaDaCompra("2026-02-27", 31, 10).dataFechamento).toBe("2026-02-28");
  });
});

describe("valores e situação", () => {
  it("sinal pelo tipo", () => {
    expect(valorComSinal("despesa", 1000)).toBe(-1000);
    expect(valorComSinal("receita", 1000)).toBe(1000);
    expect(valorComSinal("transferencia_saida", 1000)).toBe(-1000);
    expect(valorComSinal("transferencia_entrada", 1000)).toBe(1000);
    expect(valorComSinal("saldo_inicial", -1500)).toBe(-1500);
  });
  it("situação calculada", () => {
    expect(situacaoDe("2026-11-20", "2026-11-20", "2026-11-24")).toBe("realizado");
    expect(situacaoDe("2026-11-20", null, "2026-11-24")).toBe("vencido");
    expect(situacaoDe("2026-11-24", null, "2026-11-24")).toBe("a_vencer");
  });
  it("detalhado: receitas menos despesas", () => {
    expect(totalDetalhado([{ tipo: "despesa", valorCentavos: 3000 }, { tipo: "despesa", valorCentavos: 2000 }, { tipo: "receita", valorCentavos: 1000 }])).toEqual({ tipo: "despesa", valorCentavos: 4000, saldo: -4000 });
    expect(totalDetalhado([{ tipo: "receita", valorCentavos: 5000 }]).tipo).toBe("receita");
  });
});

describe("pagamento parcial", () => {
  it("pagar o valor certo não muda nada", () => {
    expect(calcularPagamento(10000, 10000, true)).toEqual({ tipo: "integral" });
  });

  it("pagar 60,00 de 100,00 deixa 40,00 de restante e a soma fecha 100,00", () => {
    const r = calcularPagamento(10000, 6000, true);
    expect(r).toEqual({ tipo: "parcial", valorCentavos: 6000, restanteCentavos: 4000 });
    if (r.tipo === "parcial") expect(r.valorCentavos + r.restanteCentavos).toBe(10000);
  });

  it("centavos quebrados: 83,37 pagando 50,01 deixa 33,36", () => {
    expect(calcularPagamento(8337, 5001, true)).toEqual({ tipo: "parcial", valorCentavos: 5001, restanteCentavos: 3336 });
  });

  it("pagar a menos sem gerar restante é desconto", () => {
    expect(calcularPagamento(10000, 9500, false)).toEqual({ tipo: "desconto", valorCentavos: 9500, diferencaCentavos: 500 });
  });

  it("pagar a mais é juros ou multa, sem restante", () => {
    expect(calcularPagamento(10000, 10250, true)).toEqual({ tipo: "acrescimo", valorCentavos: 10250, diferencaCentavos: 250 });
  });
});
