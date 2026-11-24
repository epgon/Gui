/** Tipos da importação, compartilhados entre o navegador e o servidor. */

/** Uma transação lida do arquivo (OFX ou CSV), antes de virar linha da importação. */
export type TransacaoArquivo = {
  numeroLinha: number;
  data: string; // "2026-11-24"
  /** Sempre positivo; o sentido vem do tipo. */
  valorCentavos: number;
  tipo: "receita" | "despesa";
  descricao: string;
  documento: string | null;
  fitid: string | null;
  /** Só no CSV, quando há coluna de cliente/fornecedor ou categoria. */
  contato: string | null;
  categoria: string | null;
  bruto: Record<string, string>;
};

/** Campos que a linha vai ter quando virar lançamento. */
export type CamposLinha = {
  descricao?: string;
  categoriaId?: number | null;
  contatoId?: number | null;
  /** Cliente/fornecedor que veio no arquivo e ainda não existe: é cadastrado ao adicionar. */
  contatoNome?: string | null;
  formaPagamentoId?: number | null;
  tagIds?: number[];
  /** De onde veio a categoria: regra, histórico (último lançamento parecido) ou você. */
  origemCategoria?: "regra" | "historico" | "arquivo" | "manual" | null;
};

export type StatusLinha = "novo" | "encontrado" | "pendente" | "ignorado" | "adicionado" | "conciliado";

/** Um lançamento do sistema (ou recorrente previsto) que pode ser o mesmo da linha do extrato. */
export type Candidato = {
  /** "l:12" (lançamento gravado) ou "r:5:2026-11-10" (ocorrência prevista de recorrente). */
  chave: string;
  descricao: string;
  data: string;
  valorCentavos: number;
  tipo: "receita" | "despesa";
  destino: string; // nome da conta ou cartão
  realizado: boolean;
  previsto: boolean;
};

export type CampoCondicao = "descricao" | "documento" | "valor" | "tipo";
export type OperadorCondicao = "contem" | "nao_contem" | "igual" | "comeca" | "termina" | "maior" | "menor";
export type Condicao = { campo: CampoCondicao; operador: OperadorCondicao; valor: string };

export type PreencherRegra = {
  descricao?: string | null;
  categoriaId?: number | null;
  contatoId?: number | null;
  formaPagamentoId?: number | null;
  tagIds?: number[];
};

export type RegraAplicavel = {
  id: number;
  nome: string;
  contaId: number | null;
  cartaoId: number | null;
  ordem: number;
  condicoes: Condicao[];
  acao: "ignorar" | "preencher";
  preencher: PreencherRegra;
};

/** Configuração dos vínculos do CSV (o que o sistema memoriza para os próximos arquivos). */
export type ConfiguracaoCsv = {
  separador: ";" | "," | "\t";
  decimal: "virgula" | "ponto";
  formatoData: "dd/mm/aaaa" | "mm/dd/aaaa" | "aaaa-mm-dd";
  temCabecalho: boolean;
  /** Valores positivos são despesas (comum em fatura de cartão). */
  inverterSinal: boolean;
  /** Índice da coluna de cada campo (null = não usado). */
  colunas: {
    data: number | null;
    descricao: number | null;
    valor: number | null;
    /** Alternativa ao Valor: colunas separadas de saída e entrada. */
    valorDebito: number | null;
    valorCredito: number | null;
    tipo: number | null;
    documento: number | null;
    contato: number | null;
    categoria: number | null;
  };
};

export const CAMPOS_CSV: { chave: keyof ConfiguracaoCsv["colunas"]; rotulo: string; obrigatorio?: boolean; ajuda?: string }[] = [
  { chave: "data", rotulo: "Data", obrigatorio: true, ajuda: "Data do lançamento no extrato." },
  { chave: "descricao", rotulo: "Descrição", obrigatorio: true },
  { chave: "valor", rotulo: "Valor", ajuda: "Valor com sinal (negativo = saída). Se o arquivo tem colunas separadas de saída e entrada, use os dois campos abaixo." },
  { chave: "valorDebito", rotulo: "Valor de saída (débito)" },
  { chave: "valorCredito", rotulo: "Valor de entrada (crédito)" },
  { chave: "tipo", rotulo: "Tipo (débito ou crédito)", ajuda: "Coluna que diz se é saída (D, débito) ou entrada (C, crédito). Sem ela, o sinal do valor decide." },
  { chave: "documento", rotulo: "Documento" },
  { chave: "contato", rotulo: "Cliente ou Fornecedor" },
  { chave: "categoria", rotulo: "Categoria" },
];

/** Passo "Destino e checagem" do assistente. */
export type DadosDestino = {
  destino: string; // "conta:3" ou "cartao:2"
  toleranciaDias: string; // "0" = exata
  qualquerConta: boolean;
  contatoPessoa: "fisica" | "juridica";
  contatoCliente: boolean;
  contatoFornecedor: boolean;
};

/** Cadastro de regra (tela Regras ou "Criar Regra" na revisão). */
export type DadosRegra = {
  nome: string;
  destino: string; // "" = todas
  condicoes: Condicao[];
  acao: "ignorar" | "preencher";
  descricao: string;
  categoriaId: string;
  contatoId: string;
  formaPagamentoId: string;
  tagIds: number[];
  ordem: string;
};

/** Uma linha na tela de revisão. */
export type LinhaRevisao = {
  id: number;
  numeroLinha: number;
  data: string;
  valorCentavos: number;
  tipo: "receita" | "despesa";
  descricaoOriginal: string;
  documento: string | null;
  campos: CamposLinha;
  status: StatusLinha;
  duplicada: boolean;
  candidatos: Candidato[];
  lancamento: { id: number; descricao: string } | null;
  regra: { id: number; nome: string } | null;
  bruto: Record<string, string>;
};
