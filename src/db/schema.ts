/**
 * Tabelas do banco de dados (Fase 0: seções 4.1 e 4.2 do plano).
 *
 * Regras que valem para todas:
 * - Dinheiro sempre em centavos inteiros (R$ 83,37 = 8337).
 * - Datas sem hora para vencimento, nascimento etc. (tipo "date").
 * - Cadastros não são apagados: são inativados pelo campo "ativo".
 * - Não existe coluna de "dono": o sistema tem um único usuário.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  customType,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** Campos presentes em quase todas as tabelas. */
const camposPadrao = {
  id: serial("id").primaryKey(),
  ativo: boolean("ativo").notNull().default(true),
  padraoSistema: boolean("padrao_sistema").notNull().default(false),
  campoAuxiliar: text("campo_auxiliar"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Campos de endereço, repetidos em usuário e contato. */
const camposEndereco = {
  cep: varchar("cep", { length: 9 }),
  logradouro: text("logradouro"),
  numero: varchar("numero", { length: 20 }),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  uf: varchar("uf", { length: 2 }),
};

// ---------------------------------------------------------------------------
// Listas fixas de opções
// ---------------------------------------------------------------------------

export const sexoEnum = pgEnum("sexo", ["masculino", "feminino", "outro", "nao_informado"]);

export const tipoContaEnum = pgEnum("tipo_conta", [
  "outro",
  "conta_corrente",
  "carteira",
  "poupanca",
  "investimento",
]);

export const naturezaCategoriaEnum = pgEnum("natureza_categoria", ["receita", "despesa"]);

export const categoriaEspecialEnum = pgEnum("categoria_especial", [
  "acerto_saldo",
  "cartao_credito",
  "transferencia",
]);

export const tipoPessoaEnum = pgEnum("tipo_pessoa", ["fisica", "juridica"]);

// ---------------------------------------------------------------------------
// 4.1. Usuário e configurações
// ---------------------------------------------------------------------------

/** O único usuário do sistema (uma linha só). */
export const usuario = pgTable(
  "usuario",
  {
    ...camposPadrao,
    nome: text("nome").notNull(),
    apelido: text("apelido"),
    email: text("email").notNull(),
    senhaHash: text("senha_hash").notNull(),
    telefone: varchar("telefone", { length: 20 }),
    nascimento: date("nascimento"),
    sexo: sexoEnum("sexo").notNull().default("nao_informado"),
    ...camposEndereco,
    avatarUrl: text("avatar_url"),
  },
  (t) => [uniqueIndex("usuario_email_unico").on(sql`lower(${t.email})`)],
);

/** Parâmetros e recursos, no formato chave e valor. */
export const configuracao = pgTable("configuracao", {
  ...camposPadrao,
  chave: text("chave").notNull().unique(),
  valor: jsonb("valor").notNull(),
});

/** Como cada lista é exibida (colunas, ordenação, paginação). */
export const preferenciaListagem = pgTable("preferencia_listagem", {
  ...camposPadrao,
  tela: text("tela").notNull().unique(),
  colunas: jsonb("colunas").notNull().default(sql`'[]'::jsonb`),
  ordenacao: jsonb("ordenacao").notNull().default(sql`'[]'::jsonb`),
  registrosPorPagina: smallint("registros_por_pagina").notNull().default(20),
  semPaginacao: boolean("sem_paginacao").notNull().default(false),
  destacarPares: boolean("destacar_pares").notNull().default(true),
  compactar: boolean("compactar").notNull().default(false),
});

/** Feriados (usados no "Apenas dia útil"). Ano vazio = repete todo ano. */
export const feriado = pgTable(
  "feriado",
  {
    ...camposPadrao,
    nome: text("nome").notNull(),
    dia: smallint("dia").notNull(),
    mes: smallint("mes").notNull(),
    ano: smallint("ano"),
    recorrente: boolean("recorrente").notNull().default(true),
  },
  (t) => [
    check("feriado_dia_valido", sql`${t.dia} between 1 and 31`),
    check("feriado_mes_valido", sql`${t.mes} between 1 and 12`),
  ],
);

/** Tabela de referência de bancos (ícone das contas e cartões). */
export const banco = pgTable("banco", {
  ...camposPadrao,
  codigo: varchar("codigo", { length: 10 }).unique(),
  nome: text("nome").notNull(),
  logoUrl: text("logo_url"),
});

// ---------------------------------------------------------------------------
// 4.2. Cadastros
// ---------------------------------------------------------------------------

export const contaFinanceira = pgTable("conta_financeira", {
  ...camposPadrao,
  descricao: text("descricao").notNull(),
  bancoId: integer("banco_id").references(() => banco.id),
  tipo: tipoContaEnum("tipo").notNull().default("outro"),
  considerarNosSaldos: boolean("considerar_nos_saldos").notNull().default(true),
  ordem: integer("ordem").notNull().default(0),
  /**
   * Saldo que a conta tinha no dia em que foi cadastrada (pode ser negativo).
   * Na Fase 2, vira o lançamento "Saldo Inicial" (categoria Acerto de Saldo).
   */
  saldoInicialCentavos: bigint("saldo_inicial_centavos", { mode: "number" }).notNull().default(0),
  saldoInicialData: date("saldo_inicial_data"),
});

export const cartaoCredito = pgTable(
  "cartao_credito",
  {
    ...camposPadrao,
    descricao: text("descricao").notNull(),
    bancoId: integer("banco_id").references(() => banco.id),
    limiteCentavos: integer("limite_centavos").notNull().default(0),
    ilimitado: boolean("ilimitado").notNull().default(false),
    diaFechamento: smallint("dia_fechamento").notNull(),
    diaVencimento: smallint("dia_vencimento").notNull(),
    contaPagamentoId: integer("conta_pagamento_id").references(() => contaFinanceira.id),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [
    check("cartao_dia_fechamento_valido", sql`${t.diaFechamento} between 1 and 31`),
    check("cartao_dia_vencimento_valido", sql`${t.diaVencimento} between 1 and 31`),
    check("cartao_limite_positivo", sql`${t.limiteCentavos} >= 0`),
  ],
);

/**
 * Categorias em árvore. A numeração (1., 9.4.1.) não é guardada:
 * é calculada pela posição na árvore (campo "ordem" entre irmãs).
 */
export const categoria = pgTable(
  "categoria",
  {
    ...camposPadrao,
    nome: text("nome").notNull(),
    categoriaPaiId: integer("categoria_pai_id").references((): AnyPgColumn => categoria.id),
    ordem: integer("ordem").notNull().default(0),
    /** Só as raízes têm cor; as filhas herdam. */
    cor: varchar("cor", { length: 7 }),
    natureza: naturezaCategoriaEnum("natureza").notNull().default("despesa"),
    /** Acerto de Saldo, Cartão de Crédito e Transferência: sem número, não podem ser excluídas. */
    especial: categoriaEspecialEnum("especial").unique(),
  },
  (t) => [index("categoria_pai_idx").on(t.categoriaPaiId)],
);

/** Clientes e Fornecedores. */
export const contato = pgTable("contato", {
  ...camposPadrao,
  pessoa: tipoPessoaEnum("pessoa").notNull().default("fisica"),
  nome: text("nome").notNull(),
  razaoSocial: text("razao_social"),
  documento: varchar("documento", { length: 18 }),
  email: text("email"),
  telefone: varchar("telefone", { length: 20 }),
  telefoneWhatsapp: boolean("telefone_whatsapp").notNull().default(false),
  sexo: sexoEnum("sexo").notNull().default("nao_informado"),
  nascimento: date("nascimento"),
  ...camposEndereco,
  observacoes: text("observacoes"),
  eCliente: boolean("e_cliente").notNull().default(false),
  eFornecedor: boolean("e_fornecedor").notNull().default(false),
});

export const formaPagamento = pgTable("forma_pagamento", {
  ...camposPadrao,
  descricao: text("descricao").notNull(),
  sigla: varchar("sigla", { length: 5 }),
});

export const tag = pgTable("tag", {
  ...camposPadrao,
  descricao: text("descricao").notNull(),
});

// ---------------------------------------------------------------------------
// 4.3. Lançamentos (Fase 2)
// ---------------------------------------------------------------------------

export const tipoLancamentoEnum = pgEnum("tipo_lancamento", [
  "despesa",
  "receita",
  "transferencia_saida",
  "transferencia_entrada",
  "saldo_inicial",
  "acerto_saldo",
  "pagamento_fatura",
]);

export const formatoLancamentoEnum = pgEnum("formato_lancamento", ["simples", "detalhado"]);

export const origemLancamentoEnum = pgEnum("origem_lancamento", ["manual", "parcelamento", "recorrente", "importacao", "sistema"]);

export const periodicidadeEnum = pgEnum("periodicidade", [
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
]);

export const situacaoFaturaEnum = pgEnum("situacao_fatura", ["aberta", "fechada", "paga"]);

/** Conteúdo binário (anexos). Guardado no próprio banco, sem serviço extra. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Fatura do cartão: uma por cartão e mês de fechamento, criada na primeira compra. */
export const fatura = pgTable(
  "fatura",
  {
    id: serial("id").primaryKey(),
    cartaoId: integer("cartao_id").notNull().references(() => cartaoCredito.id),
    /** Primeiro dia do mês em que a fatura fecha (ex.: 2026-12-01). */
    competencia: date("competencia").notNull(),
    dataFechamento: date("data_fechamento").notNull(),
    dataVencimento: date("data_vencimento").notNull(),
    situacao: situacaoFaturaEnum("situacao").notNull().default("aberta"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fatura_cartao_competencia_unica").on(t.cartaoId, t.competencia)],
);

/** Compra parcelada: as parcelas são gravadas todas de uma vez como lançamentos. */
export const parcelamento = pgTable("parcelamento", {
  id: serial("id").primaryKey(),
  descricaoBase: text("descricao_base").notNull(),
  valorTotalCentavos: bigint("valor_total_centavos", { mode: "number" }).notNull(),
  quantidade: smallint("quantidade").notNull(),
  periodicidade: periodicidadeEnum("periodicidade").notNull().default("mensal"),
  iniciarNaParcela: smallint("iniciar_na_parcela").notNull().default(1),
  dividirValor: boolean("dividir_valor").notNull().default(true),
  incluirParcelaNaDescricao: boolean("incluir_parcela_na_descricao").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/** Transferência entre contas: gera dois lançamentos ligados (saída e entrada). */
export const transferencia = pgTable("transferencia", {
  id: serial("id").primaryKey(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const lancamento = pgTable(
  "lancamento",
  {
    id: serial("id").primaryKey(),
    tipo: tipoLancamentoEnum("tipo").notNull(),
    formato: formatoLancamentoEnum("formato").notNull().default("simples"),
    descricao: text("descricao").notNull(),
    documento: varchar("documento", { length: 60 }),
    observacao: varchar("observacao", { length: 1000 }),
    /** Sempre positivo; o sinal vem do tipo. Só "Saldo Inicial" e "Acerto de Saldo" podem ser negativos. */
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    valorPagoCentavos: bigint("valor_pago_centavos", { mode: "number" }),
    /**
     * Pago com valor diferente (pagamento parcial, desconto ou juros): o valor que o lançamento tinha antes.
     * "Voltar para não pago" devolve este valor. Vazio = pago pelo valor do lançamento.
     */
    valorOriginalCentavos: bigint("valor_original_centavos", { mode: "number" }),
    dataVencimento: date("data_vencimento").notNull(),
    /** Vazia = ainda não pago/recebido. */
    dataPagamento: date("data_pagamento"),
    dataReferencia: date("data_referencia"),
    /** Compras no cartão: dia da compra (o vencimento é o da fatura). */
    dataCompra: date("data_compra"),
    realizarAutomaticamente: boolean("realizar_automaticamente").notNull().default(false),
    contaId: integer("conta_id").references(() => contaFinanceira.id),
    cartaoId: integer("cartao_id").references(() => cartaoCredito.id),
    faturaId: integer("fatura_id").references(() => fatura.id),
    /** Pagamento de fatura (tipo "pagamento_fatura"): a fatura que este lançamento pagou. */
    faturaPagaId: integer("fatura_paga_id").references(() => fatura.id),
    categoriaId: integer("categoria_id").references(() => categoria.id),
    formaPagamentoId: integer("forma_pagamento_id").references(() => formaPagamento.id),
    contatoId: integer("contato_id").references(() => contato.id),
    parcelamentoId: integer("parcelamento_id").references(() => parcelamento.id, { onDelete: "set null" }),
    parcelaNumero: smallint("parcela_numero"),
    parcelaTotal: smallint("parcela_total"),
    transferenciaId: integer("transferencia_id").references(() => transferencia.id, { onDelete: "cascade" }),
    /** Lançamento gravado a partir de um recorrente: a regra e a data original da ocorrência. */
    recorrenciaId: integer("recorrencia_id").references((): AnyPgColumn => recorrencia.id, { onDelete: "set null" }),
    dataOcorrencia: date("data_ocorrencia"),
    /** Restante de um pagamento parcial: o lançamento que foi pago em parte. */
    lancamentoOrigemId: integer("lancamento_origem_id").references((): AnyPgColumn => lancamento.id, { onDelete: "set null" }),
    /** Gestão de Dívidas: a dívida de que este lançamento é parcela (ou que ele acompanha). */
    dividaId: integer("divida_id").references((): AnyPgColumn => divida.id, { onDelete: "set null" }),
    origem: origemLancamentoEnum("origem").notNull().default("manual"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("lancamento_conta_ou_cartao", sql`num_nonnulls(${t.contaId}, ${t.cartaoId}) = 1`),
    check(
      "lancamento_valor_positivo",
      sql`${t.valorCentavos} >= 0 or ${t.tipo} in ('saldo_inicial', 'acerto_saldo')`,
    ),
    index("lancamento_vencimento_idx").on(t.dataVencimento),
    index("lancamento_pagamento_idx").on(t.dataPagamento),
    index("lancamento_conta_idx").on(t.contaId),
    index("lancamento_cartao_idx").on(t.cartaoId),
    index("lancamento_fatura_idx").on(t.faturaId),
    index("lancamento_fatura_paga_idx").on(t.faturaPagaId),
    index("lancamento_parcelamento_idx").on(t.parcelamentoId),
    index("lancamento_transferencia_idx").on(t.transferenciaId),
    index("lancamento_origem_idx").on(t.lancamentoOrigemId),
    index("lancamento_divida_idx").on(t.dividaId),
    uniqueIndex("lancamento_saldo_inicial_unico").on(t.contaId).where(sql`${t.tipo} = 'saldo_inicial'`),
    // Uma ocorrência de recorrente vira no máximo um lançamento (dois na transferência: saída e entrada).
    uniqueIndex("lancamento_ocorrencia_unica").on(t.recorrenciaId, t.dataOcorrencia, t.tipo).where(sql`${t.recorrenciaId} is not null`),
  ],
);

/** Itens do lançamento detalhado (cada um com a sua categoria). */
export const lancamentoItem = pgTable(
  "lancamento_item",
  {
    id: serial("id").primaryKey(),
    lancamentoId: integer("lancamento_id")
      .notNull()
      .references(() => lancamento.id, { onDelete: "cascade" }),
    tipo: naturezaCategoriaEnum("tipo").notNull(),
    descricao: text("descricao").notNull(),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    categoriaId: integer("categoria_id")
      .notNull()
      .references(() => categoria.id),
    ordem: smallint("ordem").notNull().default(0),
  },
  (t) => [index("lancamento_item_lancamento_idx").on(t.lancamentoId), check("lancamento_item_valor_positivo", sql`${t.valorCentavos} > 0`)],
);

export const lancamentoTag = pgTable(
  "lancamento_tag",
  {
    lancamentoId: integer("lancamento_id")
      .notNull()
      .references(() => lancamento.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id),
  },
  (t) => [uniqueIndex("lancamento_tag_unico").on(t.lancamentoId, t.tagId)],
);

/** Anexos (imagem ou PDF) guardados no próprio banco. */
export const anexo = pgTable(
  "anexo",
  {
    id: serial("id").primaryKey(),
    lancamentoId: integer("lancamento_id")
      .notNull()
      .references(() => lancamento.id, { onDelete: "cascade" }),
    nomeArquivo: text("nome_arquivo").notNull(),
    tipoMime: varchar("tipo_mime", { length: 100 }).notNull(),
    tamanhoBytes: integer("tamanho_bytes").notNull(),
    conteudo: bytea("conteudo").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("anexo_lancamento_idx").on(t.lancamentoId)],
);

// ---------------------------------------------------------------------------
// 4.4. Recorrentes (Fase 3)
// ---------------------------------------------------------------------------

export const formatoRecorrenciaEnum = pgEnum("formato_recorrencia", ["simples", "detalhado", "transferencia"]);

export const intervaloRecorrenciaEnum = pgEnum("intervalo_recorrencia", [
  "semanal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
  "livre",
]);

/** Planos: agrupam recorrentes com a mesma descrição e valor. */
export const plano = pgTable("plano", {
  ...camposPadrao,
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull(),
  tipo: naturezaCategoriaEnum("tipo").notNull().default("despesa"),
  valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
});

/**
 * A regra do recorrente. Os lançamentos futuros não são gravados antes da hora:
 * são calculados na hora de mostrar. Uma ocorrência só é gravada quando é paga,
 * editada ou realizada automaticamente.
 */
export const recorrencia = pgTable(
  "recorrencia",
  {
    ...camposPadrao,
    formato: formatoRecorrenciaEnum("formato").notNull().default("simples"),
    /** Despesa ou receita (no detalhado, o sinal da soma dos itens; na transferência, não se aplica). */
    tipo: naturezaCategoriaEnum("tipo").notNull().default("despesa"),
    /** Aceita as variáveis #ano# e #mes#, trocadas pelo ano e mês do vencimento. */
    descricao: text("descricao").notNull(),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    /** Média: 0 = valor fixo; 1 = valor do último lançamento; 2 a 12 = média dos últimos N. */
    mediaUltimos: smallint("media_ultimos").notNull().default(0),
    intervalo: intervaloRecorrenciaEnum("intervalo").notNull().default("mensal"),
    /** Só no intervalo "Livre": a cada quantos dias. */
    intervaloDias: smallint("intervalo_dias"),
    diaFixo: smallint("dia_fixo").notNull(),
    dataInicio: date("data_inicio").notNull(),
    repeticoes: smallint("repeticoes"),
    dataFim: date("data_fim"),
    realizarAutomaticamente: boolean("realizar_automaticamente").notNull().default(false),
    apenasDiaUtil: boolean("apenas_dia_util").notNull().default(false),
    contaId: integer("conta_id").references(() => contaFinanceira.id),
    cartaoId: integer("cartao_id").references(() => cartaoCredito.id),
    contaDestinoId: integer("conta_destino_id").references(() => contaFinanceira.id),
    categoriaId: integer("categoria_id").references(() => categoria.id),
    formaPagamentoId: integer("forma_pagamento_id").references(() => formaPagamento.id),
    contatoId: integer("contato_id").references(() => contato.id),
    planoId: integer("plano_id").references(() => plano.id),
    observacao: varchar("observacao", { length: 1000 }),
  },
  (t) => [
    check("recorrencia_conta_ou_cartao", sql`num_nonnulls(${t.contaId}, ${t.cartaoId}) = 1`),
    check("recorrencia_dia_fixo_valido", sql`${t.diaFixo} between 1 and 31`),
    check("recorrencia_valor_positivo", sql`${t.valorCentavos} >= 0`),
    check("recorrencia_media_valida", sql`${t.mediaUltimos} between 0 and 12`),
  ],
);

export const recorrenciaItem = pgTable(
  "recorrencia_item",
  {
    id: serial("id").primaryKey(),
    recorrenciaId: integer("recorrencia_id")
      .notNull()
      .references(() => recorrencia.id, { onDelete: "cascade" }),
    tipo: naturezaCategoriaEnum("tipo").notNull(),
    descricao: text("descricao").notNull(),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    categoriaId: integer("categoria_id")
      .notNull()
      .references(() => categoria.id),
    ordem: smallint("ordem").notNull().default(0),
  },
  (t) => [index("recorrencia_item_recorrencia_idx").on(t.recorrenciaId)],
);

export const recorrenciaTag = pgTable(
  "recorrencia_tag",
  {
    recorrenciaId: integer("recorrencia_id")
      .notNull()
      .references(() => recorrencia.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id),
  },
  (t) => [uniqueIndex("recorrencia_tag_unico").on(t.recorrenciaId, t.tagId)],
);

/** Ocorrências puladas (excluídas) de um recorrente: não aparecem mais. */
export const recorrenciaExcecao = pgTable(
  "recorrencia_excecao",
  {
    id: serial("id").primaryKey(),
    recorrenciaId: integer("recorrencia_id")
      .notNull()
      .references(() => recorrencia.id, { onDelete: "cascade" }),
    dataOcorrencia: date("data_ocorrencia").notNull(),
    motivo: text("motivo"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("recorrencia_excecao_unica").on(t.recorrenciaId, t.dataOcorrencia)],
);

// ---------------------------------------------------------------------------
// 4.7. Importação OFX e CSV, regras e conciliação (Fase 6)
// ---------------------------------------------------------------------------

export const formatoImportacaoEnum = pgEnum("formato_importacao", ["ofx", "csv", "pdf"]);
export const situacaoImportacaoEnum = pgEnum("situacao_importacao", ["rascunho", "concluida", "cancelada"]);
/** Em que passo do assistente a importação parou (para retomar o rascunho). */
export const etapaImportacaoEnum = pgEnum("etapa_importacao", ["destino", "vinculo", "revisao"]);
export const statusLinhaImportacaoEnum = pgEnum("status_linha_importacao", ["novo", "encontrado", "pendente", "ignorado", "adicionado", "conciliado"]);
export const acaoRegraImportacaoEnum = pgEnum("acao_regra_importacao", ["ignorar", "preencher"]);

/** Vínculos das colunas do CSV, memorizados por conta ou cartão. */
export const mapeamentoCsv = pgTable("mapeamento_csv", {
  ...camposPadrao,
  nome: text("nome").notNull(),
  contaId: integer("conta_id").references(() => contaFinanceira.id),
  cartaoId: integer("cartao_id").references(() => cartaoCredito.id),
  /** Separador, decimal, formato de data, cabeçalho e coluna de cada campo (ver lib/importacao/csv.ts). */
  configuracao: jsonb("configuracao").notNull(),
});

/** Regras automáticas: ignorar registros ou preencher campos (categoria, contato...). */
export const regraImportacao = pgTable("regra_importacao", {
  ...camposPadrao,
  nome: text("nome").notNull(),
  /** Vazio = vale para todas as contas e cartões. */
  contaId: integer("conta_id").references(() => contaFinanceira.id),
  cartaoId: integer("cartao_id").references(() => cartaoCredito.id),
  ordem: integer("ordem").notNull().default(0),
  /** Lista de { campo, operador, valor }; todas precisam valer. */
  condicoes: jsonb("condicoes").notNull(),
  acao: acaoRegraImportacaoEnum("acao").notNull(),
  /** { descricao, categoriaId, contatoId, formaPagamentoId, tagIds } */
  preencher: jsonb("preencher").notNull().default(sql`'{}'::jsonb`),
});

export const importacao = pgTable("importacao", {
  id: serial("id").primaryKey(),
  arquivoNome: text("arquivo_nome").notNull(),
  formato: formatoImportacaoEnum("formato").notNull(),
  /** Conteúdo do arquivo (já como texto), para voltar às etapas anteriores. */
  conteudo: text("conteudo").notNull(),
  contaId: integer("conta_id").references(() => contaFinanceira.id),
  cartaoId: integer("cartao_id").references(() => cartaoCredito.id),
  mapeamentoId: integer("mapeamento_id").references(() => mapeamentoCsv.id, { onDelete: "set null" }),
  situacao: situacaoImportacaoEnum("situacao").notNull().default("rascunho"),
  etapa: etapaImportacaoEnum("etapa").notNull().default("destino"),
  /** Checagem da conciliação: tolerância de datas (0 = exata) e se procura em qualquer conta. */
  toleranciaDias: smallint("tolerancia_dias").notNull().default(0),
  qualquerConta: boolean("qualquer_conta").notNull().default(false),
  /** Padrão para clientes e fornecedores novos que vierem no arquivo. */
  contatoPessoa: tipoPessoaEnum("contato_pessoa").notNull().default("juridica"),
  contatoCliente: boolean("contato_cliente").notNull().default(false),
  contatoFornecedor: boolean("contato_fornecedor").notNull().default(true),
  /** Informações que o arquivo traz (banco, conta, período, saldo). */
  infoArquivo: jsonb("info_arquivo").notNull().default(sql`'{}'::jsonb`),
  linhasPuladas: integer("linhas_puladas").notNull().default(0),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  concluidoEm: timestamp("concluido_em", { withTimezone: true }),
});

export const importacaoLinha = pgTable(
  "importacao_linha",
  {
    id: serial("id").primaryKey(),
    importacaoId: integer("importacao_id")
      .notNull()
      .references(() => importacao.id, { onDelete: "cascade" }),
    numeroLinha: integer("numero_linha").notNull(),
    dadosBrutos: jsonb("dados_brutos").notNull(),
    /** Código único da transação no OFX (evita importar duas vezes). */
    fitid: text("fitid"),
    data: date("data").notNull(),
    /** Sempre positivo; o sentido vem do tipo. */
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    tipo: naturezaCategoriaEnum("tipo").notNull(),
    /** Descrição como veio do banco. */
    descricao: text("descricao").notNull(),
    documento: text("documento"),
    /** O que vai para o lançamento: { descricao, categoriaId, contatoId, contatoNome, formaPagamentoId, tagIds, origem }. */
    campos: jsonb("campos").notNull().default(sql`'{}'::jsonb`),
    status: statusLinhaImportacaoEnum("status").notNull().default("novo"),
    /** Ignorada porque já tinha sido importada antes. */
    duplicada: boolean("duplicada").notNull().default(false),
    /** Lançamentos do sistema que batem com a linha (conciliação). */
    candidatos: jsonb("candidatos").notNull().default(sql`'[]'::jsonb`),
    /** O lançamento criado (Adicionar) ou conciliado. */
    lancamentoId: integer("lancamento_id").references(() => lancamento.id, { onDelete: "set null" }),
    /** Como o lançamento conciliado era antes (para desfazer). */
    conciliacaoAntes: jsonb("conciliacao_antes"),
    regraId: integer("regra_id").references(() => regraImportacao.id, { onDelete: "set null" }),
  },
  (t) => [
    index("importacao_linha_importacao_idx").on(t.importacaoId),
    index("importacao_linha_fitid_idx").on(t.fitid),
    index("importacao_linha_lancamento_idx").on(t.lancamentoId),
  ],
);

// ---------------------------------------------------------------------------
// 4.6. Orçamentos
// ---------------------------------------------------------------------------

/** Categorias raiz escolhidas para o orçamento (as filhas entram sozinhas). */
export const orcamentoCategoria = pgTable("orcamento_categoria", {
  id: serial("id").primaryKey(),
  categoriaId: integer("categoria_id")
    .notNull()
    .unique()
    .references(() => categoria.id, { onDelete: "cascade" }),
  ordem: integer("ordem").notNull().default(0),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Limite de gasto de uma categoria (raiz ou filha) a partir de um mês.
 * Replicação: um mês sem linha própria usa a do último mês anterior que tiver.
 * valor_centavos vazio = "sem limite" daquele mês em diante.
 */
export const orcamentoLimite = pgTable(
  "orcamento_limite",
  {
    id: serial("id").primaryKey(),
    categoriaId: integer("categoria_id")
      .notNull()
      .references(() => categoria.id, { onDelete: "cascade" }),
    /** Primeiro dia do mês (2026-11-01). */
    competencia: date("competencia").notNull(),
    valorCentavos: bigint("valor_centavos", { mode: "number" }),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("orcamento_limite_categoria_mes_idx").on(t.categoriaId, t.competencia)],
);

// ---------------------------------------------------------------------------
// Gestão de Dívidas (fase D1)
// ---------------------------------------------------------------------------

export const tipoDividaEnum = pgEnum("tipo_divida", [
  "emprestimo_pessoal",
  "consignado",
  "financiamento_veiculo",
  "financiamento_imovel",
  "cartao",
  "cheque_especial",
  "crediario",
  "pessoa_fisica",
  "conta_atrasada",
  "acordo",
  "outro",
]);
export const formaDividaEnum = pgEnum("forma_divida", ["parcelas_fixas", "sem_parcelas"]);
/** "Em dia" e "Em atraso" não são guardadas: saem das parcelas vencidas, na hora. */
export const situacaoDividaEnum = pgEnum("situacao_divida", ["ativa", "quitada", "renegociada", "cancelada"]);
export const garantiaDividaEnum = pgEnum("garantia_divida", ["nenhuma", "bem_financiado", "desconto_folha", "fiador"]);
export const tipoEventoDividaEnum = pgEnum("tipo_evento_divida", [
  "cadastro",
  "pagamento",
  "atualizacao_saldo",
  "amortizacao",
  "encargo",
  "renegociacao",
  "quitacao",
  "vinculo",
  "anotacao",
  "cancelamento",
  "desfeito",
]);

/** Contrato ou relacionamento com um credor. As parcelas são lançamentos comuns (lancamento.divida_id). */
export const divida = pgTable(
  "divida",
  {
    id: serial("id").primaryKey(),
    descricao: text("descricao").notNull(),
    contatoId: integer("contato_id")
      .notNull()
      .references(() => contato.id),
    tipo: tipoDividaEnum("tipo").notNull().default("outro"),
    situacao: situacaoDividaEnum("situacao").notNull().default("ativa"),
    forma: formaDividaEnum("forma").notNull(),
    valorOriginalCentavos: bigint("valor_original_centavos", { mode: "number" }),
    dataContratacao: date("data_contratacao"),
    /** Taxa de juros ao mês, em % (2,9900 = 2,99% a.m.). Vazio = sem taxa informada. */
    taxaMensal: numeric("taxa_mensal", { precision: 8, scale: 4 }),
    multaPercentual: numeric("multa_percentual", { precision: 6, scale: 2 }),
    moraMensal: numeric("mora_mensal", { precision: 6, scale: 2 }),
    garantia: garantiaDividaEnum("garantia").notNull().default("nenhuma"),
    contaId: integer("conta_id").references(() => contaFinanceira.id),
    categoriaId: integer("categoria_id").references(() => categoria.id),
    formaPagamentoId: integer("forma_pagamento_id").references(() => formaPagamento.id),
    parcelamentoId: integer("parcelamento_id").references(() => parcelamento.id, { onDelete: "set null" }),
    observacao: varchar("observacao", { length: 1000 }),
    quitadaEm: date("quitada_em"),
    encerradaEm: date("encerrada_em"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("divida_contato_idx").on(t.contatoId), index("divida_situacao_idx").on(t.situacao)],
);

/** Ligação de uma fatura de cartão ou de um recorrente a uma dívida (cada um em no máximo uma). */
export const dividaVinculo = pgTable(
  "divida_vinculo",
  {
    id: serial("id").primaryKey(),
    dividaId: integer("divida_id")
      .notNull()
      .references(() => divida.id, { onDelete: "cascade" }),
    faturaId: integer("fatura_id").references(() => fatura.id, { onDelete: "cascade" }),
    recorrenciaId: integer("recorrencia_id").references(() => recorrencia.id, { onDelete: "cascade" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("divida_vinculo_so_um", sql`num_nonnulls(${t.faturaId}, ${t.recorrenciaId}) = 1`),
    uniqueIndex("divida_vinculo_fatura_unico").on(t.faturaId).where(sql`${t.faturaId} is not null`),
    uniqueIndex("divida_vinculo_recorrencia_unico").on(t.recorrenciaId).where(sql`${t.recorrenciaId} is not null`),
    index("divida_vinculo_divida_idx").on(t.dividaId),
  ],
);

/** Histórico da dívida (linha do tempo). Correções nunca apagam o passado: viram um evento novo. */
export const dividaEvento = pgTable(
  "divida_evento",
  {
    id: serial("id").primaryKey(),
    dividaId: integer("divida_id")
      .notNull()
      .references(() => divida.id, { onDelete: "cascade" }),
    data: date("data").notNull(),
    tipo: tipoEventoDividaEnum("tipo").notNull(),
    valorCentavos: bigint("valor_centavos", { mode: "number" }),
    /** Atualização de saldo: o saldo que o credor informou. */
    saldoCentavos: bigint("saldo_centavos", { mode: "number" }),
    /** De onde veio o saldo: extrato, app, boleto, contato. */
    origemSaldo: text("origem_saldo"),
    lancamentoId: integer("lancamento_id").references(() => lancamento.id, { onDelete: "set null" }),
    descricao: text("descricao").notNull(),
    /** Valores antes e depois, cópias de parcelas etc. */
    dados: jsonb("dados"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("divida_evento_divida_idx").on(t.dividaId, t.data)],
);

// ---------------------------------------------------------------------------
// Gestão de Dívidas (fase D2): negociações e renegociação
// ---------------------------------------------------------------------------

export const situacaoNegociacaoEnum = pgEnum("situacao_negociacao", ["em_andamento", "proposta_recebida", "aguardando_resposta", "aceita", "recusada", "desistida"]);
export const canalNegociacaoEnum = pgEnum("canal_negociacao", ["telefone", "aplicativo", "agencia", "site", "feirao", "advogado", "outro"]);
export const quemProposEnum = pgEnum("quem_propos", ["credor", "eu"]);
export const modalidadePropostaEnum = pgEnum("modalidade_proposta", ["a_vista", "parcelada"]);
export const situacaoPropostaEnum = pgEnum("situacao_proposta", ["aberta", "aceita", "recusada"]);

/** A conversa com o credor antes de virar acordo. */
export const negociacao = pgTable(
  "negociacao",
  {
    id: serial("id").primaryKey(),
    contatoId: integer("contato_id")
      .notNull()
      .references(() => contato.id),
    situacao: situacaoNegociacaoEnum("situacao").notNull().default("em_andamento"),
    canal: canalNegociacaoEnum("canal").notNull().default("telefone"),
    protocolo: varchar("protocolo", { length: 60 }),
    dataInicio: date("data_inicio").notNull(),
    prazoResposta: date("prazo_resposta"),
    /** Quanto sobra por mês para pagar o acordo (digitado; a sobra calculada chega com o Simulador). */
    sobraMensalCentavos: bigint("sobra_mensal_centavos", { mode: "number" }),
    observacao: varchar("observacao", { length: 1000 }),
    /** A dívida Acordo criada quando a negociação foi aceita. */
    acordoId: integer("acordo_id").references((): AnyPgColumn => divida.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("negociacao_contato_idx").on(t.contatoId), index("negociacao_situacao_idx").on(t.situacao)],
);

export const negociacaoDivida = pgTable(
  "negociacao_divida",
  {
    id: serial("id").primaryKey(),
    negociacaoId: integer("negociacao_id")
      .notNull()
      .references(() => negociacao.id, { onDelete: "cascade" }),
    dividaId: integer("divida_id")
      .notNull()
      .references(() => divida.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("negociacao_divida_unico").on(t.negociacaoId, t.dividaId), index("negociacao_divida_divida_idx").on(t.dividaId)],
);

/** Proposta dentro da negociação. À vista: entrada = valor à vista e parcelas = 0. */
export const negociacaoProposta = pgTable(
  "negociacao_proposta",
  {
    id: serial("id").primaryKey(),
    negociacaoId: integer("negociacao_id")
      .notNull()
      .references(() => negociacao.id, { onDelete: "cascade" }),
    data: date("data").notNull(),
    quemPropos: quemProposEnum("quem_propos").notNull(),
    modalidade: modalidadePropostaEnum("modalidade").notNull(),
    entradaCentavos: bigint("entrada_centavos", { mode: "number" }).notNull().default(0),
    parcelas: smallint("parcelas").notNull().default(0),
    valorParcelaCentavos: bigint("valor_parcela_centavos", { mode: "number" }).notNull().default(0),
    primeiroVencimento: date("primeiro_vencimento"),
    totalCentavos: bigint("total_centavos", { mode: "number" }).notNull(),
    validade: date("validade"),
    situacao: situacaoPropostaEnum("situacao").notNull().default("aberta"),
    observacao: varchar("observacao", { length: 500 }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("negociacao_proposta_negociacao_idx").on(t.negociacaoId)],
);

/** Liga o acordo às dívidas originais que ele juntou (um acordo pode juntar várias). */
export const dividaRenegociacao = pgTable(
  "divida_renegociacao",
  {
    id: serial("id").primaryKey(),
    acordoId: integer("acordo_id")
      .notNull()
      .references(() => divida.id, { onDelete: "cascade" }),
    originalId: integer("original_id")
      .notNull()
      .references(() => divida.id),
    negociacaoId: integer("negociacao_id").references(() => negociacao.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("divida_renegociacao_unico").on(t.acordoId, t.originalId), index("divida_renegociacao_original_idx").on(t.originalId)],
);

// ---------------------------------------------------------------------------
// 4.8. Auditoria
// ---------------------------------------------------------------------------

/**
 * Simulação guardada (Gestão de Dívidas, Simulador). Só os parâmetros e o resumo do cálculo:
 * não se liga a lançamentos nem a dívidas e nunca altera dado real.
 */
export const simulacao = pgTable("simulacao", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 80 }).notNull(),
  /** quitar, estrategias, cenarios ou proposta. */
  modo: varchar("modo", { length: 20 }).notNull(),
  parametros: jsonb("parametros").notNull(),
  resumo: jsonb("resumo").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Gestão de Dívidas (fase D4): Consultor Gui (assuntos e mensagens)
// ---------------------------------------------------------------------------

/** Uma conversa do Consultor Gui, organizada por assunto. Só guarda texto e números: o Consultor nunca grava dívida nem lançamento. */
export const consultorAssunto = pgTable(
  "consultor_assunto",
  {
    id: serial("id").primaryKey(),
    titulo: varchar("titulo", { length: 80 }).notNull(),
    /** aberto ou arquivado. */
    situacao: varchar("situacao", { length: 12 }).notNull().default("aberto"),
    /** Assunto sobre uma dívida em particular (opcional). */
    dividaId: integer("divida_id").references(() => divida.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("consultor_assunto_situacao_idx").on(t.situacao, t.atualizadoEm)],
);

export const consultorMensagem = pgTable(
  "consultor_mensagem",
  {
    id: serial("id").primaryKey(),
    assuntoId: integer("assunto_id")
      .notNull()
      .references(() => consultorAssunto.id, { onDelete: "cascade" }),
    /** pessoa, gui (cálculo do Gui) ou gui_ia (fase D6). */
    autor: varchar("autor", { length: 10 }).notNull(),
    texto: text("texto").notNull(),
    /** Números usados, critério, "Como calculei" e ações sugeridas (só links). */
    dados: jsonb("dados"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consultor_mensagem_assunto_idx").on(t.assuntoId, t.criadoEm)],
);

// ---------------------------------------------------------------------------
// Gestão de Dívidas (fase D6): Consultor com IA (só a contagem de chamadas por dia)
// ---------------------------------------------------------------------------

/** Quantas vezes a IA externa foi chamada em cada dia (para o limite diário e o limite do plano gratuito). Não guarda perguntas, respostas nem chave. */
export const consultorUsoIa = pgTable("consultor_uso_ia", {
  id: serial("id").primaryKey(),
  dia: date("dia", { mode: "string" }).notNull().unique(),
  chamadas: integer("chamadas").notNull().default(0),
  falhas: integer("falhas").notNull().default(0),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Gestão de Dívidas (fase D5): Plano de Quitação
// ---------------------------------------------------------------------------

/**
 * Plano de Quitação "vivo". Guarda só o que se planejou (meta de pagamento por mês e dívida).
 * O realizado nunca é gravado: é calculado dos lançamentos pagos ligados às dívidas.
 * Cada ajuste aprovado cria uma nova versão; a anterior fica como "substituido".
 */
export const planoQuitacao = pgTable(
  "plano_quitacao",
  {
    id: serial("id").primaryKey(),
    nome: varchar("nome", { length: 80 }).notNull(),
    versao: integer("versao").notNull().default(1),
    planoAnteriorId: integer("plano_anterior_id").references((): AnyPgColumn => planoQuitacao.id, { onDelete: "set null" }),
    /** rascunho, ativo, substituido ou encerrado. */
    situacao: varchar("situacao", { length: 12 }).notNull().default("ativo"),
    estrategia: varchar("estrategia", { length: 20 }).notNull(),
    /** Quanto se paga por mês no total, parcelas incluídas. Vazio = só as parcelas. */
    valorMensalCentavos: bigint("valor_mensal_centavos", { mode: "number" }),
    reservaMinimaCentavos: bigint("reserva_minima_centavos", { mode: "number" }).notNull().default(0),
    /** Primeiro mês do plano (dia 1). */
    inicio: date("inicio").notNull(),
    /** Ordem personalizada, extras pontuais, sobra na aprovação, saldo planejado mês a mês e de onde veio o plano. */
    parametros: jsonb("parametros").notNull(),
    aprovadoEm: timestamp("aprovado_em", { withTimezone: true }),
    encerradoEm: timestamp("encerrado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("plano_quitacao_situacao_idx").on(t.situacao)],
);

/** Meta de pagamento de cada dívida em cada mês do plano. */
export const planoQuitacaoMes = pgTable(
  "plano_quitacao_mes",
  {
    id: serial("id").primaryKey(),
    planoId: integer("plano_id")
      .notNull()
      .references(() => planoQuitacao.id, { onDelete: "cascade" }),
    /** Primeiro dia do mês. */
    competencia: date("competencia").notNull(),
    dividaId: integer("divida_id")
      .notNull()
      .references(() => divida.id),
    planejadoCentavos: bigint("planejado_centavos", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("plano_quitacao_mes_unico").on(t.planoId, t.competencia, t.dividaId), index("plano_quitacao_mes_divida_idx").on(t.dividaId)],
);

/** Proposta de ajuste do plano e a decisão da pessoa. Nada muda no plano sem a aprovação. */
export const planoAjuste = pgTable(
  "plano_ajuste",
  {
    id: serial("id").primaryKey(),
    planoId: integer("plano_id")
      .notNull()
      .references(() => planoQuitacao.id, { onDelete: "cascade" }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    motivo: text("motivo").notNull(),
    /** As opções calculadas na hora da proposta (aumentar o valor ou adiar) e o cálculo. */
    proposta: jsonb("proposta").notNull(),
    /** pendente, aprovado ou recusado. */
    situacao: varchar("situacao", { length: 10 }).notNull().default("pendente"),
    /** Qual opção foi aprovada (aumentar ou adiar). */
    opcao: varchar("opcao", { length: 10 }),
    decididoEm: timestamp("decidido_em", { withTimezone: true }),
    /** A versão nova criada ao aprovar. */
    planoNovoId: integer("plano_novo_id").references(() => planoQuitacao.id, { onDelete: "set null" }),
  },
  (t) => [index("plano_ajuste_plano_idx").on(t.planoId, t.situacao)],
);

export const acaoAuditoriaEnum = pgEnum("acao_auditoria", [
  "cadastrou",
  "alterou",
  "ativou",
  "inativou",
  "excluiu",
  "pagou",
  "importou",
  "renegociou",
  "aprovou",
]);

/**
 * Histórico de tudo o que foi cadastrado, alterado, ativado ou inativado.
 * Gravado na mesma transação da operação, para nunca faltar.
 */
export const auditoria = pgTable(
  "auditoria",
  {
    id: serial("id").primaryKey(),
    quando: timestamp("quando", { withTimezone: true }).notNull().defaultNow(),
    tela: text("tela").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: integer("entidade_id"),
    acao: acaoAuditoriaEnum("acao").notNull(),
    descricao: text("descricao").notNull(),
    /** Campos gravados; na alteração, { antes, depois }. */
    dados: jsonb("dados"),
  },
  (t) => [index("auditoria_quando_idx").on(t.quando), index("auditoria_entidade_idx").on(t.entidade, t.entidadeId)],
);
