/**
 * Configurações > Parâmetros e Recursos: formato, valores padrão e leitura segura.
 * Ficam na tabela "configuracao" (chave e valor). Este arquivo serve à tela e ao servidor.
 */

/** Cadastros que podem ter um Campo Auxiliar (um texto extra no cadastro). */
export const CADASTROS_AUXILIARES = [
  { chave: "contas", rotulo: "Contas Financeiras" },
  { chave: "cartoes", rotulo: "Cartões de Crédito" },
  { chave: "categorias", rotulo: "Categorias" },
  { chave: "contatos", rotulo: "Clientes e Fornecedores" },
  { chave: "formas", rotulo: "Formas de Pagamento" },
  { chave: "tags", rotulo: "Tags" },
] as const;
export type CadastroAuxiliar = (typeof CADASTROS_AUXILIARES)[number]["chave"];
export type CampoAuxiliar = { ativo: boolean; rotulo: string };

export const OPCOES_NOVO_ATUALIZADO = [
  { valor: 0, rotulo: "Não destacar" },
  { valor: 24, rotulo: "Últimas 24 horas" },
  { valor: 72, rotulo: "Últimos 3 dias" },
  { valor: 168, rotulo: "Últimos 7 dias" },
  { valor: 720, rotulo: "Últimos 30 dias" },
] as const;

export const OPCOES_PREVISAO = [30, 60, 90, 180, 360, 720] as const;

export type Parametros = {
  /** Texto do cabeçalho do sistema e das impressões. */
  titulo: string;
  exibirCores: boolean;
  exibirNumeracao: boolean;
  /** Por quantas horas um cadastro novo ou alterado fica com o destaque laranja (0 = não destaca). */
  novoAtualizadoHoras: number;
  previsaoRecorrenteDias: number;
  pagamentoParcial: boolean;
  campos: { dataReferencia: boolean; documento: boolean; observacao: boolean; anexos: boolean };
  camposAuxiliares: Record<CadastroAuxiliar, CampoAuxiliar>;
};

/** Recursos que podem ser desligados. Desligado, some dos menus e a tela avisa que está desativado. */
export const RECURSOS = [
  { chave: "cartoes", rotulo: "Cartões de Crédito", descricao: "Cartões, faturas e limite.", telas: ["/cadastros/cartoes-de-credito"] },
  { chave: "recorrentes", rotulo: "Lançamentos Recorrentes", descricao: "Contas que se repetem e Planos.", telas: ["/financeiro/recorrentes"] },
  { chave: "agenda", rotulo: "Agenda", descricao: "Calendário com o que vence em cada dia.", telas: ["/financeiro/agenda"] },
  { chave: "contatos", rotulo: "Clientes e Fornecedores", descricao: "Cadastro de pessoas e empresas.", telas: ["/cadastros/clientes-e-fornecedores"] },
  { chave: "formas_pagamento", rotulo: "Formas de Pagamento", descricao: "Pix, boleto, dinheiro...", telas: ["/cadastros/formas-de-pagamento"] },
  { chave: "tags", rotulo: "Tags", descricao: "Etiquetas livres nos lançamentos.", telas: ["/cadastros/tags"] },
  { chave: "orcamentos", rotulo: "Orçamentos", descricao: "Limites de gasto por categoria.", telas: ["/gestao/orcamentos"] },
  { chave: "importacao", rotulo: "Importação", descricao: "Extratos OFX e CSV do banco.", telas: ["/financeiro/importacoes"] },
  { chave: "exportacao", rotulo: "Exportação", descricao: "Exportar listas para Excel e CSV.", telas: [] },
  { chave: "impressao", rotulo: "Impressão", descricao: "Impressão em PDF das listas e relatórios.", telas: [] },
] as const;
export type Recurso = (typeof RECURSOS)[number]["chave"];
export type Recursos = Record<Recurso, boolean>;

const bool = (v: unknown, padrao: boolean) => (typeof v === "boolean" ? v : padrao);

/** Monta os Parâmetros a partir das linhas da tabela, com o padrão para o que faltar ou estiver errado. */
export function lerParametrosDe(c: Record<string, unknown>): Parametros {
  const horas = Number(c["novo_ou_atualizado_horas"]);
  const dias = Number(c["previsao_recorrente_dias"]);
  const auxGravado = (c["campos_auxiliares"] ?? {}) as Record<string, unknown>;
  const camposAuxiliares = {} as Record<CadastroAuxiliar, CampoAuxiliar>;
  for (const { chave } of CADASTROS_AUXILIARES) {
    const v = (auxGravado && typeof auxGravado === "object" ? auxGravado[chave] : null) as Partial<CampoAuxiliar> | null;
    camposAuxiliares[chave] = {
      ativo: bool(v?.ativo, false),
      rotulo: typeof v?.rotulo === "string" && v.rotulo.trim() ? v.rotulo.trim().slice(0, 40) : "Campo Auxiliar",
    };
  }
  return {
    titulo: typeof c["titulo"] === "string" ? (c["titulo"] as string).slice(0, 60) : "Gui",
    exibirCores: bool(c["categorias.exibir_cores"], true),
    exibirNumeracao: bool(c["categorias.exibir_numeracao"], true),
    novoAtualizadoHoras: OPCOES_NOVO_ATUALIZADO.some((o) => o.valor === horas) ? horas : 24,
    previsaoRecorrenteDias: Number.isInteger(dias) && dias > 0 && dias <= 3650 ? dias : 360,
    pagamentoParcial: bool(c["pagamento_parcial.ativo"], true),
    campos: {
      dataReferencia: bool(c["campos.data_referencia"], true),
      documento: bool(c["campos.documento"], true),
      observacao: bool(c["campos.observacao"], true),
      anexos: bool(c["campos.anexos"], true),
    },
    camposAuxiliares,
  };
}

export function lerRecursosDe(c: Record<string, unknown>): Recursos {
  const r = {} as Recursos;
  for (const { chave } of RECURSOS) r[chave] = bool(c[`recursos.${chave}`], true);
  return r;
}

/** Telas (endereços) escondidas pelos recursos desligados. */
export function telasOcultas(r: Recursos): string[] {
  return RECURSOS.filter((x) => !r[x.chave]).flatMap((x) => [...x.telas]);
}

/** Um cadastro é "novo ou atualizado" dentro do período escolhido nos Parâmetros. */
export function novoOuAtualizado(atualizadoEm: Date | string | null | undefined, horas: number, agora = Date.now()): boolean {
  if (!horas || !atualizadoEm) return false;
  const t = new Date(atualizadoEm).getTime();
  return Number.isFinite(t) && agora - t <= horas * 3600_000 && t <= agora + 60_000;
}
