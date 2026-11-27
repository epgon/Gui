import "server-only";
import { lerConfiguracao } from "@/lib/configuracao";
import { lerInclusoes, type InclusoesRelatorio, type TelaComInclusoes } from "./regras";

/** Chave na tabela de configurações onde fica a engrenagem "Incluir as categorias" de cada relatório. */
export const chaveInclusoes = (tela: TelaComInclusoes) => `relatorio_inclusoes:${tela}`;

/** O que está gravado na engrenagem do relatório (tudo desligado se nunca mexeu). */
export async function lerInclusoesSalvas(tela: TelaComInclusoes): Promise<InclusoesRelatorio> {
  return lerInclusoes(await lerConfiguracao(chaveInclusoes(tela)));
}
