import "server-only";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { rotuloTipoConta } from "@/lib/cadastros/opcoes";
import { hojeIso } from "@/lib/datas";
import { lerFiltros, listarLancamentos, valorRealizadoSql } from "@/lib/lancamentos/consultas";
import { mesDe, somarMeses } from "@/lib/lancamentos/regras";
import type { Situacao } from "@/lib/lancamentos/regras";
import type { Resumo } from "@/lib/lancamentos/tipos";

const { lancamento: l, contaFinanceira: conta, banco } = schema;

export type LinhaDetalhe = {
  chave: string;
  data: string;
  descricao: string;
  categoria: string | null;
  categoriaCor: string | null;
  valorCentavos: number;
  situacao: Situacao;
  previsto: boolean;
  eFatura: boolean;
};

export type MesHistorico = { anoMes: string; rotulo: string; entradas: number; saidas: number; saldoFim: number };

export type DetalheConta = {
  conta: {
    id: number;
    descricao: string;
    tipo: string;
    bancoNome: string;
    bancoCodigo: string | null;
    considerarNosSaldos: boolean;
    ativo: boolean;
    saldoInicialCentavos: number;
    saldoInicialData: string | null;
  };
  hoje: string;
  saldoAtual: number;
  mes: ReturnType<typeof mesDe>;
  resumo: Resumo;
  linhas: LinhaDetalhe[];
  historico: MesHistorico[];
};

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Dados da janela "Detalhando Conta Financeira": resumo, últimos 6 meses e lançamentos do mês escolhido. */
export async function carregarDetalheConta(id: number, anoMes?: string, hoje = hojeIso()): Promise<DetalheConta | null> {
  const db = getDb();
  const [c] = await db
    .select({
      id: conta.id,
      descricao: conta.descricao,
      tipo: conta.tipo,
      bancoNome: banco.nome,
      bancoCodigo: banco.codigo,
      considerarNosSaldos: conta.considerarNosSaldos,
      ativo: conta.ativo,
      saldoInicialCentavos: conta.saldoInicialCentavos,
      saldoInicialData: conta.saldoInicialData,
    })
    .from(conta)
    .leftJoin(banco, eq(banco.id, conta.bancoId))
    .where(eq(conta.id, id))
    .limit(1);
  if (!c) return null;

  const mes = mesDe(anoMes && /^\d{4}-(0[1-9]|1[0-2])$/.test(anoMes) ? anoMes : hoje.slice(0, 7));
  const realizados = and(eq(l.contaId, id), isNotNull(l.dataPagamento), lte(l.dataPagamento, hoje));
  const primeiroMes = somarMeses(`${hoje.slice(0, 7)}-01`, -5);

  const [lista, [atual], [antesDoHistorico], porMes] = await Promise.all([
    listarLancamentos(lerFiltros({ mes: mes.anoMes, destino: `conta:${id}` }, hoje), hoje),
    db.select({ total: sql<number>`coalesce(sum(${valorRealizadoSql}), 0)` }).from(l).where(realizados),
    db
      .select({ total: sql<number>`coalesce(sum(${valorRealizadoSql}), 0)` })
      .from(l)
      .where(and(realizados, sql`${l.dataPagamento} < ${primeiroMes}`)),
    db
      .select({
        mes: sql<string>`to_char(${l.dataPagamento}, 'YYYY-MM')`,
        entradas: sql<number>`coalesce(sum(${valorRealizadoSql}) filter (where ${valorRealizadoSql} > 0 and ${l.tipo} <> 'saldo_inicial'), 0)`,
        saidas: sql<number>`coalesce(-sum(${valorRealizadoSql}) filter (where ${valorRealizadoSql} < 0 and ${l.tipo} <> 'saldo_inicial'), 0)`,
        total: sql<number>`coalesce(sum(${valorRealizadoSql}), 0)`,
      })
      .from(l)
      .where(and(realizados, sql`${l.dataPagamento} >= ${primeiroMes}`))
      .groupBy(sql`1`),
  ]);

  // Saldo no fim de cada um dos últimos 6 meses (só o que já foi pago ou recebido).
  const movimentos = new Map(porMes.map((m) => [m.mes, m]));
  let saldo = Number(antesDoHistorico.total);
  const historico: MesHistorico[] = [];
  for (let i = 0; i < 6; i++) {
    const anoMesHist = somarMeses(primeiroMes, i).slice(0, 7);
    const m = movimentos.get(anoMesHist);
    saldo += Number(m?.total ?? 0);
    historico.push({
      anoMes: anoMesHist,
      rotulo: `${MESES_CURTOS[Number(anoMesHist.slice(5)) - 1]}/${anoMesHist.slice(2, 4)}`,
      entradas: Number(m?.entradas ?? 0),
      saidas: Number(m?.saidas ?? 0),
      saldoFim: saldo,
    });
  }

  return {
    conta: { ...c, tipo: rotuloTipoConta(c.tipo), bancoNome: c.bancoNome ?? "Outro" },
    hoje,
    saldoAtual: Number(atual.total),
    mes,
    resumo: lista.resumo,
    linhas: lista.linhas.map((x) => ({
      chave: x.chave,
      data: x.data,
      descricao: x.descricao,
      categoria: x.categoria,
      categoriaCor: x.categoriaCor,
      valorCentavos: x.valorCentavos,
      situacao: x.situacao,
      previsto: x.previsto !== null,
      eFatura: x.id === null && x.faturaId !== null,
    })),
    historico,
  };
}
