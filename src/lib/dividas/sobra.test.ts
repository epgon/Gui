import { describe, expect, it } from "vitest";
import { colunasDoPeriodo, montarFluxoDeCaixa, type Movimento } from "@/lib/relatorios/regras";
import { calcularSobra, periodoDaSobra, semDividas } from "./sobra";

const mov = (data: string, valorCentavos: number, extra: Partial<Movimento> = {}): Movimento => ({
  data,
  valorCentavos,
  especial: null,
  categoriaId: null,
  contaId: 1,
  cartaoId: null,
  contatoId: null,
  formaId: null,
  tagIds: [],
  ...extra,
});

describe("período da sobra", () => {
  it("são os últimos meses fechados, sem o mês de hoje", () => {
    expect(periodoDaSobra("2026-11-26", 3)).toEqual({ inicio: "2026-08-01", fim: "2026-10-31" });
    expect(periodoDaSobra("2027-02-10", 3)).toEqual({ inicio: "2026-11-01", fim: "2027-01-31" });
    expect(periodoDaSobra("2024-03-01", 1)).toEqual({ inicio: "2024-02-01", fim: "2024-02-29" });
  });
});

describe("sobra mensal", () => {
  const movimentos: Movimento[] = [
    mov("2026-08-05", 500_000),
    mov("2026-08-10", -200_000),
    mov("2026-09-05", 500_000),
    mov("2026-09-12", -250_000),
    mov("2026-10-05", 500_000),
    mov("2026-10-20", -300_000),
    // Parcelas de dívida: ficam de fora.
    mov("2026-08-15", -100_000, { dividaId: 7 }),
    mov("2026-09-15", -100_000, { dividaId: 7 }),
    mov("2026-10-15", -100_000, { dividaId: 7 }),
    // Fora do período: não conta.
    mov("2026-11-02", -999_999),
  ];

  it("é a média de receitas − despesas, sem as parcelas de dívida", () => {
    const r = calcularSobra(movimentos, "2026-11-26", 3);
    expect(r.meses).toBe(3);
    expect(r.sobraMensalCentavos).toBe(Math.round((300_000 + 250_000 + 200_000) / 3));
    expect(r.despesaMediaCentavos).toBe(250_000);
  });

  it("bate com o Fluxo de Caixa do mesmo período (mesmas contas)", () => {
    const { inicio, fim } = periodoDaSobra("2026-11-26", 3);
    const fluxo = montarFluxoDeCaixa(
      movimentos.filter((m) => m.data >= inicio && m.data <= fim && !m.dividaId),
      "mensal",
      colunasDoPeriodo("mensal", inicio, fim),
      new Map(),
    );
    expect(calcularSobra(movimentos, "2026-11-26", 3).sobraMensalCentavos).toBe(fluxo.saldo.media);
    // Com as parcelas dentro, o Fluxo de Caixa comum daria menos: a diferença é só a dívida.
    const comDividas = montarFluxoDeCaixa(movimentos.filter((m) => m.data >= inicio && m.data <= fim), "mensal", colunasDoPeriodo("mensal", inicio, fim), new Map());
    expect(comDividas.saldo.media).toBe(fluxo.saldo.media - 100_000);
  });

  it("semDividas só tira o que tem dívida", () => {
    expect(semDividas(movimentos)).toHaveLength(movimentos.length - 3);
  });

  it("sem movimentos, sobra zero", () => {
    expect(calcularSobra([], "2026-11-26", 3)).toMatchObject({ sobraMensalCentavos: 0, despesaMediaCentavos: 0 });
  });
});
