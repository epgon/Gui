import { describe, expect, it } from "vitest";
import type { OpcaoCategoria } from "@/lib/lancamentos/tipos";
import { filtrarCategorias } from "./seletor-categoria";

const c = (id: number, rotulo: string, nivel: number): OpcaoCategoria => ({ id, rotulo, nivel, cor: "#000", natureza: "despesa", ativo: true });
const lista = [c(1, "1. Moradia", 1), c(2, "1.1. Aluguel", 2), c(3, "2. Alimentação", 1), c(4, "2.1. Mercado", 2), c(5, "2.2. Restaurante", 2)];

describe("filtrarCategorias", () => {
  it("sem busca devolve tudo", () => {
    expect(filtrarCategorias(lista, "  ")).toHaveLength(5);
  });
  it("ignora acento e maiúscula e mantém o pai da filha que combina", () => {
    const r = filtrarCategorias(lista, "ALIMENTACAO");
    expect(r.map((x) => x.c.id)).toEqual([3]);
    const f = filtrarCategorias(lista, "merc");
    expect(f.map((x) => [x.c.id, x.combina])).toEqual([[3, false], [4, true]]);
  });
  it("busca por qualquer parte, inclusive a numeração", () => {
    expect(filtrarCategorias(lista, "2.2").map((x) => x.c.id)).toEqual([3, 5]);
  });
});
