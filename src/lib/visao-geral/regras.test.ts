import { describe, expect, it } from "vitest";
import { fatiasDeCategorias, mesesDoPeriodo, normalizarOpcoes, periodosDosPrazos, separarPrazos, serieDeSaldo, somarTotais, totaisDoMes, type LinhaPainel } from "./regras";

const linha = (p: Partial<LinhaPainel>): LinhaPainel => ({
  chave: Math.random().toString(),
  tipo: "despesa",
  descricao: "x",
  data: "2026-11-24",
  situacao: "a_vencer",
  valorCentavos: -100,
  contaOuCartao: "Conta",
  ...p,
});

describe("opções", () => {
  it("usa o padrão quando não há nada guardado", () => {
    expect(normalizarOpcoes(null)).toEqual({ vencidosDias: 7, futuroDias: 7, categoriasDias: 28, contasOcultas: [] });
  });
  it("descarta valores fora do limite", () => {
    expect(normalizarOpcoes({ vencidosDias: 0, futuroDias: 500, categoriasDias: 30, contasOcultas: [2, 2, "x", -1] })).toEqual({
      vencidosDias: 7,
      futuroDias: 7,
      categoriasDias: 30,
      contasOcultas: [2],
    });
  });
});

describe("períodos", () => {
  it("7 dias para trás e 7 para frente, sem incluir hoje", () => {
    expect(periodosDosPrazos("2026-11-24", { vencidosDias: 7, futuroDias: 7 })).toEqual({
      vencidos: { inicio: "2026-11-17", fim: "2026-11-23" },
      vencendo: { inicio: "2026-11-24", fim: "2026-11-24" },
      futuro: { inicio: "2026-11-25", fim: "2026-12-01" },
    });
  });
  it("lista os meses tocados, virando o ano", () => {
    expect(mesesDoPeriodo({ inicio: "2026-11-20", fim: "2027-01-05" })).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(mesesDoPeriodo({ inicio: "2026-11-01", fim: "2026-11-30" })).toEqual(["2026-11"]);
  });
});

describe("totais", () => {
  it("transferência e saldo inicial não contam como receita nem despesa", () => {
    const t = somarTotais([
      linha({ tipo: "receita", valorCentavos: 500000 }),
      linha({ tipo: "despesa", valorCentavos: -8337 }),
      linha({ tipo: "pagamento_fatura", valorCentavos: -20000 }),
      linha({ tipo: "transferencia_saida", valorCentavos: -1000 }),
      linha({ tipo: "transferencia_entrada", valorCentavos: 1000 }),
      linha({ tipo: "saldo_inicial", valorCentavos: 999999 }),
    ]);
    expect(t).toEqual({ receitas: 500000, despesas: 28337 });
  });
  it("separa o que já foi recebido e pago no mês", () => {
    expect(
      totaisDoMes([
        linha({ tipo: "receita", valorCentavos: 300000, situacao: "realizado" }),
        linha({ tipo: "receita", valorCentavos: 100000 }),
        linha({ tipo: "despesa", valorCentavos: -5000, situacao: "realizado" }),
        linha({ tipo: "despesa", valorCentavos: -7000, situacao: "vencido" }),
      ]),
    ).toEqual({ receitas: 400000, despesas: 12000, recebido: 300000, pago: 5000 });
  });
});

describe("vencidos, vencendo e futuro", () => {
  const hoje = "2026-11-24";
  const linhas = [
    linha({ chave: "a", data: "2026-11-16", situacao: "vencido", valorCentavos: -100 }), // 8 dias atrás: fora
    linha({ chave: "b", data: "2026-11-17", situacao: "vencido", valorCentavos: -200 }),
    linha({ chave: "c", data: "2026-11-23", situacao: "vencido", tipo: "receita", valorCentavos: 300 }),
    linha({ chave: "d", data: "2026-11-23", situacao: "realizado", valorCentavos: -400 }), // pago: fora
    linha({ chave: "e", data: "2026-11-24", valorCentavos: -500 }),
    linha({ chave: "f", data: "2026-11-24", tipo: "transferencia_saida", valorCentavos: -600 }), // transferência: fora
    linha({ chave: "g", data: "2026-12-01", tipo: "pagamento_fatura", valorCentavos: -700 }),
    linha({ chave: "h", data: "2026-12-02", valorCentavos: -800 }), // 8 dias à frente: fora
  ];
  const r = separarPrazos(linhas, hoje, { vencidosDias: 7, futuroDias: 7 });
  it("vencidos", () => {
    expect(r.vencidos.linhas.map((l) => l.chave)).toEqual(["b", "c"]);
    expect([r.vencidos.receitas, r.vencidos.despesas]).toEqual([300, 200]);
  });
  it("vencendo hoje", () => {
    expect(r.vencendo.linhas.map((l) => l.chave)).toEqual(["e"]);
    expect(r.vencendo.despesas).toBe(500);
  });
  it("futuro (inclui a fatura do cartão)", () => {
    expect(r.futuro.linhas.map((l) => l.chave)).toEqual(["g"]);
    expect(r.futuro.despesas).toBe(700);
  });
});

describe("despesas por categorias", () => {
  it("mostra as 5 maiores e junta o resto em Outras, com percentuais que somam 100", () => {
    const gastos = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, nome: `C${id}`, cor: "#000", valorCentavos: id * 1000 }));
    gastos.push({ id: 7, nome: "C7", cor: "#000", valorCentavos: 1000 }); // soma na mesma categoria
    const f = fatiasDeCategorias(gastos);
    expect(f.map((x) => x.nome)).toEqual(["C7", "C6", "C5", "C4", "C3", "Outras"]);
    expect(f[0].valorCentavos).toBe(8000);
    expect(f.at(-1)!.valorCentavos).toBe(3000);
    expect(Math.round(f.reduce((s, x) => s + x.percentual, 0) * 10) / 10).toBe(100);
  });
  it("sem gastos, não há fatias", () => {
    expect(fatiasDeCategorias([])).toEqual([]);
  });
  it("três partes iguais fecham 100%", () => {
    const f = fatiasDeCategorias([1, 2, 3].map((id) => ({ id, nome: `C${id}`, cor: "#000", valorCentavos: 100 })));
    expect(f.reduce((s, x) => s + x.percentual, 0)).toBeCloseTo(100, 5);
  });
});

describe("evolução do saldo", () => {
  it("acumula dia a dia a partir do saldo anterior", () => {
    const s = serieDeSaldo(1000, [{ data: "2026-11-23", valorCentavos: -300 }, { data: "2026-11-23", valorCentavos: 50 }, { data: "2026-11-24", valorCentavos: 200 }], { inicio: "2026-11-22", fim: "2026-11-24" });
    expect(s).toEqual([
      { data: "2026-11-22", saldo: 1000 },
      { data: "2026-11-23", saldo: 750 },
      { data: "2026-11-24", saldo: 950 },
    ]);
  });
});
