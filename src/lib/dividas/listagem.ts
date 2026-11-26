import "server-only";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { diaDe } from "@/lib/listagem/cadastros";
import type { Leitores } from "@/lib/listagem/avancado";
import { aplicarAvancadoEOrdem, lerPreferencia } from "@/lib/listagem/servidor";
import { estaAtiva, rotuloGarantia, rotuloTipoDivida, ROTULO_SITUACAO_DIVIDA } from "./regras";
import { carregarListaDividas, lerFiltrosDividas } from "./servidor";
import type { LinhaDivida } from "./tipos";

/** O que o Filtro Avançado e a Ordenação leem de cada dívida (Configurações da Listagem de Minhas Dívidas). */
export const leitoresDividas: Leitores<LinhaDivida> = {
  codigo: (d) => d.id,
  cadastrado: (d) => diaDe(d.criadoEm),
  atualizado: (d) => diaDe(d.atualizadoEm),
  descricao: (d) => d.descricao,
  credor: (d) => d.credor,
  tipo: (d) => rotuloTipoDivida(d.tipo),
  situacao: (d) => ROTULO_SITUACAO_DIVIDA[d.situacao],
  garantia: (d) => rotuloGarantia(d.garantia),
  proximo: (d) => (estaAtiva(d.situacao) ? d.proximoVencimento : null),
  contratacao: (d) => d.dataContratacao,
  parcelasPagas: (d) => (d.forma === "parcelas_fixas" ? d.parcelasPagas : null),
  parcelasTotal: (d) => (d.forma === "parcelas_fixas" ? d.parcelasTotal : null),
  taxa: (d) => d.taxaMensal,
  saldo: (d) => (estaAtiva(d.situacao) ? d.saldo.exibido : 0),
  valorOriginal: (d) => d.valorOriginalCentavos,
  diasAtraso: (d) => d.diasAtraso,
};

/** A lista de Minhas Dívidas com o painel Simples, o Filtro Avançado e a Ordenação das Configurações da Listagem. */
export async function carregarMinhasDividas(sp: ParametrosBusca, hoje = hojeIso()) {
  const f = lerFiltrosDividas(sp);
  const [dados, preferencia] = await Promise.all([carregarListaDividas(f, hoje), lerPreferencia("dividas")]);
  const r = aplicarAvancadoEOrdem("dividas", dados.linhas, sp, leitoresDividas, preferencia);
  return {
    f,
    preferencia,
    linhas: r.linhas,
    descricoes: r.descricoes,
    todas: dados.todas,
    credores: dados.credores,
    totalDevidoLista: r.linhas.filter((x) => estaAtiva(x.situacao)).reduce((s, x) => s + x.saldo.exibido, 0),
  };
}
