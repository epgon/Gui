/**
 * Números da Visão Geral do módulo Gestão de Dívidas (fase D4), sem banco: indicadores, evolução e rosca.
 * Dinheiro em centavos inteiros; datas no formato "2026-11-24"; meses no formato "2026-11".
 */
import { fatiasDeCategorias } from "@/lib/visao-geral/regras";
import { mesDe, rotuloMes, simular, somarMesesYm, type DividaSim } from "./simulador";

/** Juros que as dívidas com taxa custam por mês: saldo × taxa ao mês, arredondado em cada dívida. */
export function jurosEstimadosPorMes(dividas: { saldoCentavos: number; taxaMensalPct: number | null }[]): number {
  return dividas.reduce((s, d) => s + (d.taxaMensalPct ? Math.round((d.saldoCentavos * d.taxaMensalPct) / 100) : 0), 0);
}

/** O que as dívidas tiram do mês: parcelas (pagas ou não) com vencimento no mês de `hoje`. */
export function parcelasDoMes(obrigacoes: { vencimento: string; valorCentavos: number }[], hoje: string): number {
  const mes = mesDe(hoje);
  return obrigacoes.filter((o) => mesDe(o.vencimento) === mes).reduce((s, o) => s + o.valorCentavos, 0);
}

export type ItemEvolucao = {
  /** Data em que a dívida passou a existir no Gui (contratação ou cadastro). */
  desde: string;
  forma: "parcelas_fixas" | "sem_parcelas";
  /** Parcelas fixas: cada parcela. Sem parcelas: cada pagamento feito. */
  obrigacoes: { vencimento: string; dataPagamento: string | null; valorCentavos: number }[];
  /** Saldo de hoje (usado nas dívidas sem parcelas, voltando no tempo com os pagamentos). */
  saldoHojeCentavos: number;
};

const ultimoDiaDoMes = (ym: string) => {
  const dias = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  return `${ym}-${String(dias).padStart(2, "0")}`;
};

/**
 * Evolução do total devido no fim de cada um dos últimos meses (até hoje). É aproximada, pelas parcelas:
 * em dívida com parcelas, o que ainda não tinha sido pago naquele dia; em dívida sem parcelas, o saldo de hoje
 * somado aos pagamentos feitos depois. Um mês só entra quando já existia alguma dívida, para o gráfico não "subir do zero".
 */
export function evolucaoDoTotalDevido(itens: ItemEvolucao[], hoje: string, meses = 12): { mes: string; totalCentavos: number }[] {
  const atual = mesDe(hoje);
  const serie: { mes: string; totalCentavos: number }[] = [];
  for (let k = meses - 1; k >= 0; k--) {
    const mes = somarMesesYm(atual, -k);
    const fim = mes === atual ? hoje : ultimoDiaDoMes(mes);
    let total = 0;
    let existia = false;
    for (const d of itens) {
      if (d.desde > fim) continue;
      existia = true;
      if (d.forma === "parcelas_fixas") {
        total += d.obrigacoes.filter((o) => !o.dataPagamento || o.dataPagamento > fim).reduce((s, o) => s + o.valorCentavos, 0);
      } else {
        total += d.saldoHojeCentavos + d.obrigacoes.filter((o) => o.dataPagamento && o.dataPagamento > fim).reduce((s, o) => s + o.valorCentavos, 0);
      }
    }
    if (existia) serie.push({ mes, totalCentavos: total });
  }
  return serie;
}

const PALETA = ["#135D3B", "#1D6CE0", "#E04F16", "#E8B931", "#1F8A70", "#2F4550"];

/** As fatias da rosca (por credor ou por tipo): as maiores e "Outras". Os percentuais somam 100. */
export function fatiasDeDividas(dividas: { chave: string; nome: string; saldoCentavos: number }[], maximo = 5) {
  const ordem = new Map<string, number>();
  const gastos = dividas.map((d) => {
    if (!ordem.has(d.chave)) ordem.set(d.chave, ordem.size);
    return { id: ordem.get(d.chave)!, nome: d.nome, cor: "", valorCentavos: d.saldoCentavos };
  });
  const fatias = fatiasDeCategorias(gastos, maximo);
  return fatias.map((f, i) => ({ ...f, cor: f.id === null ? "#9CA3AF" : PALETA[i % PALETA.length] }));
}

export type PrevisaoQuitacao =
  | { tipo: "data"; mes: string; rotulo: string; meses: number; /** Há dívida sem parcelas definidas: o mínimo considerado é só o juro do mês. */ aproximada: boolean }
  | { tipo: "sem_previsao"; motivo: string }
  | { tipo: "nada" };

/**
 * Previsão de quitação pagando só as parcelas (sem plano ativo; o plano chega na D5).
 * Dívida sem parcelas definidas entra com o pagamento mínimo igual aos juros do mês (como no Simulador): a data é aproximada.
 */
export function preverQuitacao(dividas: DividaSim[], inicioYm: string): PrevisaoQuitacao {
  const abertas = dividas.filter((d) => d.saldoCentavos > 0);
  if (!abertas.length) return { tipo: "nada" };
  const r = simular({ dividas: abertas, estrategia: "avalanche", valorMensalCentavos: null, inicioYm });
  const semParcelas = abertas.filter((d) => d.cronograma.length === 0).length;
  if (r.quitouTudo && r.mesFinal) return { tipo: "data", mes: r.mesFinal, rotulo: rotuloMes(r.mesFinal), meses: r.mesesAteQuitar ?? 0, aproximada: semParcelas > 0 };
  return { tipo: "sem_previsao", motivo: "Pagando só as parcelas e os juros do mês, as dívidas não terminam em 30 anos." };
}
