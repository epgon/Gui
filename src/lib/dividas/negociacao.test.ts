import { describe, expect, it } from "vitest";
import {
  analisarProposta,
  gerarParcelasAcordo,
  jurosImplicitosMensais,
  negociacaoAberta,
  planejarRenegociacao,
  podeDesfazerRenegociacao,
  totalDoAcordo,
  validarCondicoes,
  validarRenegociacao,
  type CondicoesRenegociacao,
  type DividaOriginal,
} from "./negociacao";

const cond = (extra: Partial<CondicoesRenegociacao> = {}): CondicoesRenegociacao => ({
  entradaCentavos: 0,
  dataEntrada: null,
  parcelas: 10,
  valorParcelaCentavos: 19_800,
  primeiroVencimento: "2027-01-10",
  periodicidade: "mensal",
  ...extra,
});

const lanc = (id: number, valorCentavos: number, vencimento: string, dataPagamento: string | null = null) => ({ id, descricao: `Parcela ${id}`, vencimento, valorCentavos, dataPagamento });

describe("juros implícitos da proposta", () => {
  it("R$ 1.000,00 em 12 × R$ 88,85 dá cerca de 1% ao mês (tabela Price)", () => {
    expect(jurosImplicitosMensais(100_000, 12, 8_885)).toBeCloseTo(1, 2);
  });
  it("R$ 10.000,00 em 24 × R$ 528,71 dá cerca de 2% ao mês", () => {
    expect(jurosImplicitosMensais(1_000_000, 24, 52_871)).toBeCloseTo(2, 2);
  });
  it("parcelas que somam o financiado não têm juros (0%)", () => {
    expect(jurosImplicitosMensais(120_000, 12, 10_000)).toBe(0);
  });
  it("parcelas que somam menos que o financiado são desconto, sem taxa", () => {
    expect(jurosImplicitosMensais(100_000, 10, 8_000)).toBeNull();
  });
  it("sem parcelas ou sem nada a financiar não há taxa", () => {
    expect(jurosImplicitosMensais(100_000, 0, 0)).toBeNull();
    expect(jurosImplicitosMensais(0, 12, 1_000)).toBeNull();
  });
});

describe("análise da proposta", () => {
  it("à vista com desconto: mostra quanto sai do saldo e a porcentagem", () => {
    const a = analisarProposta({ saldoCentavos: 500_000, entradaCentavos: 300_000, parcelas: 0, valorParcelaCentavos: 0, sobraMensalCentavos: null });
    expect(a.totalCentavos).toBe(300_000);
    expect(a.descontoCentavos).toBe(200_000);
    expect(a.descontoPct).toBe(40);
    expect(a.maisCaro).toBe(false);
    expect(a.jurosImplicitosMensal).toBeNull();
    expect(a.cabeNaSobra).toBeNull();
  });
  it("parcelado com entrada: os juros implícitos usam só o que foi financiado", () => {
    const a = analisarProposta({ saldoCentavos: 110_000, entradaCentavos: 10_000, parcelas: 12, valorParcelaCentavos: 8_885, sobraMensalCentavos: 10_000 });
    expect(a.jurosImplicitosMensal).toBeCloseTo(1, 2);
    expect(a.totalCentavos).toBe(10_000 + 12 * 8_885);
    expect(a.maisCaro).toBe(true);
    expect(a.acrescimoCentavos).toBe(6_620);
    expect(a.cabeNaSobra).toBe(true);
    expect(a.folgaCentavos).toBe(1_115);
  });
  it("proposta mais cara que o saldo e parcela que não cabe na sobra", () => {
    const a = analisarProposta({ saldoCentavos: 100_000, entradaCentavos: 0, parcelas: 10, valorParcelaCentavos: 12_000, sobraMensalCentavos: 10_000 });
    expect(a.maisCaro).toBe(true);
    expect(a.acrescimoCentavos).toBe(20_000);
    expect(a.descontoCentavos).toBe(0);
    expect(a.cabeNaSobra).toBe(false);
    expect(a.folgaCentavos).toBe(-2_000);
  });
  it("valida as condições", () => {
    expect(validarCondicoes({ entradaCentavos: 0, parcelas: 0, valorParcelaCentavos: 0 })).not.toBeNull();
    expect(validarCondicoes({ entradaCentavos: 0, parcelas: 3, valorParcelaCentavos: 0 })).not.toBeNull();
    expect(validarCondicoes({ entradaCentavos: 0, parcelas: 0, valorParcelaCentavos: 500 })).not.toBeNull();
    expect(validarCondicoes({ entradaCentavos: 0, parcelas: 361, valorParcelaCentavos: 500 })).not.toBeNull();
    expect(validarCondicoes({ entradaCentavos: 10_000, parcelas: 0, valorParcelaCentavos: 0 })).toBeNull();
    expect(validarCondicoes({ entradaCentavos: 0, parcelas: 12, valorParcelaCentavos: 8_885 })).toBeNull();
  });
  it("só as negociações em andamento, com proposta ou aguardando deixam a dívida em negociação", () => {
    expect(negociacaoAberta("em_andamento")).toBe(true);
    expect(negociacaoAberta("proposta_recebida")).toBe(true);
    expect(negociacaoAberta("aguardando_resposta")).toBe(true);
    expect(negociacaoAberta("aceita")).toBe(false);
    expect(negociacaoAberta("recusada")).toBe(false);
    expect(negociacaoAberta("desistida")).toBe(false);
  });
});

describe("parcelas do acordo", () => {
  it("10 parcelas mensais sem entrada", () => {
    const p = gerarParcelasAcordo("Acordo Banco X", cond());
    expect(p).toHaveLength(10);
    expect(p[0]).toMatchObject({ numero: 1, total: 10, data: "2027-01-10", valorCentavos: 19_800, descricao: "Acordo Banco X 1/10" });
    expect(p[9]).toMatchObject({ numero: 10, data: "2027-10-10" });
    expect(p.reduce((s, x) => s + x.valorCentavos, 0)).toBe(totalDoAcordo(cond()));
  });
  it("a entrada é a parcela 1 e as outras seguem", () => {
    const p = gerarParcelasAcordo("Acordo", cond({ entradaCentavos: 50_000, dataEntrada: "2026-12-05", parcelas: 3, valorParcelaCentavos: 10_000 }));
    expect(p.map((x) => [x.numero, x.total, x.valorCentavos, x.data])).toEqual([
      [1, 4, 50_000, "2026-12-05"],
      [2, 4, 10_000, "2027-01-10"],
      [3, 4, 10_000, "2027-02-10"],
      [4, 4, 10_000, "2027-03-10"],
    ]);
    expect(p[0].descricao).toBe("Acordo 1/4 (entrada)");
  });
  it("acordo à vista é só a entrada", () => {
    const p = gerarParcelasAcordo("Acordo", cond({ entradaCentavos: 300_000, dataEntrada: "2026-12-05", parcelas: 0, valorParcelaCentavos: 0, primeiroVencimento: null }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ entrada: true, valorCentavos: 300_000, total: 1 });
  });
  it("respeita a periodicidade", () => {
    const p = gerarParcelasAcordo("A", cond({ parcelas: 3, periodicidade: "trimestral" }));
    expect(p.map((x) => x.data)).toEqual(["2027-01-10", "2027-04-10", "2027-07-10"]);
  });
});

describe("renegociação de duas dívidas num acordo", () => {
  const dividaA: DividaOriginal = {
    id: 1,
    descricao: "Empréstimo X",
    saldoCentavos: 231_000,
    lancamentos: [lanc(1, 33_000, "2026-06-10", "2026-06-10"), lanc(2, 33_000, "2026-07-10", "2026-07-10"), ...[3, 4, 5, 6, 7, 8, 9].map((n) => lanc(n, 33_000, `2026-${String(n + 4).padStart(2, "0")}-10`))],
  };
  const dividaB: DividaOriginal = { id: 2, descricao: "Cartão Y", saldoCentavos: 90_000, lancamentos: [lanc(20, 45_000, "2026-12-01"), lanc(21, 45_000, "2027-01-01")] };

  it("parcelas pagas ficam intactas e só as não pagas saem", () => {
    const plano = planejarRenegociacao({ originais: [dividaA, dividaB], condicoes: cond(), descricaoAcordo: "Acordo X e Y" });
    expect(plano.retiradas).toHaveLength(9);
    expect(plano.retiradas.every((x) => x.dataPagamento === null)).toBe(true);
    expect(plano.mantidas.map((x) => x.id)).toEqual([1, 2]);
    expect(plano.totalRetiradoCentavos).toBe(7 * 33_000 + 90_000);
    expect(plano.retiradas.filter((x) => x.dividaId === 1)).toHaveLength(7);
  });
  it("o Saldo Previsto não conta em dobro: depois só vale o acordo", () => {
    const plano = planejarRenegociacao({ originais: [dividaA, dividaB], condicoes: cond(), descricaoAcordo: "Acordo X e Y" });
    expect(plano.abertoAntesCentavos).toBe(321_000);
    expect(plano.abertoDepoisCentavos).toBe(198_000);
    expect(plano.parcelasAcordo).toHaveLength(10);
    expect(plano.totalAcordoCentavos).toBe(198_000);
    expect(plano.saldoOriginaisCentavos).toBe(321_000);
    expect(plano.diferencaCentavos).toBe(-123_000);
  });
  it("a revisão descreve o que vai acontecer", () => {
    const plano = planejarRenegociacao({ originais: [dividaA], condicoes: cond(), descricaoAcordo: "Acordo X" });
    expect(plano.frases[0]).toBe("As 7 parcelas não pagas da dívida Empréstimo X (R$ 2.310,00) saem de Lançamentos.");
    expect(plano.frases[1]).toBe("O acordo cria 10 parcelas de R$ 198,00 a partir de 10/01/2027, no total de R$ 1.980,00.");
    expect(plano.avisos).toHaveLength(0);
  });
  it("avisa quando o acordo sai mais caro e quando a parcela não cabe na sobra", () => {
    const plano = planejarRenegociacao({ originais: [dividaB], condicoes: cond({ parcelas: 10, valorParcelaCentavos: 12_000 }), descricaoAcordo: "A", sobraMensalCentavos: 10_000 });
    expect(plano.avisos.some((a) => a.includes("a mais que o saldo"))).toBe(true);
    expect(plano.avisos.some((a) => a.includes("sobra mensal"))).toBe(true);
  });
  it("dívida sem lançamentos em aberto passa o saldo para o acordo", () => {
    const sem: DividaOriginal = { id: 3, descricao: "Pessoa Z", saldoCentavos: 50_000, lancamentos: [] };
    const plano = planejarRenegociacao({ originais: [sem], condicoes: cond(), descricaoAcordo: "A" });
    expect(plano.retiradas).toHaveLength(0);
    expect(plano.frases[0]).toContain("não tem parcelas em aberto");
    expect(plano.avisos.some((a) => a.includes("Nenhum lançamento sai"))).toBe(true);
  });
  it("só junta dívidas ativas do mesmo credor", () => {
    expect(validarRenegociacao({ originais: [], condicoes: cond() })).not.toBeNull();
    expect(validarRenegociacao({ originais: [{ id: 1, contatoId: 1, ativa: true, descricao: "A" }, { id: 2, contatoId: 2, ativa: true, descricao: "B" }], condicoes: cond() })).toContain("mesmo credor");
    expect(validarRenegociacao({ originais: [{ id: 1, contatoId: 1, ativa: false, descricao: "A" }], condicoes: cond() })).toContain("não está ativa");
    expect(validarRenegociacao({ originais: [{ id: 1, contatoId: 1, ativa: true, descricao: "A" }], condicoes: cond({ primeiroVencimento: null }) })).toContain("Primeiro Vencimento");
    expect(validarRenegociacao({ originais: [{ id: 1, contatoId: 1, ativa: true, descricao: "A" }], condicoes: cond({ entradaCentavos: 1_000, dataEntrada: null }) })).toContain("Entrada");
    expect(validarRenegociacao({ originais: [{ id: 1, contatoId: 1, ativa: true, descricao: "A" }, { id: 2, contatoId: 1, ativa: true, descricao: "B" }], condicoes: cond() })).toBeNull();
  });
});

describe("desfazer renegociação", () => {
  it("pode enquanto o acordo está ativo e sem pagamento", () => {
    expect(podeDesfazerRenegociacao({ acordoSituacao: "ativa", lancamentosAcordo: [{ dataPagamento: null }, { dataPagamento: null }] })).toEqual({ ok: true });
  });
  it("recusa depois de um pagamento", () => {
    const r = podeDesfazerRenegociacao({ acordoSituacao: "ativa", lancamentosAcordo: [{ dataPagamento: "2027-01-10" }, { dataPagamento: null }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("1 pagamento");
  });
  it("recusa se o acordo já foi quitado, cancelado ou renegociado", () => {
    for (const s of ["quitada", "cancelada", "renegociada"] as const) {
      expect(podeDesfazerRenegociacao({ acordoSituacao: s, lancamentosAcordo: [] }).ok).toBe(false);
    }
  });
});
