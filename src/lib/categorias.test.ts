import { describe, expect, it } from "vitest";
import { motivoParaNaoExcluir, SEM_USO } from "./categorias";

describe("motivoParaNaoExcluir", () => {
  const comum = { especial: null, quantidadeFilhas: 0 };

  it("deixa excluir categoria sem filhas e sem uso", () => {
    expect(motivoParaNaoExcluir(comum)).toBeNull();
    expect(motivoParaNaoExcluir(comum, SEM_USO)).toBeNull();
  });

  it("não deixa excluir categoria especial", () => {
    expect(motivoParaNaoExcluir({ especial: "transferencia", quantidadeFilhas: 0 })).toMatch(/especial/);
  });

  it("não deixa excluir categoria pai", () => {
    expect(motivoParaNaoExcluir({ ...comum, quantidadeFilhas: 1 })).toMatch(/categoria pai \(tem 1 subcategoria\)/);
    expect(motivoParaNaoExcluir({ ...comum, quantidadeFilhas: 3 })).toMatch(/3 subcategorias/);
  });

  it("não deixa excluir categoria com lançamentos", () => {
    expect(motivoParaNaoExcluir(comum, { ...SEM_USO, lancamentos: 1 })).toMatch(/Tem 1 lançamento\./);
    expect(motivoParaNaoExcluir(comum, { ...SEM_USO, lancamentos: 12 })).toMatch(/12 lançamentos/);
  });

  it("não deixa excluir categoria usada em recorrentes, regras ou importações em rascunho", () => {
    expect(motivoParaNaoExcluir(comum, { ...SEM_USO, recorrentes: 2 })).toMatch(/2 recorrentes/);
    expect(motivoParaNaoExcluir(comum, { ...SEM_USO, regras: 1 })).toMatch(/1 regra de importação/);
    expect(motivoParaNaoExcluir(comum, { ...SEM_USO, importacoes: 4 })).toMatch(/rascunho/);
  });

  it("filhas vêm antes de lançamentos no motivo", () => {
    expect(motivoParaNaoExcluir({ ...comum, quantidadeFilhas: 2 }, { ...SEM_USO, lancamentos: 5 })).toMatch(/categoria pai/);
  });
});
