import { describe, expect, it } from "vitest";
import { montarArvore } from "@/lib/categorias";
import type { Movimento } from "@/lib/relatorios/regras";
import { limiteNoMes, montarOrcamento, mudancasDoLimite, percentualUsado, situacaoDoUso, type LimiteGravado } from "./regras";

const cat = (id: number, nome: string, pai: number | null, ordem: number, extra: Partial<{ natureza: "receita" | "despesa"; ativo: boolean; especial: "transferencia" }> = {}) => ({
  id,
  nome,
  categoriaPaiId: pai,
  ordem,
  cor: pai ? null : "#123456",
  natureza: extra.natureza ?? ("despesa" as const),
  especial: extra.especial ?? null,
  ativo: extra.ativo ?? true,
  padraoSistema: true,
});

// 1. Receita > 1.1 Salário; 2. Transporte > 2.1 Metrô, 2.2 Veículo > 2.2.1 Combustível, 2.2.2 Seguro (inativa); 3. Lazer
const arvore = new Map(
  montarArvore([
    cat(1, "Receita", null, 1, { natureza: "receita" }),
    cat(2, "Salário", 1, 1, { natureza: "receita" }),
    cat(10, "Transporte", null, 2),
    cat(11, "Metrô", 10, 1),
    cat(12, "Veículo", 10, 2),
    cat(13, "Combustível", 12, 1),
    cat(14, "Seguro", 12, 2, { ativo: false }),
    cat(20, "Lazer", null, 3),
    cat(99, "Transferência", null, 0, { especial: "transferencia" }),
  ]).map((c) => [c.id, c]),
);

const mov = (categoriaId: number, valorCentavos: number): Movimento => ({
  data: "2026-11-10",
  valorCentavos,
  especial: null,
  categoriaId,
  contaId: 1,
  cartaoId: null,
  contatoId: null,
  formaId: null,
  tagIds: [],
});

const lim = (categoriaId: number, competencia: string, valorCentavos: number | null): LimiteGravado => ({ categoriaId, competencia, valorCentavos });

describe("limite no mês (replicação)", () => {
  const limites = [lim(10, "2026-09-01", 50000), lim(10, "2026-12-01", 70000), lim(20, "2026-10-01", null)];

  it("usa o do último mês anterior que tiver", () => {
    expect(limiteNoMes(limites, 10, "2026-08-01")).toBeNull();
    expect(limiteNoMes(limites, 10, "2026-09-01")).toBe(50000);
    expect(limiteNoMes(limites, 10, "2026-11-01")).toBe(50000);
    expect(limiteNoMes(limites, 10, "2026-12-01")).toBe(70000);
    expect(limiteNoMes(limites, 10, "2027-05-01")).toBe(70000);
  });

  it("uma linha vazia tira o limite dali em diante", () => {
    expect(limiteNoMes(limites, 20, "2026-11-01")).toBeNull();
  });
});

describe("definir limite", () => {
  const limites = [lim(10, "2026-09-01", 50000), lim(10, "2026-12-01", 70000)];

  it("este mês e os seguintes: grava no mês e apaga os meses depois", () => {
    expect(mudancasDoLimite(limites, 10, "2026-11-01", 60000, "seguintes")).toEqual({ gravar: [{ competencia: "2026-11-01", valorCentavos: 60000 }], apagarDepoisDe: "2026-11-01" });
  });

  it("só este mês: o mês seguinte guarda o limite que já valia", () => {
    expect(mudancasDoLimite(limites, 10, "2026-10-01", 60000, "mes")).toEqual({
      gravar: [
        { competencia: "2026-10-01", valorCentavos: 60000 },
        { competencia: "2026-11-01", valorCentavos: 50000 },
      ],
      apagarDepoisDe: null,
    });
  });

  it("só este mês: se o mês seguinte já tem limite próprio, não mexe nele", () => {
    expect(mudancasDoLimite(limites, 10, "2026-11-01", 60000, "mes").gravar).toEqual([{ competencia: "2026-11-01", valorCentavos: 60000 }]);
  });

  it("só este mês sem nada antes: o mês seguinte fica sem limite", () => {
    expect(mudancasDoLimite([], 10, "2026-11-01", 60000, "mes").gravar).toEqual([
      { competencia: "2026-11-01", valorCentavos: 60000 },
      { competencia: "2026-12-01", valorCentavos: null },
    ]);
  });
});

describe("cartões do orçamento", () => {
  const movimentos = [mov(11, -10000), mov(13, -25000), mov(13, 5000), mov(10, -1000), mov(2, 800000), mov(20, -3000), mov(99, -999)];
  const limites = [lim(10, "2026-01-01", 40000), lim(11, "2026-01-01", 15000), lim(13, "2026-01-01", 30000), lim(1, "2026-01-01", 1000000)];

  it("soma as despesas da categoria e das filhas, e o estorno reduz o gasto", () => {
    const o = montarOrcamento(arvore, [20, 10], limites, movimentos, "2026-11-01");
    const transporte = o.cartoes.find((c) => c.id === 10)!;
    // 100 (metrô) + 250 - 50 (combustível) + 10 (na própria Transporte) = 310
    expect(transporte.realizado).toBe(31000);
    expect(transporte.orcamento).toBe(40000);
    expect(transporte.disponivel).toBe(9000);
    const veiculo = transporte.filhos.find((f) => f.id === 12)!;
    expect(veiculo.realizado).toBe(20000);
    // Sem limite próprio: soma das filhas.
    expect(veiculo.limiteProprio).toBeNull();
    expect(veiculo.orcamento).toBe(30000);
  });

  it("segue a ordem das categorias e esconde filha inativa sem valor", () => {
    const o = montarOrcamento(arvore, [20, 10], limites, movimentos, "2026-11-01");
    expect(o.cartoes.map((c) => c.id)).toEqual([10, 20]);
    const veiculo = o.cartoes[0].filhos.find((f) => f.id === 12)!;
    expect(veiculo.filhos.map((f) => f.id)).toEqual([13]);
  });

  it("avisa quando as filhas somam mais que a categoria", () => {
    const o = montarOrcamento(arvore, [10], [...limites, lim(12, "2026-01-01", 50000)], movimentos, "2026-11-01");
    const t = o.cartoes[0];
    // 150 (metrô) + 500 (veículo) = 650 > 400
    expect(t.somaFilhas).toBe(65000);
    expect(t.filhasPassam).toBe(true);
  });

  it("totais separam despesas e receitas; ignora categoria especial e filha escolhida por engano", () => {
    const o = montarOrcamento(arvore, [1, 10, 20, 99, 11], limites, movimentos, "2026-11-01");
    expect(o.cartoes.map((c) => c.id)).toEqual([1, 10, 20]);
    expect(o.despesas).toEqual({ orcamento: 40000, realizado: 34000, disponivel: 6000 });
    expect(o.receitas).toEqual({ orcamento: 1000000, realizado: 800000, disponivel: 200000 });
  });

  it("sem receita escolhida, não há total de receitas", () => {
    expect(montarOrcamento(arvore, [10], limites, movimentos, "2026-11-01").receitas).toBeNull();
  });
});

describe("barra de progresso", () => {
  it("percentual e cor", () => {
    expect(percentualUsado(40000, 10000)).toBe(25);
    expect(percentualUsado(40000, 90000)).toBe(100);
    expect(percentualUsado(0, 100)).toBe(0);
    expect(situacaoDoUso(0, 100)).toBe("sem");
    expect(percentualUsado(0, 0)).toBe(0);
    expect(situacaoDoUso(40000, 10000)).toBe("ok");
    expect(situacaoDoUso(40000, 32000)).toBe("atencao");
    expect(situacaoDoUso(40000, 40001)).toBe("estourou");
    expect(situacaoDoUso(0, 0)).toBe("sem");
  });
});
