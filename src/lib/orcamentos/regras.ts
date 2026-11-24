/**
 * Contas do Orçamento, sem banco de dados. Testes em regras.test.ts.
 * Dinheiro em centavos; competência = primeiro dia do mês ("2026-11-01").
 */
import type { CategoriaNaArvore } from "@/lib/categorias";
import { somarMeses } from "@/lib/lancamentos/regras";
import type { Movimento } from "@/lib/relatorios/regras";

export type LimiteGravado = { categoriaId: number; competencia: string; valorCentavos: number | null };

/** "2026-11" ou "2026-11-24" -> "2026-11-01" */
export const competenciaDe = (data: string) => `${data.slice(0, 7)}-01`;
export const mesSeguinte = (competencia: string) => somarMeses(competencia, 1);

/**
 * Limite que vale no mês: o do próprio mês ou, se não houver, o do último mês anterior que tiver.
 * null = sem limite.
 */
export function limiteNoMes(limites: LimiteGravado[], categoriaId: number, competencia: string): number | null {
  let melhor: LimiteGravado | null = null;
  for (const l of limites) {
    if (l.categoriaId !== categoriaId || l.competencia > competencia) continue;
    if (!melhor || l.competencia > melhor.competencia) melhor = l;
  }
  return melhor?.valorCentavos ?? null;
}

export type ModoLimite = "seguintes" | "mes";

/**
 * O que gravar ao definir um limite no mês:
 * - "seguintes": vale neste mês e nos próximos (apaga os limites próprios dos meses seguintes);
 * - "mes": só neste mês; o mês seguinte continua com o limite que tinha antes.
 * valor null = tirar o limite.
 */
export function mudancasDoLimite(limites: LimiteGravado[], categoriaId: number, competencia: string, valor: number | null, modo: ModoLimite) {
  const gravar: { competencia: string; valorCentavos: number | null }[] = [{ competencia, valorCentavos: valor }];
  if (modo === "seguintes") return { gravar, apagarDepoisDe: competencia };
  const seguinte = mesSeguinte(competencia);
  const temProprio = limites.some((l) => l.categoriaId === categoriaId && l.competencia === seguinte);
  if (!temProprio) gravar.push({ competencia: seguinte, valorCentavos: limiteNoMes(limites, categoriaId, seguinte) });
  return { gravar, apagarDepoisDe: null };
}

// ---------------------------------------------------------------------------
// Cartões do orçamento
// ---------------------------------------------------------------------------

export type NoOrcamento = {
  id: number;
  numero: string;
  nome: string;
  cor: string;
  nivel: number;
  ativo: boolean;
  /** Limite gravado para esta categoria (vale no mês). */
  limiteProprio: number | null;
  /** Orçamento usado nas contas: o limite próprio ou, sem ele, a soma das filhas. */
  orcamento: number;
  /** Quanto foi gasto (despesas) ou recebido (receitas) no mês, já com as filhas. Sempre positivo quando é o "normal". */
  realizado: number;
  /** orcamento − realizado */
  disponivel: number;
  /** Soma dos orçamentos das filhas. */
  somaFilhas: number;
  /** As filhas somam mais que o limite desta categoria. */
  filhasPassam: boolean;
  filhos: NoOrcamento[];
};

export type CartaoOrcamento = NoOrcamento & { natureza: "receita" | "despesa" };

export type Orcamento = {
  cartoes: CartaoOrcamento[];
  /** Soma dos cartões de despesa. */
  despesas: { orcamento: number; realizado: number; disponivel: number };
  /** Soma dos cartões de receita (se houver algum). */
  receitas: { orcamento: number; realizado: number; disponivel: number } | null;
};

type Arvore = Map<number, CategoriaNaArvore>;

/**
 * Monta os cartões do mês: um por categoria raiz escolhida, com a árvore das filhas.
 * Despesas: o que saiu menos o que voltou (estorno) na categoria e nas filhas.
 * Receitas: o que entrou. Filhas inativas só aparecem se tiverem valor ou limite.
 */
export function montarOrcamento(arvore: Arvore, raizes: number[], limites: LimiteGravado[], movimentos: Movimento[], competencia: string): Orcamento {
  // Soma por categoria (sem as filhas ainda).
  const soma = new Map<number, number>();
  for (const m of movimentos) {
    if (m.categoriaId === null) continue;
    soma.set(m.categoriaId, (soma.get(m.categoriaId) ?? 0) + m.valorCentavos);
  }

  const filhasDe = new Map<number, CategoriaNaArvore[]>();
  for (const c of arvore.values()) {
    if (c.categoriaPaiId === null || c.especial) continue;
    filhasDe.set(c.categoriaPaiId, [...(filhasDe.get(c.categoriaPaiId) ?? []), c]);
  }

  const montar = (c: CategoriaNaArvore, sinal: 1 | -1): NoOrcamento | null => {
    const filhos = (filhasDe.get(c.id) ?? []).map((f) => montar(f, sinal)).filter((x): x is NoOrcamento => x !== null);
    const limiteProprio = limiteNoMes(limites, c.id, competencia);
    const realizado = sinal * (soma.get(c.id) ?? 0) + filhos.reduce((s, f) => s + f.realizado, 0);
    if (!c.ativo && c.nivel > 1 && realizado === 0 && limiteProprio === null && filhos.length === 0) return null;
    const somaFilhas = filhos.reduce((s, f) => s + f.orcamento, 0);
    const orcamento = limiteProprio ?? somaFilhas;
    return {
      id: c.id,
      numero: c.numero,
      nome: c.nome,
      cor: c.corEfetiva,
      nivel: c.nivel,
      ativo: c.ativo,
      limiteProprio,
      orcamento,
      realizado,
      disponivel: orcamento - realizado,
      somaFilhas,
      filhasPassam: limiteProprio !== null && somaFilhas > limiteProprio,
      filhos,
    };
  };

  const cartoes: CartaoOrcamento[] = [];
  for (const id of raizes) {
    const c = arvore.get(id);
    if (!c || c.especial || c.categoriaPaiId !== null) continue;
    const no = montar(c, c.natureza === "receita" ? 1 : -1);
    if (no) cartoes.push({ ...no, natureza: c.natureza });
  }
  // Na ordem da tela de Categorias (1. Receita, 2. Alimentação...).
  const posicao = new Map([...arvore.keys()].map((id, i) => [id, i]));
  cartoes.sort((a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0));

  const total = (lista: CartaoOrcamento[]) => {
    const orcamento = lista.reduce((s, c) => s + c.orcamento, 0);
    const realizado = lista.reduce((s, c) => s + c.realizado, 0);
    return { orcamento, realizado, disponivel: orcamento - realizado };
  };
  const deReceita = cartoes.filter((c) => c.natureza === "receita");
  return { cartoes, despesas: total(cartoes.filter((c) => c.natureza === "despesa")), receitas: deReceita.length ? total(deReceita) : null };
}

/** Quanto do orçamento já foi usado, de 0 a 100 (para a barra). Sem orçamento, a barra fica vazia (cinza). */
export function percentualUsado(orcamento: number, realizado: number): number {
  if (orcamento <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((realizado / orcamento) * 100)));
}

/** Cor da barra: verde até 80%, amarelo até 100%, vermelho quando estoura; cinza sem orçamento. */
export function situacaoDoUso(orcamento: number, realizado: number): "ok" | "atencao" | "estourou" | "sem" {
  if (orcamento <= 0) return "sem";
  if (realizado > orcamento) return "estourou";
  if (realizado >= orcamento * 0.8) return "atencao";
  return "ok";
}
