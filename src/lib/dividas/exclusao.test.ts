import { describe, expect, it } from "vitest";
import { motivoParaNaoExcluirDivida, SEM_USO_DIVIDA } from "./exclusao";

describe("motivoParaNaoExcluirDivida", () => {
  it("deixa excluir dívida sem nenhum vínculo", () => {
    expect(motivoParaNaoExcluirDivida()).toBeNull();
    expect(motivoParaNaoExcluirDivida(SEM_USO_DIVIDA)).toBeNull();
  });

  it("não deixa excluir dívida com pagamento", () => {
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, pagamentos: 1 })).toMatch(/Tem 1 pagamento registrado\./);
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, pagamentos: 4 })).toMatch(/4 pagamentos registrados.*cancele/);
  });

  it("não deixa excluir dívida renegociada nem o acordo", () => {
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, renegociacao: "original" })).toMatch(/acordo/);
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, renegociacao: "acordo" })).toMatch(/Desfazer renegociação/);
  });

  it("não deixa excluir dívida em negociação ou plano de quitação", () => {
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, negociacoes: 1 })).toMatch(/1 negociação/);
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, negociacoes: 2 })).toMatch(/2 negociações/);
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, planos: 1 })).toMatch(/plano de quitação/);
  });

  it("pagamentos vêm antes dos outros motivos", () => {
    expect(motivoParaNaoExcluirDivida({ ...SEM_USO_DIVIDA, pagamentos: 2, negociacoes: 1 })).toMatch(/pagamentos/);
  });
});
