/** Tipos da Gestão de Dívidas compartilhados entre as telas (navegador) e o servidor. */
import type { FormaDivida, GarantiaDivida, ResumoSaldo, SituacaoDivida, TipoDivida } from "./regras";

export type SituacaoParcela = "realizado" | "a_vencer" | "vencido";

/** Uma obrigação da dívida: um lançamento (parcela, restante, encargo, conta acompanhada) ou uma fatura acompanhada. */
export type LinhaObrigacao = {
  chave: string;
  origem: "lancamento" | "fatura";
  /** Id do lançamento ou da fatura. */
  id: number;
  descricao: string;
  vencimento: string;
  dataPagamento: string | null;
  valorCentavos: number;
  /** Pago com valor diferente: o valor que o lançamento tinha antes. */
  valorOriginalCentavos: number | null;
  parcela: string | null;
  restante: boolean;
  encargo: boolean;
  /** O valor foi reduzido por uma amortização. */
  ajustada: boolean;
  situacao: SituacaoParcela;
  /** Estimativa de multa e juros (só em parcela vencida e não paga). */
  atrasoDias: number;
  acrescimoCentavos: number;
  /** Lançamentos do cartão ou faturas não se pagam pela janela de lançamento. */
  podePagarAqui: boolean;
};

export type EventoLinha = {
  chave: string;
  data: string;
  tipo: string;
  descricao: string;
  valorCentavos: number | null;
  lancamentoId: number | null;
  /** Para ordenar eventos do mesmo dia. */
  ordem: number;
};

export type VinculoLinha = {
  chave: string;
  tipo: "fatura" | "recorrencia" | "lancamento";
  id: number;
  rotulo: string;
  detalhe: string;
  /** Endereço do registro de origem. */
  href: string;
};

export type LinhaDivida = {
  id: number;
  descricao: string;
  contatoId: number;
  credor: string;
  tipo: TipoDivida;
  forma: FormaDivida;
  situacao: SituacaoDivida;
  situacaoGravada: "ativa" | "quitada" | "renegociada" | "cancelada";
  diasAtraso: number;
  parcelasAtrasadas: number;
  taxaMensal: number | null;
  multaPercentual: number | null;
  moraMensal: number | null;
  garantia: GarantiaDivida;
  contaId: number | null;
  categoriaId: number | null;
  formaPagamentoId: number | null;
  valorOriginalCentavos: number | null;
  dataContratacao: string | null;
  observacao: string | null;
  proximoVencimento: string | null;
  parcelasPagas: number;
  parcelasTotal: number;
  saldo: ResumoSaldo;
  pagoCentavos: number;
  progresso: number;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type DetalheDivida = {
  divida: LinhaDivida;
  obrigacoes: LinhaObrigacao[];
  historico: EventoLinha[];
  vinculos: VinculoLinha[];
  /** Total pago em juros, multa e encargos (pagamentos acima do valor da parcela). */
  jurosPagosCentavos: number;
  /** Última parcela em aberto: a previsão de término. */
  previsaoTermino: string | null;
  /** Saldo a cada pagamento, para o gráfico do Resumo (do mais antigo ao mais novo). */
  evolucao: { data: string; saldoCentavos: number }[];
  /** Taxa ao ano equivalente (quando há taxa mensal). */
  taxaAnual: number | null;
  /** Quanto custaria quitar hoje, trazendo as parcelas futuras a valor presente (só com taxa). */
  valorPresenteCentavos: number | null;
};

export type ContaEmAberto = {
  chave: string;
  origem: "fatura" | "lancamento" | "recorrente";
  id: number;
  descricao: string;
  /** "Fatura-Cartão Nubank dez/2026", "Lançamento: Conta de luz"... */
  rotuloOrigem: string;
  vencimento: string | null;
  valorCentavos: number;
  /** Dias de atraso (0 se não venceu). */
  atrasoDias: number;
  href: string;
  /** Lançamento: pode abrir a janela de pagar. */
  receita?: boolean;
};

export type ResumoDividas = {
  totalDevidoCentavos: number;
  /** Algum saldo é estimado (há atraso). */
  estimado: boolean;
  atrasoCentavos: number;
  atrasoParcelas: number;
  atrasoMaisAntigaDias: number;
  vence30Centavos: number;
  vence30Parcelas: number;
  dividasAtivas: number;
  pagoCentavos: number;
  progresso: number;
};

export type FiltrosDividas = {
  busca: string;
  credor: string;
  tipo: string;
  situacao: string;
  conta: string;
  pagina: number;
};
