import "server-only";
import { asc, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { mesDe } from "@/lib/lancamentos/regras";
import { DATAS_CONSIDERADAS, type ConsiderarData, type FiltrosRelatorio } from "@/lib/relatorios/regras";
import { carregarArvore, carregarMovimentos } from "@/lib/relatorios/servidor";
import { competenciaDe, montarOrcamento } from "./regras";

const { orcamentoCategoria, orcamentoLimite } = schema;

export type FiltrosOrcamento = { mes: string; destino: string; considerar: ConsiderarData };

export function lerFiltrosOrcamento(sp: ParametrosBusca, hoje = hojeIso()): FiltrosOrcamento {
  const mes = parametro(sp, "mes");
  const destino = parametro(sp, "destino");
  const considerar = parametro(sp, "considerar");
  return {
    mes: /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoje.slice(0, 7),
    destino: /^(conta|cartao):\d+$/.test(destino) ? destino : "",
    considerar: (DATAS_CONSIDERADAS.some((d) => d.valor === considerar) ? considerar : "vencimento") as ConsiderarData,
  };
}

/** Ids das categorias raiz escolhidas para o orçamento. */
export async function carregarEscolhidas(): Promise<number[]> {
  const linhas = await getDb().select({ id: orcamentoCategoria.categoriaId }).from(orcamentoCategoria).orderBy(asc(orcamentoCategoria.ordem));
  return linhas.map((l) => l.id);
}

/** Tudo o que a tela de Orçamentos precisa para o mês escolhido. */
export async function carregarOrcamento(f: FiltrosOrcamento, hoje = hojeIso()) {
  const mes = mesDe(f.mes);
  const competencia = competenciaDe(f.mes);
  const filtros: FiltrosRelatorio = {
    de: mes.inicio,
    ate: mes.fim,
    inicio: mes.inicio,
    fim: mes.fim,
    destino: f.destino,
    situacao: "",
    considerar: f.considerar,
    categoria: "",
    forma: "",
    contato: "",
    tag: "",
    incluirAcerto: false,
    incluirTransferencia: false,
  };
  const arvore = await carregarArvore();
  const [escolhidas, limites, movimentos] = await Promise.all([
    carregarEscolhidas(),
    getDb()
      .select({ categoriaId: orcamentoLimite.categoriaId, competencia: orcamentoLimite.competencia, valorCentavos: orcamentoLimite.valorCentavos })
      .from(orcamentoLimite)
      .where(lte(orcamentoLimite.competencia, competencia)),
    carregarMovimentos(filtros, arvore, hoje),
  ]);
  return { mes, competencia, arvore, escolhidas, orcamento: montarOrcamento(arvore, escolhidas, limites, movimentos, competencia) };
}
