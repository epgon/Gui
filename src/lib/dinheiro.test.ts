import { describe, expect, it } from "vitest";
import { mascararValor, normalizarValor } from "./dinheiro";

describe("máscara de valor", () => {
  it("agrupa milhares ao digitar", () => {
    expect(mascararValor("10000")).toBe("10.000");
    expect(mascararValor("1500,5")).toBe("1.500,5");
    expect(mascararValor("1.500,999")).toBe("1.500,99");
    expect(mascararValor(",5")).toBe("0,5");
    expect(mascararValor("")).toBe("");
  });
  it("aceita sinal só quando permitido", () => {
    expect(mascararValor("-2500", true)).toBe("-2.500");
    expect(mascararValor("-2500")).toBe("2.500");
  });
  it("completa os centavos ao sair do campo", () => {
    expect(normalizarValor("10.000")).toBe("10.000,00");
    expect(normalizarValor("-250,5")).toBe("-250,50");
    expect(normalizarValor("")).toBe("");
  });
});
