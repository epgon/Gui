import { describe, expect, it } from "vitest";
import { aplicarVariaveis, ehDiaUtil, ehOcorrencia, ocorrencias, primeiraOcorrencia, proximoDiaUtil, rotuloDia, valorDaOcorrencia, type RegraDatas } from "./regras";

const FERIADOS = [
  { dia: 1, mes: 1, ano: null },
  { dia: 21, mes: 4, ano: null },
  { dia: 25, mes: 12, ano: null },
];

const aluguel: RegraDatas = { intervalo: "mensal", intervaloDias: null, diaFixo: 23, dataInicio: "2026-11-23", repeticoes: null, dataFim: null, apenasDiaUtil: false };

describe("ocorrências", () => {
  it("aluguel todo dia 23 aparece em todos os meses, sem fim", () => {
    const o = ocorrencias(aluguel, FERIADOS, "2027-11-30");
    expect(o).toHaveLength(13);
    expect(o[0]).toEqual({ numero: 1, data: "2026-11-23", vencimento: "2026-11-23" });
    expect(o[1].data).toBe("2026-12-23");
    expect(o[12].data).toBe("2027-11-23");
  });

  it("Início depois do Dia Fixo começa no mês seguinte", () => {
    expect(primeiraOcorrencia({ intervalo: "mensal", diaFixo: 10, dataInicio: "2026-11-24" })).toBe("2026-12-10");
    expect(primeiraOcorrencia({ intervalo: "mensal", diaFixo: 30, dataInicio: "2026-11-24" })).toBe("2026-11-30");
  });

  it("dia 31 vira o último dia nos meses curtos e volta a 31 depois", () => {
    const o = ocorrencias({ ...aluguel, diaFixo: 31, dataInicio: "2027-01-01" }, [], "2027-04-30");
    expect(o.map((x) => x.data)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("Repetições limita a quantidade", () => {
    expect(ocorrencias({ ...aluguel, repeticoes: 3 }, [], "2030-01-01")).toHaveLength(3);
  });

  it("Fim para na data de fim (inclusive)", () => {
    const o = ocorrencias({ ...aluguel, dataFim: "2027-02-23" }, [], "2030-01-01");
    expect(o.map((x) => x.data)).toEqual(["2026-11-23", "2026-12-23", "2027-01-23", "2027-02-23"]);
  });

  it("bimestral, trimestral, semestral e anual pulam os meses certos", () => {
    const datas = (intervalo: RegraDatas["intervalo"]) => ocorrencias({ ...aluguel, intervalo, repeticoes: 3 }, [], "2030-01-01").map((x) => x.data);
    expect(datas("bimestral")).toEqual(["2026-11-23", "2027-01-23", "2027-03-23"]);
    expect(datas("trimestral")).toEqual(["2026-11-23", "2027-02-23", "2027-05-23"]);
    expect(datas("semestral")).toEqual(["2026-11-23", "2027-05-23", "2027-11-23"]);
    expect(datas("anual")).toEqual(["2026-11-23", "2027-11-23", "2028-11-23"]);
  });

  it("semanal e livre contam a partir do Início", () => {
    const semanal = ocorrencias({ ...aluguel, intervalo: "semanal", dataInicio: "2026-11-24", repeticoes: 3 }, [], "2030-01-01");
    expect(semanal.map((x) => x.data)).toEqual(["2026-11-24", "2026-12-01", "2026-12-08"]);
    const livre = ocorrencias({ ...aluguel, intervalo: "livre", intervaloDias: 10, dataInicio: "2026-11-24", repeticoes: 3 }, [], "2030-01-01");
    expect(livre.map((x) => x.data)).toEqual(["2026-11-24", "2026-12-04", "2026-12-14"]);
  });

  it("filtra pelo período pedido (de / até)", () => {
    const o = ocorrencias(aluguel, [], "2027-01-31", "2027-01-01");
    expect(o).toEqual([{ numero: 3, data: "2027-01-23", vencimento: "2027-01-23" }]);
  });

  it("confere se uma data é ocorrência da regra", () => {
    expect(ehOcorrencia(aluguel, "2027-03-23")).toBe(true);
    expect(ehOcorrencia(aluguel, "2027-03-24")).toBe(false);
    expect(ehOcorrencia(aluguel, "2026-10-23")).toBe(false);
    expect(ehOcorrencia({ ...aluguel, repeticoes: 2 }, "2027-01-23")).toBe(false);
  });
});

describe("apenas dia útil", () => {
  it("sábado, domingo e feriado não são dias úteis", () => {
    expect(ehDiaUtil("2026-11-28", FERIADOS)).toBe(false); // sábado
    expect(ehDiaUtil("2026-11-29", FERIADOS)).toBe(false); // domingo
    expect(ehDiaUtil("2026-12-25", FERIADOS)).toBe(false); // Natal (sexta)
    expect(ehDiaUtil("2026-11-30", FERIADOS)).toBe(true); // segunda
  });

  it("passa para o próximo dia útil", () => {
    expect(proximoDiaUtil("2026-11-28", FERIADOS)).toBe("2026-11-30");
    expect(proximoDiaUtil("2026-12-25", FERIADOS)).toBe("2026-12-28"); // Natal na sexta: segunda
    expect(proximoDiaUtil("2027-01-01", FERIADOS)).toBe("2027-01-04"); // Ano Novo na sexta
  });

  it("vencimento muda, a data da ocorrência não", () => {
    const o = ocorrencias({ ...aluguel, diaFixo: 25, dataInicio: "2026-12-01", apenasDiaUtil: true, repeticoes: 2 }, FERIADOS, "2030-01-01");
    expect(o[0]).toEqual({ numero: 1, data: "2026-12-25", vencimento: "2026-12-28" });
    expect(o[1]).toEqual({ numero: 2, data: "2027-01-25", vencimento: "2027-01-25" });
  });

  it("feriado de um ano só vale naquele ano", () => {
    const f = [{ dia: 30, mes: 11, ano: 2026 }];
    expect(ehDiaUtil("2026-11-30", f)).toBe(false);
    expect(ehDiaUtil("2027-11-30", f)).toBe(true);
  });
});

describe("descrição e valor", () => {
  it("troca #mes# e #ano# pelo mês e ano do vencimento", () => {
    expect(aplicarVariaveis("Luz #mes#/#ano#", "2026-11-23")).toBe("Luz 11/2026");
    expect(aplicarVariaveis("Aluguel", "2026-11-23")).toBe("Aluguel");
  });

  it("média dos últimos N pagos, arredondada ao centavo", () => {
    expect(valorDaOcorrencia(10000, 0, [20000, 30000])).toBe(10000); // valor fixo
    expect(valorDaOcorrencia(10000, 1, [20000, 30000])).toBe(20000); // último
    expect(valorDaOcorrencia(10000, 3, [10000, 10000, 10001])).toBe(10000);
    expect(valorDaOcorrencia(10000, 2, [15050, 15051])).toBe(15051);
    expect(valorDaOcorrencia(10000, 3, [])).toBe(10000); // sem histórico, usa o valor informado
  });

  it("rótulo da coluna Dia", () => {
    expect(rotuloDia(aluguel)).toBe("Dia 23");
    expect(rotuloDia({ intervalo: "semanal", diaFixo: 1, dataInicio: "2026-11-24" })).toBe("Toda terça");
  });
});
