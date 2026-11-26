/**
 * Contas das negociações e da renegociação de dívidas (sem banco de dados), com testes em negociacao.test.ts.
 * Dinheiro sempre em centavos inteiros; datas no formato "2026-11-24".
 */
import { formatarData } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { somarPeriodo, type Periodicidade } from "@/lib/lancamentos/regras";

const reais = (centavos: number) => `R$ ${formatarCentavos(centavos)}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// ---------------------------------------------------------------------------
// Situações e rótulos
// ---------------------------------------------------------------------------

export const SITUACOES_NEGOCIACAO = [
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "proposta_recebida", rotulo: "Proposta recebida" },
  { valor: "aguardando_resposta", rotulo: "Aguardando resposta" },
  { valor: "aceita", rotulo: "Aceita" },
  { valor: "recusada", rotulo: "Recusada" },
  { valor: "desistida", rotulo: "Desistida" },
] as const;
export type SituacaoNegociacao = (typeof SITUACOES_NEGOCIACAO)[number]["valor"];

/** Enquanto a negociação está numa destas, as dívidas dela ficam "Em negociação". */
export const SITUACOES_ABERTAS_NEGOCIACAO: SituacaoNegociacao[] = ["em_andamento", "proposta_recebida", "aguardando_resposta"];
export const negociacaoAberta = (s: string) => (SITUACOES_ABERTAS_NEGOCIACAO as string[]).includes(s);

export const CANAIS_NEGOCIACAO = [
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "aplicativo", rotulo: "Aplicativo" },
  { valor: "agencia", rotulo: "Agência" },
  { valor: "site", rotulo: "Site" },
  { valor: "feirao", rotulo: "Feirão" },
  { valor: "advogado", rotulo: "Advogado" },
  { valor: "outro", rotulo: "Outro" },
] as const;
export type CanalNegociacao = (typeof CANAIS_NEGOCIACAO)[number]["valor"];

export const rotuloSituacaoNegociacao = (v: string) => SITUACOES_NEGOCIACAO.find((s) => s.valor === v)?.rotulo ?? v;
export const rotuloCanal = (v: string) => CANAIS_NEGOCIACAO.find((s) => s.valor === v)?.rotulo ?? v;

// ---------------------------------------------------------------------------
// Proposta: total, desconto, juros implícitos
// ---------------------------------------------------------------------------

/** O que o credor (ou a pessoa) propôs: entrada mais parcelas iguais. À vista: só a entrada e zero parcelas. */
export type CondicoesProposta = { entradaCentavos: number; parcelas: number; valorParcelaCentavos: number };

export const totalDoAcordo = (c: CondicoesProposta) => c.entradaCentavos + c.parcelas * c.valorParcelaCentavos;

/**
 * Juros implícitos ao mês (em %): a taxa que faz as parcelas valerem exatamente o que se deve hoje
 * (tabela Price, primeira parcela um período depois). Ex.: R$ 1.000,00 em 12 × R$ 88,85 dá cerca de 1% ao mês.
 * Devolve null quando não há o que calcular (sem parcelas, sem valor a financiar ou parcelas somando menos que o financiado,
 * isto é, há desconto e nenhum juro). Zero quando as parcelas somam exatamente o financiado.
 */
export function jurosImplicitosMensais(financiadoCentavos: number, parcelas: number, valorParcelaCentavos: number): number | null {
  if (parcelas < 1 || financiadoCentavos <= 0 || valorParcelaCentavos <= 0) return null;
  const soma = parcelas * valorParcelaCentavos;
  if (soma < financiadoCentavos) return null;
  if (soma === financiadoCentavos) return 0;
  const valorPresente = (i: number) => (valorParcelaCentavos * (1 - (1 + i) ** -parcelas)) / i;
  let baixo = 1e-9;
  let alto = 10; // 1000% ao mês: bem acima de qualquer cobrança real
  for (let k = 0; k < 200; k++) {
    const meio = (baixo + alto) / 2;
    if (valorPresente(meio) > financiadoCentavos) baixo = meio;
    else alto = meio;
  }
  return Math.round(((baixo + alto) / 2) * 100 * 10_000) / 10_000;
}

export type AnaliseProposta = {
  totalCentavos: number;
  saldoCentavos: number;
  /** Quanto a proposta tira do saldo (0 se não há desconto). */
  descontoCentavos: number;
  descontoPct: number;
  /** Quanto a proposta passa do saldo (0 se não passa). */
  acrescimoCentavos: number;
  jurosImplicitosMensal: number | null;
  /** Total maior que o saldo atual. */
  maisCaro: boolean;
  /** A parcela cabe na sobra digitada; null quando não há sobra informada ou a proposta é à vista. */
  cabeNaSobra: boolean | null;
  /** Quanto falta (ou sobra) por mês: sobra − parcela. */
  folgaCentavos: number | null;
};

/** Os números de uma proposta, comparados com o saldo atual das dívidas e com a sobra mensal digitada. */
export function analisarProposta(p: CondicoesProposta & { saldoCentavos: number; sobraMensalCentavos: number | null }): AnaliseProposta {
  const totalCentavos = totalDoAcordo(p);
  const saldoCentavos = p.saldoCentavos;
  const descontoCentavos = Math.max(0, saldoCentavos - totalCentavos);
  const acrescimoCentavos = Math.max(0, totalCentavos - saldoCentavos);
  const aPrazo = p.parcelas > 0;
  const folgaCentavos = aPrazo && p.sobraMensalCentavos !== null ? p.sobraMensalCentavos - p.valorParcelaCentavos : null;
  return {
    totalCentavos,
    saldoCentavos,
    descontoCentavos,
    descontoPct: saldoCentavos > 0 ? Math.round((descontoCentavos / saldoCentavos) * 10_000) / 100 : 0,
    acrescimoCentavos,
    jurosImplicitosMensal: jurosImplicitosMensais(saldoCentavos - p.entradaCentavos, p.parcelas, p.valorParcelaCentavos),
    maisCaro: totalCentavos > saldoCentavos,
    cabeNaSobra: folgaCentavos === null ? null : folgaCentavos >= 0,
    folgaCentavos,
  };
}

/** Valida as condições (entrada, quantidade, valor). Devolve a mensagem do problema ou null. */
export function validarCondicoes(c: CondicoesProposta & { modalidade?: "a_vista" | "parcelada" }): string | null {
  const inteiro = (n: number) => Number.isInteger(n) && n >= 0;
  if (![c.entradaCentavos, c.parcelas, c.valorParcelaCentavos].every(inteiro)) return "Confira os valores informados.";
  if (c.parcelas > 360) return "O acordo aceita no máximo 360 parcelas.";
  if (c.parcelas > 0 && c.valorParcelaCentavos <= 0) return "Informe o **Valor da Parcela**.";
  if (c.parcelas === 0 && c.valorParcelaCentavos > 0) return "Informe a **Quantidade de Parcelas** (ou deixe o valor da parcela vazio).";
  if (totalDoAcordo(c) <= 0) return c.modalidade === "a_vista" ? "Informe o **Valor à Vista**." : "Informe a entrada, ou a quantidade e o valor das parcelas.";
  return null;
}

// ---------------------------------------------------------------------------
// Renegociação (assistente)
// ---------------------------------------------------------------------------

/** Um lançamento de uma dívida original (parcela, restante, encargo ou conta acompanhada). */
export type LancamentoOriginal = {
  id: number;
  descricao: string;
  vencimento: string;
  valorCentavos: number;
  dataPagamento: string | null;
};

export type DividaOriginal = {
  id: number;
  descricao: string;
  /** Saldo devedor mostrado na tela. */
  saldoCentavos: number;
  lancamentos: LancamentoOriginal[];
};

export type CondicoesRenegociacao = CondicoesProposta & {
  /** Vencimento da entrada (quando há). */
  dataEntrada: string | null;
  /** Vencimento da primeira parcela (as outras seguem a periodicidade). */
  primeiroVencimento: string | null;
  periodicidade: Periodicidade;
};

export type ParcelaAcordo = { numero: number; total: number; descricao: string; data: string; valorCentavos: number; entrada: boolean };

/**
 * As parcelas do acordo: a entrada (se houver) é a parcela 1, e as demais seguem a periodicidade.
 * Ex.: entrada + 10 parcelas = "Acordo 1/11 (entrada)", "Acordo 2/11", ... "Acordo 11/11".
 */
export function gerarParcelasAcordo(descricao: string, c: CondicoesRenegociacao): ParcelaAcordo[] {
  const temEntrada = c.entradaCentavos > 0;
  const total = c.parcelas + (temEntrada ? 1 : 0);
  const lista: ParcelaAcordo[] = [];
  let numero = 1;
  if (temEntrada && c.dataEntrada) lista.push({ numero: numero++, total, descricao: `${descricao} 1/${total} (entrada)`, data: c.dataEntrada, valorCentavos: c.entradaCentavos, entrada: true });
  if (c.parcelas > 0 && c.primeiroVencimento) {
    for (let k = 0; k < c.parcelas; k++) {
      lista.push({ numero, total, descricao: `${descricao} ${numero}/${total}`, data: somarPeriodo(c.primeiroVencimento, c.periodicidade, k), valorCentavos: c.valorParcelaCentavos, entrada: false });
      numero++;
    }
  }
  return lista;
}

export type PlanoRenegociacao = {
  /** Lançamentos não pagos que saem de Lançamentos (com cópia no histórico e na auditoria). */
  retiradas: (LancamentoOriginal & { dividaId: number })[];
  /** Lançamentos já pagos: ficam intactos. */
  mantidas: (LancamentoOriginal & { dividaId: number })[];
  totalRetiradoCentavos: number;
  saldoOriginaisCentavos: number;
  parcelasAcordo: ParcelaAcordo[];
  totalAcordoCentavos: number;
  /** Soma dos lançamentos não pagos das dívidas originais antes e depois (o Saldo Previsto não conta em dobro). */
  abertoAntesCentavos: number;
  abertoDepoisCentavos: number;
  /** Acordo menos o saldo das dívidas: positivo = mais caro, negativo = desconto. */
  diferencaCentavos: number;
  jurosImplicitosMensal: number | null;
  frases: string[];
  avisos: string[];
};

/**
 * O que vai acontecer ao confirmar (revisão do assistente): quais lançamentos saem, quais ficam e o que o acordo cria.
 * Só lançamentos não pagos saem; os pagos nunca são tocados. A soma dos não pagos antes é a das originais e,
 * depois, a do acordo, então nada é contado duas vezes.
 */
export function planejarRenegociacao(p: { originais: DividaOriginal[]; condicoes: CondicoesRenegociacao; descricaoAcordo: string; sobraMensalCentavos?: number | null }): PlanoRenegociacao {
  const { originais, condicoes, descricaoAcordo } = p;
  const retiradas = originais.flatMap((o) => o.lancamentos.filter((x) => !x.dataPagamento).map((x) => ({ ...x, dividaId: o.id })));
  const mantidas = originais.flatMap((o) => o.lancamentos.filter((x) => x.dataPagamento).map((x) => ({ ...x, dividaId: o.id })));
  const parcelasAcordo = gerarParcelasAcordo(descricaoAcordo, condicoes);
  const totalRetiradoCentavos = retiradas.reduce((s, x) => s + x.valorCentavos, 0);
  const saldoOriginaisCentavos = originais.reduce((s, o) => s + o.saldoCentavos, 0);
  const totalAcordoCentavos = totalDoAcordo(condicoes);
  const diferencaCentavos = totalAcordoCentavos - saldoOriginaisCentavos;
  const analise = analisarProposta({ ...condicoes, saldoCentavos: saldoOriginaisCentavos, sobraMensalCentavos: p.sobraMensalCentavos ?? null });

  const frases = originais.map((o) => {
    const doAcordo = retiradas.filter((x) => x.dividaId === o.id);
    const valor = doAcordo.reduce((s, x) => s + x.valorCentavos, 0);
    return doAcordo.length
      ? `${doAcordo.length === 1 ? "A parcela não paga" : `As ${doAcordo.length} parcelas não pagas`} da dívida ${o.descricao} (${reais(valor)}) ${doAcordo.length === 1 ? "sai" : "saem"} de Lançamentos.`
      : `A dívida ${o.descricao} não tem parcelas em aberto em Lançamentos; o saldo de ${reais(o.saldoCentavos)} passa para o acordo.`;
  });
  const entrada = parcelasAcordo.find((x) => x.entrada);
  const regulares = parcelasAcordo.filter((x) => !x.entrada);
  const partes: string[] = [];
  if (entrada) partes.push(`entrada de ${reais(entrada.valorCentavos)} em ${formatarData(entrada.data)}`);
  if (regulares.length) partes.push(`${plural(regulares.length, "parcela", "parcelas")} de ${reais(regulares[0].valorCentavos)} a partir de ${formatarData(regulares[0].data)}`);
  frases.push(`O acordo cria ${partes.join(" e ")}, no total de ${reais(totalAcordoCentavos)}.`);

  const avisos: string[] = [];
  if (analise.maisCaro) avisos.push(`O acordo soma ${reais(diferencaCentavos)} a mais que o saldo atual das dívidas (${reais(saldoOriginaisCentavos)}). Confira se isso foi combinado com o credor.`);
  if (analise.cabeNaSobra === false) avisos.push(`A parcela de ${reais(condicoes.valorParcelaCentavos)} passa da sobra mensal informada (${reais(p.sobraMensalCentavos ?? 0)}).`);
  if (!retiradas.length) avisos.push("Nenhum lançamento sai de Lançamentos: o acordo será uma obrigação nova, somada ao que já está lá.");

  return {
    retiradas,
    mantidas,
    totalRetiradoCentavos,
    saldoOriginaisCentavos,
    parcelasAcordo,
    totalAcordoCentavos,
    abertoAntesCentavos: totalRetiradoCentavos,
    abertoDepoisCentavos: parcelasAcordo.reduce((s, x) => s + x.valorCentavos, 0),
    diferencaCentavos,
    jurosImplicitosMensal: analise.jurosImplicitosMensal,
    frases,
    avisos,
  };
}

/** Valida a escolha de dívidas e as datas do acordo. Devolve a mensagem do problema ou null. */
export function validarRenegociacao(p: { originais: { id: number; contatoId: number; ativa: boolean; descricao: string }[]; condicoes: CondicoesRenegociacao }): string | null {
  const { originais, condicoes } = p;
  if (!originais.length) return "Escolha pelo menos uma dívida para renegociar.";
  if (new Set(originais.map((o) => o.contatoId)).size > 1) return "Um acordo junta só dívidas do **mesmo credor**.";
  const inativa = originais.find((o) => !o.ativa);
  if (inativa) return `A dívida ${inativa.descricao} não está ativa e não pode ser renegociada.`;
  const erro = validarCondicoes(condicoes);
  if (erro) return erro;
  if (condicoes.entradaCentavos > 0 && !condicoes.dataEntrada) return "Informe o vencimento da **Entrada**.";
  if (condicoes.parcelas > 0 && !condicoes.primeiroVencimento) return "Informe o **Primeiro Vencimento**.";
  return null;
}

/**
 * Pode desfazer enquanto o acordo está ativo e nenhuma parcela dele foi paga (nem por amortização ou quitação).
 * Depois do primeiro pagamento não dá mais: o histórico explica por quê.
 */
export function podeDesfazerRenegociacao(p: { acordoSituacao: "ativa" | "quitada" | "renegociada" | "cancelada"; lancamentosAcordo: { dataPagamento: string | null }[] }): { ok: true } | { ok: false; motivo: string } {
  if (p.acordoSituacao !== "ativa") return { ok: false, motivo: "O acordo não está mais ativo (foi quitado, cancelado ou renegociado de novo), então não dá para desfazer." };
  const pagas = p.lancamentosAcordo.filter((x) => x.dataPagamento).length;
  if (pagas > 0) return { ok: false, motivo: `Já há ${plural(pagas, "pagamento", "pagamentos")} neste acordo, então a renegociação não pode mais ser desfeita.` };
  return { ok: true };
}
