import { describe, expect, it } from "vitest";
import { montarDividaComParcelas, montarDividaSemParcelas } from "./simulador";
import { evolucaoDoTotalDevido, fatiasDeDividas, jurosEstimadosPorMes, parcelasDoMes, preverQuitacao, type ItemEvolucao } from "./painel";

describe("indicadores da Visão Geral", () => {
  it("juros por mês: saldo × taxa de cada dívida, só das que têm taxa", () => {
    expect(
      jurosEstimadosPorMes([
        { saldoCentavos: 100_000, taxaMensalPct: 2 },
        { saldoCentavos: 50_000, taxaMensalPct: 3.5 },
        { saldoCentavos: 90_000, taxaMensalPct: null },
        { saldoCentavos: 90_000, taxaMensalPct: 0 },
      ]),
    ).toBe(2_000 + 1_750);
  });
  it("parcelas do mês: só as que vencem no mês de hoje, pagas ou não", () => {
    const o = [
      { vencimento: "2026-11-05", valorCentavos: 10_000 },
      { vencimento: "2026-11-28", valorCentavos: 20_000 },
      { vencimento: "2026-12-05", valorCentavos: 30_000 },
      { vencimento: "2026-10-30", valorCentavos: 40_000 },
    ];
    expect(parcelasDoMes(o, "2026-11-26")).toBe(30_000);
  });
});

describe("evolução do total devido", () => {
  const parcela = (vencimento: string, dataPagamento: string | null, valorCentavos = 10_000) => ({ vencimento, dataPagamento, valorCentavos });
  it("cai a cada parcela paga e só começa quando a dívida passa a existir", () => {
    const itens: ItemEvolucao[] = [
      {
        desde: "2026-09-15",
        forma: "parcelas_fixas",
        saldoHojeCentavos: 20_000,
        obrigacoes: [parcela("2026-10-10", "2026-10-10"), parcela("2026-11-10", "2026-11-10"), parcela("2026-12-10", null), parcela("2027-01-10", null)],
      },
    ];
    const serie = evolucaoDoTotalDevido(itens, "2026-11-26", 12);
    expect(serie[0]).toEqual({ mes: "2026-09", totalCentavos: 40_000 });
    expect(serie.map((s) => s.mes)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(serie.map((s) => s.totalCentavos)).toEqual([40_000, 30_000, 20_000]);
  });
  it("dívida sem parcelas: o saldo de hoje mais os pagamentos feitos depois", () => {
    const itens: ItemEvolucao[] = [{ desde: "2026-01-01", forma: "sem_parcelas", saldoHojeCentavos: 70_000, obrigacoes: [parcela("2026-11-05", "2026-11-05", 20_000), parcela("2026-10-05", "2026-10-05", 10_000)] }];
    const serie = evolucaoDoTotalDevido(itens, "2026-11-26", 3);
    expect(serie.map((s) => s.totalCentavos)).toEqual([100_000, 90_000, 70_000]);
  });
  it("sem dívidas, a série é vazia", () => {
    expect(evolucaoDoTotalDevido([], "2026-11-26")).toEqual([]);
  });
});

describe("rosca por credor ou tipo", () => {
  it("soma o mesmo credor, mostra as maiores e junta o resto em Outras, fechando em 100%", () => {
    const fatias = fatiasDeDividas(
      [
        { chave: "1", nome: "Banco X", saldoCentavos: 500_000 },
        { chave: "1", nome: "Banco X", saldoCentavos: 100_000 },
        { chave: "2", nome: "Loja", saldoCentavos: 200_000 },
        { chave: "3", nome: "João", saldoCentavos: 100_000 },
        { chave: "4", nome: "A", saldoCentavos: 50_000 },
        { chave: "5", nome: "B", saldoCentavos: 30_000 },
        { chave: "6", nome: "C", saldoCentavos: 10_000 },
        { chave: "7", nome: "D", saldoCentavos: 10_000 },
      ],
      3,
    );
    expect(fatias.map((f) => f.nome)).toEqual(["Banco X", "Loja", "João", "Outras"]);
    expect(fatias[0].valorCentavos).toBe(600_000);
    expect(Math.round(fatias.reduce((s, f) => s + f.percentual, 0) * 10) / 10).toBe(100);
    expect(fatias[3].cor).toBe("#9CA3AF");
  });
});

describe("previsão de quitação", () => {
  const parcelas = (n: number) => Array.from({ length: n }, (_, i) => ({ vencimento: `${2026 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, "0")}-10`, valorCentavos: 10_000, acrescimoCentavos: 0 }));
  it("com parcelas, diz o mês em que tudo acaba", () => {
    const d = montarDividaComParcelas({ id: "d1", nome: "A", credor: "A", taxaMensalPct: 0, abertas: parcelas(6), inicioYm: "2026-11", atrasoDias: 0, comGarantia: false });
    const p = preverQuitacao([d], "2026-11");
    expect(p).toMatchObject({ tipo: "data", mes: "2027-04", rotulo: "abr/2027", meses: 6, aproximada: false });
  });
  it("dívida sem parcelas definidas dá uma data aproximada (mínimo = juros do mês)", () => {
    const d = montarDividaSemParcelas({ id: "d2", nome: "B", credor: "B", taxaMensalPct: 3, saldoCentavos: 100_000, atrasoDias: 0, comGarantia: false });
    expect(preverQuitacao([d], "2026-11")).toMatchObject({ tipo: "data", aproximada: true });
  });
  it("se o pagamento nunca cobre o saldo, diz que não há previsão", () => {
    const d = montarDividaSemParcelas({ id: "d3", nome: "C", credor: "C", taxaMensalPct: 5, saldoCentavos: 1_000_000, parcelaMinimaCentavos: 100, atrasoDias: 0, comGarantia: false });
    expect(preverQuitacao([d], "2026-11").tipo).toBe("sem_previsao");
  });
  it("sem dívidas, não há o que prever", () => {
    expect(preverQuitacao([], "2026-11")).toEqual({ tipo: "nada" });
  });
});
