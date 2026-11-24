/**
 * Contas da Visão Geral (sem banco de dados), com testes em regras.test.ts.
 * Datas no formato "2026-11-24"; dinheiro em centavos, com sinal (entrada +, saída -).
 */
import { somarDias } from "@/lib/lancamentos/regras";
import type { Situacao, TipoLancamento } from "@/lib/lancamentos/regras";

// ---------------------------------------------------------------------------
// Opções de cada cartão do painel (guardadas na tabela "configuracao")
// ---------------------------------------------------------------------------

export type OpcoesVisaoGeral = {
  /** Vencidos: quantos dias para trás olhar. */
  vencidosDias: number;
  /** Futuro: quantos dias à frente olhar. */
  futuroDias: number;
  /** Despesas por Categorias: período, em dias, terminando hoje. */
  categoriasDias: number;
  /** Contas que não aparecem em "Saldo das Contas". */
  contasOcultas: number[];
};

export const OPCOES_PADRAO: OpcoesVisaoGeral = { vencidosDias: 7, futuroDias: 7, categoriasDias: 28, contasOcultas: [] };

export const LIMITES = { prazoDias: 90, categoriasDias: 365 };

const inteiroEntre = (v: unknown, min: number, max: number, padrao: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : padrao;

/** Lê o que está guardado no banco e corrige o que vier estranho. */
export function normalizarOpcoes(valor: unknown): OpcoesVisaoGeral {
  const v = (valor && typeof valor === "object" ? valor : {}) as Record<string, unknown>;
  return {
    vencidosDias: inteiroEntre(v.vencidosDias, 1, LIMITES.prazoDias, OPCOES_PADRAO.vencidosDias),
    futuroDias: inteiroEntre(v.futuroDias, 1, LIMITES.prazoDias, OPCOES_PADRAO.futuroDias),
    categoriasDias: inteiroEntre(v.categoriasDias, 1, LIMITES.categoriasDias, OPCOES_PADRAO.categoriasDias),
    contasOcultas: Array.isArray(v.contasOcultas) ? [...new Set(v.contasOcultas.filter((x): x is number => Number.isInteger(x) && x > 0))] : [],
  };
}

// ---------------------------------------------------------------------------
// Períodos
// ---------------------------------------------------------------------------

export type Periodo = { inicio: string; fim: string };

/** Vencidos (ontem para trás), Vencendo (hoje) e Futuro (amanhã para frente). */
export function periodosDosPrazos(hoje: string, o: Pick<OpcoesVisaoGeral, "vencidosDias" | "futuroDias">) {
  return {
    vencidos: { inicio: somarDias(hoje, -o.vencidosDias), fim: somarDias(hoje, -1) },
    vencendo: { inicio: hoje, fim: hoje },
    futuro: { inicio: somarDias(hoje, 1), fim: somarDias(hoje, o.futuroDias) },
  } satisfies Record<string, Periodo>;
}

/** Meses ("2026-11") que um período toca, em ordem. */
export function mesesDoPeriodo(p: Periodo): string[] {
  const meses: string[] = [];
  let [ano, mes] = p.inicio.slice(0, 7).split("-").map(Number);
  const fim = p.fim.slice(0, 7);
  for (;;) {
    const atual = `${ano}-${String(mes).padStart(2, "0")}`;
    meses.push(atual);
    if (atual >= fim) break;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return meses;
}

// ---------------------------------------------------------------------------
// Totais
// ---------------------------------------------------------------------------

/** O que a Visão Geral precisa de cada linha da lista de lançamentos. */
export type LinhaPainel = {
  chave: string;
  tipo: TipoLancamento;
  descricao: string;
  data: string;
  situacao: Situacao;
  valorCentavos: number;
  contaOuCartao: string;
};

/**
 * Receitas e despesas de verdade: transferências entre as suas contas e o
 * "Saldo Inicial"/"Acerto de Saldo" não são ganho nem gasto.
 */
export function contaComoReceitaOuDespesa(tipo: TipoLancamento): boolean {
  return tipo === "receita" || tipo === "despesa" || tipo === "pagamento_fatura";
}

export type Totais = { receitas: number; despesas: number };

/** Soma receitas (positivo) e despesas (positivo também, é o gasto). */
export function somarTotais(linhas: Pick<LinhaPainel, "tipo" | "valorCentavos">[]): Totais {
  let receitas = 0;
  let despesas = 0;
  for (const l of linhas) {
    if (!contaComoReceitaOuDespesa(l.tipo)) continue;
    if (l.valorCentavos >= 0) receitas += l.valorCentavos;
    else despesas -= l.valorCentavos;
  }
  return { receitas, despesas };
}

/** Totais do mês, e quanto disso já foi recebido e pago. */
export function totaisDoMes(linhas: Pick<LinhaPainel, "tipo" | "valorCentavos" | "situacao">[]) {
  const todos = somarTotais(linhas);
  const realizados = somarTotais(linhas.filter((l) => l.situacao === "realizado"));
  return { receitas: todos.receitas, despesas: todos.despesas, recebido: realizados.receitas, pago: realizados.despesas };
}

export type Prazo = Totais & { linhas: LinhaPainel[] };

/** Separa o que falta pagar ou receber em Vencidos, Vencendo e Futuro. */
export function separarPrazos(linhas: LinhaPainel[], hoje: string, o: Pick<OpcoesVisaoGeral, "vencidosDias" | "futuroDias">) {
  const periodos = periodosDosPrazos(hoje, o);
  const pendentes = linhas.filter((l) => l.situacao !== "realizado" && contaComoReceitaOuDespesa(l.tipo));
  const montar = (p: Periodo): Prazo => {
    const escolhidas = pendentes.filter((l) => l.data >= p.inicio && l.data <= p.fim).sort((a, b) => a.data.localeCompare(b.data));
    return { ...somarTotais(escolhidas), linhas: escolhidas };
  };
  return { vencidos: montar(periodos.vencidos), vencendo: montar(periodos.vencendo), futuro: montar(periodos.futuro), periodos };
}

// ---------------------------------------------------------------------------
// Despesas por Categorias
// ---------------------------------------------------------------------------

export type FatiaCategoria = { id: number | null; nome: string; cor: string; valorCentavos: number; percentual: number };

/**
 * Junta os gastos por categoria, mostra as maiores (padrão: 5) e soma o resto em "Outras".
 * Os percentuais somam 100 (o arredondamento vai para a maior fatia).
 */
export function fatiasDeCategorias(gastos: { id: number; nome: string; cor: string; valorCentavos: number }[], maximo = 5): FatiaCategoria[] {
  const porId = new Map<number, { id: number; nome: string; cor: string; valorCentavos: number }>();
  for (const g of gastos) {
    if (g.valorCentavos <= 0) continue;
    const atual = porId.get(g.id);
    if (atual) atual.valorCentavos += g.valorCentavos;
    else porId.set(g.id, { ...g });
  }
  const ordenadas = [...porId.values()].sort((a, b) => b.valorCentavos - a.valorCentavos || a.nome.localeCompare(b.nome));
  const total = ordenadas.reduce((s, x) => s + x.valorCentavos, 0);
  if (!total) return [];
  const principais: Omit<FatiaCategoria, "percentual">[] = ordenadas.slice(0, maximo);
  const resto = ordenadas.slice(maximo).reduce((s, x) => s + x.valorCentavos, 0);
  if (resto > 0) principais.push({ id: null, nome: "Outras", cor: "#9CA3AF", valorCentavos: resto });
  const fatias = principais.map((x) => ({ ...x, percentual: Math.round((x.valorCentavos / total) * 1000) / 10 }));
  const diferenca = Math.round((100 - fatias.reduce((s, x) => s + x.percentual, 0)) * 10) / 10;
  if (diferenca) fatias[0].percentual = Math.round((fatias[0].percentual + diferenca) * 10) / 10;
  return fatias;
}

// ---------------------------------------------------------------------------
// Evolução do saldo (mini gráfico)
// ---------------------------------------------------------------------------

/**
 * Saldo no fim de cada dia do período.
 * saldoAntes = saldo no fim do dia anterior ao início; movimentos = realizados por data de pagamento.
 */
export function serieDeSaldo(saldoAntes: number, movimentos: { data: string; valorCentavos: number }[], p: Periodo) {
  const porDia = new Map<string, number>();
  for (const m of movimentos) porDia.set(m.data, (porDia.get(m.data) ?? 0) + m.valorCentavos);
  const serie: { data: string; saldo: number }[] = [];
  let saldo = saldoAntes;
  for (let d = p.inicio; d <= p.fim; d = somarDias(d, 1)) {
    saldo += porDia.get(d) ?? 0;
    serie.push({ data: d, saldo });
  }
  return serie;
}
