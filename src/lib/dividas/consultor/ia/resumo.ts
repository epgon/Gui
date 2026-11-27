import { rotuloTipoDivida } from "../../regras";
import { formatarReais } from "../../simulador";
import type { ContextoPerguntas } from "../perguntas";

/**
 * O resumo anonimizado que vai para a IA (e que a pessoa pode ver antes em "Ver o que será enviado").
 * Só números e categorias: as dívidas viram "Dívida A, Dívida B" com o tipo. Nunca entram nome de credor,
 * descrição de dívida ou de lançamento, nome de conta ou de cartão, nome da pessoa, documento ou nome do plano.
 */

const ATIVAS = new Set(["em_dia", "em_atraso", "em_negociacao"]);

export type ResumoIA = {
  texto: string;
  /** "Dívida A" -> id da dívida. Fica só no Gui: serve para trocar "Dívida A" pelo nome real na resposta e para os botões. */
  mapa: Map<string, { id: number; descricao: string }>;
};

export function rotuloAnonimo(indice: number): string {
  if (indice < 26) return `Dívida ${String.fromCharCode(65 + indice)}`;
  return `Dívida ${indice + 1}`;
}

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const mesTexto = (ym: string | null) => (ym ? ym : "sem previsão");

export function montarResumo(c: ContextoPerguntas): ResumoIA {
  const ativas = c.dividas.filter((d) => ATIVAS.has(d.situacao));
  const mapa: ResumoIA["mapa"] = new Map();
  const linhas: string[] = [];
  linhas.push("RESUMO DOS NÚMEROS (valores em reais; as dívidas não têm nome por privacidade)");
  linhas.push(`Mês atual: ${c.hoje.slice(0, 7)}`);
  linhas.push(`Renda média por mês: ${c.rendaMensalCentavos === null ? "sem histórico" : formatarReais(c.rendaMensalCentavos)}`);
  linhas.push(`Sobra média por mês (sem as parcelas de dívida): ${c.sobraMensalCentavos === null ? "sem histórico" : formatarReais(c.sobraMensalCentavos)}`);
  const pRenda = c.rendaMensalCentavos && c.rendaMensalCentavos > 0 ? (c.parcelasDoMesCentavos / c.rendaMensalCentavos) * 100 : null;
  linhas.push(`Parcelas de dívida neste mês: ${formatarReais(c.parcelasDoMesCentavos)}${pRenda === null ? "" : ` (${pct(Math.round(pRenda * 10) / 10)} da renda)`}`);
  linhas.push(`Reserva: ${formatarReais(c.reservaCentavos)}; reserva mínima recomendada: ${formatarReais(c.reservaMinimaCentavos)}`);
  if (c.caixa) linhas.push(`Dinheiro em caixa (fora da reserva): ${formatarReais(c.caixa.saldoCentavos)}; parcelas até o próximo mês: ${formatarReais(c.caixa.parcelasAteProximoMesCentavos)}`);
  linhas.push(`Rendimento estimado da reserva: ${pct(c.limites.rendimentoReservaPct)} ao mês`);

  const total = ativas.reduce((s, d) => s + d.saldoCentavos, 0);
  const atraso = ativas.reduce((s, d) => s + d.atrasoCentavos, 0);
  linhas.push(`Dívidas ativas: ${ativas.length}; total devido: ${formatarReais(total)}; em atraso: ${formatarReais(atraso)}`);
  ativas.forEach((d, i) => {
    const nome = rotuloAnonimo(i);
    mapa.set(nome, { id: d.id, descricao: d.descricao });
    const partes = [
      `tipo ${rotuloTipoDivida(d.tipo).replace(/ \(.*\)$/, "")}`,
      `saldo ${formatarReais(d.saldoCentavos)}`,
      d.taxaMensalPct === null ? "taxa não informada" : `taxa ${pct(d.taxaMensalPct)} ao mês`,
      d.forma === "parcelas_fixas" ? `parcela ${formatarReais(d.parcelaCentavos)}, ${d.parcelasAbertas} em aberto` : "sem parcelas definidas",
      d.parcelasAtrasadas > 0 ? `${d.parcelasAtrasadas} parcela(s) vencida(s) há ${d.diasAtraso} dia(s), total ${formatarReais(d.atrasoCentavos)}` : "em dia",
    ];
    if (d.sim?.comGarantia) partes.push("com garantia (risco de perder o bem)");
    if (d.situacao === "em_negociacao") partes.push("em negociação");
    linhas.push(`${nome}: ${partes.join("; ")}`);
  });

  if (c.faturasVencidas.length) linhas.push(`Faturas de cartão vencidas e não pagas: ${c.faturasVencidas.length}; total ${formatarReais(c.faturasVencidas.reduce((s, f) => s + f.valorCentavos, 0))}`);
  c.propostas.forEach((p, i) => {
    linhas.push(`Proposta aberta ${i + 1}: ${p.modalidade === "a_vista" ? `à vista ${formatarReais(p.entradaCentavos)}` : `entrada ${formatarReais(p.entradaCentavos)} e ${p.parcelas} parcelas de ${formatarReais(p.valorParcelaCentavos)}`}, para um saldo de ${formatarReais(p.saldoCentavos)}`);
  });

  const pl = c.plano;
  if (pl) {
    linhas.push(`Plano de Quitação ativo: versão ${pl.versao}; mês final planejado ${mesTexto(pl.mesFinalPlanejado)}; previsão atual ${mesTexto(pl.previsaoMesFinal)}; ajuste pendente: ${pl.ajustePendente ? "sim" : "não"}`);
    if (pl.mesAnterior) linhas.push(`Último mês fechado do plano (${pl.mesAnterior.mes}): planejado ${formatarReais(pl.mesAnterior.planejadoCentavos)}, realizado ${formatarReais(pl.mesAnterior.realizadoCentavos)}`);
    if (pl.deficitCentavos > 0) linhas.push(`Déficit acumulado do plano: ${formatarReais(pl.deficitCentavos)}`);
    if (pl.novasDividas.length) linhas.push(`Dívidas novas fora do plano: ${pl.novasDividas.length}; total ${formatarReais(pl.novasDividas.reduce((s, x) => s + x.saldoCentavos, 0))}`);
    if (pl.comprasParceladas.length) linhas.push(`Compras parceladas grandes depois do plano: ${pl.comprasParceladas.length}`);
  } else {
    linhas.push("Plano de Quitação ativo: nenhum");
  }
  return { texto: linhas.join("\n"), mapa };
}

/** Troca "Dívida A" pelo nome real, só na tela da pessoa (a IA nunca recebe os nomes). */
export function desanonimizar(texto: string, mapa: ResumoIA["mapa"]): string {
  return texto.replace(/Dívida ([A-Z]|\d{1,3})\b/g, (m) => mapa.get(m)?.descricao ?? m);
}

/** Tira de um texto digitado e-mails, telefones e números longos (CPF, CNPJ, conta, cartão) antes de enviar. */
export function limparTextoLivre(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento removido]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[documento removido]")
    .replace(/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone removido]")
    .replace(/\b\d{8,}\b/g, "[número removido]")
    .trim();
}
