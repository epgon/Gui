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
  check,
  date,
  index,
  integer,
  jsonb,
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
// 4.8. Auditoria
// ---------------------------------------------------------------------------

export const acaoAuditoriaEnum = pgEnum("acao_auditoria", [
  "cadastrou",
  "alterou",
  "ativou",
  "inativou",
  "excluiu",
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
