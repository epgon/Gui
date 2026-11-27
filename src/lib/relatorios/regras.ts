/**
 * Contas dos relatórios (Fluxo de Caixa e Saldo Detalhado), sem banco de dados.
 * Testes em regras.test.ts. Datas no formato "2026-11-24"; dinheiro em centavos, com sinal (entrada +, saída -).
 */
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { COR_ESPECIAL, type CategoriaNaArvore } from "@/lib/categorias";
import { dataValida, formatarData } from "@/lib/datas";
import { diasNoMes, montarData, somarDias, somarMeses } from "@/lib/lancamentos/regras";
import type { FiltroSituacao } from "@/lib/lancamentos/tipos";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Periodicidade = "diario" | "mensal" | "trimestral" | "anual";
export type Agrupamento = "dia" | "mes" | "ano" | "categoria" | "conta" | "contato" | "forma" | "tag";
export type ConsiderarData = "vencimento" | "pagamento" | "referencia" | "compra";
/** Como o intervalo "de ... a ..." é digitado: datas, mês/ano ou anos. */
export type Granularidade = "dia" | "mes" | "ano";

export const PERIODICIDADES: { valor: Periodicidade; rotulo: string; texto: string }[] = [
  { valor: "diario", rotulo: "Diário", texto: "Um dia em cada coluna." },
  { valor: "mensal", rotulo: "Mensal", texto: "Um mês em cada coluna." },
  { valor: "trimestral", rotulo: "Trimestral", texto: "Trimestres do ano (1T, 2T, 3T e 4T)." },
  { valor: "anual", rotulo: "Anual", texto: "Um ano em cada coluna." },
];

export const AGRUPAMENTOS: { valor: Agrupamento; rotulo: string; coluna: string; texto: string }[] = [
  { valor: "dia", rotulo: "Total por Dia", coluna: "Data", texto: "Receitas, despesas e resultado de cada dia." },
  { valor: "mes", rotulo: "Total por Mês", coluna: "Mês", texto: "Receitas, despesas e resultado de cada mês." },
  { valor: "ano", rotulo: "Total por Ano", coluna: "Ano", texto: "Receitas, despesas e resultado de cada ano." },
  { valor: "categoria", rotulo: "Categorias", coluna: "Categoria", texto: "Quanto entrou e saiu em cada categoria." },
  { valor: "conta", rotulo: "Contas Financeiras", coluna: "Conta Financeira", texto: "Totais de cada conta e cartão." },
  { valor: "contato", rotulo: "Clientes e Fornecedores", coluna: "Cliente e Fornecedor", texto: "Com quem você mais recebe e gasta." },
  { valor: "forma", rotulo: "Formas de Pagamento", coluna: "Forma de Pagamento", texto: "Pix, boleto, dinheiro, cartão..." },
  { valor: "tag", rotulo: "Tags", coluna: "Tag", texto: "Totais de cada tag." },
];

export const DATAS_CONSIDERADAS: { valor: ConsiderarData; rotulo: string }[] = [
  { valor: "vencimento", rotulo: "Data de Vencimento" },
  { valor: "pagamento", rotulo: "Data de Pagamento" },
  { valor: "referencia", rotulo: "Data de Referência" },
  { valor: "compra", rotulo: "Data de Compra" },
];

export const SITUACOES_RELATORIO: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: "", rotulo: "Todas as situações" },
  { valor: "nao_realizado", rotulo: "Não Realizado" },
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "a_vencer", rotulo: "A Vencer" },
  { valor: "vencido", rotulo: "Vencido" },
];

/** Um valor que entra no relatório: um lançamento simples, um item de um detalhado ou um recorrente previsto. */
export type Movimento = {
  /** A data escolhida em "Considerar". */
  data: string;
  valorCentavos: number;
  /** Lançamentos de sistema: só entram com a chave "Incluir as categorias" ligada. */
  especial: "acerto_saldo" | "transferencia" | null;
  categoriaId: number | null;
  contaId: number | null;
  cartaoId: number | null;
  contatoId: number | null;
  formaId: number | null;
  tagIds: number[];
  /** Parcela ou lançamento de uma dívida da Gestão de Dívidas (o relatório não usa; o Simulador usa para tirar as parcelas da sobra). */
  dividaId?: number | null;
};

export type FiltrosRelatorio = {
  /** Como veio na URL (para devolver aos campos "de" e "a"). */
  de: string;
  ate: string;
  /** O intervalo já resolvido em datas. */
  inicio: string;
  fim: string;
  destino: string;
  situacao: FiltroSituacao;
  considerar: ConsiderarData;
  categoria: string;
  forma: string;
  contato: string;
  tag: string;
  incluirAcerto: boolean;
  incluirTransferencia: boolean;
  /** Mostra também as categorias sem nenhum valor no período (linhas zeradas). */
  incluirZeradas: boolean;
};

/**
 * Engrenagem "Incluir as categorias" dos relatórios. Fica gravada (uma para cada relatório),
 * e não na URL: vale para a tela, para a impressão e para as próximas vezes. Tudo desligado por padrão.
 */
export type InclusoesRelatorio = { zeradas: boolean; acerto: boolean; transferencia: boolean };
export const INCLUSOES_PADRAO: InclusoesRelatorio = { zeradas: false, acerto: false, transferencia: false };
export const TELAS_COM_INCLUSOES = ["fluxo-de-caixa", "saldo-detalhado"] as const;
export type TelaComInclusoes = (typeof TELAS_COM_INCLUSOES)[number];

/** Lê o que veio gravado (ou de fora), aceitando só verdadeiro/falso; o resto fica no padrão. */
export function lerInclusoes(valor: unknown): InclusoesRelatorio {
  const v = valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  return { zeradas: v.zeradas === true, acerto: v.acerto === true, transferencia: v.transferencia === true };
}

// ---------------------------------------------------------------------------
// Intervalo
// ---------------------------------------------------------------------------

/** Quantas colunas (ou linhas) cada tipo aceita, para a tela não travar. */
export const LIMITES: Record<Granularidade, number> = { dia: 366, mes: 60, ano: 20 };
/** No Fluxo de Caixa Diário, cada dia é uma coluna: até dois meses. */
export const LIMITE_DIARIO = 62;

export const granularidadeDe = (x: Periodicidade | Agrupamento): Granularidade =>
  x === "mensal" || x === "trimestral" || x === "mes" ? "mes" : x === "anual" || x === "ano" ? "ano" : "dia";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function intervaloPadrao(tipo: Periodicidade | Agrupamento, hoje: string): { de: string; ate: string } {
  const ano = Number(hoje.slice(0, 4));
  const mes = hoje.slice(0, 7);
  switch (tipo) {
    case "mensal":
    case "mes":
    case "trimestral":
      return { de: `${ano}-01`, ate: `${ano}-12` };
    case "anual":
    case "ano":
      return { de: String(ano - 2), ate: String(ano) };
    default:
      return { de: `${mes}-01`, ate: montarData(ano, Number(hoje.slice(5, 7)), diasNoMes(ano, Number(hoje.slice(5, 7)))) };
  }
}

const valido: Record<Granularidade, (x: string) => boolean> = {
  dia: (x) => dataValida(x),
  mes: (x) => /^\d{4}-(0[1-9]|1[0-2])$/.test(x),
  ano: (x) => /^\d{4}$/.test(x) && Number(x) >= 1900 && Number(x) <= 2200,
};

/** Primeiro dia de cada coisa digitada (data, mês ou ano). */
const inicioDe = (g: Granularidade, x: string) => (g === "dia" ? x : g === "mes" ? `${x}-01` : `${x}-01-01`);
/** Último dia de cada coisa digitada. */
const fimDe = (g: Granularidade, x: string) => {
  if (g === "dia") return x;
  if (g === "ano") return `${x}-12-31`;
  const [ano, mes] = x.split("-").map(Number);
  return montarData(ano, mes, diasNoMes(ano, mes));
};

/** Avança "n" unidades (dia, mês ou ano) a partir do texto digitado. */
function avancar(g: Granularidade, x: string, n: number): string {
  if (g === "dia") return somarDias(x, n);
  if (g === "mes") return somarMeses(`${x}-01`, n).slice(0, 7);
  return String(Number(x) + n);
}

/** Quantas unidades há entre "de" e "ate" (inclusive). */
function contar(g: Granularidade, de: string, ate: string): number {
  if (g === "dia") return Math.round((Date.parse(ate + "T12:00:00Z") - Date.parse(de + "T12:00:00Z")) / 86_400_000) + 1;
  if (g === "mes") return (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + Number(ate.slice(5, 7)) - Number(de.slice(5, 7)) + 1;
  return Number(ate) - Number(de) + 1;
}

/**
 * Lê "de" e "a" da URL no formato do tipo (data, mês/ano ou ano), corrige o que vier estranho
 * (invertido, inválido, longo demais) e devolve também as datas de início e fim.
 * O trimestral sempre vai do início do primeiro trimestre ao fim do último.
 */
export function lerIntervalo(tipo: Periodicidade | Agrupamento, deUrl: string, ateUrl: string, hoje: string) {
  const g = granularidadeDe(tipo);
  const padrao = intervaloPadrao(tipo, hoje);
  let de = valido[g](deUrl) ? deUrl : padrao.de;
  let ate = valido[g](ateUrl) ? ateUrl : valido[g](deUrl) ? deUrl : padrao.ate;
  if (ate < de) [de, ate] = [ate, de];
  const limite = tipo === "diario" ? LIMITE_DIARIO : LIMITES[g];
  if (contar(g, de, ate) > limite) ate = avancar(g, de, limite - 1);
  let inicio = inicioDe(g, de);
  let fim = fimDe(g, ate);
  if (tipo === "trimestral") {
    inicio = inicioDoTrimestre(inicio);
    fim = fimDoTrimestre(fim);
  }
  return { de, ate, inicio, fim, granularidade: g };
}

const trimestre = (iso: string) => Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
const inicioDoTrimestre = (iso: string) => montarData(Number(iso.slice(0, 4)), (trimestre(iso) - 1) * 3 + 1, 1);
function fimDoTrimestre(iso: string) {
  const ano = Number(iso.slice(0, 4));
  const mes = trimestre(iso) * 3;
  return montarData(ano, mes, diasNoMes(ano, mes));
}

// ---------------------------------------------------------------------------
// Filtros vindos da URL
// ---------------------------------------------------------------------------

export function lerPeriodicidade(sp: ParametrosBusca): Periodicidade | null {
  const p = parametro(sp, "periodo");
  return PERIODICIDADES.some((x) => x.valor === p) ? (p as Periodicidade) : null;
}

export function lerAgrupamento(sp: ParametrosBusca): Agrupamento | null {
  const r = parametro(sp, "relatorio");
  return AGRUPAMENTOS.some((x) => x.valor === r) ? (r as Agrupamento) : null;
}

export function lerFiltrosRelatorio(sp: ParametrosBusca, tipo: Periodicidade | Agrupamento, hoje: string, inclusoes: InclusoesRelatorio = INCLUSOES_PADRAO): FiltrosRelatorio {
  const id = (nome: string) => (/^\d+$/.test(parametro(sp, nome)) ? parametro(sp, nome) : "");
  const situacao = parametro(sp, "situacao");
  const considerar = parametro(sp, "considerar");
  const destino = parametro(sp, "destino");
  const intervalo = lerIntervalo(tipo, parametro(sp, "de"), parametro(sp, "ate"), hoje);
  return {
    de: intervalo.de,
    ate: intervalo.ate,
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    destino: /^(conta|cartao):\d+$/.test(destino) ? destino : "",
    situacao: (SITUACOES_RELATORIO.some((s) => s.valor === situacao) ? situacao : "") as FiltroSituacao,
    considerar: (DATAS_CONSIDERADAS.some((d) => d.valor === considerar) ? considerar : "vencimento") as ConsiderarData,
    categoria: id("categoria"),
    forma: id("forma"),
    contato: id("contato"),
    tag: id("tag"),
    incluirAcerto: inclusoes.acerto,
    incluirTransferencia: inclusoes.transferencia,
    incluirZeradas: inclusoes.zeradas,
  };
}

/** Os filtros como parâmetros da URL (só os que fogem do padrão). */
export function parametrosDosFiltros(f: FiltrosRelatorio): Record<string, string> {
  return {
    de: f.de,
    ate: f.ate,
    destino: f.destino,
    situacao: f.situacao,
    considerar: f.considerar === "vencimento" ? "" : f.considerar,
    categoria: f.categoria,
    forma: f.forma,
    contato: f.contato,
    tag: f.tag,
  };
}

/** "Período: 01/11/2026 a 30/11/2026" */
export function rotuloIntervalo(f: Pick<FiltrosRelatorio, "inicio" | "fim">): string {
  return f.inicio === f.fim ? formatarData(f.inicio) : `${formatarData(f.inicio)} a ${formatarData(f.fim)}`;
}

// ---------------------------------------------------------------------------
// Colunas (períodos) e chaves
// ---------------------------------------------------------------------------

export type Coluna = { chave: string; rotulo: string; inicio: string; fim: string };

/** Em que coluna cai uma data. */
export function chaveDoPeriodo(p: Periodicidade, data: string): string {
  if (p === "diario") return data;
  if (p === "mensal") return data.slice(0, 7);
  if (p === "trimestral") return `${data.slice(0, 4)}-T${trimestre(data)}`;
  return data.slice(0, 4);
}

/** As colunas do período, em ordem: dias, meses, trimestres ("4T.2026") ou anos. */
export function colunasDoPeriodo(p: Periodicidade, inicio: string, fim: string): Coluna[] {
  const colunas: Coluna[] = [];
  let atual = inicio;
  while (atual <= fim) {
    let ate: string;
    let rotulo: string;
    const ano = Number(atual.slice(0, 4));
    const mes = Number(atual.slice(5, 7));
    if (p === "diario") {
      ate = atual;
      rotulo = `${atual.slice(8, 10)}/${atual.slice(5, 7)}`;
    } else if (p === "mensal") {
      ate = montarData(ano, mes, diasNoMes(ano, mes));
      rotulo = `${MESES[mes - 1]}/${ano}`;
    } else if (p === "trimestral") {
      ate = fimDoTrimestre(atual);
      rotulo = `${trimestre(atual)}T.${ano}`;
    } else {
      ate = `${ano}-12-31`;
      rotulo = String(ano);
    }
    colunas.push({ chave: chaveDoPeriodo(p, atual), rotulo, inicio: atual, fim: ate > fim ? fim : ate });
    atual = somarDias(ate, 1);
  }
  return colunas;
}

// ---------------------------------------------------------------------------
// Fluxo de Caixa
// ---------------------------------------------------------------------------

export type LinhaValores = { valores: number[]; total: number; media: number };
export type NoCategoria = LinhaValores & { chave: string; rotulo: string; cor: string; nivel: number; filhos: NoCategoria[] };
export type FluxoDeCaixa = {
  colunas: Coluna[];
  receitas: LinhaValores & { filhos: NoCategoria[] };
  despesas: LinhaValores & { filhos: NoCategoria[] };
  saldo: LinhaValores;
};

type Arvore = Map<number, CategoriaNaArvore>;

const cachePosicoes = new WeakMap<Arvore, Map<number, number>>();
/** Posição de cada categoria na árvore (para ordenar as linhas como na tela de Categorias). */
function posicoes(arvore: Arvore): Map<number, number> {
  let p = cachePosicoes.get(arvore);
  if (!p) {
    p = new Map([...arvore.keys()].map((id, i) => [id, i]));
    cachePosicoes.set(arvore, p);
  }
  return p;
}

const NOMES_ESPECIAIS = { acerto_saldo: "Acerto de Saldo", transferencia: "Transferência" } as const;

/** O caminho de categorias até a do movimento (raiz, filha, neta), para somar em cada nível. */
function caminhoDaCategoria(m: Movimento, arvore: Arvore): { chave: string; rotulo: string; cor: string; ordem: number }[] {
  const c = m.categoriaId ? arvore.get(m.categoriaId) : undefined;
  const posicao = posicoes(arvore);
  if (!c) {
    if (m.especial) return [{ chave: `e-${m.especial}`, rotulo: NOMES_ESPECIAIS[m.especial], cor: COR_ESPECIAL, ordem: 1e6 }];
    return [{ chave: "sem", rotulo: "Sem categoria", cor: COR_ESPECIAL, ordem: 2e6 }];
  }
  if (c.especial) return [{ chave: `c${c.id}`, rotulo: c.nome, cor: COR_ESPECIAL, ordem: 1e6 + (posicao.get(c.id) ?? 0) }];
  return [...c.ancestrais, c.id].map((id) => {
    const x = arvore.get(id)!;
    return { chave: `c${x.id}`, rotulo: `${x.numero} ${x.nome}`.trim(), cor: x.corEfetiva, ordem: posicao.get(x.id) ?? 0 };
  });
}

/**
 * Categorias que aparecem zeradas com "Categorias Zeradas" ligada: as ativas, sem as especiais
 * (Acerto de Saldo e Transferência têm chave própria). Com o filtro de Categoria, só ela e as filhas.
 */
export function categoriasZeradas(arvore: Arvore, categoriaFiltro = ""): CategoriaNaArvore[] {
  const filtro = categoriaFiltro ? Number(categoriaFiltro) : null;
  return [...arvore.values()].filter((c) => c.ativo && !c.especial && (filtro === null || c.id === filtro || c.ancestrais.includes(filtro)));
}

const media = (total: number, n: number) => (n ? Math.round(total / n) : 0);

/**
 * Monta o Fluxo de Caixa: Receitas, Despesas e Saldo por coluna, com média e total.
 * Receitas e Despesas abrem por categoria (raiz > filha > neta). O saldo é só o do período
 * (receitas + despesas), sem o saldo das contas.
 * "zeradas": categorias que entram mesmo sem valor (cada uma do lado da sua natureza).
 */
export function montarFluxoDeCaixa(movimentos: Movimento[], p: Periodicidade, colunas: Coluna[], arvore: Arvore, zeradas: CategoriaNaArvore[] = []): FluxoDeCaixa {
  const indice = new Map(colunas.map((c, i) => [c.chave, i]));
  const n = colunas.length;
  const zeros = () => new Array<number>(n).fill(0);
  type NoInterno = { chave: string; rotulo: string; cor: string; ordem: number; nivel: number; valores: number[]; filhos: Map<string, NoInterno> };
  const lados = { receitas: { valores: zeros(), filhos: new Map<string, NoInterno>() }, despesas: { valores: zeros(), filhos: new Map<string, NoInterno>() } };

  /** Desce (criando o que faltar) pelo caminho da categoria e soma o valor na coluna "i" de cada nível. */
  const somar = (lado: (typeof lados)["receitas"], m: Movimento, i: number | null) => {
    let filhos = lado.filhos;
    caminhoDaCategoria(m, arvore).forEach((passo, nivel) => {
      let no = filhos.get(passo.chave);
      if (!no) {
        no = { ...passo, nivel: nivel + 1, valores: zeros(), filhos: new Map() };
        filhos.set(passo.chave, no);
      }
      if (i !== null) no.valores[i] += m.valorCentavos;
      filhos = no.filhos;
    });
  };

  for (const c of zeradas) somar(c.natureza === "receita" ? lados.receitas : lados.despesas, { categoriaId: c.id, especial: null } as Movimento, null);

  for (const m of movimentos) {
    const i = indice.get(chaveDoPeriodo(p, m.data));
    if (i === undefined || m.valorCentavos === 0) continue;
    const lado = m.valorCentavos > 0 ? lados.receitas : lados.despesas;
    lado.valores[i] += m.valorCentavos;
    somar(lado, m, i);
  }

  const finalizar = (mapa: Map<string, NoInterno>): NoCategoria[] =>
    [...mapa.values()]
      .sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
      .map((no) => {
        const total = no.valores.reduce((s, v) => s + v, 0);
        return { chave: no.chave, rotulo: no.rotulo, cor: no.cor, nivel: no.nivel, valores: no.valores, total, media: media(total, n), filhos: finalizar(no.filhos) };
      });
  const linha = (valores: number[]): LinhaValores => {
    const total = valores.reduce((s, v) => s + v, 0);
    return { valores, total, media: media(total, n) };
  };

  return {
    colunas,
    receitas: { ...linha(lados.receitas.valores), filhos: finalizar(lados.receitas.filhos) },
    despesas: { ...linha(lados.despesas.valores), filhos: finalizar(lados.despesas.filhos) },
    saldo: linha(lados.receitas.valores.map((v, i) => v + lados.despesas.valores[i])),
  };
}

// ---------------------------------------------------------------------------
// Saldo Detalhado
// ---------------------------------------------------------------------------

export type LinhaSaldo = { chave: string; rotulo: string; cor: string | null; receitas: number; despesas: number; resultado: number };
export type SaldoDetalhado = {
  linhas: LinhaSaldo[];
  /** Vazio nas Tags: o mesmo lançamento pode ter várias tags. */
  total: { receitas: number; despesas: number; resultado: number } | null;
};

export type Nomes = {
  arvore: Arvore;
  contas: Map<number, string>;
  cartoes: Map<number, string>;
  contatos: Map<number, string>;
  formas: Map<number, string>;
  tags: Map<number, string>;
};

const SEM = "~sem";

/** As chaves (e rótulos) em que um movimento entra, conforme o relatório escolhido. */
function grupos(m: Movimento, a: Agrupamento, nomes: Nomes): { chave: string; rotulo: string; cor: string | null; ordem: number | string }[] {
  switch (a) {
    case "dia":
      return [{ chave: m.data, rotulo: formatarData(m.data), cor: null, ordem: m.data }];
    case "mes":
      return [{ chave: m.data.slice(0, 7), rotulo: `${m.data.slice(5, 7)}/${m.data.slice(0, 4)}`, cor: null, ordem: m.data.slice(0, 7) }];
    case "ano":
      return [{ chave: m.data.slice(0, 4), rotulo: m.data.slice(0, 4), cor: null, ordem: m.data.slice(0, 4) }];
    case "categoria": {
      const passo = caminhoDaCategoria(m, nomes.arvore).at(-1)!;
      return [{ chave: passo.chave, rotulo: passo.rotulo, cor: passo.cor, ordem: passo.ordem }];
    }
    case "conta":
      if (m.contaId) return [{ chave: `conta:${m.contaId}`, rotulo: nomes.contas.get(m.contaId) ?? "Conta", cor: null, ordem: `1${(nomes.contas.get(m.contaId) ?? "").toLowerCase()}` }];
      return [{ chave: `cartao:${m.cartaoId}`, rotulo: nomes.cartoes.get(m.cartaoId ?? 0) ?? "Cartão", cor: null, ordem: `2${(nomes.cartoes.get(m.cartaoId ?? 0) ?? "").toLowerCase()}` }];
    case "contato":
      return m.contatoId
        ? [{ chave: String(m.contatoId), rotulo: nomes.contatos.get(m.contatoId) ?? "", cor: null, ordem: (nomes.contatos.get(m.contatoId) ?? "").toLowerCase() }]
        : [{ chave: SEM, rotulo: "Sem cliente ou fornecedor", cor: null, ordem: "￿" }];
    case "forma":
      return m.formaId
        ? [{ chave: String(m.formaId), rotulo: nomes.formas.get(m.formaId) ?? "", cor: null, ordem: (nomes.formas.get(m.formaId) ?? "").toLowerCase() }]
        : [{ chave: SEM, rotulo: "Sem forma de pagamento", cor: null, ordem: "￿" }];
    case "tag":
      return m.tagIds.map((t) => ({ chave: String(t), rotulo: nomes.tags.get(t) ?? "", cor: null, ordem: (nomes.tags.get(t) ?? "").toLowerCase() }));
  }
}

/**
 * Monta o Saldo Detalhado: uma linha por dia, mês, ano, categoria, conta, contato, forma ou tag,
 * com Receitas, Despesas e Resultado. Por dia, mês e ano, todos os períodos do intervalo aparecem (zerados em cinza).
 * Por Categorias, "zeradas" são as categorias que aparecem mesmo sem valor.
 */
export function montarSaldoDetalhado(movimentos: Movimento[], a: Agrupamento, nomes: Nomes, intervalo: { inicio: string; fim: string }, zeradas: CategoriaNaArvore[] = []): SaldoDetalhado {
  const mapa = new Map<string, LinhaSaldo & { ordem: number | string }>();
  if (a === "categoria") {
    for (const c of zeradas) {
      const g = grupos({ categoriaId: c.id, especial: null } as Movimento, a, nomes)[0];
      mapa.set(g.chave, { ...g, receitas: 0, despesas: 0, resultado: 0 });
    }
  }
  if (a === "dia" || a === "mes" || a === "ano") {
    const p: Periodicidade = a === "dia" ? "diario" : a === "mes" ? "mensal" : "anual";
    for (const c of colunasDoPeriodo(p, intervalo.inicio, intervalo.fim)) {
      const g = grupos({ data: c.inicio } as Movimento, a, nomes)[0];
      mapa.set(g.chave, { ...g, receitas: 0, despesas: 0, resultado: 0 });
    }
  }
  for (const m of movimentos) {
    if (m.valorCentavos === 0 || m.data < intervalo.inicio || m.data > intervalo.fim) continue;
    for (const g of grupos(m, a, nomes)) {
      const linha = mapa.get(g.chave) ?? { ...g, receitas: 0, despesas: 0, resultado: 0 };
      if (m.valorCentavos > 0) linha.receitas += m.valorCentavos;
      else linha.despesas += m.valorCentavos;
      linha.resultado += m.valorCentavos;
      mapa.set(g.chave, linha);
    }
  }
  const linhas = [...mapa.values()]
    .sort((x, y) => (typeof x.ordem === "number" && typeof y.ordem === "number" ? x.ordem - y.ordem : String(x.ordem).localeCompare(String(y.ordem), "pt-BR")) || x.rotulo.localeCompare(y.rotulo, "pt-BR"))
    .map((l): LinhaSaldo => ({ chave: l.chave, rotulo: l.rotulo, cor: l.cor, receitas: l.receitas, despesas: l.despesas, resultado: l.resultado }));
  if (a === "tag") return { linhas, total: null };
  const total = linhas.reduce((t, l) => ({ receitas: t.receitas + l.receitas, despesas: t.despesas + l.despesas, resultado: t.resultado + l.resultado }), { receitas: 0, despesas: 0, resultado: 0 });
  return { linhas, total };
}
