import { describe, expect, it } from "vitest";
import { agruparPorDia, gradeDoMes, resumirDia } from "./regras";

const l = (valorCentavos: number, situacao: "realizado" | "a_vencer" | "vencido" = "a_vencer", data = "2026-11-10") => ({ data, valorCentavos, situacao });

describe("resumirDia", () => {
  it("dia vazio: total zero e 0% realizado", () => {
    expect(resumirDia([])).toEqual({ total: 0, receitas: 0, despesas: 0, quantidade: 0, percentual: 0 });
  });

  it("soma receitas e despesas e calcula o saldo do dia", () => {
    const r = resumirDia([l(500_00), l(-1_200_00), l(-316_63)]);
    expect(r.receitas).toBe(500_00);
    expect(r.despesas).toBe(1_516_63);
    expect(r.total).toBe(-1_016_63);
    expect(r.quantidade).toBe(3);
  });

  it("% Realizado considera o valor (sem sinal) do que já foi pago ou recebido", () => {
    // 100 pago de 1.000 de movimento = 10%
    expect(resumirDia([l(-100_00, "realizado"), l(-900_00, "vencido")]).percentual).toBe(10);
    // receita recebida também conta: 300 de 400 = 75%
    expect(resumirDia([l(300_00, "realizado"), l(-100_00)]).percentual).toBe(75);
  });

  it("só mostra 100% quando tudo foi realizado", () => {
    expect(resumirDia([l(-999_99, "realizado"), l(-1)]).percentual).toBe(99);
    expect(resumirDia([l(-50_00, "realizado"), l(80_00, "realizado")]).percentual).toBe(100);
  });
});

describe("agruparPorDia", () => {
  it("separa os lançamentos pela data, mantendo a ordem", () => {
    const a = l(1, "a_vencer", "2026-11-01");
    const b = l(2, "a_vencer", "2026-11-02");
    const c = l(3, "a_vencer", "2026-11-01");
    const m = agruparPorDia([a, b, c]);
    expect(m.get("2026-11-01")).toEqual([a, c]);
    expect(m.get("2026-11-02")).toEqual([b]);
    expect(m.get("2026-11-03")).toBeUndefined();
  });
});

describe("gradeDoMes", () => {
  it("novembro de 2026 começa no domingo e ocupa 5 semanas", () => {
    const g = gradeDoMes("2026-11");
    expect(g).toHaveLength(35);
    expect(g[0]).toBe("2026-11-01");
    expect(g[29]).toBe("2026-11-30");
    expect(g[34]).toBe("2026-12-05");
  });

  it("completa a primeira semana com os dias do mês anterior", () => {
    const g = gradeDoMes("2026-12"); // 1º de dezembro de 2026 é terça
    expect(g.slice(0, 3)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(g).toHaveLength(35);
  });

  it("fevereiro que começa no domingo cabe em 4 semanas", () => {
    const g = gradeDoMes("2026-02");
    expect(g).toHaveLength(28);
    expect(g[0]).toBe("2026-02-01");
    expect(g[27]).toBe("2026-02-28");
  });

  it("mês que pede 6 semanas", () => {
    const g = gradeDoMes("2026-08"); // 1º de agosto de 2026 é sábado
    expect(g).toHaveLength(42);
    expect(g[6]).toBe("2026-08-01");
  });
});
