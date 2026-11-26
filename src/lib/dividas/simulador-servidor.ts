import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hojeIso } from "@/lib/datas";
import { saldosDasContas } from "@/lib/lancamentos/consultas";
import { lerParametros } from "@/lib/parametros/servidor";
import { carregarArvore, carregarMovimentos } from "@/lib/relatorios/servidor";
import type { FiltrosRelatorio } from "@/lib/relatorios/regras";
import { carregarNegociacoes } from "./negociacoes";
import { carregarDividasParaSimular } from "./servidor";
import { mesDe, reservaMinima, type DividaSim, type PercentuaisCenarios, type SituacaoFinanceira } from "./simulador";
import { calcularSobra, periodoDaSobra } from "./sobra";
import type { LinhaDivida, LinhaNegociacao } from "./tipos";

/**
 * Tudo o que a tela do Simulador lê. Só leitura: nada aqui grava.
 * Os números de sobra vêm do mesmo carregamento do Fluxo de Caixa.
 */
export type SimulacaoGuardada = { id: number; nome: string; modo: string; parametros: unknown; resumo: unknown; criadoEm: string };

export type DadosSimulador = {
  hoje: string;
  inicioYm: string;
  dividas: { linha: LinhaDivida; sim: DividaSim }[];
  situacao: SituacaoFinanceira;
  /** De onde vieram os números (para a frase "Como calculei"). */
  base: { mesesMedia: number; inicio: string; fim: string; contasReserva: { id: number; nome: string; saldoCentavos: number }[]; reservaMeses: number; reservaPorTipo: boolean };
  percentuais: PercentuaisCenarios;
  negociacoes: LinhaNegociacao[];
  guardadas: SimulacaoGuardada[];
};

export async function carregarSituacaoFinanceira(hoje = hojeIso()): Promise<{ situacao: SituacaoFinanceira; base: DadosSimulador["base"]; percentuais: PercentuaisCenarios }> {
  const db = getDb();
  const { dividas: p } = await lerParametros();
  const { inicio, fim } = periodoDaSobra(hoje, p.sobraMeses);
  const filtros: FiltrosRelatorio = { de: "", ate: "", inicio, fim, destino: "", situacao: "realizado", considerar: "pagamento", categoria: "", forma: "", contato: "", tag: "", incluirAcerto: false, incluirTransferencia: false };
  const arvore = await carregarArvore();
  const [movimentos, contas, saldos] = await Promise.all([
    carregarMovimentos(filtros, arvore, hoje),
    db.select({ id: schema.contaFinanceira.id, nome: schema.contaFinanceira.descricao, tipo: schema.contaFinanceira.tipo, ativo: schema.contaFinanceira.ativo }).from(schema.contaFinanceira),
    saldosDasContas(hoje),
  ]);
  const sobra = calcularSobra(movimentos, hoje, p.sobraMeses, arvore);
  const escolhidas = p.contasReserva.length > 0;
  const daReserva = contas.filter((c) => (escolhidas ? p.contasReserva.includes(c.id) : c.ativo && (c.tipo === "poupanca" || c.tipo === "investimento")));
  const contasReserva = daReserva.map((c) => ({ id: c.id, nome: c.nome, saldoCentavos: saldos.get(c.id) ?? 0 }));
  const reservaCentavos = Math.max(0, contasReserva.reduce((s, c) => s + c.saldoCentavos, 0));
  return {
    situacao: { sobraMensalCentavos: sobra.sobraMensalCentavos, despesaMediaCentavos: sobra.despesaMediaCentavos, reservaCentavos, reservaMinimaCentavos: reservaMinima(sobra.despesaMediaCentavos, p.reservaMeses) },
    base: { mesesMedia: sobra.meses, inicio, fim, contasReserva, reservaMeses: p.reservaMeses, reservaPorTipo: !escolhidas },
    percentuais: p.cenarios,
  };
}

export async function carregarSimulador(hoje = hojeIso()): Promise<DadosSimulador> {
  const db = getDb();
  const [dividas, financeiro, guardadas] = await Promise.all([
    carregarDividasParaSimular(hoje),
    carregarSituacaoFinanceira(hoje),
    db.select().from(schema.simulacao).orderBy(desc(schema.simulacao.criadoEm), desc(schema.simulacao.id)).limit(50),
  ]);
  const negociacoes = (await carregarNegociacoes(null, dividas.map((d) => d.linha))).linhas.filter((n) => n.propostas.length > 0);
  return {
    hoje,
    inicioYm: mesDe(hoje),
    dividas,
    ...financeiro,
    negociacoes,
    guardadas: guardadas.map((g) => ({ id: g.id, nome: g.nome, modo: g.modo, parametros: g.parametros, resumo: g.resumo, criadoEm: g.criadoEm.toISOString() })),
  };
}

export async function lerSimulacao(id: number) {
  const [g] = await getDb().select().from(schema.simulacao).where(eq(schema.simulacao.id, id));
  return g ?? null;
}
