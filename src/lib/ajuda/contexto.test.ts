import { describe, expect, it } from "vitest";
import { telaAjudaDoCaminho, trilhaDoCaminho } from "./contexto";

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

describe("trilhaDoCaminho", () => {
  it("abas de dívidas", () => {
    expect(trilhaDoCaminho("/gestao/dividas")).toEqual(["Gestão", "Gestão de Dívidas"]);
    expect(trilhaDoCaminho("/gestao/dividas/minhas")).toEqual(["Gestão", "Gestão de Dívidas", "Minhas Dívidas"]);
  });
  it("itens do menu e das configurações", () => {
    expect(trilhaDoCaminho("/financeiro/agenda")).toEqual(["Financeiro", "Agenda"]);
    expect(trilhaDoCaminho("/configuracoes/parametros")).toEqual(["Configurações", "Parâmetros"]);
  });
  it("subtelas usam o prefixo mais longo", () => {
    expect(trilhaDoCaminho("/financeiro/importacoes/nova")).toEqual(["Financeiro", "Importações"]);
    expect(trilhaDoCaminho("/financeiro/importacoes/123")).toEqual(["Financeiro", "Importações"]);
  });
  it("início e desconhecidos", () => {
    expect(trilhaDoCaminho("/")).toEqual([]);
    expect(trilhaDoCaminho("/qualquer/coisa")).toEqual([]);
  });
});
