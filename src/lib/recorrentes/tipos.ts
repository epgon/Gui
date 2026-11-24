/** Tipos compartilhados entre a tela de Recorrentes (navegador) e o servidor. */
import type { DadosRecorrencia, ItemDetalhe, ItemFormulario } from "@/lib/lancamentos/tipos";

export type AbaRecorrente = "simples" | "detalhado" | "transferencia";

/** O que o formulário Novo Recorrente envia ao servidor. */
export type DadosRecorrente = {
  aba: AbaRecorrente;
  tipo: "receita" | "despesa";
  planoId: string;
  descricao: string;
  /** "valor" = valor fixo; "media" = média dos últimos lançamentos (o valor vale até existir histórico). */
  modoValor: "valor" | "media";
  mediaUltimos: string;
  valor: string;
  categoriaId: string;
  destino: string;
  contaDestinoId: string;
  formaPagamentoId: string;
  contatoId: string;
  tagIds: number[];
  itens: ItemFormulario[];
  observacao: string;
  realizarAutomaticamente: boolean;
  recorrencia: DadosRecorrencia;
};

/** Uma linha da lista de Recorrentes. */
export type LinhaRecorrente = {
  id: number;
  formato: AbaRecorrente;
  tipo: "receita" | "despesa";
  descricao: string;
  /** Com sinal: receitas positivas, despesas negativas (transferência: negativo). */
  valorCentavos: number;
  mediaUltimos: number;
  intervalo: string;
  dia: string;
  bancoCodigo: string | null;
  bancoNome: string | null;
  contaOuCartao: string;
  contaDestino: string | null;
  categoria: string | null;
  categoriaCor: string | null;
  contato: string | null;
  forma: string | null;
  plano: string | null;
  tags: string[];
  itens: ItemDetalhe[];
  realizarAutomaticamente: boolean;
  apenasDiaUtil: boolean;
  ativo: boolean;
  /** Próximo vencimento ainda não lançado (null = acabou). */
  proximo: string | null;
  fim: string;
};

export type LinhaPlano = { id: number; nome: string; descricao: string; tipo: "receita" | "despesa"; valorCentavos: number; ativo: boolean; usos: number };

export type DadosPlano = { nome: string; descricao: string; tipo: "receita" | "despesa"; valor: string };

export type FiltrosRecorrentes = {
  aba: "todos" | "receitas" | "despesas" | "transferencias";
  destino: string;
  intervalo: string;
  situacao: "todos" | "ativos" | "inativos";
  busca: string;
  detalhar: boolean;
  categoria: string;
  forma: string;
  contato: string;
  tag: string;
  plano: string;
};
