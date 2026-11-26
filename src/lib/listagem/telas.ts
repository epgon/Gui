/**
 * Configurações da Listagem (engrenagem acima da tabela): colunas, ordenação e "Outros"
 * de cada lista, e os campos do Filtro Avançado e da Impressão Personalizada.
 */
import { GARANTIAS, ROTULO_SITUACAO_DIVIDA, TIPOS_DIVIDA } from "@/lib/dividas/regras";
import type { CampoAvancado } from "./avancado";

export type ColunaConfig = { chave: string; rotulo: string; fixa?: boolean; padrao: boolean };

export type TelaListagem = {
  titulo: string;
  colunas: ColunaConfig[];
  /** Campos do Filtro Avançado (também são as opções de Ordenação). */
  campos: CampoAvancado[];
  /** Cadastro com Campo Auxiliar (Parâmetros > Campos Auxiliares). */
  auxiliar?: "contas" | "cartoes" | "categorias" | "contatos" | "formas" | "tags";
  /** A lista tem ordem própria (árvore das categorias): sem a aba Ordenação. */
  semOrdenacao?: boolean;
};

const SITUACAO: CampoAvancado = { chave: "situacao", rotulo: "Situação", tipo: "lista", opcoes: [{ valor: "Ativo", rotulo: "Ativo" }, { valor: "Inativo", rotulo: "Inativo" }] };
const comuns = (aux: boolean): CampoAvancado[] => [
  { chave: "codigo", rotulo: "Código", tipo: "numero" },
  ...(aux ? [{ chave: "auxiliar", rotulo: "Campo Auxiliar", tipo: "texto" as const }] : []),
  { chave: "cadastrado", rotulo: "Cadastrado", tipo: "data" },
  { chave: "atualizado", rotulo: "Atualizado", tipo: "data" },
];
const colunasComuns = (aux: boolean): ColunaConfig[] => [
  { chave: "codigo", rotulo: "Código", padrao: false },
  ...(aux ? [{ chave: "auxiliar", rotulo: "Campo Auxiliar", padrao: false }] : []),
  { chave: "cadastrado", rotulo: "Cadastrado", padrao: false },
  { chave: "atualizado", rotulo: "Atualizado", padrao: false },
];

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const SIM_NAO: CampoAvancado["tipo"] = "booleano";

export const TELAS_LISTAGEM: Record<string, TelaListagem> = {
  dividas: {
    titulo: "Minhas Dívidas",
    colunas: [
      { chave: "divida", rotulo: "Dívida", fixa: true, padrao: true },
      { chave: "tipo", rotulo: "Tipo", padrao: true },
      { chave: "situacao", rotulo: "Situação", padrao: true },
      { chave: "proximo", rotulo: "Próximo Vencimento", padrao: true },
      { chave: "parcelas", rotulo: "Parcelas", padrao: true },
      { chave: "taxa", rotulo: "Taxa (% a.m.)", padrao: true },
      { chave: "saldo", rotulo: "Saldo Devedor", padrao: true },
      { chave: "progresso", rotulo: "Progresso", padrao: true },
      ...colunasComuns(false),
    ],
    campos: [
      { chave: "descricao", rotulo: "Dívida", tipo: "texto" },
      { chave: "credor", rotulo: "Credor", tipo: "texto" },
      { chave: "tipo", rotulo: "Tipo", tipo: "lista", opcoes: TIPOS_DIVIDA.map((t) => ({ valor: t.rotulo, rotulo: t.rotulo })) },
      { chave: "situacao", rotulo: "Situação", tipo: "lista", opcoes: Object.values(ROTULO_SITUACAO_DIVIDA).map((r) => ({ valor: r, rotulo: r })) },
      { chave: "garantia", rotulo: "Garantia", tipo: "lista", opcoes: GARANTIAS.map((g) => ({ valor: g.rotulo, rotulo: g.rotulo })) },
      { chave: "proximo", rotulo: "Próximo Vencimento", tipo: "data" },
      { chave: "contratacao", rotulo: "Data da Contratação", tipo: "data" },
      { chave: "parcelasPagas", rotulo: "Parcelas Pagas", tipo: "numero" },
      { chave: "parcelasTotal", rotulo: "Total de Parcelas", tipo: "numero" },
      { chave: "taxa", rotulo: "Taxa (% a.m.)", tipo: "numero" },
      { chave: "saldo", rotulo: "Saldo Devedor", tipo: "dinheiro" },
      { chave: "valorOriginal", rotulo: "Valor Original", tipo: "dinheiro" },
      { chave: "diasAtraso", rotulo: "Dias de Atraso", tipo: "numero" },
      ...comuns(false),
    ],
  },
  "contas-financeiras": {
    titulo: "Contas Financeiras",
    auxiliar: "contas",
    colunas: [
      { chave: "conta", rotulo: "Conta Financeira", fixa: true, padrao: true },
      { chave: "tipo", rotulo: "Tipo", padrao: true },
      { chave: "saldo", rotulo: "Saldo Inicial", padrao: true },
      { chave: "saldoAtual", rotulo: "Saldo Atual", padrao: true },
      { chave: "saldos", rotulo: "Nos saldos", padrao: true },
      { chave: "situacao", rotulo: "Situação", padrao: true },
      ...colunasComuns(true),
    ],
    campos: [
      { chave: "descricao", rotulo: "Conta Financeira", tipo: "texto" },
      { chave: "banco", rotulo: "Banco", tipo: "texto" },
      { chave: "tipo", rotulo: "Tipo", tipo: "texto" },
      { chave: "saldoInicial", rotulo: "Saldo Inicial", tipo: "dinheiro" },
      { chave: "saldoAtual", rotulo: "Saldo Atual", tipo: "dinheiro" },
      { chave: "considerar", rotulo: "Considerar nos saldos", tipo: SIM_NAO },
      SITUACAO,
      ...comuns(true),
    ],
  },
  "cartoes-de-credito": {
    titulo: "Cartões de Crédito",
    auxiliar: "cartoes",
    colunas: [
      { chave: "cartao", rotulo: "Cartão de Crédito", fixa: true, padrao: true },
      { chave: "fechamento", rotulo: "Fechamento", padrao: true },
      { chave: "vencimento", rotulo: "Vencimento", padrao: true },
      { chave: "pagamento", rotulo: "Conta para Pagamento", padrao: true },
      { chave: "uso", rotulo: "Uso do Limite", padrao: true },
      { chave: "limite", rotulo: "Limite", padrao: true },
      { chave: "situacao", rotulo: "Situação", padrao: true },
      { chave: "faturas", rotulo: "Faturas", padrao: true },
      ...colunasComuns(true),
    ],
    campos: [
      { chave: "descricao", rotulo: "Cartão de Crédito", tipo: "texto" },
      { chave: "banco", rotulo: "Bandeira ou Emissor", tipo: "texto" },
      { chave: "fechamento", rotulo: "Dia do Fechamento", tipo: "numero" },
      { chave: "vencimento", rotulo: "Dia do Vencimento", tipo: "numero" },
      { chave: "conta", rotulo: "Conta para Pagamento", tipo: "texto" },
      { chave: "limite", rotulo: "Limite", tipo: "dinheiro" },
      { chave: "ilimitado", rotulo: "Ilimitado", tipo: SIM_NAO },
      SITUACAO,
      ...comuns(true),
    ],
  },
  categorias: {
    titulo: "Categorias",
    auxiliar: "categorias",
    semOrdenacao: true,
    colunas: [
      { chave: "cor", rotulo: "Cor", padrao: true },
      { chave: "numero", rotulo: "Numeração", padrao: true },
      { chave: "categoria", rotulo: "Categoria", fixa: true, padrao: true },
      { chave: "tipo", rotulo: "Tipo", padrao: true },
      { chave: "situacao", rotulo: "Situação", padrao: true },
      ...colunasComuns(true),
    ],
    campos: [
      { chave: "nome", rotulo: "Categoria", tipo: "texto" },
      { chave: "numero", rotulo: "Numeração", tipo: "texto" },
      { chave: "tipo", rotulo: "Tipo", tipo: "lista", opcoes: [{ valor: "Receita", rotulo: "Receita" }, { valor: "Despesa", rotulo: "Despesa" }, { valor: "Especial", rotulo: "Especial" }] },
      { chave: "nivel", rotulo: "Nível", tipo: "numero" },
      SITUACAO,
      ...comuns(true),
    ],
  },
  "clientes-e-fornecedores": {
    titulo: "Clientes e Fornecedores",
    auxiliar: "contatos",
    colunas: [
      { chave: "nome", rotulo: "Nome", fixa: true, padrao: true },
      { chave: "documento", rotulo: "CPF ou CNPJ", padrao: false },
      { chave: "email", rotulo: "E-mail", padrao: false },
      { chave: "telefone", rotulo: "Telefone", padrao: true },
      { chave: "cidade", rotulo: "Cidade", padrao: true },
      { chave: "papel", rotulo: "Tipo", padrao: true },
      { chave: "situacao", rotulo: "Situação", padrao: true },
      ...colunasComuns(true),
    ],
    campos: [
      { chave: "nome", rotulo: "Nome", tipo: "texto" },
      { chave: "razaoSocial", rotulo: "Razão Social", tipo: "texto" },
      { chave: "pessoa", rotulo: "Pessoa", tipo: "lista", opcoes: [{ valor: "Física", rotulo: "Física" }, { valor: "Jurídica", rotulo: "Jurídica" }] },
      { chave: "documento", rotulo: "Documento", tipo: "texto" },
      { chave: "email", rotulo: "E-mail", tipo: "texto" },
      { chave: "telefone", rotulo: "Telefone", tipo: "texto" },
      {
        chave: "sexo",
        rotulo: "Sexo",
        tipo: "lista",
        opcoes: [
          { valor: "Masculino", rotulo: "Masculino" },
          { valor: "Feminino", rotulo: "Feminino" },
          { valor: "Outro", rotulo: "Outro" },
          { valor: "Não informado", rotulo: "Não informado" },
        ],
      },
      { chave: "nascimento", rotulo: "Nascimento", tipo: "data" },
      { chave: "cliente", rotulo: "Cliente", tipo: SIM_NAO },
      { chave: "fornecedor", rotulo: "Fornecedor", tipo: SIM_NAO },
      { chave: "cep", rotulo: "CEP", tipo: "texto" },
      { chave: "endereco", rotulo: "Endereço", tipo: "texto" },
      { chave: "numero", rotulo: "Número", tipo: "texto" },
      { chave: "complemento", rotulo: "Complemento", tipo: "texto" },
      { chave: "bairro", rotulo: "Bairro", tipo: "texto" },
      { chave: "cidade", rotulo: "Cidade", tipo: "texto" },
      { chave: "uf", rotulo: "Estado", tipo: "lista", opcoes: UFS.map((u) => ({ valor: u, rotulo: u })) },
      { chave: "observacoes", rotulo: "Observação", tipo: "texto" },
      SITUACAO,
      ...comuns(true),
    ],
  },
  "formas-de-pagamento": {
    titulo: "Formas de Pagamento",
    auxiliar: "formas",
    colunas: [
      { chave: "forma", rotulo: "Forma de Pagamento", fixa: true, padrao: true },
      { chave: "sigla", rotulo: "Sigla", padrao: true },
      { chave: "situacao", rotulo: "Situação", padrao: true },
      ...colunasComuns(true),
    ],
    campos: [{ chave: "descricao", rotulo: "Forma de Pagamento", tipo: "texto" }, { chave: "sigla", rotulo: "Sigla", tipo: "texto" }, SITUACAO, ...comuns(true)],
  },
  tags: {
    titulo: "Tags",
    auxiliar: "tags",
    colunas: [{ chave: "tag", rotulo: "Tag", fixa: true, padrao: true }, { chave: "situacao", rotulo: "Situação", padrao: true }, ...colunasComuns(true)],
    campos: [{ chave: "descricao", rotulo: "Tag", tipo: "texto" }, SITUACAO, ...comuns(true)],
  },
  auditoria: {
    titulo: "Auditoria",
    colunas: [
      { chave: "horario", rotulo: "Horário", fixa: true, padrao: true },
      { chave: "descricao", rotulo: "Descrição", fixa: true, padrao: true },
      { chave: "dados", rotulo: "Dados", padrao: true },
      { chave: "tela", rotulo: "Tela", padrao: false },
      { chave: "acao", rotulo: "Ação", padrao: false },
      { chave: "codigo", rotulo: "Código", padrao: false },
    ],
    campos: [],
    semOrdenacao: true,
  },
};

export const POR_PAGINA_OPCOES = [10, 20, 50, 100] as const;

export type Ordenacao = { campo: string; direcao: "asc" | "desc" } | null;

export type PreferenciaListagem = {
  /** Colunas visíveis. */
  colunas: string[];
  ordenacao: Ordenacao;
  porPagina: number;
  destacarPares: boolean;
  compactar: boolean;
};

export function preferenciaPadrao(tela: string): PreferenciaListagem {
  const t = TELAS_LISTAGEM[tela];
  return { colunas: t ? t.colunas.filter((c) => c.padrao || c.fixa).map((c) => c.chave) : [], ordenacao: null, porPagina: 20, destacarPares: true, compactar: false };
}

/** Confere o que veio do banco (ou da tela): só colunas e campos que existem, fixas sempre visíveis. */
export function normalizarPreferencia(tela: string, gravada: Partial<{ colunas: unknown; ordenacao: unknown; porPagina: unknown; destacarPares: unknown; compactar: unknown }> | null | undefined): PreferenciaListagem {
  const t = TELAS_LISTAGEM[tela];
  const padrao = preferenciaPadrao(tela);
  if (!t || !gravada) return padrao;
  const existentes = t.colunas.map((c) => c.chave);
  const lista = Array.isArray(gravada.colunas) ? gravada.colunas.filter((c): c is string => typeof c === "string" && existentes.includes(c)) : [];
  const colunas = lista.length ? [...new Set([...t.colunas.filter((c) => c.fixa).map((c) => c.chave), ...lista])] : padrao.colunas;
  const o = gravada.ordenacao as { campo?: unknown; direcao?: unknown } | null;
  const ordenacao: Ordenacao =
    !t.semOrdenacao && o && typeof o.campo === "string" && t.campos.some((c) => c.chave === o.campo) ? { campo: o.campo, direcao: o.direcao === "desc" ? "desc" : "asc" } : null;
  const porPagina = (POR_PAGINA_OPCOES as readonly number[]).includes(Number(gravada.porPagina)) ? Number(gravada.porPagina) : padrao.porPagina;
  return {
    colunas,
    ordenacao,
    porPagina,
    destacarPares: typeof gravada.destacarPares === "boolean" ? gravada.destacarPares : true,
    compactar: typeof gravada.compactar === "boolean" ? gravada.compactar : false,
  };
}

/** Só as colunas ligadas (as que não estão na configuração, como o menu de três pontos, ficam sempre). */
export function colunasVisiveis<C extends { chave: string }>(tela: string, colunas: C[], pref: PreferenciaListagem): C[] {
  const t = TELAS_LISTAGEM[tela];
  if (!t) return colunas;
  const configuraveis = new Set(t.colunas.map((c) => c.chave));
  return colunas.filter((c) => !configuraveis.has(c.chave) || pref.colunas.includes(c.chave));
}
