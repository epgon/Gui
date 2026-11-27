/**
 * Perguntas do Consultor Gui (fase D4): perguntas prontas, leitura de palavras-chave e respostas calculadas.
 * Funções puras, sem banco e sem IA. O campo de texto só reconhece palavras-chave e números: quando não entende,
 * diz isso e mostra as opções, sem fingir que entendeu.
 *
 * Toda resposta traz: a conclusão em uma frase, os números, o critério usado, "Como calculei" e, quando couber,
 * ações que são só links para as janelas normais do Gui. O Consultor nunca grava nada.
 */
import { analisarProposta, type AnaliseProposta } from "../negociacao";
import { ordenarDividas, analisarQuitacao, formatarReais, mesDe, quitarComExtraMensal, reservaUsavel, rotuloMes, simular, type DividaSim } from "../simulador";
import { taxaMensalParaAnual } from "../regras";
import { classificarPercentualRenda, percentualDaRenda, sobraLivre, type ContextoConsultor, type DividaConsultor, type LimitesConsultor, type LinkAcao } from "./regras";

export type IdPergunta = "total" | "ordem" | "cabe" | "extra" | "reserva" | "proposta" | "livre" | "compra" | "plano";

export type Dado = "valor" | "parcelas";

export const PERGUNTAS_PRONTAS: { id: IdPergunta; grupo: string; rotulo: string; pede: Dado[] }[] = [
  { id: "total", grupo: "Minha situação", rotulo: "Quanto eu devo no total?", pede: [] },
  { id: "livre", grupo: "Minha situação", rotulo: "Quando fico livre das dívidas?", pede: [] },
  { id: "plano", grupo: "Meu plano", rotulo: "Por que meu plano atrasou?", pede: [] },
  { id: "ordem", grupo: "O que fazer", rotulo: "Qual dívida pagar primeiro?", pede: [] },
  { id: "cabe", grupo: "O que fazer", rotulo: "Cabe uma parcela de R$ X?", pede: ["valor"] },
  { id: "extra", grupo: "O que fazer", rotulo: "Quanto economizo pagando R$ X a mais?", pede: ["valor"] },
  { id: "reserva", grupo: "O que fazer", rotulo: "Vale a pena usar a reserva?", pede: [] },
  { id: "proposta", grupo: "O que fazer", rotulo: "Essa proposta é boa?", pede: [] },
  { id: "compra", grupo: "Antes de comprar", rotulo: "Posso fazer uma compra parcelada de R$ X em N vezes?", pede: ["valor", "parcelas"] },
];

export const rotuloPergunta = (id: IdPergunta) => PERGUNTAS_PRONTAS.find((p) => p.id === id)?.rotulo ?? id;

/** A pergunta como a pessoa a faria, já com os números ("Cabe uma parcela de R$ 300,00?"). */
export function textoDaPergunta(id: IdPergunta, e: { valorCentavos?: number | null; parcelas?: number | null } = {}): string {
  const valor = e.valorCentavos ? formatarReais(e.valorCentavos) : "R$ X";
  switch (id) {
    case "cabe":
      return `Cabe uma parcela de ${valor}?`;
    case "extra":
      return `Quanto economizo pagando ${valor} a mais?`;
    case "compra":
      return `Posso fazer uma compra parcelada de ${valor} em ${e.parcelas ?? "N"} vezes?`;
    default:
      return rotuloPergunta(id);
  }
}

// ---------------------------------------------------------------------------
// Leitura do texto
// ---------------------------------------------------------------------------

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "1.500,50" -> 1500.5; "1500" -> 1500; "1.500" -> 1500; "500,5" -> 500.5. */
export function lerNumeroBR(texto: string): number | null {
  const t = texto.trim().replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Acha um valor em reais no texto ("R$ 1.500,00", "500 reais", "3 mil") e devolve em centavos. */
export function acharValorEmCentavos(texto: string): number | null {
  const t = semAcento(texto);
  const mil = t.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (mil) {
    const n = lerNumeroBR(mil[1]);
    return n === null ? null : Math.round(n * 1000 * 100);
  }
  const rs = t.match(/r\$\s*(\d[\d.,]*)/) ?? t.match(/(\d[\d.,]*)\s*(?:reais|real)\b/);
  if (rs) {
    const n = lerNumeroBR(rs[1].replace(/[.,]$/, ""));
    return n === null ? null : Math.round(n * 100);
  }
  return null;
}

/** Acha a quantidade de parcelas ("em 10x", "10 vezes", "em 12 parcelas"). */
export function acharParcelas(texto: string): number | null {
  const t = semAcento(texto);
  const m = t.match(/(\d{1,3})\s*(?:x\b|vezes|parcelas?|meses)/) ?? t.match(/\bem\s+(\d{1,3})\b(?!\s*[.,]\d)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 360 ? n : null;
}

export type PerguntaLida = { id: IdPergunta | null; valorCentavos: number | null; parcelas: number | null };

/**
 * Leva o texto à pergunta pronta certa pelas palavras-chave e números.
 * Devolve id nulo quando não reconhece: quem chama deve dizer isso e mostrar as perguntas prontas.
 */
export function interpretarPergunta(texto: string): PerguntaLida {
  const t = semAcento(texto);
  const valorCentavos = acharValorEmCentavos(texto);
  const parcelas = acharParcelas(texto);
  const tem = (...padroes: RegExp[]) => padroes.some((p) => p.test(t));
  let id: IdPergunta | null = null;
  if (tem(/\bplano\b.*(atras|furou|fugiu|desvi|abaixo|parou)/, /(atras|furou|fugiu|desvi).*\bplano\b/, /por que (o |meu )?plano/, /\bmeu plano\b/)) id = "plano";
  else if (tem(/\bcompra\b/, /\bcomprar\b/, /compra parcelada/, /financiar/, /parcelar (uma|um|o|a)\b/)) id = "compra";
  else if (tem(/\bcabe\b/, /\bcaber\b/, /\bcaberia\b/, /parcela de r\$/)) id = "cabe";
  else if (tem(/economiz/, /a mais\b/, /pagando mais/, /pagar mais/, /adiantar/, /amortiz/)) id = "extra";
  else if (tem(/reserva/, /poupanca/, /fundo de emergencia/)) id = "reserva";
  else if (tem(/proposta/, /acordo e bom/, /vale a pena aceitar/, /desconto/)) id = "proposta";
  else if (tem(/\bfico livre/, /\blivre das/, /quando (eu )?(termino|acabo|quito|saio)/, /terminar de pagar/, /quitar tudo/, /previsao de quitacao/)) id = "livre";
  else if (tem(/\bprimeir/, /qual (divida )?(eu )?(devo )?pagar/, /\bordem\b/, /prioridade/, /priorizar/, /por onde comecar/)) id = "ordem";
  else if (tem(/quanto (eu )?devo/, /total (das|de) dividas/, /quanto (eu )?(ainda )?(falta|tenho de divida)/, /minhas dividas/, /resumo/)) id = "total";
  return { id, valorCentavos, parcelas };
}

/** Que dado falta para responder (o Consultor pergunta antes de calcular). */
export function dadosFaltando(id: IdPergunta, l: Pick<PerguntaLida, "valorCentavos" | "parcelas">): Dado[] {
  const pede = PERGUNTAS_PRONTAS.find((p) => p.id === id)?.pede ?? [];
  return pede.filter((d) => (d === "valor" ? !l.valorCentavos || l.valorCentavos <= 0 : !l.parcelas || l.parcelas < 1));
}

export const TEXTO_NAO_ENTENDI = "Não entendi essa pergunta. O Consultor Gui ainda não conversa em texto livre: ele reconhece palavras como \"quanto devo\", \"pagar primeiro\", \"reserva\" ou \"cabe R$ 300\". Escolha uma das perguntas prontas abaixo.";

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export type Resposta = {
  /** A conclusão em uma frase. */
  conclusao: string;
  numeros: { rotulo: string; valor: string }[];
  /** O critério usado ("ordenei pela maior taxa de juros"). */
  criterio: string;
  /** "Como calculei": uma linha por passo. */
  comoCalculei: string[];
  /** Só links para as janelas normais: o Consultor nunca grava nada. */
  acoes: LinkAcao[];
  /** Quando a resposta é um "não recomendo". */
  cuidado?: boolean;
};

export type PropostaAberta = {
  negociacaoId: number;
  propostaId: number;
  credor: string;
  dividas: string;
  saldoCentavos: number;
  modalidade: "a_vista" | "parcelada";
  entradaCentavos: number;
  parcelas: number;
  valorParcelaCentavos: number;
  validade: string | null;
};

export type ContextoPerguntas = ContextoConsultor & { limites: LimitesConsultor; propostas: PropostaAberta[] };

const ATIVAS = new Set(["em_dia", "em_atraso", "em_negociacao"]);
const ativas = (c: ContextoConsultor) => c.dividas.filter((d) => ATIVAS.has(d.situacao));
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);
const dia = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);
const verDividas: LinkAcao = { rotulo: "Ver as dívidas", href: "/gestao/dividas/minhas" };
const abrir = (d: DividaConsultor): LinkAcao => ({ rotulo: `Abrir ${d.descricao}`, href: `/gestao/dividas/minhas?detalhar=${d.id}` });
const origemSaldo = (d: DividaConsultor) => (d.saldoOrigem === "informado" ? "informado pelo credor" : d.saldoOrigem === "estimado" ? "estimado, com multa e juros de atraso" : "soma das parcelas em aberto");

/** Taxa de uma dívida para as frases ("sem taxa" quando não foi informada). */
const taxaTexto = (d: DividaConsultor) => (d.taxaMensalPct === null ? "sem taxa informada (conto 0%)" : `${pct(d.taxaMensalPct)} ao mês`);
const juros = (d: DividaConsultor) => (d.taxaMensalPct === null ? 0 : Math.round((d.saldoCentavos * d.taxaMensalPct) / 100));

const SEM_DIVIDAS: Resposta = {
  conclusao: "Você não tem dívidas ativas cadastradas, então não há o que calcular por aqui.",
  numeros: [],
  criterio: "Só entram dívidas ativas (em dia, em atraso ou em negociação). Quitadas, renegociadas e canceladas ficam de fora.",
  comoCalculei: ["Procurei dívidas ativas em Minhas Dívidas e não encontrei nenhuma."],
  acoes: [{ rotulo: "Cadastrar dívida", href: "/gestao/dividas/minhas?nova=1" }],
};

/** "Quanto eu devo no total?" */
export function responderTotal(c: ContextoPerguntas): Resposta {
  const lista = ativas(c);
  if (!lista.length) return SEM_DIVIDAS;
  const total = lista.reduce((s, d) => s + d.saldoCentavos, 0);
  const atraso = lista.reduce((s, d) => s + d.atrasoCentavos, 0);
  const parcelasAtrasadas = lista.reduce((s, d) => s + d.parcelasAtrasadas, 0);
  const jurosMes = lista.reduce((s, d) => s + juros(d), 0);
  const p = percentualDaRenda(c.parcelasDoMesCentavos, c.rendaMensalCentavos);
  const estimado = lista.some((d) => d.saldoOrigem !== "parcelas");
  return {
    conclusao: `Você deve ${formatarReais(total)} em ${plural(lista.length, "dívida ativa", "dívidas ativas")}${estimado ? " (inclui valores estimados ou informados pelo credor)" : ""}.`,
    numeros: [
      { rotulo: "Total devido", valor: formatarReais(total) },
      { rotulo: "Em atraso", valor: parcelasAtrasadas ? `${formatarReais(atraso)} (${plural(parcelasAtrasadas, "parcela", "parcelas")})` : "nada" },
      { rotulo: "Parcelas deste mês", valor: `${formatarReais(c.parcelasDoMesCentavos)}${p !== null ? ` (${pct(p)} da renda)` : ""}` },
      { rotulo: "Juros estimados por mês", valor: formatarReais(jurosMes) },
    ],
    criterio: "Somei o saldo devedor de cada dívida ativa. Quando o credor informou o saldo há menos de 60 dias, uso esse valor; senão, a soma das parcelas em aberto com a estimativa de multa e juros de atraso.",
    comoCalculei: [...lista.map((d) => `${d.descricao}: ${formatarReais(d.saldoCentavos)} (${origemSaldo(d)}).`), `Juros por mês = saldo × taxa ao mês de cada dívida, somados: ${formatarReais(jurosMes)}. Dívidas sem taxa contam 0%.`],
    acoes: [verDividas],
  };
}

/** "Qual dívida pagar primeiro?" */
export function responderOrdem(c: ContextoPerguntas): Resposta {
  const lista = ativas(c).filter((d) => d.sim && d.saldoCentavos > 0);
  if (!lista.length) return SEM_DIVIDAS;
  const sims = lista.map((d) => d.sim!) as DividaSim[];
  const ids = ordenarDividas("risco", sims);
  const porId = new Map(lista.map((d) => [d.sim!.id, d]));
  const ordem = ids.map((id) => porId.get(id)!).filter(Boolean);
  const primeira = ordem[0];
  const avalanche = porId.get(ordenarDividas("avalanche", sims)[0])!;
  const motivo = (d: DividaConsultor) => (d.diasAtraso > 0 ? `atrasada há ${dia(d.diasAtraso)}` : d.sim?.comGarantia ? "tem garantia (risco de perder o bem)" : d.taxaMensalPct ? `taxa de ${pct(d.taxaMensalPct)} ao mês` : "menor saldo");
  const diferente = avalanche.id !== primeira.id;
  return {
    conclusao: `Pague as parcelas de todas em dia e, com o dinheiro extra, comece por ${primeira.descricao}: ${motivo(primeira)}.${ordem.length > 1 ? "" : " É a sua única dívida ativa."}`,
    numeros: ordem.map((d, i) => ({ rotulo: `${i + 1}ª ${d.descricao}`, valor: `${formatarReais(d.saldoCentavos)} · ${taxaTexto(d)}${d.diasAtraso > 0 ? ` · atraso de ${dia(d.diasAtraso)}` : ""}` })),
    criterio: "Ordem \"risco primeiro\": 1º a dívida atrasada há mais tempo, 2º as que têm garantia (bem que pode ser perdido), 3º a de maior taxa de juros e, no empate, a de menor saldo. Todas as parcelas continuam sendo pagas; só o dinheiro extra vai para a primeira da fila.",
    comoCalculei: [
      ...ordem.map((d, i) => `${i + 1}º ${d.descricao}: ${motivo(d)}; saldo ${formatarReais(d.saldoCentavos)}.`),
      diferente
        ? `Se o critério fosse só o custo, a primeira seria ${avalanche.descricao} (maior taxa, ${taxaTexto(avalanche)}): é o método Avalanche, que costuma pagar menos juros. Escolhi o risco primeiro porque atraso e garantia têm consequências piores que os juros.`
        : "O critério de custo (maior taxa de juros) aponta para a mesma dívida.",
      "Dívidas sem parcelas definidas entram com o mínimo de pagar só os juros do mês.",
      "Não é aconselhamento profissional: confirme com o credor antes de pagar a mais.",
    ],
    acoes: [{ rotulo: "Comparar estratégias", href: "/gestao/dividas/simulador?modo=estrategias" }, abrir(primeira)],
  };
}

/** "Cabe uma parcela de R$ X?" */
export function responderCabe(c: ContextoPerguntas, valorCentavos: number): Resposta {
  if (c.sobraMensalCentavos === null) {
    return { conclusao: "Ainda não consigo dizer: faltam meses fechados de receitas e despesas para calcular a sua sobra mensal.", numeros: [], criterio: "A sobra mensal é a média dos últimos meses fechados de receitas menos despesas (sem as parcelas de dívida).", comoCalculei: ["Não encontrei histórico suficiente nos lançamentos pagos."], acoes: [{ rotulo: "Ver o Simulador", href: "/gestao/dividas/simulador" }], cuidado: true };
  }
  const livre = sobraLivre(c);
  const folga = livre - valorCentavos;
  const depois = percentualDaRenda(c.parcelasDoMesCentavos + valorCentavos, c.rendaMensalCentavos);
  const nivel = depois === null ? "ok" : classificarPercentualRenda(depois, c.limites);
  const abaixoReserva = c.reservaMinimaCentavos > 0 && c.reservaCentavos < c.reservaMinimaCentavos;
  const atraso = ativas(c).some((d) => d.parcelasAtrasadas > 0);
  let conclusao: string;
  let cuidado = false;
  if (folga < 0) {
    conclusao = `Não recomendo: a parcela de ${formatarReais(valorCentavos)} passa em ${formatarReais(-folga)} da sua sobra livre de ${formatarReais(livre)} por mês.`;
    cuidado = true;
  } else if (atraso || nivel === "alta") {
    conclusao = `Cabe na conta, mas não recomendo agora: ${atraso ? "você tem parcela de dívida em atraso" : `as parcelas passariam a ${pct(depois!)} da renda`}.`;
    cuidado = true;
  } else if (nivel === "atencao" || abaixoReserva) {
    conclusao = `Cabe, com folga de ${formatarReais(folga)}, mas com cuidado: ${nivel === "atencao" ? `as parcelas iriam a ${pct(depois!)} da renda` : "a reserva está abaixo do mínimo"}.`;
  } else {
    conclusao = `Cabe: a parcela de ${formatarReais(valorCentavos)} deixa uma folga de ${formatarReais(folga)} por mês.`;
  }
  return {
    conclusao,
    numeros: [
      { rotulo: "Parcela perguntada", valor: formatarReais(valorCentavos) },
      { rotulo: "Sobra livre por mês", valor: formatarReais(livre) },
      { rotulo: "Folga depois da parcela", valor: formatarReais(folga) },
      ...(depois !== null ? [{ rotulo: "Parcelas das dívidas na renda", valor: `${pct(percentualDaRenda(c.parcelasDoMesCentavos, c.rendaMensalCentavos) ?? 0)} → ${pct(depois)}` }] : []),
    ],
    criterio: "Comparo a parcela com a sobra livre: a sobra mensal média menos as parcelas de referência das dívidas que você já tem.",
    comoCalculei: [
      `Sobra mensal média (receitas − despesas, sem parcelas de dívida): ${formatarReais(c.sobraMensalCentavos)}.`,
      `Parcelas de referência das dívidas ativas: ${formatarReais(c.parcelasReferenciaCentavos)}.`,
      `Sobra livre: ${formatarReais(c.sobraMensalCentavos)} − ${formatarReais(c.parcelasReferenciaCentavos)} = ${formatarReais(livre)}.`,
      `Folga: ${formatarReais(livre)} − ${formatarReais(valorCentavos)} = ${formatarReais(folga)}.`,
      depois !== null ? `Parcelas do mês + a nova: ${formatarReais(c.parcelasDoMesCentavos + valorCentavos)} ÷ renda média ${formatarReais(c.rendaMensalCentavos!)} = ${pct(depois)} (atenção acima de ${pct(c.limites.rendaAtencaoPct)}, alta acima de ${pct(c.limites.rendaAltaPct)}).` : "Sem renda média calculada, não comparei com a renda.",
      "A média pode não refletir meses fora do comum.",
    ],
    acoes: [{ rotulo: "Comparar no Simulador", href: "/gestao/dividas/simulador" }],
    cuidado,
  };
}

/** "Quanto economizo pagando R$ X a mais?" */
export function responderExtra(c: ContextoPerguntas, valorCentavos: number): Resposta {
  const lista = ativas(c).filter((d) => d.sim && d.saldoCentavos > 0);
  if (!lista.length) return SEM_DIVIDAS;
  const alvo = [...lista].sort((a, b) => (b.taxaMensalPct ?? 0) - (a.taxaMensalPct ?? 0) || b.saldoCentavos - a.saldoCentavos)[0];
  const inicioYm = mesDe(c.hoje);
  const base = analisarQuitacao(alvo.sim!, inicioYm).comoEsta;
  const r = quitarComExtraMensal(alvo.sim!, valorCentavos, inicioYm);
  const livre = sobraLivre(c);
  const passaDaSobra = c.sobraMensalCentavos !== null && valorCentavos > livre;
  const fimBase = base.mesFinal ? rotuloMes(base.mesFinal) : "sem previsão";
  const fimNovo = r.resultado.mesFinal ? rotuloMes(r.resultado.mesFinal) : "sem previsão";
  const economiza = r.economiaJurosCentavos > 0;
  return {
    conclusao: economiza
      ? `Pagando ${formatarReais(valorCentavos)} a mais por mês em ${alvo.descricao}, você economiza cerca de ${formatarReais(r.economiaJurosCentavos)} de juros${r.mesesAntecipados ? ` e termina ${plural(r.mesesAntecipados, "mês", "meses")} antes (${fimNovo} em vez de ${fimBase})` : ""}.`
      : `Pagando ${formatarReais(valorCentavos)} a mais por mês em ${alvo.descricao}, não há juros a economizar${alvo.taxaMensalPct === null ? " (a dívida está sem taxa informada: informe a taxa para a conta ficar melhor)" : ""}${r.mesesAntecipados ? `, mas ela termina ${plural(r.mesesAntecipados, "mês", "meses")} antes` : ""}.`,
    numeros: [
      { rotulo: "Dívida usada na conta", valor: `${alvo.descricao} · ${taxaTexto(alvo)}` },
      { rotulo: "Juros economizados", valor: formatarReais(Math.max(0, r.economiaJurosCentavos)) },
      { rotulo: "Término", valor: `${fimBase} → ${fimNovo}` },
      { rotulo: "Sobra livre por mês", valor: c.sobraMensalCentavos === null ? "sem histórico" : formatarReais(livre) },
    ],
    criterio: "Uso a dívida de maior taxa (a que mais custa) e simulo mês a mês pagando a parcela mais o valor extra, contra pagar só a parcela.",
    comoCalculei: [
      `Dívida escolhida: ${alvo.descricao}, ${taxaTexto(alvo)}, saldo ${formatarReais(alvo.saldoCentavos)}.`,
      `Só as parcelas: juros totais ${formatarReais(base.totalJurosCentavos)}, termina em ${fimBase}.`,
      `Parcela + ${formatarReais(valorCentavos)}: juros totais ${formatarReais(r.resultado.totalJurosCentavos)}, termina em ${fimNovo}.`,
      "É uma estimativa: cada credor abate o pagamento antecipado de um jeito. Pergunte se o valor reduz o saldo ou só adianta parcelas.",
    ],
    acoes: [{ rotulo: "Simular com este valor", href: `/gestao/dividas/simulador?modo=quitar&divida=${alvo.id}` }],
    cuidado: passaDaSobra,
    ...(passaDaSobra ? { conclusao: `Não recomendo esse valor: ele passa em ${formatarReais(valorCentavos - livre)} da sua sobra livre. ${economiza ? `Pagando ${formatarReais(valorCentavos)} a mais em ${alvo.descricao} a economia seria de ${formatarReais(r.economiaJurosCentavos)} de juros, mas o mês fecharia no negativo.` : ""}`.trim() } : {}),
  };
}

/** "Vale a pena usar a reserva?" */
export function responderReserva(c: ContextoPerguntas): Resposta {
  const lista = ativas(c).filter((d) => d.saldoCentavos > 0);
  const usavel = reservaUsavel(c);
  const alvo = [...lista].filter((d) => d.taxaMensalPct !== null).sort((a, b) => b.taxaMensalPct! - a.taxaMensalPct! || b.saldoCentavos - a.saldoCentavos)[0];
  const base = [
    { rotulo: "Reserva atual", valor: formatarReais(c.reservaCentavos) },
    { rotulo: "Reserva mínima", valor: formatarReais(c.reservaMinimaCentavos) },
    { rotulo: "Acima do mínimo", valor: formatarReais(usavel) },
  ];
  const como = [`Reserva = saldo das contas da reserva: ${formatarReais(c.reservaCentavos)}.`, `Reserva mínima = meses de despesa definidos em Parâmetros × despesa média sem dívidas: ${formatarReais(c.reservaMinimaCentavos)}.`, "Rendimento da reserva e taxas de juros são estimativas. Não é aconselhamento profissional."];
  if (!lista.length) return { ...SEM_DIVIDAS, conclusao: "Você não tem dívida ativa para quitar com a reserva: deixe o dinheiro como proteção.", numeros: base, comoCalculei: como };
  if (c.reservaMinimaCentavos > 0 && c.reservaCentavos <= c.reservaMinimaCentavos) {
    return {
      conclusao: `Não recomendo usar a reserva agora: ela está em ${formatarReais(c.reservaCentavos)}, ${c.reservaCentavos === c.reservaMinimaCentavos ? "no" : "abaixo do"} mínimo de ${formatarReais(c.reservaMinimaCentavos)}. Sem ela, um imprevisto pode virar dívida nova, em geral mais cara.`,
      numeros: base,
      criterio: "A reserva só entra na conta quando passa do mínimo. Abaixo disso, a prioridade é recompô-la.",
      comoCalculei: como,
      acoes: [{ rotulo: "Ver o Simulador", href: "/gestao/dividas/simulador" }],
      cuidado: true,
    };
  }
  if (!alvo) {
    return { conclusao: "Não consigo comparar: nenhuma dívida tem taxa de juros informada. Com a taxa, eu comparo o custo da dívida com o rendimento da reserva.", numeros: base, criterio: "Comparo a taxa da dívida mais cara com o rendimento estimado da reserva.", comoCalculei: como, acoes: [verDividas] };
  }
  const rend = c.limites.rendimentoReservaPct;
  if (alvo.taxaMensalPct! <= rend) {
    return {
      conclusao: `Não vale a pena: a dívida mais cara (${alvo.descricao}) custa ${pct(alvo.taxaMensalPct!)} ao mês e a reserva rende cerca de ${pct(rend)}. Manter a reserva sai mais barato.`,
      numeros: [...base, { rotulo: "Taxa da dívida mais cara", valor: `${pct(alvo.taxaMensalPct!)} ao mês` }, { rotulo: "Rendimento estimado da reserva", valor: `${pct(rend)} ao mês` }],
      criterio: "Se a dívida custa menos do que a reserva rende, usar a reserva para pagá-la aumenta o custo.",
      comoCalculei: [...como, `${alvo.descricao}: ${pct(alvo.taxaMensalPct!)} ao mês contra ${pct(rend)} de rendimento.`],
      acoes: [],
      cuidado: true,
    };
  }
  const valor = Math.min(usavel, alvo.saldoCentavos);
  const ganhoMes = Math.round((valor * (alvo.taxaMensalPct! - rend)) / 100);
  return {
    conclusao: `Vale avaliar: usar até ${formatarReais(valor)} da reserva (só o que passa do mínimo) em ${alvo.descricao} economiza cerca de ${formatarReais(ganhoMes)} por mês, porque a dívida custa ${pct(alvo.taxaMensalPct!)} ao mês e a reserva rende cerca de ${pct(rend)}. A decisão é sua.`,
    numeros: [...base, { rotulo: "Valor sugerido", valor: formatarReais(valor) }, { rotulo: "Economia estimada por mês", valor: formatarReais(ganhoMes) }, { rotulo: "Reserva depois", valor: formatarReais(c.reservaCentavos - valor) }],
    criterio: "Uso só o que passa da reserva mínima, na dívida de maior taxa, quando a taxa é maior que o rendimento estimado da reserva.",
    comoCalculei: [...como, `Valor: o menor entre o que passa do mínimo (${formatarReais(usavel)}) e o saldo de ${alvo.descricao} (${formatarReais(alvo.saldoCentavos)}) = ${formatarReais(valor)}.`, `Economia por mês: ${formatarReais(valor)} × (${pct(alvo.taxaMensalPct!)} − ${pct(rend)}) = ${formatarReais(ganhoMes)}.`],
    acoes: [{ rotulo: "Simular quitação", href: `/gestao/dividas/simulador?modo=quitar&divida=${alvo.id}` }],
  };
}

/** Um veredito curto para uma proposta (usado na resposta e testável). */
export function vereditoProposta(a: AnaliseProposta, limiteTaxaAltaPct: number): { texto: string; cuidado: boolean } {
  if (a.maisCaro) return { texto: `Não recomendo: a proposta custa ${formatarReais(a.acrescimoCentavos)} a mais que o saldo de hoje.`, cuidado: true };
  if (a.cabeNaSobra === false) return { texto: `Cuidado: a parcela não cabe na sua sobra mensal (faltam ${formatarReais(-(a.folgaCentavos ?? 0))} por mês).`, cuidado: true };
  if (a.jurosImplicitosMensal !== null && a.jurosImplicitosMensal > limiteTaxaAltaPct) return { texto: `Cuidado: os juros implícitos são de ${pct(a.jurosImplicitosMensal)} ao mês, acima de ${pct(limiteTaxaAltaPct)}.`, cuidado: true };
  if (a.descontoCentavos > 0) return { texto: `Vale considerar: desconto de ${formatarReais(a.descontoCentavos)} (${pct(a.descontoPct)}) sobre o saldo de hoje.`, cuidado: false };
  return { texto: "Sem desconto: a proposta só troca o prazo. Confira os juros implícitos antes de aceitar.", cuidado: false };
}

/** "Essa proposta é boa?" */
export function responderProposta(c: ContextoPerguntas): Resposta {
  if (!c.propostas.length) {
    return {
      conclusao: "Não encontrei nenhuma proposta em aberto. Registre a proposta do credor em uma negociação e eu comparo com o saldo, os juros e a sua sobra.",
      numeros: [],
      criterio: "Analiso as propostas abertas das negociações em andamento.",
      comoCalculei: ["Procurei propostas com situação Aberta em negociações Em andamento, Proposta recebida ou Aguardando resposta."],
      acoes: [{ rotulo: "Abrir Negociações", href: "/gestao/dividas/negociacoes" }],
    };
  }
  const lista = c.propostas.slice(0, 3);
  const analises = lista.map((p) => ({ p, a: analisarProposta({ entradaCentavos: p.entradaCentavos, parcelas: p.parcelas, valorParcelaCentavos: p.valorParcelaCentavos, saldoCentavos: p.saldoCentavos, sobraMensalCentavos: c.sobraMensalCentavos }) }));
  const veredito = analises.map((x) => vereditoProposta(x.a, c.limites.taxaAltaPct));
  const [principal] = analises;
  return {
    conclusao: `${principal.p.credor}: ${veredito[0].texto}${analises.length > 1 ? ` Há mais ${plural(analises.length - 1, "proposta analisada", "propostas analisadas")} abaixo.` : ""}`,
    numeros: analises.flatMap(({ p, a }) => [
      { rotulo: `${p.credor} (${p.modalidade === "a_vista" ? "à vista" : `${p.parcelas}× de ${formatarReais(p.valorParcelaCentavos)}`})`, valor: `total ${formatarReais(a.totalCentavos)} · saldo ${formatarReais(a.saldoCentavos)}` },
      { rotulo: "Juros implícitos", valor: a.jurosImplicitosMensal === null ? (p.parcelas === 0 ? "à vista" : "sem juros") : `${pct(a.jurosImplicitosMensal)} ao mês (${pct(taxaMensalParaAnual(a.jurosImplicitosMensal))} ao ano)` },
    ]),
    criterio: "Comparo o total da proposta com o saldo de hoje, calculo a taxa de juros que as parcelas escondem e vejo se a parcela cabe na sobra mensal.",
    comoCalculei: analises.flatMap(({ p, a }, i) => [
      `${p.credor} (${p.dividas}): total = entrada ${formatarReais(p.entradaCentavos)} + ${p.parcelas} × ${formatarReais(p.valorParcelaCentavos)} = ${formatarReais(a.totalCentavos)}.`,
      `Contra o saldo de ${formatarReais(a.saldoCentavos)}: ${a.descontoCentavos > 0 ? `desconto de ${formatarReais(a.descontoCentavos)} (${pct(a.descontoPct)})` : a.acrescimoCentavos > 0 ? `acréscimo de ${formatarReais(a.acrescimoCentavos)}` : "igual ao saldo"}.`,
      a.folgaCentavos !== null ? `Parcela contra a sobra mensal de ${formatarReais(c.sobraMensalCentavos ?? 0)}: folga de ${formatarReais(a.folgaCentavos)}.` : "Sem sobra mensal calculada ou proposta à vista: não comparei a parcela.",
      veredito[i].texto,
    ]),
    acoes: [{ rotulo: "Simular a proposta", href: `/gestao/dividas/simulador?modo=proposta&negociacao=${principal.p.negociacaoId}&proposta=${principal.p.propostaId}` }, { rotulo: "Abrir Negociações", href: "/gestao/dividas/negociacoes" }],
    cuidado: veredito[0].cuidado,
  };
}

/** "Quando fico livre das dívidas?" */
export function responderLivre(c: ContextoPerguntas): Resposta {
  const lista = ativas(c).filter((d) => d.sim && d.saldoCentavos > 0);
  if (!lista.length) return SEM_DIVIDAS;
  const inicioYm = mesDe(c.hoje);
  const sims = lista.map((d) => d.sim!);
  const soParcelas = simular({ dividas: sims, estrategia: "avalanche", valorMensalCentavos: null, inicioYm });
  const livre = sobraLivre(c);
  const extra = Math.floor((livre * c.limites.extraSobraPct) / 100);
  const comExtra = extra > 0 ? simular({ dividas: sims, estrategia: "avalanche", valorMensalCentavos: c.parcelasReferenciaCentavos + extra, inicioYm }) : null;
  const semParcelas = lista.filter((d) => d.forma === "sem_parcelas");
  const quita = soParcelas.quitouTudo && soParcelas.mesFinal;
  const doPlano = c.plano?.previsaoMesFinal ?? null;
  const aprox = semParcelas.length ? ` (estimativa: ${plural(semParcelas.length, "dívida não tem", "dívidas não têm")} parcelas definidas e conto como pagamento só os juros do mês)` : "";
  const numeros = [
    ...(doPlano ? [{ rotulo: `Pelo plano "${c.plano!.nome}"`, valor: `${rotuloMes(doPlano)}${c.plano!.mesFinalPlanejado && doPlano > c.plano!.mesFinalPlanejado ? ` (o plano previa ${rotuloMes(c.plano!.mesFinalPlanejado)})` : ""}` }] : []),
    { rotulo: "Só pagando as parcelas", valor: quita ? `${rotuloMes(soParcelas.mesFinal!)} (${plural(soParcelas.mesesAteQuitar ?? 0, "mês", "meses")})` : "sem previsão" },
    { rotulo: "Juros previstos até lá", valor: formatarReais(soParcelas.totalJurosCentavos) },
    ...(comExtra && comExtra.quitouTudo && comExtra.mesFinal ? [{ rotulo: `Com ${formatarReais(extra)} a mais por mês`, valor: `${rotuloMes(comExtra.mesFinal)} (${plural(comExtra.mesesAteQuitar ?? 0, "mês", "meses")}), ${formatarReais(soParcelas.totalJurosCentavos - comExtra.totalJurosCentavos)} a menos de juros` }] : []),
  ];
  return {
    conclusao: doPlano
      ? `Seguindo o seu plano ativo você fica livre das dívidas em ${rotuloMes(doPlano)}. Só pagando as parcelas seria ${quita ? rotuloMes(soParcelas.mesFinal!) : "depois de 30 anos"}.`
      : quita
      ? `Pagando só as parcelas você fica livre das dívidas em ${rotuloMes(soParcelas.mesFinal!)}${aprox}${comExtra?.quitouTudo && comExtra.mesFinal && comExtra.mesesAteQuitar! < soParcelas.mesesAteQuitar! ? `; com ${formatarReais(extra)} a mais por mês, em ${rotuloMes(comExtra.mesFinal)}` : ""}.`
      : "Com o ritmo atual as dívidas não terminam em 30 anos: os pagamentos não cobrem os juros. Aumente o valor pago por mês ou renegocie.",
    numeros,
    criterio: "Simulo mês a mês pagando as parcelas de todas as dívidas ativas (e os juros mínimos nas que não têm parcelas), com os juros de cada taxa.",
    comoCalculei: [
      `Dívidas na conta: ${lista.map((d) => `${d.descricao} (${formatarReais(d.saldoCentavos)})`).join("; ")}.`,
      "Parcelas futuras entram a valor presente pela taxa da dívida e o atraso estimado cai no mês atual.",
      comExtra ? `Com extra: ${pct(c.limites.extraSobraPct)} da sobra livre de ${formatarReais(livre)} = ${formatarReais(extra)} por mês, na dívida mais cara (Avalanche).` : "Não há sobra livre para simular um valor extra.",
      ...(doPlano ? ["Pelo plano: simulo o valor mensal do plano com o que falta pagar hoje (é a previsão recalculada da tela Plano de Quitação)."] : []),
      "Limite de 360 meses. É uma projeção: atrasos, juros do credor e novas dívidas mudam o resultado.",
    ],
    acoes: [{ rotulo: "Comparar estratégias", href: "/gestao/dividas/simulador?modo=estrategias" }],
    cuidado: !quita,
  };
}

/** "Por que meu plano atrasou?" */
export function responderPlano(c: ContextoPerguntas): Resposta {
  const p = c.plano;
  const ver: LinkAcao = { rotulo: "Ver o Plano de Quitação", href: "/gestao/dividas/plano" };
  if (!p) {
    return {
      conclusao: "Você não tem um Plano de Quitação ativo, então não há o que atrasar. Dá para criar um a partir de uma simulação ou do zero.",
      numeros: [],
      criterio: "Só olho o plano ativo (aprovado por você).",
      comoCalculei: ["Procurei um plano com situação Ativo e não encontrei."],
      acoes: [{ rotulo: "Criar plano", href: "/gestao/dividas/plano" }, { rotulo: "Ir ao Simulador", href: "/gestao/dividas/simulador" }],
    };
  }
  const atrasado = p.previsaoMesFinal !== null && p.mesFinalPlanejado !== null && p.previsaoMesFinal > p.mesFinalPlanejado;
  const numeros = [
    { rotulo: "Plano", valor: `${p.nome} (versão ${p.versao})` },
    ...(p.mesFinalPlanejado ? [{ rotulo: "Término previsto no plano", valor: rotuloMes(p.mesFinalPlanejado) }] : []),
    ...(p.previsaoMesFinal ? [{ rotulo: "Previsão recalculada hoje", valor: rotuloMes(p.previsaoMesFinal) }] : []),
    { rotulo: "Ficou sem pagar nos meses fechados", valor: formatarReais(p.deficitCentavos) },
  ];
  if (!p.desvios.length) {
    return {
      conclusao: `O seu plano não atrasou: ${p.mesAnterior ? "o mês anterior foi cumprido e " : ""}a previsão continua em ${p.previsaoMesFinal ? rotuloMes(p.previsaoMesFinal) : "dia"}.`,
      numeros,
      criterio: "Comparo, mês a mês, o que o plano previa com o que foi pago nas dívidas do plano (lançamentos pagos), e recalculo a previsão com o que falta pagar hoje.",
      comoCalculei: ["Realizado = soma dos lançamentos pagos ligados às dívidas do plano, na data do pagamento (inclui pagamento parcial e o restante).", "Não encontrei desvio: nenhum mês fechado ficou abaixo, a previsão não passou do prazo, a sobra não caiu muito e não há dívida nova fora do plano."],
      acoes: [ver],
    };
  }
  return {
    conclusao: `O plano ${atrasado ? "atrasou" : "saiu do rumo"} por ${p.desvios.length === 1 ? "um motivo" : `${p.desvios.length} motivos`}: ${p.desvios[0].replace(/\.$/, "")}${p.desvios.length > 1 ? " (e mais)" : ""}.${p.ajusteRecomendado ? ` O Gui sugere: ${p.ajusteRecomendado.charAt(0).toLowerCase()}${p.ajusteRecomendado.slice(1)}. Nada muda sem a sua aprovação.` : ""}`,
    numeros,
    criterio: "Comparo o planejado com o realizado dos meses fechados, a previsão recalculada com o prazo do plano, a sobra de hoje com a da aprovação e as dívidas novas.",
    comoCalculei: [...p.desvios, "Realizado = soma dos lançamentos pagos ligados às dívidas do plano, na data do pagamento.", "O ajuste proposto só vira uma nova versão do plano se você clicar em Aprovar ajuste."],
    acoes: [ver],
    cuidado: true,
  };
}

/** "Posso fazer uma compra parcelada de R$ X em N vezes?" */
export function responderCompra(c: ContextoPerguntas, valorCentavos: number, parcelas: number): Resposta {
  const parcela = Math.round(valorCentavos / parcelas);
  const livre = sobraLivre(c);
  const depois = percentualDaRenda(c.parcelasDoMesCentavos + parcela, c.rendaMensalCentavos);
  const nivel = depois === null ? "ok" : classificarPercentualRenda(depois, c.limites);
  const atraso = ativas(c).some((d) => d.parcelasAtrasadas > 0);
  const abaixoReserva = c.reservaMinimaCentavos > 0 && c.reservaCentavos < c.reservaMinimaCentavos;
  const semHistorico = c.sobraMensalCentavos === null;
  const motivos: string[] = [];
  if (atraso) motivos.push("você tem parcela de dívida em atraso");
  if (!semHistorico && parcela > livre) motivos.push(`a parcela passa em ${formatarReais(parcela - livre)} da sua sobra livre`);
  if (nivel === "alta") motivos.push(`as parcelas das dívidas iriam a ${pct(depois!)} da renda`);
  const naoRecomendo = motivos.length > 0;
  const atencao = !naoRecomendo && (nivel === "atencao" || abaixoReserva);
  return {
    conclusao: semHistorico
      ? "Ainda não consigo dizer: faltam meses fechados para calcular a sua sobra. Sem isso, não recomendo assumir uma parcela nova."
      : naoRecomendo
        ? `Não recomendo: ${motivos.join(" e ")}.`
        : atencao
          ? `Cabe, mas com cuidado: ${nivel === "atencao" ? `as parcelas das dívidas iriam a ${pct(depois!)} da renda` : "a reserva está abaixo do mínimo"}.`
          : `Cabe: a parcela de ${formatarReais(parcela)} por ${parcelas} meses deixa uma folga de ${formatarReais(livre - parcela)} por mês.`,
    numeros: [
      { rotulo: "Compra", valor: `${formatarReais(valorCentavos)} em ${parcelas}×` },
      { rotulo: "Parcela (sem juros)", valor: formatarReais(parcela) },
      { rotulo: "Sobra livre por mês", valor: semHistorico ? "sem histórico" : formatarReais(livre) },
      ...(depois !== null ? [{ rotulo: "Parcelas das dívidas na renda", valor: `${pct(percentualDaRenda(c.parcelasDoMesCentavos, c.rendaMensalCentavos) ?? 0)} → ${pct(depois)}` }] : []),
    ],
    criterio: "Divido o valor pelo número de parcelas e comparo com a sobra livre (sobra mensal menos as parcelas das dívidas). Também olho atraso, % da renda e reserva.",
    comoCalculei: [
      `Parcela: ${formatarReais(valorCentavos)} ÷ ${parcelas} = ${formatarReais(parcela)}. Se a loja cobrar juros, a parcela real é maior e a conta piora.`,
      semHistorico ? "Sem histórico para a sobra mensal." : `Sobra livre: ${formatarReais(c.sobraMensalCentavos!)} − ${formatarReais(c.parcelasReferenciaCentavos)} = ${formatarReais(livre)}.`,
      depois !== null ? `Parcelas do mês + a nova: ${formatarReais(c.parcelasDoMesCentavos + parcela)} ÷ renda média ${formatarReais(c.rendaMensalCentavos!)} = ${pct(depois)}.` : "Sem renda média calculada.",
      "Compras no cartão entram na fatura do mês seguinte e somam com as outras compras parceladas que você já tem.",
    ],
    acoes: [{ rotulo: "Ver o Simulador", href: "/gestao/dividas/simulador" }],
    cuidado: naoRecomendo || semHistorico,
  };
}

/** Escolhe e roda a pergunta pronta. Quem chama já conferiu `dadosFaltando`. */
export function responder(id: IdPergunta, c: ContextoPerguntas, entrada: { valorCentavos?: number | null; parcelas?: number | null } = {}): Resposta {
  switch (id) {
    case "total":
      return responderTotal(c);
    case "ordem":
      return responderOrdem(c);
    case "cabe":
      return responderCabe(c, entrada.valorCentavos ?? 0);
    case "extra":
      return responderExtra(c, entrada.valorCentavos ?? 0);
    case "reserva":
      return responderReserva(c);
    case "proposta":
      return responderProposta(c);
    case "livre":
      return responderLivre(c);
    case "plano":
      return responderPlano(c);
    case "compra":
      return responderCompra(c, entrada.valorCentavos ?? 0, entrada.parcelas ?? 1);
  }
}
