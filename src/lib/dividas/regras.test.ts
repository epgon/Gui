import { describe, expect, it } from "vitest";
import { camposDoRestante } from "@/lib/lancamentos/regras";
import {
  amortizarReduzindoQuantidade,
  amortizarReduzindoValor,
  diasEntre,
  dividaQueJaTem,
  estimarAtraso,
  percentualPago,
  resumirSaldo,
  saldoEstimado,
  saldoInformadoAtual,
  saldoPelasParcelas,
  situacaoDaDivida,
  taxaAnualParaMensal,
  taxaMensalParaAnual,
  valorPresente,
  type ConfigAtraso,
  type Obrigacao,
} from "./regras";

const CFG: ConfigAtraso = { multaPct: 2, moraMensalPct: 1, taxaMensalPct: 0 };
const ob = (id: number, valorCentavos: number, vencimento: string, dataPagamento: string | null = null, extra: Partial<Obrigacao> = {}): Obrigacao => ({
  id,
  valorCentavos,
  vencimento,
  dataPagamento,
  registradoEm: 0,
  deSistema: false,
  ...extra,
});

describe("taxas", () => {
  it("converte taxa anual em mensal (12% a.a. = 0,9489% a.m.) e volta", () => {
    expect(taxaAnualParaMensal(12)).toBe(0.9489);
    expect(taxaMensalParaAnual(1)).toBe(12.6825);
    expect(taxaAnualParaMensal(0)).toBe(0);
  });
  it("2,99% ao mês vale cerca de 42,41% ao ano", () => {
    expect(taxaMensalParaAnual(2.99)).toBeCloseTo(42.41, 1);
  });
});

describe("diasEntre", () => {
  it("conta dias, inclusive na virada de mês e de ano", () => {
    expect(diasEntre("2026-11-26", "2026-11-26")).toBe(0);
    expect(diasEntre("2026-12-25", "2027-01-05")).toBe(11);
    expect(diasEntre("2026-11-26", "2026-11-20")).toBe(-6);
  });
});

describe("estimativa de atraso", () => {
  it("parcela em dia ou no dia do vencimento não tem acréscimo", () => {
    const e = estimarAtraso(100_000, "2026-11-26", "2026-11-26", CFG);
    expect(e).toMatchObject({ dias: 0, acrescimoCentavos: 0, totalCentavos: 100_000 });
    expect(estimarAtraso(100_000, "2026-12-10", "2026-11-26", CFG).acrescimoCentavos).toBe(0);
  });
  it("multa uma vez só (2%) e mora proporcional aos dias (1% ao mês)", () => {
    // R$ 1.000,00 vencida há 30 dias: multa R$ 20,00 + mora R$ 10,00.
    const e = estimarAtraso(100_000, "2026-10-27", "2026-11-26", CFG);
    expect(e.dias).toBe(30);
    expect(e.multaCentavos).toBe(2_000);
    expect(e.moraCentavos).toBe(1_000);
    expect(e.totalCentavos).toBe(103_000);
    // Com 60 dias a multa não dobra, só a mora.
    const e60 = estimarAtraso(100_000, "2026-09-27", "2026-11-26", CFG);
    expect(e60.multaCentavos).toBe(2_000);
    expect(e60.moraCentavos).toBe(2_000);
  });
  it("mora por dia: 10 dias de R$ 300,00 a 1% ao mês = R$ 1,00", () => {
    expect(estimarAtraso(30_000, "2026-11-16", "2026-11-26", CFG).moraCentavos).toBe(100);
  });
  it("soma a taxa da dívida nos dias de atraso", () => {
    const e = estimarAtraso(100_000, "2026-10-27", "2026-11-26", { ...CFG, taxaMensalPct: 3 });
    expect(e.jurosCentavos).toBe(3_000);
    expect(e.totalCentavos).toBe(106_000);
  });
});

describe("saldo devedor", () => {
  const obrigacoes = [ob(1, 50_000, "2026-09-10", "2026-09-10"), ob(2, 50_000, "2026-10-10"), ob(3, 50_000, "2026-12-10")];
  it("pelas parcelas: soma só o que não foi pago", () => {
    expect(saldoPelasParcelas(obrigacoes)).toBe(100_000);
  });
  it("estimado: acrescenta multa e mora da parcela vencida", () => {
    // Parcela de 10/10 vencida há 47 dias em 26/11: multa 1.000 + mora 50.000 × 1% × 47/30 = 783.
    expect(saldoEstimado(obrigacoes, "2026-11-26", CFG)).toBe(100_000 + 1_000 + 783);
  });
  it("informado: desconta só os pagamentos feitos depois da data informada", () => {
    const informado = { saldoCentavos: 90_000, data: "2026-10-01", registradoEm: 100 };
    const lista = [ob(1, 30_000, "2026-09-10", "2026-09-30", { registradoEm: 50 }), ob(2, 20_000, "2026-10-10", "2026-10-15", { registradoEm: 200 })];
    expect(saldoInformadoAtual(informado, lista)).toBe(70_000);
  });
  it("informado: pagamento no mesmo dia vale se foi gravado depois do saldo", () => {
    const informado = { saldoCentavos: 90_000, data: "2026-10-01", registradoEm: 100 };
    const antes = ob(1, 10_000, "2026-10-01", "2026-10-01", { registradoEm: 90 });
    const depois = ob(2, 5_000, "2026-10-01", "2026-10-01", { registradoEm: 110 });
    expect(saldoInformadoAtual(informado, [antes, depois])).toBe(85_000);
  });
  it("informado nunca fica negativo", () => {
    expect(saldoInformadoAtual({ saldoCentavos: 1_000, data: "2026-10-01", registradoEm: 0 }, [ob(1, 5_000, "2026-10-05", "2026-10-05")])).toBe(0);
  });

  it("mostra o informado quando tem menos de 60 dias; senão, o estimado", () => {
    const base = { forma: "parcelas_fixas" as const, obrigacoes, hoje: "2026-11-26", atraso: CFG };
    const recente = resumirSaldo({ ...base, informado: { saldoCentavos: 105_000, data: "2026-11-01", registradoEm: 0 } });
    expect(recente).toMatchObject({ exibido: 105_000, origem: "informado", informadoAntigo: false });
    const antigo = resumirSaldo({ ...base, informado: { saldoCentavos: 105_000, data: "2026-08-01", registradoEm: 0 } });
    expect(antigo).toMatchObject({ exibido: 101_783, origem: "estimado", informadoAntigo: true });
    const nenhum = resumirSaldo({ ...base, informado: null });
    expect(nenhum).toMatchObject({ exibido: 101_783, origem: "estimado", informado: null });
  });
  it("sem atraso e sem informado, mostra o saldo pelas parcelas", () => {
    const r = resumirSaldo({ forma: "parcelas_fixas", obrigacoes: [ob(1, 10_000, "2027-01-10")], informado: null, hoje: "2026-11-26", atraso: CFG });
    expect(r).toMatchObject({ exibido: 10_000, origem: "parcelas", atrasoCentavos: 0 });
  });
  it("sem parcelas definidas: parte do saldo informado, abate só os pagamentos do botão Pagar e soma o que está em aberto", () => {
    const informado = { saldoCentavos: 300_000, data: "2026-11-01", registradoEm: 100 };
    const pagamento = ob(1, 40_000, "2026-11-10", "2026-11-10", { registradoEm: 200, deSistema: true });
    const contaAcompanhada = ob(2, 9_000, "2026-11-12", "2026-11-12", { registradoEm: 300, deSistema: false });
    const encargo = ob(3, 2_500, "2026-12-20");
    const r = resumirSaldo({ forma: "sem_parcelas", obrigacoes: [pagamento, contaAcompanhada, encargo], informado, hoje: "2026-11-26", atraso: CFG });
    expect(r.informado).toBe(260_000);
    expect(r.exibido).toBe(262_500);
  });
  it("valor presente das parcelas futuras com taxa", () => {
    // R$ 1.000,00 daqui a 30 dias a 1% ao mês vale R$ 990,10 hoje.
    expect(valorPresente([ob(1, 100_000, "2026-12-26")], "2026-11-26", 1)).toBe(99_010);
    expect(valorPresente([ob(1, 100_000, "2026-12-26")], "2026-11-26", 0)).toBe(100_000);
  });
});

describe("situação da dívida", () => {
  const base = { forma: "parcelas_fixas" as const, saldoCentavos: 1, hoje: "2026-11-26" };
  it("em dia: parcelas a vencer", () => {
    expect(situacaoDaDivida({ ...base, situacao: "ativa", obrigacoes: [ob(1, 100, "2026-12-10")] }).situacao).toBe("em_dia");
  });
  it("em atraso: mostra os dias da parcela mais antiga", () => {
    const r = situacaoDaDivida({ ...base, situacao: "ativa", obrigacoes: [ob(1, 100, "2026-11-16"), ob(2, 100, "2026-10-27"), ob(3, 100, "2026-12-10")] });
    expect(r).toEqual({ situacao: "em_atraso", diasAtraso: 30, parcelasAtrasadas: 2 });
  });
  it("quitada: tudo pago; voltar uma parcela para não paga reabre a dívida", () => {
    const pagas = [ob(1, 100, "2026-10-10", "2026-10-10"), ob(2, 100, "2026-11-10", "2026-11-10")];
    expect(situacaoDaDivida({ ...base, situacao: "ativa", obrigacoes: pagas }).situacao).toBe("quitada");
    expect(situacaoDaDivida({ ...base, situacao: "quitada", obrigacoes: pagas }).situacao).toBe("quitada");
    const reaberta = [pagas[0], ob(2, 100, "2026-12-10")];
    expect(situacaoDaDivida({ ...base, situacao: "quitada", obrigacoes: reaberta }).situacao).toBe("em_dia");
  });
  it("renegociada e cancelada vêm do cadastro", () => {
    expect(situacaoDaDivida({ ...base, situacao: "renegociada", obrigacoes: [ob(1, 100, "2026-01-10")] }).situacao).toBe("renegociada");
    expect(situacaoDaDivida({ ...base, situacao: "cancelada", obrigacoes: [] }).situacao).toBe("cancelada");
  });
  it("sem parcelas: quitada quando o saldo chega a zero", () => {
    expect(situacaoDaDivida({ situacao: "ativa", forma: "sem_parcelas", obrigacoes: [], saldoCentavos: 0, hoje: "2026-11-26" }).situacao).toBe("quitada");
    expect(situacaoDaDivida({ situacao: "ativa", forma: "sem_parcelas", obrigacoes: [], saldoCentavos: 5_000, hoje: "2026-11-26" }).situacao).toBe("em_dia");
  });
  it("percentual pago", () => {
    expect(percentualPago(25_000, 75_000)).toBe(25);
    expect(percentualPago(0, 0)).toBe(0);
    expect(percentualPago(100, 0)).toBe(100);
  });
});

describe("amortização", () => {
  const parcelas = [
    { id: 1, vencimento: "2026-12-10", valorCentavos: 10_000 },
    { id: 2, vencimento: "2027-01-10", valorCentavos: 10_000 },
    { id: 3, vencimento: "2027-02-10", valorCentavos: 10_000 },
    { id: 4, vencimento: "2027-03-10", valorCentavos: 10_000 },
  ];
  const somaCortes = (r: ReturnType<typeof amortizarReduzindoValor>) => (r.ok ? r.ajustes.reduce((s, a) => s + a.antesCentavos - a.depoisCentavos, 0) : -1);

  it("reduzindo o valor: o extra sai de todas as parcelas e fecha no centavo", () => {
    const r = amortizarReduzindoValor(parcelas, 10_000);
    expect(r.ok && r.ajustes.map((a) => a.depoisCentavos)).toEqual([7_500, 7_500, 7_500, 7_500]);
    expect(somaCortes(r)).toBe(10_000);
  });
  it("reduzindo o valor com centavos quebrados: nada se perde", () => {
    const r = amortizarReduzindoValor(parcelas, 10_001);
    expect(somaCortes(r)).toBe(10_001);
    expect(r.ok && r.ajustes.map((a) => a.depoisCentavos)).toEqual([7_499, 7_500, 7_500, 7_500]);
  });
  it("reduzindo o valor com parcelas diferentes: proporcional e nunca abaixo de zero", () => {
    const r = amortizarReduzindoValor([{ id: 1, vencimento: "2026-12-10", valorCentavos: 1_000 }, { id: 2, vencimento: "2027-01-10", valorCentavos: 9_000 }], 9_999);
    expect(somaCortes(r)).toBe(9_999);
    expect(r.ok && r.ajustes.every((a) => a.depoisCentavos >= 0)).toBe(true);
  });
  it("reduzindo a quantidade: quita as últimas e abate a seguinte com o que sobrar", () => {
    const r = amortizarReduzindoQuantidade(parcelas, 25_000);
    expect(r.ok && r.ajustes.map((a) => [a.id, a.depoisCentavos, a.removida])).toEqual([
      [1, 10_000, false],
      [2, 5_000, false],
      [3, 0, true],
      [4, 0, true],
    ]);
    expect(somaCortes(r)).toBe(25_000);
  });
  it("reduzindo a quantidade, valor exato de parcelas inteiras remove só elas", () => {
    const r = amortizarReduzindoQuantidade(parcelas, 20_000);
    expect(r.ok && r.ajustes.filter((a) => a.removida).map((a) => a.id)).toEqual([3, 4]);
    expect(somaCortes(r)).toBe(20_000);
  });
  it("recusa valor que cobre tudo (é para Quitar), zero ou sem parcelas", () => {
    expect(amortizarReduzindoValor(parcelas, 40_000).ok).toBe(false);
    expect(amortizarReduzindoQuantidade(parcelas, 99_999_999).ok).toBe(false);
    expect(amortizarReduzindoValor(parcelas, 0).ok).toBe(false);
    expect(amortizarReduzindoQuantidade([], 100).ok).toBe(false);
  });
});

describe("vínculos", () => {
  const existentes = [
    { tipo: "fatura" as const, id: 7, dividaId: 1 },
    { tipo: "recorrencia" as const, id: 3, dividaId: 2 },
  ];
  it("uma fatura ou um recorrente não ficam ligados a duas dívidas", () => {
    expect(dividaQueJaTem(existentes, { tipo: "fatura", id: 7 })).toBe(1);
    expect(dividaQueJaTem(existentes, { tipo: "recorrencia", id: 3 })).toBe(2);
  });
  it("o que está livre pode ser ligado (fatura 3 não é a recorrente 3)", () => {
    expect(dividaQueJaTem(existentes, { tipo: "fatura", id: 3 })).toBeNull();
    expect(dividaQueJaTem(existentes, { tipo: "lancamento", id: 7 })).toBeNull();
  });
});

describe("restante de um pagamento parcial", () => {
  it("continua na mesma dívida e aponta para o lançamento original", () => {
    const original = { id: 10, descricao: "Empréstimo 3/12", documento: null, observacao: null, dataReferencia: null, contaId: 1, categoriaId: 2, formaPagamentoId: null, contatoId: 5, dividaId: 42 };
    const restante = camposDoRestante(original, 4_000, "2026-12-30");
    expect(restante).toMatchObject({ dividaId: 42, lancamentoOrigemId: 10, valorCentavos: 4_000, dataVencimento: "2026-12-30", contatoId: 5 });
  });
  it("lançamento sem dívida gera restante sem dívida", () => {
    const original = { id: 11, descricao: "Luz", documento: null, observacao: null, dataReferencia: null, contaId: 1, categoriaId: 2, formaPagamentoId: null, contatoId: null, dividaId: null };
    expect(camposDoRestante(original, 100, "2026-12-30").dividaId).toBeNull();
  });
});
