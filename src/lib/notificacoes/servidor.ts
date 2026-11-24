import "server-only";
import { and, count, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/db";
import { faturasAtuais } from "@/lib/cartoes/servidor";
import { formatarData, hojeIso } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { carregarOrcamento } from "@/lib/orcamentos/servidor";
import { lerConfiguracoes, lerRecursos } from "@/lib/parametros/servidor";
import { somarDias } from "@/lib/lancamentos/regras";
import { carregarContexto, pendentes } from "@/lib/recorrentes/servidor";
import { CHAVE_LIDAS, type Notificacao } from "./tipos";

const { lancamento: l, usuario, importacao } = schema;
const TIPOS_CONTA = ["receita", "despesa", "transferencia_saida"] as const;

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Os avisos de agora: contas vencidas, que vencem hoje, faturas, orçamento, importações e cadastro. */
export const calcularNotificacoes = cache(async (hoje = hojeIso()): Promise<{ lista: Notificacao[]; lidas: string[] }> => {
  const db = getDb();
  const [config, recursos] = await Promise.all([lerConfiguracoes(), lerRecursos()]);
  const lidasGravadas = config[CHAVE_LIDAS];
  const lidas = Array.isArray(lidasGravadas) ? lidasGravadas.filter((x): x is string => typeof x === "string") : [];
  const lista: Notificacao[] = [];

  // Lançamentos da conta (compras no cartão entram pela fatura) ainda não pagos.
  const [abertos, ctx, [u]] = await Promise.all([
    db
      .select({
        vencidos: sql<number>`count(*) filter (where ${l.dataVencimento} < ${hoje})`,
        totalVencidos: sql<number>`coalesce(sum(${l.valorCentavos}) filter (where ${l.dataVencimento} < ${hoje}), 0)`,
        hoje: sql<number>`count(*) filter (where ${l.dataVencimento} = ${hoje})`,
        totalHoje: sql<number>`coalesce(sum(${l.valorCentavos}) filter (where ${l.dataVencimento} = ${hoje}), 0)`,
      })
      .from(l)
      .where(and(isNull(l.dataPagamento), isNotNull(l.contaId), inArray(l.tipo, [...TIPOS_CONTA]), lte(l.dataVencimento, hoje))),
    recursos.recorrentes ? carregarContexto(db, hoje) : Promise.resolve(null),
    db.select({ telefone: usuario.telefone, cidade: usuario.cidade, cep: usuario.cep }).from(usuario).limit(1),
  ]);

  // Recorrentes previstos (ainda não lançados) dos últimos 60 dias também contam.
  const previstos = ctx ? pendentes(ctx, hoje, somarDias(hoje, -60)).filter((p) => p.pernas.some((x) => x.contaId !== null && x.valorComSinal !== 0 && x.tipo !== "transferencia_entrada")) : [];
  const previstosVencidos = previstos.filter((p) => p.vencimento < hoje);
  const previstosHoje = previstos.filter((p) => p.vencimento === hoje);
  const a = abertos[0];
  const qtdVencidos = Number(a?.vencidos ?? 0) + previstosVencidos.length;
  const qtdHoje = Number(a?.hoje ?? 0) + previstosHoje.length;
  const valorVencidos = Number(a?.totalVencidos ?? 0) + previstosVencidos.reduce((s, p) => s + p.valorCentavos, 0);
  const valorHoje = Number(a?.totalHoje ?? 0) + previstosHoje.reduce((s, p) => s + p.valorCentavos, 0);

  if (qtdVencidos > 0) {
    lista.push({
      id: `vencidos:${hoje}`,
      tipo: "alerta",
      titulo: `${plural(qtdVencidos, "lançamento vencido", "lançamentos vencidos")}`,
      texto: `Somam R$ ${formatarCentavos(valorVencidos)} ainda não pagos ou recebidos.`,
      href: "/financeiro/lancamentos?situacao=vencido",
      rotuloLink: "Ver vencidos",
    });
  }
  if (qtdHoje > 0) {
    lista.push({
      id: `hoje:${hoje}`,
      tipo: "aviso",
      titulo: `${plural(qtdHoje, "lançamento vence", "lançamentos vencem")} hoje`,
      texto: `Total de R$ ${formatarCentavos(valorHoje)} para ${formatarData(hoje)}.`,
      href: `/financeiro/lancamentos?mes=${hoje.slice(0, 7)}&situacao=a_vencer`,
      rotuloLink: "Ver lançamentos",
    });
  }

  if (recursos.cartoes) {
    const limite = somarDias(hoje, 5);
    for (const f of await faturasAtuais(hoje)) {
      if (f.fatura.situacao === "paga" || f.fatura.pendenteCentavos <= 0 || f.fatura.dataVencimento > limite) continue;
      const vencida = f.fatura.dataVencimento < hoje;
      lista.push({
        id: `fatura:${f.cartao.id}:${f.fatura.competencia}:${vencida ? "vencida" : "vencendo"}`,
        tipo: vencida ? "alerta" : "aviso",
        titulo: `Fatura ${f.cartao.descricao} ${vencida ? "vencida" : "vence em breve"}`,
        texto: `R$ ${formatarCentavos(f.fatura.pendenteCentavos)} com vencimento em ${formatarData(f.fatura.dataVencimento)}.`,
        href: "/cadastros/cartoes-de-credito",
        rotuloLink: "Ver faturas",
      });
    }
  }

  if (recursos.orcamentos) {
    const mes = hoje.slice(0, 7);
    const { orcamento } = await carregarOrcamento({ mes, destino: "", considerar: "vencimento" }, hoje);
    const estourados = orcamento.cartoes.filter((c) => c.natureza === "despesa" && c.orcamento > 0 && c.realizado > c.orcamento);
    for (const c of estourados) {
      lista.push({
        id: `orcamento:${c.id}:${mes}`,
        tipo: "alerta",
        titulo: `Orçamento de ${c.nome} ultrapassado`,
        texto: `Gasto de R$ ${formatarCentavos(c.realizado)} para um limite de R$ ${formatarCentavos(c.orcamento)} neste mês.`,
        href: `/gestao/orcamentos?mes=${mes}`,
        rotuloLink: "Ver orçamentos",
      });
    }
  }

  if (recursos.importacao) {
    const [{ total }] = await db.select({ total: count() }).from(importacao).where(eq(importacao.situacao, "rascunho"));
    if (total > 0) {
      lista.push({
        id: `importacoes:${total}`,
        tipo: "info",
        titulo: `${plural(total, "importação não concluída", "importações não concluídas")}`,
        texto: "Ficaram como rascunho. Continue de onde parou ou descarte.",
        href: "/financeiro/importacoes",
        rotuloLink: "Ver importações",
      });
    }
  }

  if (u && (!u.telefone || !u.cidade || !u.cep)) {
    lista.push({ id: "meus-dados", tipo: "info", titulo: "Complete suas informações", texto: "Telefone e endereço ainda estão em branco.", href: "/administracao/meus-dados", rotuloLink: "Acessar Meus Dados" });
  }

  return { lista, lidas };
});
