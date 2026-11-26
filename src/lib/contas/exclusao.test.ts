import { describe, expect, it } from "vitest";
import { motivoParaNaoExcluirConta, SEM_USO_CONTA } from "./exclusao";

describe("motivoParaNaoExcluirConta", () => {
  it("deixa excluir conta sem uso", () => {
    expect(motivoParaNaoExcluirConta()).toBeNull();
    expect(motivoParaNaoExcluirConta(SEM_USO_CONTA)).toBeNull();
  });

  it("não deixa excluir conta com lançamentos", () => {
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, lancamentos: 1 })).toMatch(/Tem 1 lançamento\./);
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, lancamentos: 7 })).toMatch(/7 lançamentos.*inative/);
  });

  it("não deixa excluir conta de pagamento de cartão", () => {
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, cartoes: 1 })).toMatch(/1 cartão de crédito\. Troque a conta nele/);
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, cartoes: 2 })).toMatch(/2 cartões de crédito/);
  });

  it("não deixa excluir conta usada em recorrentes, regras ou importações em rascunho", () => {
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, recorrentes: 3 })).toMatch(/3 recorrentes/);
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, regras: 1 })).toMatch(/1 regra de importação/);
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, importacoes: 1 })).toMatch(/rascunho/);
  });

  it("lançamentos vêm antes dos outros motivos", () => {
    expect(motivoParaNaoExcluirConta({ ...SEM_USO_CONTA, lancamentos: 2, cartoes: 1 })).toMatch(/lançamentos/);
  });
});
