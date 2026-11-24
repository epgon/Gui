/**
 * Como os "Dados" de um registro da auditoria aparecem na tela: uma lista de campo e valor.
 * Nas alterações, o valor é "antes → depois".
 */
export type LinhaDado = { campo: string; valor: string; antes?: string };

const NOMES: Record<string, string> = {
  descricao: "Descrição",
  nome: "Nome",
  valorCentavos: "Valor",
  valor: "Valor",
  dataVencimento: "Data de Vencimento",
  dataPagamento: "Data de Pagamento",
  dataCompra: "Data da Compra",
  dataReferencia: "Data de Referência",
  categoriaId: "Categoria",
  categoriaPaiId: "Categoria Pai",
  contaId: "Conta",
  cartaoId: "Cartão",
  contatoId: "Cliente ou Fornecedor",
  formaPagamentoId: "Forma de Pagamento",
  limiteCentavos: "Limite",
  diaFechamento: "Dia do Fechamento",
  diaVencimento: "Dia do Vencimento",
  saldoInicialCentavos: "Saldo Inicial",
  saldoInicialData: "Data do Saldo Inicial",
  realizarAutomaticamente: "Realizar automaticamente",
  apenasDiaUtil: "Apenas dia útil",
  ativo: "Situação",
  cor: "Cor",
  natureza: "Tipo",
  observacao: "Observação",
  documento: "Documento",
  tipo: "Tipo",
  sigla: "Sigla",
  email: "E-mail",
  telefone: "Telefone",
  campoAuxiliar: "Campo Auxiliar",
  ordem: "Ordem",
};

/** "saldoInicialCentavos" -> "Saldo Inicial"; desconhecidos: "dataFim" -> "Data Fim". */
export function nomeDoCampo(chave: string): string {
  if (NOMES[chave]) return NOMES[chave];
  const separado = chave.replace(/Centavos$/, "").replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return separado.charAt(0).toUpperCase() + separado.slice(1);
}

export function textoDoValor(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (typeof v === "boolean") return chave === "ativo" ? (v ? "Ativo" : "Inativo") : v ? "Sim" : "Não";
  if (typeof v === "number" && /centavos$/i.test(chave)) return (v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "(nenhum)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const ehMudanca = (v: unknown): v is { antes: unknown; depois: unknown } =>
  !!v && typeof v === "object" && !Array.isArray(v) && "antes" in v && "depois" in v && Object.keys(v).length === 2;

/** Lista de campo e valor de um registro. Campos técnicos (id, datas de gravação) ficam de fora. */
export function linhasDosDados(dados: unknown): LinhaDado[] {
  if (dados === null || dados === undefined) return [];
  if (typeof dados !== "object" || Array.isArray(dados)) return [{ campo: "Dados", valor: textoDoValor("", dados) }];
  // Configurações gravam { antes, depois } inteiros.
  if (ehMudanca(dados)) return [{ campo: "Valor", antes: textoDoValor("", dados.antes), valor: textoDoValor("", dados.depois) }];
  const ignorar = new Set(["id", "criadoEm", "atualizadoEm", "padraoSistema", "senhaHash", "conteudo"]);
  return Object.entries(dados as Record<string, unknown>)
    .filter(([k]) => !ignorar.has(k))
    .map(([k, v]) => (ehMudanca(v) ? { campo: nomeDoCampo(k), antes: textoDoValor(k, v.antes), valor: textoDoValor(k, v.depois) } : { campo: nomeDoCampo(k), valor: textoDoValor(k, v) }));
}
