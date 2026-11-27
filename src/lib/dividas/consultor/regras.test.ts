import { describe, expect, it } from "vitest";
import { montarDividaComParcelas, montarDividaSemParcelas } from "../simulador";
import {
  LIMITES_PADRAO,
  atualizarEstadoAlertas,
  calcularAlertas,
  classificarPercentualRenda,
  dataDoLembrete,
  filtrarPorEstado,
  lerEstadoAlertas,
  percentualDaRenda,
  regraR1,
  regraR11,
  regraR12,
  regraR13,
  regraR2,
  regraR3,
  regraR4,
  regraR5,
  regraR6,
  regraR7,
  regraR10,
  regraR8,
  regraR9,
  sobraLivre,
  type PlanoParaConsultor,
  type ContextoConsultor,
  type DividaConsultor,
} from "./regras";

const HOJE = "2026-11-26";

const divida = (extra: Partial<DividaConsultor> = {}): DividaConsultor => ({
  id: 1,
  descricao: "Empréstimo Banco X",
  credor: "Banco X",
  tipo: "emprestimo_pessoal",
  forma: "parcelas_fixas",
  situacao: "em_dia",
  taxaMensalPct: 2,
  saldoCentavos: 500_000,
  saldoOrigem: "parcelas",
  informadoEm: null,
  diasAtraso: 0,
  parcelasAtrasadas: 0,
  atrasoCentavos: 0,
  acrescimoCentavos: 0,
  parcelaCentavos: 50_000,
  parcelasAbertas: 12,
  quitadaEm: null,
  sim: null,
  ...extra,
});

const contexto = (extra: Partial<ContextoConsultor> = {}): ContextoConsultor => ({
  hoje: HOJE,
  dividas: [],
  rendaMensalCentavos: 600_000,
  sobraMensalCentavos: 200_000,
  parcelasDoMesCentavos: 50_000,
  parcelasReferenciaCentavos: 50_000,
  reservaCentavos: 1_000_000,
  reservaMinimaCentavos: 900_000,
  extrasRecentesCentavos: 0,
  caixa: null,
  faturasVencidas: [],
  ...extra,
});

/** Dívida de 12 parcelas de R$ 500,00 a 2% ao mês, no formato do Simulador. */
const simParcelas = (taxa = 2) =>
  montarDividaComParcelas({
    id: "d1",
    nome: "Empréstimo Banco X",
    credor: "Banco X",
    taxaMensalPct: taxa,
    abertas: Array.from({ length: 12 }, (_, i) => ({ vencimento: `${2026 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, "0")}-10`, valorCentavos: 50_000, acrescimoCentavos: 0 })),
    inicioYm: "2026-11",
    atrasoDias: 0,
    comGarantia: false,
  });

describe("R1: parcela em atraso", () => {
  it("dispara com parcela vencida e mostra a estimativa", () => {
    const [a] = regraR1(contexto({ dividas: [divida({ situacao: "em_atraso", diasAtraso: 15, parcelasAtrasadas: 1, atrasoCentavos: 50_000, acrescimoCentavos: 1_500 })] }));
    expect(a.id).toBe("R1:1");
    expect(a.gravidade).toBe("alta");
    expect(a.texto).toContain("15 dias");
    expect(a.texto).toContain("R$ 15,00");
    expect(a.acao?.href).toBe("/gestao/dividas/minhas?detalhar=1");
  });
  it("não dispara em dia, nem em dívida quitada", () => {
    expect(regraR1(contexto({ dividas: [divida()] }))).toEqual([]);
    expect(regraR1(contexto({ dividas: [divida({ situacao: "quitada", parcelasAtrasadas: 1 })] }))).toEqual([]);
  });
});

describe("R2: parcelas do mês na renda", () => {
  it("atenção acima de 30% e alta acima de 50%", () => {
    const atencao = regraR2(contexto({ parcelasDoMesCentavos: 200_000 }), LIMITES_PADRAO);
    expect(atencao[0].gravidade).toBe("atencao");
    expect(atencao[0].titulo).toContain("33,3%");
    expect(regraR2(contexto({ parcelasDoMesCentavos: 330_000 }), LIMITES_PADRAO)[0].gravidade).toBe("alta");
  });
  it("não dispara até 30% da renda, nem sem renda calculada", () => {
    expect(regraR2(contexto({ parcelasDoMesCentavos: 180_000 }), LIMITES_PADRAO)).toEqual([]);
    expect(regraR2(contexto({ parcelasDoMesCentavos: 400_000, rendaMensalCentavos: null }), LIMITES_PADRAO)).toEqual([]);
  });
  it("calcula o percentual e a classificação", () => {
    expect(percentualDaRenda(150_000, 600_000)).toBe(25);
    expect(percentualDaRenda(1, null)).toBeNull();
    expect(classificarPercentualRenda(30, LIMITES_PADRAO)).toBe("ok");
    expect(classificarPercentualRenda(30.1, LIMITES_PADRAO)).toBe("atencao");
    expect(classificarPercentualRenda(50.1, LIMITES_PADRAO)).toBe("alta");
  });
});

describe("R3: dinheiro previsto não cobre as parcelas", () => {
  it("dispara quando saldo + sobra fica abaixo das parcelas até o fim do próximo mês", () => {
    const [a] = regraR3(contexto({ sobraMensalCentavos: 50_000, caixa: { saldoCentavos: 30_000, parcelasAteProximoMesCentavos: 200_000 } }));
    expect(a.gravidade).toBe("alta");
    expect(a.texto).toContain("R$ 1.200,00");
  });
  it("não dispara quando cobre, nem sem dívidas", () => {
    expect(regraR3(contexto({ caixa: { saldoCentavos: 300_000, parcelasAteProximoMesCentavos: 200_000 } }))).toEqual([]);
    expect(regraR3(contexto({ caixa: null }))).toEqual([]);
  });
});

describe("R4: taxa muito alta", () => {
  it("dispara acima de 6% ao mês", () => {
    const [a] = regraR4(contexto({ dividas: [divida({ taxaMensalPct: 12, saldoCentavos: 100_000 })] }), LIMITES_PADRAO);
    expect(a.gravidade).toBe("alta");
    expect(a.texto).toContain("12%");
    expect(a.texto).toContain("R$ 120,00 de juros por mês");
  });
  it("não dispara em 6% ou menos, nem sem taxa", () => {
    expect(regraR4(contexto({ dividas: [divida({ taxaMensalPct: 6 }), divida({ id: 2, taxaMensalPct: null })] }), LIMITES_PADRAO)).toEqual([]);
  });
});

describe("R5: reserva acima do mínimo e dívida mais cara que o rendimento", () => {
  it("sugere usar só o que passa do mínimo", () => {
    const [a] = regraR5(contexto({ reservaCentavos: 1_000_000, reservaMinimaCentavos: 900_000, dividas: [divida({ taxaMensalPct: 8, saldoCentavos: 500_000 })] }), LIMITES_PADRAO);
    expect(a.gravidade).toBe("info");
    expect(a.titulo).toContain("R$ 1.000,00");
  });
  it("não dispara com a reserva no mínimo ou dívida mais barata que o rendimento", () => {
    expect(regraR5(contexto({ reservaCentavos: 900_000, dividas: [divida({ taxaMensalPct: 8 })] }), LIMITES_PADRAO)).toEqual([]);
    expect(regraR5(contexto({ dividas: [divida({ taxaMensalPct: 0.5 })] }), LIMITES_PADRAO)).toEqual([]);
  });
});

describe("R6: reserva abaixo do mínimo enquanto paga extra", () => {
  it("dispara quando a reserva está abaixo e houve pagamento extra", () => {
    const [a] = regraR6(contexto({ reservaCentavos: 300_000, extrasRecentesCentavos: 100_000 }));
    expect(a.gravidade).toBe("atencao");
    expect(a.calculo.join(" ")).toContain("R$ 6.000,00");
  });
  it("não dispara sem extra ou com a reserva em dia", () => {
    expect(regraR6(contexto({ reservaCentavos: 300_000, extrasRecentesCentavos: 0 }))).toEqual([]);
    expect(regraR6(contexto({ extrasRecentesCentavos: 100_000 }))).toEqual([]);
  });
});

describe("R7: atraso longo, vale negociar", () => {
  it("dispara depois de 90 dias, se ainda não está em negociação", () => {
    const [a] = regraR7(contexto({ dividas: [divida({ situacao: "em_atraso", diasAtraso: 120, parcelasAtrasadas: 4 })] }), LIMITES_PADRAO);
    expect(a.acao?.href).toBe("/gestao/dividas/negociacoes?nova=1&divida=1");
  });
  it("não dispara com 90 dias ou menos, nem se já está em negociação", () => {
    expect(regraR7(contexto({ dividas: [divida({ diasAtraso: 90 })] }), LIMITES_PADRAO)).toEqual([]);
    expect(regraR7(contexto({ dividas: [divida({ diasAtraso: 200, situacao: "em_negociacao" })] }), LIMITES_PADRAO)).toEqual([]);
  });
});

describe("R8: saldo antigo ou dívida sem taxa", () => {
  it("avisa do saldo informado há mais de 60 dias", () => {
    const alertas = regraR8(contexto({ dividas: [divida({ informadoEm: "2026-08-01", saldoOrigem: "estimado" })] }), LIMITES_PADRAO);
    expect(alertas.map((a) => a.id)).toEqual(["R8:1"]);
    expect(alertas[0].titulo).toContain("117 dias");
  });
  it("avisa de dívidas sem taxa, menos as de pessoa física", () => {
    const alertas = regraR8(contexto({ dividas: [divida({ taxaMensalPct: null }), divida({ id: 2, taxaMensalPct: null, tipo: "pessoa_fisica" })] }), LIMITES_PADRAO);
    expect(alertas.map((a) => a.id)).toEqual(["R8:sem-taxa"]);
    expect(alertas[0].titulo).toContain("1 dívida sem taxa");
  });
  it("não dispara com saldo recente e taxa informada", () => {
    expect(regraR8(contexto({ dividas: [divida({ informadoEm: "2026-11-10" })] }), LIMITES_PADRAO)).toEqual([]);
  });
});

describe("R11: pagando só o mínimo com sobra positiva", () => {
  it("sugere pagar a mais e mostra os meses e os juros economizados", () => {
    const d = divida({ sim: simParcelas(2), saldoCentavos: simParcelas(2).saldoCentavos });
    const [a] = regraR11(contexto({ dividas: [d], sobraMensalCentavos: 250_000, parcelasReferenciaCentavos: 50_000 }), LIMITES_PADRAO);
    expect(a.regra).toBe("R11");
    expect(a.gravidade).toBe("info");
    expect(a.titulo).toContain("R$ 1.000,00");
    expect(a.titulo).toMatch(/termina \d+ mes(es)? antes/);
  });
  it("não dispara sem sobra livre ou sem dívida com taxa e parcelas", () => {
    const d = divida({ sim: simParcelas(2) });
    expect(regraR11(contexto({ dividas: [d], sobraMensalCentavos: 50_000 }), LIMITES_PADRAO)).toEqual([]);
    expect(regraR11(contexto({ dividas: [divida({ sim: simParcelas(0), taxaMensalPct: 0 })], sobraMensalCentavos: 250_000 }), LIMITES_PADRAO)).toEqual([]);
    expect(regraR11(contexto({ dividas: [divida({ sim: montarDividaSemParcelas({ id: "d3", nome: "x", credor: "y", taxaMensalPct: 3, saldoCentavos: 100_000, atrasoDias: 0, comGarantia: false }), forma: "sem_parcelas" })], sobraMensalCentavos: 250_000 }), LIMITES_PADRAO)).toEqual([]);
  });
  it("a sobra livre é a sobra menos as parcelas de referência", () => {
    expect(sobraLivre(contexto({ sobraMensalCentavos: 250_000, parcelasReferenciaCentavos: 50_000 }))).toBe(200_000);
    expect(sobraLivre(contexto({ sobraMensalCentavos: 10_000 }))).toBe(0);
    expect(sobraLivre(contexto({ sobraMensalCentavos: null }))).toBe(0);
  });
});

describe("R12: dívida quitada, parcela liberada", () => {
  it("dispara por 45 dias depois da quitação e aponta a próxima da fila", () => {
    const quitada = divida({ id: 5, descricao: "Crediário", situacao: "quitada", quitadaEm: "2026-11-10", parcelaCentavos: 30_000, saldoCentavos: 0 });
    const outra = divida({ id: 6, descricao: "Cartão", taxaMensalPct: 9 });
    const [a] = regraR12(contexto({ dividas: [quitada, outra] }), LIMITES_PADRAO);
    expect(a.gravidade).toBe("boa");
    expect(a.texto).toContain("R$ 300,00");
    expect(a.texto).toContain("Cartão");
    expect(a.acao?.href).toContain("divida=6");
  });
  it("não dispara depois de 45 dias nem em dívida ativa", () => {
    expect(regraR12(contexto({ dividas: [divida({ situacao: "quitada", quitadaEm: "2026-09-01", parcelaCentavos: 30_000 })] }), LIMITES_PADRAO)).toEqual([]);
    expect(regraR12(contexto({ dividas: [divida()] }), LIMITES_PADRAO)).toEqual([]);
  });
});

describe("R13: fatura de cartão vencida (rotativo)", () => {
  const fatura = (extra: Partial<ContextoConsultor["faturasVencidas"][number]> = {}) => ({ cartaoId: 3, cartao: "Nubank", rotulo: "out/2026", vencimento: "2026-11-05", valorCentavos: 100_000, ...extra });
  it("dispara com fatura alta (acima de 30% da renda)", () => {
    const [a] = regraR13(contexto({ faturasVencidas: [fatura({ valorCentavos: 250_000 })] }), LIMITES_PADRAO);
    expect(a.gravidade).toBe("alta");
    expect(a.texto).toContain("41,7%");
    expect(a.acao?.href).toBe("/cadastros/cartoes-de-credito?faturas=3");
  });
  it("dispara com duas faturas vencidas do mesmo cartão, mesmo pequenas", () => {
    expect(regraR13(contexto({ faturasVencidas: [fatura(), fatura({ rotulo: "set/2026", vencimento: "2026-10-05" })] }), LIMITES_PADRAO)).toHaveLength(1);
  });
  it("não dispara com uma fatura pequena", () => {
    expect(regraR13(contexto({ faturasVencidas: [fatura()] }), LIMITES_PADRAO)).toEqual([]);
  });
});

describe("conjunto de alertas", () => {
  it("ordena por gravidade e respeita as regras desligadas", () => {
    const c = contexto({
      reservaMinimaCentavos: 1_000_000,
      dividas: [divida({ situacao: "em_atraso", diasAtraso: 20, parcelasAtrasadas: 1, atrasoCentavos: 50_000, taxaMensalPct: 10 }), divida({ id: 2, descricao: "Outra", taxaMensalPct: null })],
    });
    const todos = calcularAlertas(c, LIMITES_PADRAO);
    expect(todos.map((a) => a.regra)).toEqual(["R1", "R4", "R8"]);
    expect(calcularAlertas(c, LIMITES_PADRAO, ["R1"]).map((a) => a.regra)).toEqual(["R4", "R8"]);
  });
  it("com atraso e cheque especial, os dois alertas altos vêm no topo", () => {
    const c = contexto({ dividas: [divida({ id: 1, situacao: "em_atraso", diasAtraso: 10, parcelasAtrasadas: 1, atrasoCentavos: 50_000 }), divida({ id: 2, descricao: "Cheque especial", tipo: "cheque_especial", taxaMensalPct: 8 })] });
    const alertas = calcularAlertas(c, LIMITES_PADRAO);
    expect(alertas.slice(0, 2).map((a) => a.id).sort()).toEqual(["R1:1", "R4:2"]);
    expect(alertas.slice(0, 2).every((a) => a.gravidade === "alta")).toBe(true);
  });
  it("todo alerta traz o cálculo e só ações que são links", () => {
    const c = contexto({
      dividas: [divida({ situacao: "em_atraso", diasAtraso: 120, parcelasAtrasadas: 4, atrasoCentavos: 200_000, taxaMensalPct: 9, informadoEm: "2026-01-01" })],
      faturasVencidas: [{ cartaoId: 1, cartao: "X", rotulo: "out/2026", vencimento: "2026-11-01", valorCentavos: 400_000 }],
      parcelasDoMesCentavos: 400_000,
      caixa: { saldoCentavos: 0, parcelasAteProximoMesCentavos: 900_000 },
    });
    const alertas = calcularAlertas(c, LIMITES_PADRAO);
    expect(alertas.length).toBeGreaterThan(5);
    for (const a of alertas) {
      expect(a.calculo.length).toBeGreaterThan(0);
      if (a.acao) expect(a.acao.href.startsWith("/")).toBe(true);
    }
  });
});

describe("Dispensar e Lembrar em 7 dias", () => {
  const alerta = calcularAlertas(contexto({ dividas: [divida({ situacao: "em_atraso", diasAtraso: 20, parcelasAtrasadas: 1, atrasoCentavos: 50_000 })] }), LIMITES_PADRAO)[0];
  it("dispensar esconde para sempre", () => {
    const estado = atualizarEstadoAlertas({}, alerta.id, "dispensar", HOJE);
    expect(filtrarPorEstado([alerta], estado, "2027-06-01").escondidos).toHaveLength(1);
  });
  it("lembrar em 7 dias esconde até o oitavo dia", () => {
    expect(dataDoLembrete(HOJE)).toBe("2026-12-03");
    const estado = atualizarEstadoAlertas({}, alerta.id, "lembrar", HOJE);
    expect(filtrarPorEstado([alerta], estado, "2026-12-02").escondidos).toHaveLength(1);
    expect(filtrarPorEstado([alerta], estado, "2026-12-03").visiveis).toHaveLength(1);
  });
  it("restaurar traz o alerta de volta e adiamentos vencidos saem do estado", () => {
    const estado = atualizarEstadoAlertas({ "R9:1": { ate: "2026-01-01" }, [alerta.id]: { dispensado: true } }, alerta.id, "restaurar", HOJE);
    expect(estado).toEqual({});
  });
  it("lê só o que está no formato certo", () => {
    expect(lerEstadoAlertas({ "R1:3": { dispensado: true }, "R2": { ate: "2026-12-01" }, lixo: { dispensado: true }, "R4:1": { ate: "amanhã" } })).toEqual({ "R1:3": { dispensado: true }, R2: { ate: "2026-12-01" } });
    expect(lerEstadoAlertas(null)).toEqual({});
  });
});

const plano = (extra: Partial<PlanoParaConsultor> = {}): PlanoParaConsultor => ({
  id: 3,
  nome: "Plano 2027",
  versao: 1,
  mesAnterior: { mes: "2026-10", planejadoCentavos: 120_000, realizadoCentavos: 120_000, situacao: "cumprido" },
  mesFinalPlanejado: "2027-06",
  previsaoMesFinal: "2027-06",
  ajustePendente: false,
  desvios: [],
  deficitCentavos: 0,
  ajusteRecomendado: null,
  novasDividas: [],
  comprasParceladas: [],
  ...extra,
});

describe("R9: plano com o mês anterior abaixo do planejado", () => {
  it("dispara com mês parcial ou não cumprido, mostrando o cálculo", () => {
    const [a] = regraR9(contexto({ plano: plano({ mesAnterior: { mes: "2026-10", planejadoCentavos: 120_000, realizadoCentavos: 70_000, situacao: "parcial" } }) }));
    expect(a.regra).toBe("R9");
    expect(a.gravidade).toBe("atencao");
    expect(a.texto).toContain("R$ 500,00");
    expect(a.calculo.join(" ")).toContain("R$ 1.200,00 − R$ 700,00");
    expect(regraR9(contexto({ plano: plano({ mesAnterior: { mes: "2026-10", planejadoCentavos: 120_000, realizadoCentavos: 0, situacao: "nao_cumprido" } }) }))).toHaveLength(1);
  });
  it("não dispara com o mês cumprido, sem plano ou sem mês fechado", () => {
    expect(regraR9(contexto({ plano: plano() }))).toEqual([]);
    expect(regraR9(contexto())).toEqual([]);
    expect(regraR9(contexto({ plano: plano({ mesAnterior: null }) }))).toEqual([]);
  });
  it("só entra em calcularAlertas quando a regra está ligada", () => {
    const c = contexto({ plano: plano({ mesAnterior: { mes: "2026-10", planejadoCentavos: 120_000, realizadoCentavos: 0, situacao: "nao_cumprido" } }) });
    expect(calcularAlertas(c, LIMITES_PADRAO).some((a) => a.regra === "R9")).toBe(true);
    expect(calcularAlertas(c, LIMITES_PADRAO, ["R9"]).some((a) => a.regra === "R9")).toBe(false);
  });
});

describe("R10: dívida nova ou compra parcelada depois do plano", () => {
  it("dispara para dívida nova e para compra parcelada grande", () => {
    const alertas = regraR10(contexto({ plano: plano({ novasDividas: [{ id: 8, descricao: "Cheque especial", saldoCentavos: 80_000 }], comprasParceladas: [{ parcelamentoId: 5, descricao: "Geladeira", totalCentavos: 360_000, parcelas: 12, parcelaCentavos: 30_000 }] }) }));
    expect(alertas.map((a) => a.id)).toEqual(["R10:d8", "R10:c5"]);
    expect(alertas[1].texto).toContain("12×");
  });
  it("não dispara sem plano ou sem novidade", () => {
    expect(regraR10(contexto())).toEqual([]);
    expect(regraR10(contexto({ plano: plano() }))).toEqual([]);
  });
  it("o estado de Dispensar aceita o id da regra", () => {
    expect(lerEstadoAlertas({ "R10:c5": { dispensado: true }, "R9:3": { ate: "2026-12-01" } })).toEqual({ "R10:c5": { dispensado: true }, "R9:3": { ate: "2026-12-01" } });
  });
});
