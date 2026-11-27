/** Tipos compartilhados entre a tela de Lançamentos (navegador) e o servidor. */
import type { SituacaoFatura } from "@/lib/cartoes/regras";
import type { Situacao, TipoLancamento } from "./regras";

export type Aba = "todos" | "receitas" | "despesas" | "transferencias" | "recorrentes";
export type FiltroSituacao = "" | "nao_realizado" | "realizado" | "a_vencer" | "vencido";

export type OperadorFiltro = "" | "dif";

export type Filtros = {
  mes: string; // "2026-11"
  aba: Aba;
  destino: string; // "", "conta:3" ou "cartao:2"
  situacao: FiltroSituacao;
  busca: string;
  detalhar: boolean;
  categoria: string;
  forma: string;
  contato: string;
  tag: string;
  /** Operador de cada filtro acima: "" = igual, "dif" = diferente. */
  categoriaOp: OperadorFiltro;
  formaOp: OperadorFiltro;
  contatoOp: OperadorFiltro;
  tagOp: OperadorFiltro;
  /** Filtro Avançado ("av" da URL). */
  avancado: string;
};

export type ItemDetalhe = { id: number; tipo: "receita" | "despesa"; descricao: string; valorCentavos: number; categoria: string; categoriaCor: string };

/** Uma linha da lista: um lançamento ou uma fatura de cartão (agrupando as compras). */
export type LinhaLista = {
  chave: string;
  id: number | null; // null para a linha da fatura
  faturaId: number | null;
  /** Só na linha da fatura: Aberta, Fechada ou Paga. */
  faturaSituacao: SituacaoFatura | null;
  tipo: TipoLancamento;
  formato: "simples" | "detalhado";
  descricao: string;
  /** Com sinal: entradas positivas, saídas negativas. */
  valorCentavos: number;
  data: string;
  dataPagamento: string | null;
  dataCompra: string | null;
  dataReferencia: string | null;
  documento: string | null;
  /** Valor pago (positivo), quando já foi pago. */
  valorPagoCentavos: number | null;
  situacao: Situacao;
  contaOuCartao: string;
  bancoCodigo: string | null;
  bancoNome: string | null;
  eCartao: boolean;
  cartaoId: number | null;
  categoria: string | null;
  categoriaCor: string | null;
  contato: string | null;
  forma: string | null;
  tags: string[];
  parcela: string | null; // "2/12"
  parcelamentoId: number | null;
  transferenciaId: number | null;
  /** Lançamento gravado a partir de um recorrente. */
  recorrenciaId: number | null;
  /** Dívida (Gestão de Dívidas) a que o lançamento pertence. */
  dividaId?: number | null;
  dividaNome?: string | null;
  /** Ocorrência prevista de um recorrente (ainda não gravada): id é null. */
  previsto: Ocorrencia | null;
  realizarAutomaticamente: boolean;
  /** Pago com valor diferente: o valor que o lançamento tinha antes (positivo). */
  valorOriginalCentavos?: number | null;
  /** Restante de um pagamento parcial. */
  restante?: boolean;
  observacao: boolean;
  anexos: number;
  itens: ItemDetalhe[];
  compras: LinhaLista[]; // só na linha da fatura
};

/** Uma ocorrência de recorrente: a regra e a data original. */
export type Ocorrencia = { recorrenciaId: number; data: string };

export type Resumo = {
  receitas: number;
  despesas: number;
  total: number;
  /** null quando o filtro é um cartão (cartão não tem saldo). */
  saldoAnterior: number | null;
  saldoPrevisto: number | null;
  saldoAtual: number | null;
};

export type OpcaoDestino = { valor: string; rotulo: string; grupo: "Contas" | "Cartões"; bancoCodigo: string | null; bancoNome: string | null; ativo: boolean };
export type OpcaoCategoria = { id: number; rotulo: string; cor: string; natureza: "receita" | "despesa"; nivel: number; ativo: boolean };
export type OpcaoSimples = { id: number; rotulo: string; ativo: boolean };
export type OpcaoCartao = { id: number; diaFechamento: number; diaVencimento: number };

export type Opcoes = {
  destinos: OpcaoDestino[];
  cartoes: OpcaoCartao[];
  categorias: OpcaoCategoria[];
  formas: OpcaoSimples[];
  contatos: OpcaoSimples[];
  tags: OpcaoSimples[];
};

export type ItemFormulario = { chave: string; tipo: "receita" | "despesa"; descricao: string; valor: string; categoriaId: string };
export type ParcelaFormulario = { numero: number; descricao: string; data: string; valor: string };

export type DadosParcelar = {
  periodicidade: string;
  quantidade: string;
  iniciarNaParcela: string;
  dividirValor: boolean;
  incluirParcelaNaDescricao: boolean;
  /** Parcelas conferidas/editadas em "Ver Parcelas" (vazio = gerar do jeito padrão). */
  parcelas: ParcelaFormulario[];
};

/** O que o formulário Novo Lançamento envia ao servidor. */
export type DadosLancamento = {
  aba: "simples" | "detalhado" | "transferencia";
  tipo: "receita" | "despesa";
  descricao: string;
  valor: string;
  data: string;
  pago: boolean;
  dataPagamento: string;
  realizarAutomaticamente: boolean;
  destino: string;
  contaDestinoId: string;
  categoriaId: string;
  formaPagamentoId: string;
  contatoId: string;
  tagIds: number[];
  documento: string;
  dataReferencia: string;
  observacao: string;
  itens: ItemFormulario[];
  parcelar: DadosParcelar | null;
  /** "Gerar Recorrente" ligado no Novo Lançamento. */
  recorrente?: DadosRecorrencia | null;
  /** Editando uma ocorrência prevista: ao salvar, ela vira lançamento. */
  ocorrencia?: Ocorrencia | null;
};

/** Bloco de recorrência (Intervalo, Dia Fixo, Início, Repetições ou Fim, Apenas dia útil). */
export type DadosRecorrencia = {
  intervalo: string;
  intervaloDias: string;
  diaFixo: string;
  dataInicio: string;
  fim: "repeticoes" | "data";
  repeticoes: string;
  dataFim: string;
  apenasDiaUtil: boolean;
};

export type AnexoInfo = { id: number; nomeArquivo: string; tipoMime: string; tamanhoBytes: number };

/** Lançamento carregado para edição. */
export type LancamentoEdicao = { id: number; dados: DadosLancamento; anexos: AnexoInfo[]; parcela: string | null; parcelamentoId: number | null };
