import { describe, expect, it } from "vitest";
import { codificarFiltros, descreverFiltro, filtrarAvancado, lerFiltrosAvancados, ordenarPor, passaCondicao, type CampoAvancado } from "./avancado";
import { colunasVisiveis, normalizarPreferencia, preferenciaPadrao } from "./telas";
import { conferirArvore, moverNo, moverPorSeta, nivelDe, type No } from "@/lib/categorias-organizar";
import { diaDoMesValido, feriadosSugeridos, pascoa } from "@/lib/parametros/feriados";
import { lerParametrosDe, lerRecursosDe, novoOuAtualizado, telasOcultas } from "@/lib/parametros/tipos";
import { lerPersonalizacao, normalizarImpressoes, personalizar, semExtras, type Tabela } from "@/lib/exportacao/tabela";
import { juntarLidas, MAXIMO_LIDAS } from "@/lib/notificacoes/tipos";
import { linhasDosDados, nomeDoCampo } from "@/lib/auditoria-dados";

const campos: CampoAvancado[] = [
  { chave: "nome", rotulo: "Nome", tipo: "texto" },
  { chave: "valor", rotulo: "Valor", tipo: "dinheiro" },
  { chave: "data", rotulo: "Data", tipo: "data" },
  { chave: "ativo", rotulo: "Ativo", tipo: "booleano" },
  { chave: "tags", rotulo: "Tag", tipo: "lista", origem: "Tag", opcoes: [{ valor: "Casa", rotulo: "Casa" }] },
];

describe("Filtro Avançado", () => {
  it("lê e codifica o parâmetro av, descartando o que for inválido", () => {
    const av = codificarFiltros([
      { campo: "nome", condicao: "contem", valor: "joão | maria" },
      { campo: "valor", condicao: "maior", valor: "100,00" },
    ]);
    expect(lerFiltrosAvancados(av, campos)).toEqual([
      { campo: "nome", condicao: "contem", valor: "joão | maria" },
      { campo: "valor", condicao: "maior", valor: "100,00" },
    ]);
    expect(lerFiltrosAvancados("xyz~igual~1|valor~contem~1|nome~igual~|nome~vazio~", campos)).toEqual([{ campo: "nome", condicao: "vazio", valor: "" }]);
    expect(lerFiltrosAvancados("nome~igual~a|nome~igual~b|nome~igual~c|nome~igual~d|nome~igual~e|nome~igual~f", campos)).toHaveLength(5);
  });

  it("compara texto sem acento, dinheiro pelo tamanho e listas", () => {
    expect(passaCondicao({ campo: "nome", condicao: "contem", valor: "JOAO" }, campos[0], "João Silva")).toBe(true);
    expect(passaCondicao({ campo: "valor", condicao: "maior", valor: "100,00" }, campos[1], -15000)).toBe(true);
    expect(passaCondicao({ campo: "valor", condicao: "menor", valor: "100,00" }, campos[1], -15000)).toBe(false);
    expect(passaCondicao({ campo: "data", condicao: "maior_igual", valor: "2026-11-01" }, campos[2], "2026-11-01")).toBe(true);
    expect(passaCondicao({ campo: "ativo", condicao: "igual", valor: "nao" }, campos[3], false)).toBe(true);
    expect(passaCondicao({ campo: "tags", condicao: "igual", valor: "casa" }, campos[4], ["Lazer", "Casa"])).toBe(true);
    expect(passaCondicao({ campo: "tags", condicao: "diferente", valor: "Casa" }, campos[4], ["Lazer", "Casa"])).toBe(false);
    expect(passaCondicao({ campo: "tags", condicao: "diferente", valor: "Casa" }, campos[4], [])).toBe(true);
    expect(passaCondicao({ campo: "nome", condicao: "vazio", valor: "" }, campos[0], null)).toBe(true);
  });

  it("filtra com todas as condições e descreve para a impressão", () => {
    const linhas = [
      { nome: "Mercado", valor: -5000 },
      { nome: "Mercado Livre", valor: -20000 },
      { nome: "Salário", valor: 500000 },
    ];
    const leitores = { nome: (l: (typeof linhas)[number]) => l.nome, valor: (l: (typeof linhas)[number]) => l.valor };
    const filtros = lerFiltrosAvancados("nome~comeca~mercado|valor~maior_igual~100", campos);
    expect(filtrarAvancado(linhas, filtros, campos, leitores).map((l) => l.nome)).toEqual(["Mercado Livre"]);
    expect(descreverFiltro(filtros[0], campos)).toBe("Nome começa com mercado");
    expect(descreverFiltro({ campo: "data", condicao: "igual", valor: "2026-11-24" }, campos)).toBe("Data igual 24/11/2026");
    expect(descreverFiltro({ campo: "tags", condicao: "igual", valor: "Casa" }, campos)).toBe("Tag > Tag igual Casa");
  });

  it("ordena com vazios sempre no fim", () => {
    const linhas = [{ n: "b" }, { n: "" }, { n: "Á" }, { n: "c" }];
    expect(ordenarPor(linhas, (l) => l.n, "asc").map((l) => l.n)).toEqual(["Á", "b", "c", ""]);
    expect(ordenarPor(linhas, (l) => l.n, "desc").map((l) => l.n)).toEqual(["c", "b", "Á", ""]);
  });
});

describe("Configurações da Listagem", () => {
  it("usa o padrão quando não há nada gravado e mantém as colunas fixas", () => {
    const padrao = preferenciaPadrao("contas-financeiras");
    expect(normalizarPreferencia("contas-financeiras", null)).toEqual(padrao);
    const p = normalizarPreferencia("contas-financeiras", { colunas: ["tipo", "inexistente"], porPagina: 50, ordenacao: { campo: "nada", direcao: "desc" }, compactar: true });
    expect(p.colunas).toContain("conta");
    expect(p.colunas).toContain("tipo");
    expect(p.colunas).not.toContain("inexistente");
    expect(p.porPagina).toBe(50);
    expect(p.ordenacao).toBeNull();
    expect(p.compactar).toBe(true);
    expect(normalizarPreferencia("contas-financeiras", { porPagina: 7 }).porPagina).toBe(20);
  });

  it("esconde só as colunas configuráveis desligadas", () => {
    const pref = { ...preferenciaPadrao("contas-financeiras"), colunas: ["conta"] };
    const r = colunasVisiveis("contas-financeiras", [{ chave: "conta" }, { chave: "tipo" }, { chave: "acoes" }], pref);
    expect(r.map((c) => c.chave)).toEqual(["conta", "acoes"]);
  });
});

describe("Organizar Categorias", () => {
  // 1 Moradia (2 Aluguel, 3 Luz (4 Conta)), 5 Lazer
  const nos: No[] = [
    { id: 1, paiId: null, ordem: 1 },
    { id: 2, paiId: 1, ordem: 1 },
    { id: 3, paiId: 1, ordem: 2 },
    { id: 4, paiId: 3, ordem: 1 },
    { id: 5, paiId: null, ordem: 2 },
  ];

  it("move para dentro, antes e depois, renumerando", () => {
    const r = moverNo(nos, 2, 5, "dentro") as No[];
    expect(r.find((n) => n.id === 2)).toEqual({ id: 2, paiId: 5, ordem: 1 });
    expect(r.find((n) => n.id === 3)!.ordem).toBe(1);
    const r2 = moverNo(nos, 5, 1, "antes") as No[];
    expect(r2.find((n) => n.id === 5)!.ordem).toBe(1);
    expect(r2.find((n) => n.id === 1)!.ordem).toBe(2);
  });

  it("não deixa passar de 3 níveis nem entrar em si mesma", () => {
    expect(moverNo(nos, 3, 5, "dentro")).toEqual(expect.any(Array));
    expect(typeof moverNo(nos, 1, 4, "dentro")).toBe("string");
    expect(typeof moverNo(nos, 3, 2, "dentro")).toBe("string"); // 3 tem filha: iria a 4 níveis
    expect(nivelDe(nos, 4)).toBe(3);
  });

  it("setas e conferência da árvore", () => {
    const subiu = moverPorSeta(nos, 3, "subir") as No[];
    expect(subiu.find((n) => n.id === 3)!.ordem).toBe(1);
    const recuou = moverPorSeta(nos, 4, "recuar") as No[];
    expect(recuou.find((n) => n.id === 4)).toEqual({ id: 4, paiId: 1, ordem: 3 });
    expect(typeof moverPorSeta(nos, 1, "avancar")).toBe("string");
    expect(conferirArvore(nos)).toBeNull();
    expect(conferirArvore([{ id: 1, paiId: 2, ordem: 1 }, { id: 2, paiId: 1, ordem: 1 }])).not.toBeNull();
  });
});

describe("Feriados", () => {
  it("calcula a Páscoa e os feriados móveis", () => {
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2025)).toBe("2025-04-20");
    const f = feriadosSugeridos(2026);
    expect(f.find((x) => x.nome === "Sexta-feira Santa")).toMatchObject({ dia: 3, mes: 4, ano: 2026 });
    expect(f.find((x) => x.nome === "Carnaval (terça-feira)")).toMatchObject({ dia: 17, mes: 2 });
    expect(f.find((x) => x.nome === "Corpus Christi")).toMatchObject({ dia: 4, mes: 6 });
  });

  it("confere dia e mês", () => {
    expect(diaDoMesValido(29, 2, null)).toBe(true);
    expect(diaDoMesValido(29, 2, 2026)).toBe(false);
    expect(diaDoMesValido(31, 4, null)).toBe(false);
  });
});

describe("Parâmetros e Recursos", () => {
  it("usa o padrão para o que falta", () => {
    const p = lerParametrosDe({ titulo: "Minha Casa", novo_ou_atualizado_horas: 5, "pagamento_parcial.ativo": false });
    expect(p.titulo).toBe("Minha Casa");
    expect(p.novoAtualizadoHoras).toBe(24);
    expect(p.pagamentoParcial).toBe(false);
    expect(p.camposAuxiliares.contas).toEqual({ ativo: false, rotulo: "Campo Auxiliar" });
  });

  it("recursos desligados escondem as telas", () => {
    const r = lerRecursosDe({ "recursos.tags": false });
    expect(r.tags).toBe(false);
    expect(r.cartoes).toBe(true);
    expect(telasOcultas(r).length).toBeGreaterThan(0);
  });

  it("marca novo ou atualizado dentro do período", () => {
    const agora = Date.parse("2026-11-24T12:00:00Z");
    expect(novoOuAtualizado("2026-11-24T02:00:00Z", 24, agora)).toBe(true);
    expect(novoOuAtualizado("2026-11-20T02:00:00Z", 24, agora)).toBe(false);
    expect(novoOuAtualizado("2026-11-24T02:00:00Z", 0, agora)).toBe(false);
  });
});

describe("Impressão Personalizada", () => {
  const t: Tabela = {
    titulo: "Tags",
    filtros: [],
    colunas: [{ titulo: "Tag" }, { titulo: "Situação" }, { titulo: "Cadastrado em", tipo: "data", extra: true }],
    linhas: [
      { celulas: ["Casa", "Ativo", "2026-01-02"] },
      { celulas: ["Academia", "Inativo", "2026-03-04"] },
      { celulas: ["Total", null, null], estilo: "total" },
    ],
    orientacao: "retrato",
    arquivo: "tags",
  } as Tabela;

  it("a padrão não mostra as colunas extras", () => {
    expect(semExtras(t).colunas.map((c) => c.titulo)).toEqual(["Tag", "Situação"]);
  });

  it("escolhe colunas, ordena e deixa o total no fim", () => {
    const p = lerPersonalizacao({ p_cols: "Cadastrado em|Tag|Nada", p_ord: "Tag", p_orient: "paisagem", p_larg: "2|0.1" }, t.colunas.map((c) => c.titulo))!;
    expect(p.colunas).toEqual(["Cadastrado em", "Tag"]);
    expect(p.larguras).toEqual([2, 1]);
    const r = personalizar(t, p);
    expect(r.colunas.map((c) => c.titulo)).toEqual(["Cadastrado em", "Tag"]);
    expect(r.linhas.map((l) => l.celulas[1])).toEqual(["Academia", "Casa", "Total"]);
    expect(r.orientacao).toBe("paisagem");
    expect(lerPersonalizacao({ p_cols: "" }, ["Tag"])).toBeNull();
  });

  it("descarta impressões guardadas estragadas", () => {
    expect(normalizarImpressoes([{ nome: "A", colunas: ["Tag"] }, { nome: 1 }, null])).toHaveLength(1);
    expect(normalizarImpressoes("x")).toEqual([]);
  });
});

describe("Notificações e Auditoria", () => {
  it("junta as lidas sem repetir e com limite", () => {
    expect(juntarLidas(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(juntarLidas(null, ["x"])).toEqual(["x"]);
    expect(juntarLidas(Array.from({ length: MAXIMO_LIDAS }, (_, i) => String(i)), ["novo"]).at(-1)).toBe("novo");
  });

  it("mostra os dados como campo e valor", () => {
    expect(nomeDoCampo("dataFim")).toBe("Data Fim");
    const linhas = linhasDosDados({ id: 3, ativo: true, valorCentavos: 12345, nome: { antes: "A", depois: "B" } });
    expect(linhas.find((l) => l.campo === "Id")).toBeUndefined();
    expect(linhas.find((l) => l.valor === "123,45")).toBeTruthy();
    expect(linhas.find((l) => l.antes === "A")).toMatchObject({ valor: "B" });
    expect(linhasDosDados({ antes: 1, depois: 2 })).toEqual([{ campo: "Valor", antes: "1", valor: "2" }]);
  });
});
