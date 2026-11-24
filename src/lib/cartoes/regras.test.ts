import { describe, expect, it } from "vitest";
import { faturaDaCompetencia } from "@/lib/lancamentos/regras";
import { competenciaVizinha, escolherFaturaAtual, limiteDoCartao, situacaoDaFatura, totalProximas, type FaturaResumo } from "./regras";

const fatura = (p: Partial<FaturaResumo> & { competencia: string }): FaturaResumo => ({
  id: 1,
  ...faturaDaCompetencia(p.competencia, 5, 12),
  situacaoGravada: "aberta",
  compras: 1,
  totalCentavos: 10000,
  pendenteCentavos: 10000,
  pagoCentavos: 0,
  ...p,
});

describe("situação da fatura (fecha dia 5)", () => {
  it("antes do fechamento está aberta", () => {
    expect(situacaoDaFatura(fatura({ competencia: "2026-12-01" }), "2026-12-04")).toBe("aberta");
  });
  it("no dia do fechamento já está fechada", () => {
    expect(situacaoDaFatura(fatura({ competencia: "2026-12-01" }), "2026-12-05")).toBe("fechada");
  });
  it("fechada antes do dia, à mão", () => {
    expect(situacaoDaFatura(fatura({ competencia: "2026-12-01", situacaoGravada: "fechada" }), "2026-12-01")).toBe("fechada");
  });
  it("paga quando o pagamento cobre tudo", () => {
    expect(situacaoDaFatura(fatura({ competencia: "2026-12-01", pendenteCentavos: 0, pagoCentavos: 10000 }), "2026-12-20")).toBe("paga");
  });
  it("compra nova depois de pagar deixa a fatura com valor pendente", () => {
    expect(situacaoDaFatura(fatura({ competencia: "2026-12-01", totalCentavos: 15000, pendenteCentavos: 5000, pagoCentavos: 10000 }), "2026-12-03")).toBe("aberta");
  });
});

describe("limite do cartão", () => {
  it("disponível = limite − compras não pagas", () => {
    expect(limiteDoCartao({ limiteCentavos: 500000, ilimitado: false }, 125000)).toMatchObject({ disponivel: 375000, percentualUsado: 25, percentualDisponivel: 75 });
  });
  it("estourado fica negativo e 100% usado", () => {
    expect(limiteDoCartao({ limiteCentavos: 100000, ilimitado: false }, 130000)).toMatchObject({ disponivel: -30000, percentualUsado: 100 });
  });
  it("estorno maior que as compras não aumenta o limite", () => {
    expect(limiteDoCartao({ limiteCentavos: 100000, ilimitado: false }, -5000)).toMatchObject({ usado: 0, disponivel: 100000 });
  });
  it("ilimitado não tem disponível", () => {
    expect(limiteDoCartao({ limiteCentavos: 0, ilimitado: true }, 5000)).toMatchObject({ ilimitado: true, disponivel: null, usado: 5000 });
  });
});

describe("fatura atual e próximas", () => {
  const cartao = { diaFechamento: 5, diaVencimento: 12 };
  it("sem compras, mostra a fatura aberta de hoje zerada", () => {
    const atual = escolherFaturaAtual([], cartao, "2026-11-24");
    expect(atual).toMatchObject({ id: null, competencia: "2026-12-01", dataFechamento: "2026-12-05", dataVencimento: "2026-12-12", totalCentavos: 0 });
  });
  it("fechada com valor a pagar vem antes da aberta", () => {
    const fechada = fatura({ id: 7, competencia: "2026-11-01" });
    const aberta = fatura({ id: 8, competencia: "2026-12-01" });
    expect(escolherFaturaAtual([aberta, fechada], cartao, "2026-11-08").id).toBe(7);
  });
  it("fechada já paga sai da frente", () => {
    const paga = fatura({ id: 7, competencia: "2026-11-01", pendenteCentavos: 0, pagoCentavos: 10000 });
    const aberta = fatura({ id: 8, competencia: "2026-12-01" });
    expect(escolherFaturaAtual([paga, aberta], cartao, "2026-11-08").id).toBe(8);
  });
  it("próximas = o que falta pagar nas faturas seguintes (parcelas)", () => {
    const atual = fatura({ id: 8, competencia: "2026-12-01" });
    const lista = [atual, fatura({ id: 9, competencia: "2027-01-01", pendenteCentavos: 8333 }), fatura({ id: 10, competencia: "2027-02-01", pendenteCentavos: 8333 })];
    expect(totalProximas(lista, atual)).toBe(16666);
  });
});

describe("competência vizinha", () => {
  it("vira o ano nos dois sentidos", () => {
    expect(competenciaVizinha("2026-12-01", 1)).toBe("2027-01-01");
    expect(competenciaVizinha("2027-01-01", -1)).toBe("2026-12-01");
  });
});
