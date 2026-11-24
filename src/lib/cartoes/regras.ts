/**
 * Contas dos cartões de crédito e das faturas (sem banco de dados), com testes em regras.test.ts.
 * Datas no formato "2026-11-24"; dinheiro em centavos.
 */
import { faturaDaCompra } from "@/lib/lancamentos/regras";

export type SituacaoFatura = "aberta" | "fechada" | "paga";

export const ROTULO_SITUACAO_FATURA: Record<SituacaoFatura, string> = { aberta: "Aberta", fechada: "Fechada", paga: "Paga" };

/** Números de uma fatura, já somados a partir das compras e dos pagamentos. */
export type NumerosFatura = {
  /** Situação gravada: "fechada" quando você fechou antes do dia; "paga" depois do pagamento. */
  situacaoGravada: SituacaoFatura;
  dataFechamento: string;
  /** Quantas compras (e estornos) a fatura tem. */
  compras: number;
  /** Total da fatura: compras menos estornos (positivo = a pagar). */
  totalCentavos: number;
  /** O que ainda não foi pago (compras novas depois de um pagamento entram aqui). */
  pendenteCentavos: number;
  /** Soma dos pagamentos feitos. */
  pagoCentavos: number;
};

/**
 * Situação da fatura, calculada na hora:
 * - Paga: teve pagamento e não sobrou nada pendente.
 * - Fechada: chegou o dia do fechamento (ou você fechou antes).
 * - Aberta: ainda recebe compras.
 */
export function situacaoDaFatura(f: NumerosFatura, hoje: string): SituacaoFatura {
  if (f.pagoCentavos > 0 && f.pendenteCentavos <= 0) return "paga";
  if (f.situacaoGravada === "fechada" || hoje >= f.dataFechamento) return "fechada";
  return "aberta";
}

/** A fatura pode ser paga quando sobra algo pendente. */
export const podePagar = (f: Pick<NumerosFatura, "pendenteCentavos">) => f.pendenteCentavos > 0;

/**
 * Limite do cartão.
 * usado = compras ainda não pagas, de todas as faturas (abertas, fechadas e parcelas futuras).
 */
export function limiteDoCartao(c: { limiteCentavos: number; ilimitado: boolean }, usadoCentavos: number) {
  const usado = Math.max(0, usadoCentavos);
  if (c.ilimitado) return { ilimitado: true as const, limite: 0, usado, disponivel: null, percentualUsado: 0, percentualDisponivel: 100 };
  const limite = c.limiteCentavos;
  const disponivel = limite - usado;
  const percentualUsado = limite > 0 ? Math.min(100, Math.round((usado / limite) * 1000) / 10) : usado > 0 ? 100 : 0;
  return { ilimitado: false as const, limite, usado, disponivel, percentualUsado, percentualDisponivel: Math.round((100 - percentualUsado) * 10) / 10 };
}

export type FaturaResumo = NumerosFatura & { id: number | null; competencia: string; dataVencimento: string };

/**
 * A "fatura atual" de um cartão:
 * 1. a fatura fechada mais antiga que ainda tem valor a pagar (é a mais urgente);
 * 2. senão, a fatura que está recebendo as compras de hoje (aberta), mesmo que ainda zerada.
 */
export function escolherFaturaAtual(
  faturas: FaturaResumo[],
  cartao: { diaFechamento: number; diaVencimento: number },
  hoje: string,
): FaturaResumo {
  const fechadaAPagar = faturas
    .filter((f) => situacaoDaFatura(f, hoje) === "fechada" && f.pendenteCentavos > 0)
    .sort((a, b) => a.competencia.localeCompare(b.competencia))[0];
  if (fechadaAPagar) return fechadaAPagar;
  const datas = faturaDaCompra(hoje, cartao.diaFechamento, cartao.diaVencimento);
  return (
    faturas.find((f) => f.competencia === datas.competencia) ?? {
      id: null,
      ...datas,
      situacaoGravada: "aberta",
      compras: 0,
      totalCentavos: 0,
      pendenteCentavos: 0,
      pagoCentavos: 0,
    }
  );
}

/** Soma o que falta pagar nas faturas depois da atual ("Próximas Faturas"). */
export function totalProximas(faturas: FaturaResumo[], atual: FaturaResumo): number {
  return faturas.filter((f) => f.competencia > atual.competencia).reduce((s, f) => s + Math.max(0, f.pendenteCentavos), 0);
}

/** "2026-12-01" + 1 -> "2027-01-01" (competência vizinha). */
export function competenciaVizinha(competencia: string, passo: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + passo;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Valor a pagar mostrado como saída (negativo), sem virar "-0,00" quando é zero. */
export const comoSaida = (centavos: number) => (centavos === 0 ? 0 : -centavos);
