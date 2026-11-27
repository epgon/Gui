import { describe, expect, it } from "vitest";
import { motivoParaNaoExcluirCartao, SEM_USO_CARTAO } from "./exclusao";

describe("motivoParaNaoExcluirCartao", () => {
  it("deixa excluir cartão sem uso", () => {
    expect(motivoParaNaoExcluirCartao()).toBeNull();
    expect(motivoParaNaoExcluirCartao(SEM_USO_CARTAO)).toBeNull();
  });

  it("não deixa excluir cartão com lançamentos", () => {
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, lancamentos: 1 })).toMatch(/Tem 1 lançamento\./);
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, lancamentos: 7 })).toMatch(/7 lançamentos.*inative/);
  });

  it("não deixa excluir cartão com faturas", () => {
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, faturas: 1 })).toMatch(/Tem 1 fatura\./);
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, faturas: 3 })).toMatch(/3 faturas/);
  });

  it("não deixa excluir cartão usado em recorrentes, regras ou importações em rascunho", () => {
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, recorrentes: 3 })).toMatch(/3 recorrentes/);
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, regras: 1 })).toMatch(/1 regra de importação/);
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, importacoes: 1 })).toMatch(/rascunho/);
  });

  it("lançamentos vêm antes dos outros motivos", () => {
    expect(motivoParaNaoExcluirCartao({ ...SEM_USO_CARTAO, lancamentos: 2, faturas: 1 })).toMatch(/lançamentos/);
  });
});
