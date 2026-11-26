import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  analisarQuitacao,
  avisosDaSituacao,
  compararEstrategias,
  compararProposta,
  criarDividaHipotetica,
  destacarComparacao,
  fraseComparacao,
  indiceDoMes,
  montarDividaComParcelas,
  montarDividaSemParcelas,
  ordenarDividas,
  pagamentoParaQuitarEm,
  parcelaPrice,
  PERCENTUAIS_PADRAO,
  quitarComExtraMensal,
  reservaMinima,
  reservaUsavel,
  simular,
  simularPagamentoFixo,
  somarMesesYm,
  valoresDoCenario,
  type DividaSim,
} from "./simulador";

const INICIO = "2026-11";

/** Três dívidas de exemplo: um cartão sem parcelas (juros altos), um empréstimo e um financiamento com garantia. */
function exemplo(): DividaSim[] {
  const cartao = montarDividaSemParcelas({ id: "d1", nome: "Cartão", credor: "Banco A", taxaMensalPct: 10, saldoCentavos: 400_000, parcelaMinimaCentavos: 50_000, atrasoDias: 0, comGarantia: false });
  // Empréstimo: 6 parcelas de R$ 400, a primeira em dezembro, 3% ao mês, uma parcela vencida em novembro.
  const emprestimo = montarDividaComParcelas({
    id: "d2",
    nome: "Empréstimo",
    credor: "Banco B",
    taxaMensalPct: 3,
    abertas: ["2026-11-05", "2026-12-05", "2027-01-05", "2027-02-05", "2027-03-05", "2027-04-05"].map((v) => ({ vencimento: v, valorCentavos: 40_000, acrescimoCentavos: 0 })),
    inicioYm: INICIO,
    atrasoDias: 20,
    comGarantia: false,
  });
  const financiamento = montarDividaComParcelas({
    id: "d3",
    nome: "Financiamento",
    credor: "Banco C",
    taxaMensalPct: 1.5,
    abertas: Array.from({ length: 24 }, (_, k) => ({ vencimento: `${2026 + Math.floor((10 + k + 1) / 12)}-${String(((10 + k + 1) % 12) + 1).padStart(2, "0")}-10`, valorCentavos: 26_000, acrescimoCentavos: 0 })),
    inicioYm: INICIO,
    atrasoDias: 0,
    comGarantia: true,
  });
  return [cartao, emprestimo, financiamento];
}

const base = (extra: Partial<Parameters<typeof simular>[0]> = {}) => ({ dividas: exemplo(), estrategia: "avalanche" as const, valorMensalCentavos: 180_000, inicioYm: INICIO, ...extra });

describe("meses", () => {
  it("indexa a partir do mês de início e joga o atrasado no mês atual", () => {
    expect(indiceDoMes("2026-11", "2026-11")).toBe(0);
    expect(indiceDoMes("2026-11", "2027-02")).toBe(3);
    expect(indiceDoMes("2026-11", "2026-08")).toBe(0);
    expect(somarMesesYm("2026-11", 2)).toBe("2027-01");
  });
});

describe("montagem das dívidas", () => {
  it("parcelas fixas: saldo é o valor presente; sem taxa, é a soma", () => {
    const [, emprestimo] = exemplo();
    expect(emprestimo.saldoNominalCentavos).toBe(240_000);
    expect(emprestimo.saldoCentavos).toBeLessThan(emprestimo.saldoNominalCentavos);
    expect(emprestimo.cronograma).toEqual([40_000, 40_000, 40_000, 40_000, 40_000, 40_000]);
    const semTaxa = montarDividaComParcelas({ id: "x", nome: "x", credor: "y", taxaMensalPct: 0, abertas: [{ vencimento: "2027-01-01", valorCentavos: 10_000, acrescimoCentavos: 500 }], inicioYm: INICIO, atrasoDias: 0, comGarantia: false });
    expect(semTaxa.saldoCentavos).toBe(10_500);
  });

  it("o atraso estimado entra no mês atual", () => {
    const d = montarDividaComParcelas({ id: "x", nome: "x", credor: "y", taxaMensalPct: 0, abertas: [{ vencimento: "2026-10-01", valorCentavos: 10_000, acrescimoCentavos: 700 }, { vencimento: "2026-12-01", valorCentavos: 10_000, acrescimoCentavos: 0 }], inicioYm: INICIO, atrasoDias: 40, comGarantia: false });
    expect(d.cronograma).toEqual([10_700, 10_000]);
  });

  it("sem parcelas: o mínimo padrão são os juros do mês", () => {
    const d = montarDividaSemParcelas({ id: "x", nome: "x", credor: "y", taxaMensalPct: 10, saldoCentavos: 100_000, atrasoDias: 0, comGarantia: false });
    expect(d.parcelaMinimaCentavos).toBe(10_000);
  });
});

describe("sem pagamento extra a conta fecha com as parcelas", () => {
  it("empréstimo de parcelas fixas: total pago = soma das parcelas e acaba no último mês", () => {
    const [, emprestimo] = exemplo();
    const r = simular({ dividas: [emprestimo], estrategia: "avalanche", valorMensalCentavos: null, inicioYm: INICIO });
    expect(r.quitouTudo).toBe(true);
    expect(r.mesesAteQuitar).toBe(6);
    expect(r.mesFinal).toBe("2027-04");
    expect(Math.abs(r.totalPagoCentavos - 240_000)).toBeLessThanOrEqual(2);
    expect(r.totalJurosCentavos).toBe(r.totalPagoCentavos - emprestimo.saldoCentavos);
  });

  it("financiamento: acaba no mês da última parcela", () => {
    const [, , fin] = exemplo();
    const r = simular({ dividas: [fin], estrategia: "avalanche", valorMensalCentavos: null, inicioYm: INICIO });
    expect(r.quitouTudo).toBe(true);
    expect(r.mesesAteQuitar).toBe(25);
  });
});

describe("estratégias", () => {
  const d = exemplo();
  it("Bola de Neve: menor saldo primeiro", () => {
    expect(ordenarDividas("bola_de_neve", d)[0]).toBe("d2");
  });
  it("Avalanche: maior taxa primeiro", () => {
    expect(ordenarDividas("avalanche", d)).toEqual(["d1", "d2", "d3"]);
  });
  it("Risco primeiro: atraso mais antigo, depois garantia, taxa e saldo", () => {
    expect(ordenarDividas("risco", d)).toEqual(["d2", "d3", "d1"]);
  });
  it("Personalizada: a ordem da pessoa", () => {
    expect(ordenarDividas("personalizada", d, ["d3", "d1", "d2"])).toEqual(["d3", "d1", "d2"]);
  });

  it("todas quitam e a conta fecha: total pago = saldo inicial + juros", () => {
    const res = compararEstrategias({ ...base(), personalizada: ["d3", "d1", "d2"] });
    expect(res).toHaveLength(4);
    for (const { resultado: r } of res) {
      expect(r.quitouTudo).toBe(true);
      expect(r.totalPagoCentavos).toBe(r.saldoInicialCentavos + r.totalJurosCentavos);
      expect(r.meses.at(-1)!.saldoCentavos).toBe(0);
    }
  });

  it("a Avalanche paga menos juros que a Bola de Neve (o cartão é a dívida mais cara)", () => {
    const res = compararEstrategias(base());
    const por = Object.fromEntries(res.map((x) => [x.estrategia, x.resultado]));
    expect(por.avalanche.totalJurosCentavos).toBeLessThan(por.bola_de_neve.totalJurosCentavos);
    expect(destacarComparacao(res).menorJuros).toBe("avalanche");
    expect(por.avalanche.primeiraQuitada?.id).toBeDefined();
    expect(fraseComparacao(res)).toMatch(/^Com a Avalanche você termina em \w{3}\/\d{4} e paga R\$ [\d.,]+ a menos de juros que na /);
  });

  it("a Bola de Neve quita o primeiro credor antes", () => {
    const res = compararEstrategias(base());
    const por = Object.fromEntries(res.map((x) => [x.estrategia, x.resultado]));
    expect(por.bola_de_neve.primeiraQuitada!.indice).toBeLessThanOrEqual(por.avalanche.primeiraQuitada!.indice);
    expect(por.bola_de_neve.primeiraQuitada!.id).toBe("d2");
  });

  it("o valor das parcelas que acabam passa para a próxima dívida (bola de neve)", () => {
    const r = simular(base({ estrategia: "bola_de_neve" }));
    const mensal = r.meses.filter((m) => !r.meses.at(-1) || m.indice < r.meses.length - 1).map((m) => m.pagoCentavos);
    // Enquanto há dívida de sobra, o total pago por mês é sempre o valor mensal.
    expect(new Set(mensal.slice(0, -1))).toEqual(new Set([180_000]));
  });
});

describe("pagamento que não cobre os juros", () => {
  it("avisa e para em 360 meses", () => {
    const d = montarDividaSemParcelas({ id: "d1", nome: "Cheque especial", credor: "B", taxaMensalPct: 10, saldoCentavos: 1_000_000, parcelaMinimaCentavos: 50_000, atrasoDias: 0, comGarantia: false });
    const r = simular({ dividas: [d], estrategia: "avalanche", valorMensalCentavos: null, inicioYm: INICIO });
    expect(r.quitouTudo).toBe(false);
    expect(r.meses).toHaveLength(360);
    expect(r.mesesAteQuitar).toBeNull();
    expect(r.avisos.map((a) => a.tipo)).toContain("nao_quita");
    expect(r.avisos.map((a) => a.tipo)).toContain("nao_cobre_juros");
    expect(r.avisos[0].texto).toContain("30 anos");
  });

  it("valor mensal menor que as parcelas: avisa e paga as parcelas mesmo assim", () => {
    const r = simular(base({ valorMensalCentavos: 80_000 }));
    expect(r.avisos.map((a) => a.tipo)).toContain("valor_menor_parcelas");
    expect(r.meses[0].pagoCentavos).toBeGreaterThan(80_000);
  });
});

describe("extra pontual, reserva e hipotética", () => {
  it("extra pontual reduz juros e antecipa o fim", () => {
    const sem = simular(base());
    const com = simular(base({ extras: [{ indice: 2, valorCentavos: 100_000 }] }));
    expect(com.totalJurosCentavos).toBeLessThan(sem.totalJurosCentavos);
    expect(com.mesesAteQuitar!).toBeLessThanOrEqual(sem.mesesAteQuitar!);
    expect(com.meses[2].pagoCentavos).toBe(sem.meses[2].pagoCentavos + 100_000);
  });

  it("o extra nunca passa do saldo", () => {
    const [cartao] = exemplo();
    const r = simular({ dividas: [cartao], estrategia: "avalanche", valorMensalCentavos: null, extras: [{ indice: 0, valorCentavos: 99_999_999 }], inicioYm: INICIO });
    expect(r.mesesAteQuitar).toBe(1);
    expect(r.totalPagoCentavos).toBe(cartao.saldoCentavos);
    expect(r.totalJurosCentavos).toBe(0);
  });

  it("empréstimo hipotético para quitar o cartão: a Price fecha e o dinheiro entra como extra", () => {
    expect(parcelaPrice(100_000, 1, 12)).toBe(8885);
    const cartao = montarDividaSemParcelas({ id: "d1", nome: "Cartão", credor: "Banco A", taxaMensalPct: 10, saldoCentavos: 200_000, parcelaMinimaCentavos: 25_000, atrasoDias: 0, comGarantia: false });
    const h = criarDividaHipotetica({ id: "h1", nome: "Empréstimo novo", valorCentavos: 200_000, taxaMensalPct: 2, parcelas: 24 });
    expect(h.cronograma[0]).toBe(0);
    expect(h.cronograma).toHaveLength(25);
    const sem = simular({ dividas: [cartao], estrategia: "avalanche", valorMensalCentavos: 40_000, inicioYm: INICIO });
    const com = simular({ dividas: [cartao, h], estrategia: "avalanche", valorMensalCentavos: null, extras: [{ indice: 0, valorCentavos: 200_000 }], inicioYm: INICIO });
    expect(com.dividas.find((x) => x.id === "d1")!.quitadaEmIndice).toBe(0);
    expect(com.totalJurosCentavos).toBeLessThan(sem.totalJurosCentavos);
    expect(com.primeiraQuitada?.id).toBe("d1");
    // A hipotética não recebe extra e termina no fim das 24 parcelas.
    expect(com.mesesAteQuitar).toBe(25);
  });

  it("avisa mês negativo e reserva abaixo do mínimo", () => {
    const r = simular(base({ valorMensalCentavos: 180_000 }));
    const situacao = { sobraMensalCentavos: 100_000, despesaMediaCentavos: 300_000, reservaCentavos: 800_000, reservaMinimaCentavos: reservaMinima(300_000, 3) };
    expect(situacao.reservaMinimaCentavos).toBe(900_000);
    expect(reservaUsavel(situacao)).toBe(0);
    const avisos = avisosDaSituacao(r, situacao, { reservaUsadaCentavos: 200_000, extras: [], inicioYm: INICIO }).map((a) => a.tipo);
    expect(avisos).toContain("mes_negativo");
    expect(avisos).toContain("reserva_minima");
    const folgado = avisosDaSituacao(r, { ...situacao, sobraMensalCentavos: 500_000, reservaCentavos: 2_000_000 }, { reservaUsadaCentavos: 100_000, extras: [], inicioYm: INICIO });
    expect(folgado).toEqual([]);
  });
});

describe("cenários", () => {
  it("parcelas + percentual da sobra livre; o Acelerado usa a reserva acima do mínimo", () => {
    const p = { parcelasReferenciaCentavos: 100_000, sobraMensalCentavos: 300_000, percentuais: PERCENTUAIS_PADRAO, reservaUsavelCentavos: 250_000 };
    expect(valoresDoCenario("conservador", p)).toEqual({ valorMensalCentavos: 150_000, reservaUsadaCentavos: 0, extraMensalCentavos: 50_000 });
    expect(valoresDoCenario("intermediario", p)).toEqual({ valorMensalCentavos: 200_000, reservaUsadaCentavos: 0, extraMensalCentavos: 100_000 });
    expect(valoresDoCenario("acelerado", p)).toEqual({ valorMensalCentavos: 300_000, reservaUsadaCentavos: 250_000, extraMensalCentavos: 200_000 });
  });

  it("sobra menor que as parcelas: só as parcelas", () => {
    const p = { parcelasReferenciaCentavos: 100_000, sobraMensalCentavos: 50_000, percentuais: PERCENTUAIS_PADRAO, reservaUsavelCentavos: 0 };
    expect(valoresDoCenario("acelerado", p).valorMensalCentavos).toBe(100_000);
  });

  it("quanto mais acelerado, mais cedo termina e menos juros", () => {
    const ref = exemplo().reduce((s, d) => s + d.parcelaReferenciaCentavos, 0);
    const p = { parcelasReferenciaCentavos: ref, sobraMensalCentavos: ref + 150_000, percentuais: PERCENTUAIS_PADRAO, reservaUsavelCentavos: 100_000 };
    const rodar = (c: "conservador" | "intermediario" | "acelerado") => {
      const v = valoresDoCenario(c, p);
      return simular(base({ valorMensalCentavos: v.valorMensalCentavos, extras: v.reservaUsadaCentavos ? [{ indice: 0, valorCentavos: v.reservaUsadaCentavos }] : [] }));
    };
    const [c, i, a] = [rodar("conservador"), rodar("intermediario"), rodar("acelerado")];
    expect(a.mesesAteQuitar!).toBeLessThanOrEqual(i.mesesAteQuitar!);
    expect(i.mesesAteQuitar!).toBeLessThanOrEqual(c.mesesAteQuitar!);
    expect(a.totalJurosCentavos).toBeLessThan(c.totalJurosCentavos);
  });
});

describe("quitar uma dívida", () => {
  it("quitar hoje custa o valor presente e economiza os juros futuros", () => {
    const [, emprestimo] = exemplo();
    const a = analisarQuitacao(emprestimo, INICIO);
    expect(a.quitarHojeCentavos).toBe(emprestimo.saldoCentavos);
    expect(a.economiaHojeCentavos).toBeGreaterThan(0);
    expect(Math.abs(a.seguirComoEstaCentavos - 240_000)).toBeLessThanOrEqual(2);
  });

  it("R$ Y a mais por mês: termina antes e economiza juros", () => {
    const [, emprestimo] = exemplo();
    const q = quitarComExtraMensal(emprestimo, 20_000, INICIO);
    expect(q.mesesAntecipados!).toBeGreaterThan(0);
    expect(q.economiaJurosCentavos).toBeGreaterThan(0);
  });

  it("em N meses: o valor fixo achado acaba dentro do prazo", () => {
    const [cartao] = exemplo();
    const p = pagamentoParaQuitarEm(cartao, 12, INICIO);
    const r = simularPagamentoFixo(cartao, p, INICIO);
    expect(r.quitouTudo).toBe(true);
    expect(r.mesesAteQuitar!).toBeLessThanOrEqual(12);
    const menos = simularPagamentoFixo(cartao, p - 500, INICIO);
    expect(menos.mesesAteQuitar ?? 999).toBeGreaterThan(12);
  });
});

describe("proposta de negociação", () => {
  it("compara a proposta com continuar como está e com quitar com a reserva", () => {
    const [, emprestimo] = exemplo();
    const continuar = simular({ dividas: [emprestimo], estrategia: "avalanche", valorMensalCentavos: null, inicioYm: INICIO });
    const c = compararProposta({
      saldoCentavos: 240_000,
      proposta: { entradaCentavos: 20_000, parcelas: 8, valorParcelaCentavos: 20_000, primeiroVencimento: "2027-01-10" },
      continuar,
      inicioYm: INICIO,
      reservaCentavos: 300_000,
      reservaMinimaCentavos: 270_000,
      sobraMensalCentavos: 50_000,
    });
    expect(c.opcoes.map((o) => o.rotulo)).toEqual(["Aceitar a proposta", "Continuar como está", "Quitar hoje com a reserva"]);
    expect(c.opcoes[0].totalCentavos).toBe(180_000);
    expect(c.opcoes[0].diferencaSaldoCentavos).toBe(-60_000);
    expect(c.opcoes[0].fim).toBe("2027-08");
    expect(c.cabeNaSobra).toBe(true);
    expect(c.folgaCentavos).toBe(30_000);
    expect(c.quitarComReserva).toEqual({ possivel: true, deixaAbaixoDoMinimo: true, sobraDaReservaCentavos: 60_000 });
  });
});

describe("simular não altera nada", () => {
  it("não muda a entrada (cópia profunda igual antes e depois)", () => {
    const entrada = { ...base({ extras: [{ indice: 1, valorCentavos: 5000 }] }), personalizada: ["d3", "d1", "d2"] };
    const antes = JSON.stringify(entrada);
    simular(entrada);
    compararEstrategias(entrada);
    expect(JSON.stringify(entrada)).toBe(antes);
  });

  it("o módulo de contas não importa banco, servidor nem ações (só pode calcular)", () => {
    const fonte = readFileSync(path.join(__dirname, "simulador.ts"), "utf8");
    expect(fonte).not.toMatch(/from\s+["'](@\/db|server-only|drizzle-orm|next\/)/);
    expect(fonte).not.toMatch(/\b(insert|update|delete)\(/);
  });

  it("a gravação do simulador só toca a tabela simulacao", () => {
    const acoes = readFileSync(path.join(__dirname, "../../app/(sistema)/gestao/dividas/simulador/acoes.ts"), "utf8");
    const tabelasEscritas = [...acoes.matchAll(/\.(?:insert|update|delete)\(\s*(?:schema\.)?(\w+)\s*\)/g)].map((m) => m[1]);
    expect(tabelasEscritas.length).toBeGreaterThan(0);
    expect(new Set(tabelasEscritas)).toEqual(new Set(["simulacao"]));
  });
});
