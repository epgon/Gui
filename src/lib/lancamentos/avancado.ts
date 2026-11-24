/**
 * Filtro Avançado de Lançamentos: Origem (Lançamento, Conta ou Cartão, Categoria...), Campo, Condição e Valor.
 * Funciona na lista já montada (inclui as parcelas e os recorrentes previstos).
 */
import type { CampoAvancado, Leitores } from "@/lib/listagem/avancado";
import type { LinhaLista, Opcoes } from "./tipos";

const SITUACOES = [
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "a_vencer", rotulo: "A Vencer" },
  { valor: "vencido", rotulo: "Vencido" },
];
const TIPOS = [
  { valor: "Receita", rotulo: "Receita" },
  { valor: "Despesa", rotulo: "Despesa" },
  { valor: "Transferência", rotulo: "Transferência" },
];

/** Os campos, com as listas de opções (contas, categorias, formas e tags cadastradas). */
export function camposLancamentos(opcoes: Opcoes): CampoAvancado[] {
  const lista = (itens: { rotulo: string }[]) => [...new Set(itens.map((i) => i.rotulo))].map((r) => ({ valor: r, rotulo: r }));
  return [
    { origem: "Lançamento", chave: "descricao", rotulo: "Descrição", tipo: "texto" },
    { origem: "Lançamento", chave: "valor", rotulo: "Valor", tipo: "dinheiro" },
    { origem: "Lançamento", chave: "vencimento", rotulo: "Data de Vencimento", tipo: "data" },
    { origem: "Lançamento", chave: "pagamento", rotulo: "Data de Pagamento", tipo: "data" },
    { origem: "Lançamento", chave: "compra", rotulo: "Data da Compra", tipo: "data" },
    { origem: "Lançamento", chave: "situacao", rotulo: "Situação", tipo: "lista", opcoes: SITUACOES },
    { origem: "Lançamento", chave: "tipo", rotulo: "Tipo", tipo: "lista", opcoes: TIPOS },
    { origem: "Lançamento", chave: "parcelado", rotulo: "Parcelado", tipo: "booleano" },
    { origem: "Lançamento", chave: "recorrente", rotulo: "Recorrente", tipo: "booleano" },
    { origem: "Lançamento", chave: "observacao", rotulo: "Tem observação", tipo: "booleano" },
    { origem: "Lançamento", chave: "anexos", rotulo: "Tem anexo", tipo: "booleano" },
    { origem: "Conta ou Cartão", chave: "destino", rotulo: "Nome", tipo: "lista", opcoes: lista(opcoes.destinos) },
    { origem: "Categoria", chave: "categoria", rotulo: "Nome", tipo: "lista", opcoes: lista(opcoes.categorias) },
    { origem: "Cliente ou Fornecedor", chave: "contato", rotulo: "Nome", tipo: "texto" },
    { origem: "Forma de Pagamento", chave: "forma", rotulo: "Descrição", tipo: "lista", opcoes: lista(opcoes.formas) },
    { origem: "Tag", chave: "tag", rotulo: "Descrição", tipo: "lista", opcoes: lista(opcoes.tags) },
  ];
}

/** Campos sem as listas de opções: bastam para ler o "av" da URL e filtrar. */
export const CAMPOS_LANCAMENTOS_BASE = camposLancamentos({ destinos: [], cartoes: [], categorias: [], formas: [], contatos: [], tags: [] });

const tipoDe = (l: LinhaLista) => (l.tipo === "transferencia_saida" || l.tipo === "transferencia_entrada" ? "Transferência" : l.valorCentavos >= 0 ? "Receita" : "Despesa");

export const LEITORES_LANCAMENTOS: Leitores<LinhaLista> = {
  descricao: (l) => l.descricao,
  valor: (l) => l.valorCentavos,
  vencimento: (l) => l.data,
  pagamento: (l) => l.dataPagamento,
  compra: (l) => l.dataCompra,
  situacao: (l) => l.situacao,
  tipo: tipoDe,
  parcelado: (l) => !!l.parcela,
  recorrente: (l) => l.recorrenciaId !== null || l.previsto !== null,
  observacao: (l) => l.observacao,
  anexos: (l) => l.anexos > 0,
  destino: (l) => l.contaOuCartao,
  // No detalhado, cada item tem a sua categoria: basta um deles bater.
  categoria: (l) => (l.itens.length ? l.itens.map((i) => i.categoria).filter(Boolean) : l.categoria ? [l.categoria] : []),
  contato: (l) => l.contato,
  forma: (l) => l.forma,
  tag: (l) => l.tags,
};
