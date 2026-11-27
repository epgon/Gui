import { describe, expect, it } from "vitest";
import { montarArvore } from "@/lib/categorias";
import { gerarCsv, nomeArquivo, type Tabela } from "@/lib/exportacao/tabela";
import { categoriasZeradas, chaveDoPeriodo, colunasDoPeriodo, lerFiltrosRelatorio, lerInclusoes, lerIntervalo, montarFluxoDeCaixa, montarSaldoDetalhado, type Movimento, type Nomes } from "./regras";

const cat = (id: number, nome: string, pai: number | null, ordem: number, extra: Partial<{ cor: string; natureza: "receita" | "despesa"; especial: "acerto_saldo" | "transferencia" }> = {}) => ({
  id,
  nome,
  categoriaPaiId: pai,
  ordem,
  cor: extra.cor ?? null,
  natureza: extra.natureza ?? ("despesa" as const),
  especial: extra.especial ?? null,
  ativo: true,
  padraoSistema: true,
});

// 1. Receita > 1.1. Salário; 2. Moradia > 2.1. Aluguel; e a especial Transferência.
const arvore = new Map(
  montarArvore([
    cat(1, "Receita", null, 1, { cor: "#16A34A", natureza: "receita" }),
    cat(2, "Salário", 1, 1, { natureza: "receita" }),
    cat(3, "Moradia", null, 2, { cor: "#7C3AED" }),
    cat(4, "Aluguel", 3, 1),
    cat(9, "Transferência", null, 0, { especial: "transferencia" }),
  ]).map((c) => [c.id, c]),
);

const mov = (p: Partial<Movimento>): Movimento => ({
  data: "2026-11-10",
  valorCentavos: 0,
  especial: null,
  categoriaId: null,
  contaId: 1,
  cartaoId: null,
  contatoId: null,
  formaId: null,
  tagIds: [],
  ...p,
});

// O exemplo da especificação: 1.000,00 de receita em 12 parcelas (83,37 + 11 × 83,33) e aluguel de 1.200,00 por mês.
const exemplo: Movimento[] = [
  mov({ data: "2026-11-05", valorCentavos: 8337, categoriaId: 2 }),
  mov({ data: "2026-12-05", valorCentavos: 8333, categoriaId: 2 }),
  mov({ data: "2026-11-10", valorCentavos: -120000, categoriaId: 4 }),
  mov({ data: "2026-12-10", valorCentavos: -120000, categoriaId: 4 }),
];

describe("intervalo", () => {
  const hoje = "2026-11-24";
  it("usa o padrão de cada tipo", () => {
    expect(lerIntervalo("diario", "", "", hoje)).toMatchObject({ inicio: "2026-11-01", fim: "2026-11-30" });
    expect(lerIntervalo("mensal", "", "", hoje)).toMatchObject({ de: "2026-01", ate: "2026-12", inicio: "2026-01-01", fim: "2026-12-31" });
    expect(lerIntervalo("anual", "", "", hoje)).toMatchObject({ de: "2024", ate: "2026", inicio: "2024-01-01", fim: "2026-12-31" });
    expect(lerIntervalo("categoria", "", "", hoje)).toMatchObject({ inicio: "2026-11-01", fim: "2026-11-30" });
  });
  it("desinverte e respeita o limite", () => {
    expect(lerIntervalo("mensal", "2026-12", "2026-06", hoje)).toMatchObject({ de: "2026-06", ate: "2026-12" });
    expect(lerIntervalo("diario", "2026-01-01", "2026-12-31", hoje)).toMatchObject({ inicio: "2026-01-01", fim: "2026-03-03" });
    expect(lerIntervalo("mes", "2020-01", "2030-12", hoje)).toMatchObject({ de: "2020-01", ate: "2024-12" });
  });
  it("trimestral vai do início do primeiro trimestre ao fim do último", () => {
    expect(lerIntervalo("trimestral", "2026-05", "2027-02", hoje)).toMatchObject({ inicio: "2026-04-01", fim: "2027-03-31" });
  });
  it("aceita um só valor e descarta o inválido", () => {
    expect(lerIntervalo("dia", "2026-02-30", "x", hoje)).toMatchObject({ inicio: "2026-11-01", fim: "2026-11-30" });
    expect(lerIntervalo("ano", "2025", "", hoje)).toMatchObject({ inicio: "2025-01-01", fim: "2025-12-31" });
  });
  it("lê os filtros da URL", () => {
    const f = lerFiltrosRelatorio({ destino: "conta:3", situacao: "vencido", considerar: "compra", categoria: "4", acerto: "1", tag: "x" }, "mensal", hoje);
    // A engrenagem não vem mais da URL: fica gravada.
    expect(f).toMatchObject({ destino: "conta:3", situacao: "vencido", considerar: "compra", categoria: "4", tag: "", incluirAcerto: false, incluirTransferencia: false, incluirZeradas: false });
    const g = lerFiltrosRelatorio({}, "mensal", hoje, { zeradas: true, acerto: true, transferencia: false });
    expect(g).toMatchObject({ incluirZeradas: true, incluirAcerto: true, incluirTransferencia: false });
    expect(lerFiltrosRelatorio({ considerar: "outra", situacao: "x" }, "mensal", hoje)).toMatchObject({ considerar: "vencimento", situacao: "" });
  });
});

describe("colunas", () => {
  it("monta trimestres com o rótulo 4T.2026", () => {
    const c = colunasDoPeriodo("trimestral", "2026-04-01", "2027-03-31");
    expect(c.map((x) => x.rotulo)).toEqual(["2T.2026", "3T.2026", "4T.2026", "1T.2027"]);
    expect(c[2]).toMatchObject({ chave: "2026-T4", inicio: "2026-10-01", fim: "2026-12-31" });
    expect(chaveDoPeriodo("trimestral", "2026-11-24")).toBe("2026-T4");
  });
  it("meses e dias", () => {
    expect(colunasDoPeriodo("mensal", "2026-11-01", "2027-01-31").map((x) => x.rotulo)).toEqual(["Nov/2026", "Dez/2026", "Jan/2027"]);
    expect(colunasDoPeriodo("diario", "2026-11-29", "2026-12-01").map((x) => x.chave)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(colunasDoPeriodo("anual", "2024-01-01", "2026-12-31").map((x) => x.rotulo)).toEqual(["2024", "2025", "2026"]);
  });
});

describe("Fluxo de Caixa", () => {
  it("bate com o exemplo mensal da especificação", () => {
    const colunas = colunasDoPeriodo("mensal", "2026-11-01", "2026-12-31");
    const f = montarFluxoDeCaixa(exemplo, "mensal", colunas, arvore);
    expect(f.receitas.valores).toEqual([8337, 8333]);
    expect(f.despesas.valores).toEqual([-120000, -120000]);
    expect(f.saldo.valores).toEqual([-111663, -111667]);
    expect(f.saldo.total).toBe(-223330);
    expect(f.saldo.media).toBe(-111665);
  });
  it("no trimestral soma o trimestre inteiro (4T.2026 = 166,70 e -2.400,00)", () => {
    const colunas = colunasDoPeriodo("trimestral", "2026-10-01", "2026-12-31");
    const f = montarFluxoDeCaixa(exemplo, "trimestral", colunas, arvore);
    expect(f.receitas.valores).toEqual([16670]);
    expect(f.despesas.valores).toEqual([-240000]);
  });
  it("abre por categoria: raiz com as filhas, na ordem da árvore", () => {
    const colunas = colunasDoPeriodo("mensal", "2026-11-01", "2026-11-30");
    const f = montarFluxoDeCaixa([...exemplo, mov({ valorCentavos: -500, categoriaId: 3 }), mov({ valorCentavos: -100 })], "mensal", colunas, arvore);
    expect(f.despesas.filhos.map((n) => n.rotulo)).toEqual(["2. Moradia", "Sem categoria"]);
    const moradia = f.despesas.filhos[0];
    expect(moradia.total).toBe(-120500);
    expect(moradia.filhos).toHaveLength(1);
    expect(moradia.filhos[0]).toMatchObject({ rotulo: "2.1. Aluguel", total: -120000, nivel: 2, cor: "#7C3AED" });
    expect(f.receitas.filhos[0].filhos[0].rotulo).toBe("1.1. Salário");
  });
  it("transferência aparece na categoria especial", () => {
    const colunas = colunasDoPeriodo("mensal", "2026-11-01", "2026-11-30");
    const f = montarFluxoDeCaixa([mov({ valorCentavos: -1000, categoriaId: 9, especial: "transferencia" }), mov({ valorCentavos: 1000, categoriaId: 9, especial: "transferencia" })], "mensal", colunas, arvore);
    expect(f.saldo.total).toBe(0);
    expect(f.receitas.filhos[0].rotulo).toBe("Transferência");
  });
  it("Categorias Zeradas: mostra as categorias sem valor, cada uma do lado da sua natureza", () => {
    const colunas = colunasDoPeriodo("mensal", "2026-11-01", "2026-12-31");
    const f = montarFluxoDeCaixa([mov({ valorCentavos: -5000, categoriaId: 4 })], "mensal", colunas, arvore, categoriasZeradas(arvore));
    expect(f.receitas.total).toBe(0);
    expect(f.receitas.filhos.map((n) => [n.rotulo, n.total, n.filhos.map((x) => x.rotulo)])).toEqual([["1. Receita", 0, ["1.1. Salário"]]]);
    expect(f.despesas.filhos.map((n) => [n.rotulo, n.total])).toEqual([["2. Moradia", -5000]]);
    expect(f.despesas.filhos[0].filhos[0]).toMatchObject({ rotulo: "2.1. Aluguel", valores: [-5000, 0], total: -5000 });
  });
  it("Categorias Zeradas: sem as especiais e as inativas; com filtro, só a categoria e as filhas", () => {
    expect(categoriasZeradas(arvore).map((c) => c.id)).toEqual([1, 2, 3, 4]);
    expect(categoriasZeradas(arvore, "3").map((c) => c.id)).toEqual([3, 4]);
    const comInativa = new Map(montarArvore([cat(1, "Receita", null, 1, { natureza: "receita" }), { ...cat(2, "Velha", null, 2), ativo: false }]).map((c) => [c.id, c]));
    expect(categoriasZeradas(comInativa).map((c) => c.id)).toEqual([1]);
  });
  it("ignora o que cai fora das colunas", () => {
    const colunas = colunasDoPeriodo("mensal", "2026-11-01", "2026-11-30");
    expect(montarFluxoDeCaixa(exemplo, "mensal", colunas, arvore).receitas.total).toBe(8337);
  });
});

describe("Saldo Detalhado", () => {
  const nomes: Nomes = {
    arvore,
    contas: new Map([[1, "Bradesco"]]),
    cartoes: new Map([[5, "Nubank"]]),
    contatos: new Map([[7, "Sr. João"]]),
    formas: new Map([[8, "Boleto Bancário"]]),
    tags: new Map([
      [11, "Casa"],
      [12, "Teste"],
    ]),
  };
  const nov = { inicio: "2026-11-01", fim: "2026-11-30" };

  it("por categoria, com o Total do Período igual à lista de lançamentos", () => {
    const s = montarSaldoDetalhado(exemplo, "categoria", nomes, nov);
    expect(s.linhas.map((l) => l.rotulo)).toEqual(["1.1. Salário", "2.1. Aluguel"]);
    expect(s.total).toEqual({ receitas: 8337, despesas: -120000, resultado: -111663 });
  });
  it("por categoria, com Categorias Zeradas, lista também as sem valor", () => {
    const s = montarSaldoDetalhado(exemplo, "categoria", nomes, nov, categoriasZeradas(arvore));
    expect(s.linhas.map((l) => [l.rotulo, l.resultado])).toEqual([
      ["1. Receita", 0],
      ["1.1. Salário", 8337],
      ["2. Moradia", 0],
      ["2.1. Aluguel", -120000],
    ]);
    expect(s.total).toEqual({ receitas: 8337, despesas: -120000, resultado: -111663 });
  });
  it("por mês mostra todos os meses do intervalo, mesmo zerados", () => {
    const s = montarSaldoDetalhado(exemplo, "mes", nomes, { inicio: "2026-10-01", fim: "2026-12-31" });
    expect(s.linhas.map((l) => [l.rotulo, l.resultado])).toEqual([
      ["10/2026", 0],
      ["11/2026", -111663],
      ["12/2026", -111667],
    ]);
  });
  it("por conta separa contas e cartões; por contato junta os sem contato no fim", () => {
    const movs = [mov({ valorCentavos: -300, contatoId: 7 }), mov({ valorCentavos: -200, contaId: null, cartaoId: 5 })];
    expect(montarSaldoDetalhado(movs, "conta", nomes, nov).linhas.map((l) => l.rotulo)).toEqual(["Bradesco", "Nubank"]);
    expect(montarSaldoDetalhado(movs, "contato", nomes, nov).linhas.map((l) => l.rotulo)).toEqual(["Sr. João", "Sem cliente ou fornecedor"]);
  });
  it("tags contam o lançamento em cada tag e não têm Total do Período", () => {
    const s = montarSaldoDetalhado([mov({ valorCentavos: -1000, tagIds: [11, 12] }), mov({ valorCentavos: 500 })], "tag", nomes, nov);
    expect(s.total).toBeNull();
    expect(s.linhas.map((l) => [l.rotulo, l.despesas])).toEqual([
      ["Casa", -1000],
      ["Teste", -1000],
    ]);
  });
});

describe("engrenagem Incluir as categorias", () => {
  it("tudo desligado por padrão e só aceita verdadeiro/falso", () => {
    expect(lerInclusoes(undefined)).toEqual({ zeradas: false, acerto: false, transferencia: false });
    expect(lerInclusoes({ zeradas: true, acerto: "1", transferencia: true, outra: true })).toEqual({ zeradas: true, acerto: false, transferencia: true });
  });
});

describe("exportação", () => {
  const t: Tabela = {
    titulo: "Teste",
    filtros: [],
    colunas: [{ titulo: "Descrição" }, { titulo: "Data", tipo: "data" }, { titulo: "Valor", tipo: "dinheiro" }],
    linhas: [{ celulas: ['Aluguel; "casa"', "2026-11-10", -150050] }, { celulas: ["Total", null, 1234567], estilo: "total" }],
    orientacao: "retrato",
    arquivo: "teste",
  };
  it("CSV com ponto e vírgula, vírgula nos centavos e acentos", () => {
    expect(gerarCsv(t)).toBe('﻿Descrição;Data;Valor\r\n"Aluguel; ""casa""";10/11/2026;-1500,50\r\nTotal;;12345,67\r\n');
  });
  it("nome do arquivo sem acento", () => {
    expect(nomeArquivo("Saldo Detalhado · Formas de Pagamento", "2026-11-24")).toBe("saldo-detalhado-formas-de-pagamento-2026-11-24");
  });
});
