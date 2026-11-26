import "server-only";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { rotuloTipoConta, TIPOS_CONTA } from "@/lib/cadastros/opcoes";
import { carregarOpcoes, lerFiltros, listarLancamentos } from "@/lib/lancamentos/consultas";
import { carregarCartoes, carregarCategorias, carregarContas, carregarContatos, carregarFormas, carregarTags, diaDe } from "@/lib/listagem/cadastros";
import { lerPreferencia } from "@/lib/listagem/servidor";
import { lerParametros } from "@/lib/parametros/servidor";
import type { CadastroAuxiliar } from "@/lib/parametros/tipos";
import { mesDe } from "@/lib/lancamentos/regras";
import type { LinhaLista } from "@/lib/lancamentos/tipos";
import { CAMPOS_LANCAMENTOS_BASE } from "@/lib/lancamentos/avancado";
import { descreverFiltro, lerFiltrosAvancados } from "@/lib/listagem/avancado";
import { INTERVALOS } from "@/lib/recorrentes/regras";
import { lerFiltrosRecorrentes, listarRecorrentes } from "@/lib/recorrentes/lista";
import { carregarMinhasDividas } from "@/lib/dividas/listagem";
import { estaAtiva, ROTULO_SITUACAO_DIVIDA, rotuloTipoDivida } from "@/lib/dividas/regras";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { nomeArquivo, type ColunaTabela, type LinhaTabela, type Tabela } from "./tabela";

const ROTULO_SITUACAO = { realizado: "Realizado", a_vencer: "A Vencer", vencido: "Vencido" } as const;
const SITUACOES_LISTA: Record<string, string> = { nao_realizado: "Não Realizado", realizado: "Realizado", a_vencer: "A Vencer", vencido: "Vencido" };
const ABAS: Record<string, string> = { receitas: "Receitas", despesas: "Despesas", transferencias: "Transferências" };
const situacaoCadastro = (s: string, fem = true) => (s === "ativos" ? `Situação: ${fem ? "Ativas" : "Ativos"}` : s === "inativos" ? `Situação: ${fem ? "Inativas" : "Inativos"}` : null);
const sn = (v: boolean) => (v ? "Sim" : "Não");

/** Financeiro > Lançamentos: o mês, com os mesmos filtros da tela, as compras das faturas e os saldos. */
async function lancamentos(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const f = lerFiltros(sp, hoje);
  const [{ linhas, resumo }, opcoes] = await Promise.all([listarLancamentos(f, hoje), carregarOpcoes()]);
  const nome = (lista: { id: number; rotulo: string }[], id: string) => lista.find((x) => String(x.id) === id)?.rotulo ?? "?";
  const filtros = [`Mês: ${mesDe(f.mes).rotulo}`];
  if (f.aba !== "todos") filtros.push(`Aba: ${ABAS[f.aba]}`);
  if (f.destino) filtros.push(`Conta ou Cartão: ${opcoes.destinos.find((d) => d.valor === f.destino)?.rotulo ?? "?"}`);
  if (f.situacao) filtros.push(`Situação: ${SITUACOES_LISTA[f.situacao]}`);
  if (f.busca) filtros.push(`Busca: ${f.busca}`);
  if (f.categoria) filtros.push(`Categoria: ${opcoes.categorias.find((c) => String(c.id) === f.categoria)?.rotulo ?? "?"}`);
  if (f.forma) filtros.push(`Forma de Pagamento: ${nome(opcoes.formas, f.forma)}`);
  if (f.contato) filtros.push(`Cliente ou Fornecedor: ${nome(opcoes.contatos, f.contato)}`);
  if (f.tag) filtros.push(`Tag: ${nome(opcoes.tags, f.tag)}`);
  for (const a of lerFiltrosAvancados(f.avancado, CAMPOS_LANCAMENTOS_BASE)) filtros.push(descreverFiltro(a, CAMPOS_LANCAMENTOS_BASE));

  const celulas = (x: LinhaLista) => [
    x.data,
    x.descricao + (x.parcela ? ` (${x.parcela})` : "") + (x.previsto ? " · previsto" : ""),
    x.contaOuCartao,
    x.categoria ?? (x.itens.length ? "Detalhado" : ""),
    x.contato ?? "",
    x.forma ?? "",
    ROTULO_SITUACAO[x.situacao],
    x.valorCentavos,
  ];
  const tabela: LinhaTabela[] = [];
  if (resumo.saldoAnterior !== null) tabela.push({ celulas: [null, "Saldo Anterior", null, null, null, null, null, resumo.saldoAnterior], estilo: "grupo" });
  for (const x of linhas) {
    tabela.push({ celulas: celulas(x) });
    // Com "Detalhar", as compras da fatura e os itens do detalhado aparecem embaixo.
    if (f.detalhar) {
      for (const c of x.compras) tabela.push({ celulas: [c.dataCompra ?? c.data, c.descricao + (c.parcela ? ` (${c.parcela})` : ""), c.contaOuCartao, c.categoria ?? "", c.contato ?? "", c.forma ?? "", ROTULO_SITUACAO[c.situacao], c.valorCentavos], recuo: 1 });
      if (x.itens.length > 1) for (const i of x.itens) tabela.push({ celulas: [null, i.descricao, null, i.categoria, null, null, null, i.valorCentavos], recuo: 1 });
    }
  }
  tabela.push({ celulas: [null, "Total dos Lançamentos (receitas - despesas)", null, null, null, null, null, resumo.total], estilo: "total" });
  if (resumo.saldoPrevisto !== null) tabela.push({ celulas: [null, "Saldo Previsto", null, null, null, null, null, resumo.saldoPrevisto], estilo: "grupo" });
  if (resumo.saldoAtual !== null) tabela.push({ celulas: [null, "Saldo Atual", null, null, null, null, null, resumo.saldoAtual], estilo: "grupo" });
  return {
    titulo: "Lançamentos",
    filtros,
    colunas: [
      { titulo: "Data", tipo: "data", largura: 1 },
      { titulo: "Descrição", largura: 3 },
      { titulo: "Conta ou Cartão", largura: 1.6 },
      { titulo: "Categoria", largura: 1.8 },
      { titulo: "Cliente ou Fornecedor", largura: 1.6 },
      { titulo: "Forma", largura: 1.2 },
      { titulo: "Situação", largura: 1 },
      { titulo: "Valor", tipo: "dinheiro", largura: 1.2 },
    ],
    linhas: tabela,
    orientacao: "paisagem",
    registros: linhas.length,
    arquivo: nomeArquivo(`lancamentos ${f.mes}`, hoje),
  };
}

/** Financeiro > Recorrentes. */
async function recorrentes(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const f = lerFiltrosRecorrentes(sp);
  const { linhas, opcoes, planos } = await listarRecorrentes(f, hoje);
  const filtros: string[] = [`Situação: ${f.situacao === "ativos" ? "Ativos" : f.situacao === "inativos" ? "Inativos" : "Todos"}`];
  if (f.aba !== "todos") filtros.push(`Aba: ${ABAS[f.aba]}`);
  if (f.destino) filtros.push(`Conta ou Cartão: ${opcoes.destinos.find((d) => d.valor === f.destino)?.rotulo ?? "?"}`);
  if (f.intervalo) filtros.push(`Intervalo: ${INTERVALOS.find((i) => i.valor === f.intervalo)?.rotulo ?? f.intervalo}`);
  if (f.busca) filtros.push(`Busca: ${f.busca}`);
  if (f.categoria) filtros.push(`Categoria: ${opcoes.categorias.find((c) => String(c.id) === f.categoria)?.rotulo ?? "?"}`);
  if (f.forma) filtros.push(`Forma de Pagamento: ${opcoes.formas.find((x) => String(x.id) === f.forma)?.rotulo ?? "?"}`);
  if (f.contato) filtros.push(`Cliente ou Fornecedor: ${opcoes.contatos.find((x) => String(x.id) === f.contato)?.rotulo ?? "?"}`);
  if (f.tag) filtros.push(`Tag: ${opcoes.tags.find((x) => String(x.id) === f.tag)?.rotulo ?? "?"}`);
  if (f.plano) filtros.push(`Plano: ${planos.find((p) => String(p.id) === f.plano)?.nome ?? "?"}`);
  return {
    titulo: "Recorrentes",
    filtros,
    colunas: [
      { titulo: "Descrição", largura: 3 },
      { titulo: "Conta ou Cartão", largura: 1.6 },
      { titulo: "Categoria", largura: 1.8 },
      { titulo: "Intervalo", largura: 1.1 },
      { titulo: "Dia", largura: 0.9 },
      { titulo: "Próximo", tipo: "data", largura: 1 },
      { titulo: "Fim", largura: 1 },
      { titulo: "Situação", largura: 0.8 },
      { titulo: "Valor", tipo: "dinheiro", largura: 1.2 },
    ],
    linhas: linhas.map((x) => ({
      celulas: [
        x.descricao + (x.mediaUltimos ? " (média)" : ""),
        x.contaOuCartao + (x.contaDestino ? ` → ${x.contaDestino}` : ""),
        x.formato === "transferencia" ? "Transferência" : (x.categoria ?? (x.itens.length ? "Detalhado" : "")),
        x.intervalo,
        x.dia,
        x.proximo,
        x.fim,
        x.ativo ? "Ativo" : "Inativo",
        x.valorCentavos,
      ],
    })),
    orientacao: "paisagem",
    arquivo: nomeArquivo("recorrentes", hoje),
  };
}

/** Colunas a mais que toda lista de Cadastros oferece na Impressão Personalizada. */
async function extrasComuns(auxiliar: CadastroAuxiliar) {
  const aux = (await lerParametros()).camposAuxiliares[auxiliar];
  const colunas: ColunaTabela[] = [
    { titulo: "Código", tipo: "numero", largura: 0.6, extra: true },
    ...(aux.ativo ? [{ titulo: aux.rotulo, largura: 1.5, extra: true }] : []),
    { titulo: "Cadastrado", tipo: "data", largura: 0.9, extra: true },
    { titulo: "Atualizado", tipo: "data", largura: 0.9, extra: true },
  ];
  const celulas = (l: { id: number; campoAuxiliar: string | null; criadoEm: Date; atualizadoEm: Date }) => [
    l.id,
    ...(aux.ativo ? [l.campoAuxiliar ?? ""] : []),
    diaDe(l.criadoEm),
    diaDe(l.atualizadoEm),
  ];
  return { colunas, celulas };
}

async function contas(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const [pref, extras] = await Promise.all([lerPreferencia("contas-financeiras"), extrasComuns("contas")]);
  const { f, tipo, linhas, descricoes } = await carregarContas(sp, pref);
  const filtros = [f.busca && `Busca: ${f.busca}`, tipo && `Tipo: ${TIPOS_CONTA.find((t) => t.valor === tipo)?.rotulo}`, situacaoCadastro(f.situacao), ...descricoes].filter((x): x is string => !!x);
  const corpo: LinhaTabela[] = linhas.map((x) => ({
    celulas: [x.descricao, x.bancoNome ?? "Outro", rotuloTipoConta(x.tipo), sn(x.considerarNosSaldos), x.ativo ? "Ativa" : "Inativa", x.saldoAtualCentavos, x.saldoInicialCentavos, x.saldoInicialData, ...extras.celulas(x)],
  }));
  const total = linhas.filter((x) => x.considerarNosSaldos).reduce((s, x) => s + x.saldoAtualCentavos, 0);
  if (linhas.length) corpo.push({ celulas: ["Total (contas consideradas nos saldos)", null, null, null, null, total, null, null, ...extras.colunas.map(() => null)], estilo: "total" });
  return {
    titulo: "Contas Financeiras",
    filtros,
    colunas: [
      { titulo: "Conta Financeira", largura: 2.5 },
      { titulo: "Banco", largura: 2 },
      { titulo: "Tipo", largura: 1.5 },
      { titulo: "Considerar nos saldos", largura: 1.3 },
      { titulo: "Situação" },
      { titulo: "Saldo Atual", tipo: "dinheiro", largura: 1.3 },
      { titulo: "Saldo Inicial", tipo: "dinheiro", largura: 1.3, extra: true },
      { titulo: "Data do Saldo Inicial", tipo: "data", largura: 1, extra: true },
      ...extras.colunas,
    ],
    linhas: corpo,
    orientacao: "retrato",
    registros: linhas.length,
    arquivo: nomeArquivo("contas financeiras", hoje),
  };
}

async function cartoes(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const [pref, extras] = await Promise.all([lerPreferencia("cartoes-de-credito"), extrasComuns("cartoes")]);
  const { f, fechamento, vencimento, linhas, descricoes } = await carregarCartoes(sp, pref);
  const filtros = [f.busca && `Busca: ${f.busca}`, fechamento && `Dia do Fechamento: ${fechamento}`, vencimento && `Dia do Vencimento: ${vencimento}`, situacaoCadastro(f.situacao, false), ...descricoes].filter(
    (x): x is string => !!x,
  );
  return {
    titulo: "Cartões de Crédito",
    filtros,
    colunas: [
      { titulo: "Cartão de Crédito", largura: 2.2 },
      { titulo: "Bandeira ou Emissor", largura: 1.6 },
      { titulo: "Fechamento", tipo: "numero", largura: 0.9 },
      { titulo: "Vencimento", tipo: "numero", largura: 0.9 },
      { titulo: "Conta para Pagamento", largura: 1.6 },
      { titulo: "Situação", largura: 0.8 },
      { titulo: "Limite", tipo: "dinheiro", largura: 1.1 },
      { titulo: "Disponível", tipo: "dinheiro", largura: 1.1 },
      { titulo: "Usado", tipo: "dinheiro", largura: 1.1, extra: true },
      ...extras.colunas,
    ],
    linhas: linhas.map((x) => {
      const lim = x.limite;
      return {
        celulas: [
          x.descricao,
          x.bancoNome ?? "Outro",
          x.diaFechamento,
          x.diaVencimento,
          x.contaPagamentoNome ?? "Não informado",
          x.ativo ? "Ativo" : "Inativo",
          lim.ilimitado ? "Ilimitado" : lim.limite,
          lim.ilimitado ? null : lim.disponivel,
          lim.usado,
          ...extras.celulas(x),
        ],
      };
    }),
    orientacao: "paisagem",
    arquivo: nomeArquivo("cartoes de credito", hoje),
  };
}

async function categorias(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const extras = await extrasComuns("categorias");
  const { f, aba, arvore, linhas, descricoes } = await carregarCategorias(sp);
  const filtros = [aba !== null && `Categoria principal: ${arvore.find((c) => c.id === aba)?.nome}`, f.busca && `Busca: ${f.busca}`, situacaoCadastro(f.situacao), ...descricoes].filter((x): x is string => !!x);
  return {
    titulo: "Categorias",
    filtros,
    colunas: [{ titulo: "Numeração", largura: 0.9 }, { titulo: "Categoria", largura: 3 }, { titulo: "Tipo", largura: 1 }, { titulo: "Situação", largura: 0.9 }, { titulo: "Nível", tipo: "numero", largura: 0.6, extra: true }, ...extras.colunas],
    linhas: linhas.map((c) => ({
      celulas: [c.numero || "—", c.nome, c.especial ? "Especial" : c.natureza === "receita" ? "Receita" : "Despesa", c.ativo ? "Ativa" : "Inativa", c.nivel, ...extras.celulas(c)],
      recuo: 0,
      cor: null,
    })),
    orientacao: "retrato",
    arquivo: nomeArquivo("categorias", hoje),
  };
}

const SEXO: Record<string, string> = { masculino: "Masculino", feminino: "Feminino", outro: "Outro", nao_informado: "Não informado" };

async function contatos(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const [pref, extras] = await Promise.all([lerPreferencia("clientes-e-fornecedores"), extrasComuns("contatos")]);
  const { f, papel, pessoa, cidade, uf, linhas, descricoes } = await carregarContatos(sp, pref);
  const filtros = [
    f.busca && `Busca: ${f.busca}`,
    papel && `Mostrar: ${papel === "clientes" ? "Só Clientes" : "Só Fornecedores"}`,
    pessoa && `Pessoa: ${pessoa === "fisica" ? "Física" : "Jurídica"}`,
    cidade && `Cidade: ${cidade}`,
    uf && `Estado: ${uf}`,
    situacaoCadastro(f.situacao, false),
    ...descricoes,
  ].filter((x): x is string => !!x);
  return {
    titulo: "Clientes e Fornecedores",
    filtros,
    colunas: [
      { titulo: "Nome", largura: 2.4 },
      { titulo: "Pessoa", largura: 0.8 },
      { titulo: "CPF ou CNPJ", largura: 1.4 },
      { titulo: "E-mail", largura: 2 },
      { titulo: "Telefone", largura: 1.2 },
      { titulo: "Cidade/UF", largura: 1.4 },
      { titulo: "Cliente", largura: 0.7 },
      { titulo: "Fornecedor", largura: 0.8 },
      { titulo: "Situação", largura: 0.8 },
      { titulo: "Razão Social", largura: 2.2, extra: true },
      { titulo: "Sexo", largura: 0.9, extra: true },
      { titulo: "Nascimento", tipo: "data", largura: 0.9, extra: true },
      { titulo: "CEP", largura: 0.9, extra: true },
      { titulo: "Endereço", largura: 2.2, extra: true },
      { titulo: "Número", largura: 0.7, extra: true },
      { titulo: "Complemento", largura: 1.2, extra: true },
      { titulo: "Bairro", largura: 1.3, extra: true },
      { titulo: "Cidade", largura: 1.3, extra: true },
      { titulo: "Estado", largura: 0.6, extra: true },
      { titulo: "Observação", largura: 2.5, extra: true },
      ...extras.colunas,
    ],
    linhas: linhas.map((x) => ({
      celulas: [
        x.nome,
        x.pessoa === "fisica" ? "Física" : "Jurídica",
        x.documento ?? "",
        x.email ?? "",
        x.telefone ?? "",
        [x.cidade, x.uf].filter(Boolean).join("/"),
        sn(x.eCliente),
        sn(x.eFornecedor),
        x.ativo ? "Ativo" : "Inativo",
        x.razaoSocial ?? "",
        SEXO[x.sexo] ?? "",
        x.nascimento,
        x.cep ?? "",
        x.logradouro ?? "",
        x.numero ?? "",
        x.complemento ?? "",
        x.bairro ?? "",
        x.cidade ?? "",
        x.uf ?? "",
        x.observacoes ?? "",
        ...extras.celulas(x),
      ],
    })),
    orientacao: "paisagem",
    arquivo: nomeArquivo("clientes e fornecedores", hoje),
  };
}

async function formas(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const [pref, extras] = await Promise.all([lerPreferencia("formas-de-pagamento"), extrasComuns("formas")]);
  const { f, linhas, descricoes } = await carregarFormas(sp, pref);
  return {
    titulo: "Formas de Pagamento",
    filtros: [f.busca && `Busca: ${f.busca}`, situacaoCadastro(f.situacao), ...descricoes].filter((x): x is string => !!x),
    colunas: [{ titulo: "Forma de Pagamento", largura: 3 }, { titulo: "Sigla" }, { titulo: "Situação" }, ...extras.colunas],
    linhas: linhas.map((x) => ({ celulas: [x.descricao, x.sigla ?? "", x.ativo ? "Ativa" : "Inativa", ...extras.celulas(x)] })),
    orientacao: "retrato",
    arquivo: nomeArquivo("formas de pagamento", hoje),
  };
}

async function tags(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  const [pref, extras] = await Promise.all([lerPreferencia("tags"), extrasComuns("tags")]);
  const { f, linhas, descricoes } = await carregarTags(sp, pref);
  return {
    titulo: "Tags",
    filtros: [f.busca && `Busca: ${f.busca}`, situacaoCadastro(f.situacao), ...descricoes].filter((x): x is string => !!x),
    colunas: [{ titulo: "Tag", largura: 3 }, { titulo: "Situação" }, ...extras.colunas],
    linhas: linhas.map((x) => ({ celulas: [x.descricao, x.ativo ? "Ativa" : "Inativa", ...extras.celulas(x)] })),
    orientacao: "retrato",
    arquivo: nomeArquivo("tags", hoje),
  };
}

/** Gestão > Gestão de Dívidas > Minhas Dívidas: as dívidas com os filtros da tela (todas, sem paginar). */
async function dividas(sp: ParametrosBusca, hoje: string): Promise<Tabela> {
  if (!(await recursoAtivo("dividas"))) throw new Error("O recurso Gestão de Dívidas está desligado.");
  const { f, linhas, credores, descricoes } = await carregarMinhasDividas(sp, hoje);
  const filtros = [
    f.busca && `Busca: ${f.busca}`,
    f.credor && `Credor: ${credores.find((c) => String(c.id) === f.credor)?.nome ?? "?"}`,
    f.tipo && `Tipo: ${rotuloTipoDivida(f.tipo as never)}`,
    f.situacao && `Situação: ${ROTULO_SITUACAO_DIVIDA[f.situacao as keyof typeof ROTULO_SITUACAO_DIVIDA] ?? f.situacao}`,
    ...descricoes,
  ].filter((x): x is string => !!x);
  const aberta = (x: (typeof linhas)[number]) => estaAtiva(x.situacao);
  const total = linhas.filter(aberta).reduce((s, x) => s + x.saldo.exibido, 0);
  return {
    titulo: "Minhas Dívidas",
    filtros,
    colunas: [
      { titulo: "Dívida", largura: 3 },
      { titulo: "Credor", largura: 2 },
      { titulo: "Tipo", largura: 2 },
      { titulo: "Parcelas", largura: 1 },
      { titulo: "Próximo vencimento", tipo: "data", largura: 1.3 },
      { titulo: "Situação", largura: 1.3 },
      { titulo: "Saldo devedor", tipo: "dinheiro", largura: 1.4 },
    ],
    linhas: [
      ...linhas.map((x) => ({
        celulas: [x.descricao, x.credor, rotuloTipoDivida(x.tipo), x.parcelasTotal ? `${x.parcelasPagas}/${x.parcelasTotal}` : "—", x.proximoVencimento, ROTULO_SITUACAO_DIVIDA[x.situacao], aberta(x) ? -x.saldo.exibido : 0],
      })),
      ...(linhas.length ? [{ celulas: ["Total devido (dívidas ativas)", null, null, null, null, null, -total], estilo: "total" as const }] : []),
    ],
    orientacao: "paisagem",
    registros: linhas.length,
    arquivo: nomeArquivo("minhas dividas", hoje),
  };
}

/** Cada lista que tem Impressão Padrão e exportação, pelo nome usado no endereço. */
export const LISTAS: Record<string, (sp: ParametrosBusca, hoje: string) => Promise<Tabela>> = {
  lancamentos,
  recorrentes,
  "contas-financeiras": contas,
  "cartoes-de-credito": cartoes,
  categorias,
  "clientes-e-fornecedores": contatos,
  "formas-de-pagamento": formas,
  tags,
  dividas,
};
