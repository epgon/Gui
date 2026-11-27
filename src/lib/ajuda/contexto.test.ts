import { describe, expect, it } from "vitest";
import { telaAjudaDoCaminho } from "./contexto";

describe("telaAjudaDoCaminho", () => {
  it("mapeia as abas de Gestão de Dívidas", () => {
    expect(telaAjudaDoCaminho("/gestao/dividas")).toBe("visao");
    expect(telaAjudaDoCaminho("/gestao/dividas/minhas")).toBe("minhas");
    expect(telaAjudaDoCaminho("/gestao/dividas/simulador/")).toBe("simulador");
    expect(telaAjudaDoCaminho("/gestao/dividas/plano?x=1")).toBe("plano");
  });
  it("devolve null fora das dívidas", () => {
    expect(telaAjudaDoCaminho("/financeiro/lancamentos")).toBeNull();
    expect(telaAjudaDoCaminho("/")).toBeNull();
  });
});
