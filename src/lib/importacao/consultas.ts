import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { idValido } from "@/lib/cadastros/resultado";
import { lerCsv, sugerirConfiguracao } from "./csv";
import { totaisPorStatus } from "./servidor";
import type { CamposLinha, Candidato, Condicao, ConfiguracaoCsv, LinhaRevisao, PreencherRegra } from "./tipos";

const { importacao, importacaoLinha: linha, mapeamentoCsv, regraImportacao, contaFinanceira: conta, cartaoCredito: cartao, banco, lancamento: l } = schema;

export type ImportacaoLista = {
  id: number;
  arquivoNome: string;
  formato: "ofx" | "csv" | "pdf";
  situacao: "rascunho" | "concluida" | "cancelada";
  etapa: "destino" | "vinculo" | "revisao";
  destino: string | null;
  bancoCodigo: string | null;
  bancoNome: string | null;
  criadoEm: string;
  concluidoEm: string | null;
  totais: Record<string, number>;
};

export async function listarImportacoes(): Promise<ImportacaoLista[]> {
  const db = getDb();
  const bancoConta = schema.banco;
  const linhas = await db
    .select({
      id: importacao.id,
      arquivoNome: importacao.arquivoNome,
      formato: importacao.formato,
      situacao: importacao.situacao,
      etapa: importacao.etapa,
      conta: conta.descricao,
      cartao: cartao.descricao,
      contaBanco: conta.bancoId,
      cartaoBanco: cartao.bancoId,
      criadoEm: importacao.criadoEm,
      concluidoEm: importacao.concluidoEm,
    })
    .from(importacao)
    .leftJoin(conta, eq(conta.id, importacao.contaId))
    .leftJoin(cartao, eq(cartao.id, importacao.cartaoId))
    .orderBy(desc(importacao.criadoEm), desc(importacao.id))
    .limit(200);
  const bancos = new Map((await db.select({ id: bancoConta.id, codigo: bancoConta.codigo, nome: bancoConta.nome }).from(bancoConta)).map((b) => [b.id, b]));
  const totais = await totaisPorStatus(db, linhas.map((x) => x.id));
  return linhas.map((x) => {
    const b = bancos.get((x.contaBanco ?? x.cartaoBanco) as number);
    return {
      id: x.id,
      arquivoNome: x.arquivoNome,
      formato: x.formato,
      situacao: x.situacao,
      etapa: x.etapa,
      destino: x.conta ?? x.cartao ?? null,
      bancoCodigo: b?.codigo ?? null,
      bancoNome: b?.nome ?? null,
      criadoEm: x.criadoEm.toISOString(),
      concluidoEm: x.concluidoEm?.toISOString() ?? null,
      totais: totais.get(x.id) ?? {},
    };
  });
}

export type RegraLista = {
  id: number;
  nome: string;
  destino: string; // "" = todas
  destinoNome: string | null;
  ordem: number;
  condicoes: Condicao[];
  acao: "ignorar" | "preencher";
  preencher: PreencherRegra;
  ativo: boolean;
  padraoSistema: boolean;
};

export async function listarRegras(): Promise<RegraLista[]> {
  const linhas = await getDb()
    .select({ r: regraImportacao, conta: conta.descricao, cartao: cartao.descricao })
    .from(regraImportacao)
    .leftJoin(conta, eq(conta.id, regraImportacao.contaId))
    .leftJoin(cartao, eq(cartao.id, regraImportacao.cartaoId))
    .orderBy(asc(regraImportacao.ordem), asc(regraImportacao.id));
  return linhas.map(({ r, conta: c, cartao: k }) => ({
    id: r.id,
    nome: r.nome,
    destino: r.contaId ? `conta:${r.contaId}` : r.cartaoId ? `cartao:${r.cartaoId}` : "",
    destinoNome: c ?? k ?? null,
    ordem: r.ordem,
    condicoes: (r.condicoes ?? []) as Condicao[],
    acao: r.acao,
    preencher: (r.preencher ?? {}) as PreencherRegra,
    ativo: r.ativo,
    padraoSistema: r.padraoSistema,
  }));
}

export type DetalheImportacao = NonNullable<Awaited<ReturnType<typeof carregarImportacao>>>;

/** Tudo o que o assistente precisa para mostrar a etapa em que a importação está. */
export async function carregarImportacao(id: number) {
  if (!idValido.safeParse(id).success) return null;
  const db = getDb();
  const [imp] = await db.select().from(importacao).where(eq(importacao.id, id));
  if (!imp) return null;
  const destino = imp.contaId ? `conta:${imp.contaId}` : imp.cartaoId ? `cartao:${imp.cartaoId}` : "";
  const [nomeDestino] = imp.contaId
    ? await db.select({ d: conta.descricao, codigo: banco.codigo, banco: banco.nome }).from(conta).leftJoin(banco, eq(banco.id, conta.bancoId)).where(eq(conta.id, imp.contaId))
    : imp.cartaoId
      ? await db.select({ d: cartao.descricao, codigo: banco.codigo, banco: banco.nome }).from(cartao).leftJoin(banco, eq(banco.id, cartao.bancoId)).where(eq(cartao.id, imp.cartaoId))
      : [];

  // Vínculos do CSV: os memorizados para esta conta (ou a sugestão pelo cabeçalho) e a prévia.
  let vinculo: { configuracao: ConfiguracaoCsv; memorizado: boolean; previa: string[][] } | null = null;
  if (imp.formato === "csv") {
    const onde = imp.contaId ? eq(mapeamentoCsv.contaId, imp.contaId) : imp.cartaoId ? eq(mapeamentoCsv.cartaoId, imp.cartaoId) : undefined;
    const [salvo] = onde ? await db.select().from(mapeamentoCsv).where(onde).limit(1) : [];
    const configuracao = (salvo?.configuracao as ConfiguracaoCsv | undefined) ?? sugerirConfiguracao(imp.conteudo, imp.cartaoId !== null);
    vinculo = { configuracao, memorizado: !!salvo, previa: [] };
    // A prévia é refeita no navegador quando o separador muda; aqui vão as primeiras linhas do arquivo.
    vinculo.previa = lerCsv(imp.conteudo.split(/\r?\n/).slice(0, 60).join("\n"), configuracao.separador).slice(0, 11);
  }

  const linhas = await db
    .select({ x: linha, lancamentoDescricao: l.descricao, regraNome: regraImportacao.nome })
    .from(linha)
    .leftJoin(l, eq(l.id, linha.lancamentoId))
    .leftJoin(regraImportacao, eq(regraImportacao.id, linha.regraId))
    .where(eq(linha.importacaoId, id))
    .orderBy(asc(linha.data), asc(linha.numeroLinha));
  const revisao: LinhaRevisao[] = linhas.map(({ x, lancamentoDescricao, regraNome }) => ({
    id: x.id,
    numeroLinha: x.numeroLinha,
    data: x.data,
    valorCentavos: x.valorCentavos,
    tipo: x.tipo,
    descricaoOriginal: x.descricao,
    documento: x.documento,
    campos: x.campos as CamposLinha,
    status: x.status,
    duplicada: x.duplicada,
    candidatos: x.candidatos as Candidato[],
    lancamento: x.lancamentoId ? { id: x.lancamentoId, descricao: lancamentoDescricao ?? "" } : null,
    regra: x.regraId ? { id: x.regraId, nome: regraNome ?? "" } : null,
    bruto: x.dadosBrutos as Record<string, string>,
  }));

  return {
    id: imp.id,
    arquivoNome: imp.arquivoNome,
    formato: imp.formato,
    situacao: imp.situacao,
    etapa: imp.etapa,
    destino,
    destinoNome: nomeDestino?.d ?? null,
    bancoCodigo: nomeDestino?.codigo ?? null,
    bancoNome: nomeDestino?.banco ?? null,
    eCartao: imp.cartaoId !== null,
    toleranciaDias: imp.toleranciaDias,
    qualquerConta: imp.qualquerConta,
    contatoPessoa: imp.contatoPessoa,
    contatoCliente: imp.contatoCliente,
    contatoFornecedor: imp.contatoFornecedor,
    infoArquivo: imp.infoArquivo as Record<string, unknown>,
    linhasPuladas: imp.linhasPuladas,
    criadoEm: imp.criadoEm.toISOString(),
    concluidoEm: imp.concluidoEm?.toISOString() ?? null,
    conteudoCsv: imp.formato === "csv" && imp.etapa === "vinculo" ? imp.conteudo.split(/\r?\n/).slice(0, 60).join("\n") : "",
    vinculo,
    linhas: revisao,
  };
}
