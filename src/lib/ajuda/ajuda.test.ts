import { describe, expect, it } from "vitest";
import { ARTIGOS_DIVIDAS } from "./dividas";
import { artigosDaTela, buscarArtigos, normalizar } from "./busca";
import { ASSUNTOS_AJUDA, type ArtigoAjuda, type BlocoAjuda, type TelaAjuda } from "./tipos";

const TELAS: TelaAjuda[] = ["visao", "minhas", "negociacoes", "simulador", "plano", "consultor"];

const art = (id: string, titulo: string, extra: Partial<ArtigoAjuda> = {}): ArtigoAjuda => ({
  id,
  titulo,
  resumo: "",
  assunto: "casos",
  telas: ["minhas"],
  palavras: [],
  blocos: [],
  ...extra,
});

/** Todos os textos de um artigo, para procurar travessão e afins. */
function textosDoArtigo(a: ArtigoAjuda): string[] {
  const doBloco = (b: BlocoAjuda): string[] => {
    if (b.tipo === "passos" || b.tipo === "lista") return b.itens;
    if (b.tipo === "exemplo") return [b.titulo, ...b.linhas.flat()];
    return [b.texto];
  };
  return [a.titulo, a.resumo, ...a.palavras, ...a.blocos.flatMap(doBloco)];
}

describe("normalizar", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizar("Cartão, Vencido!")).toBe("cartao vencido");
    expect(normalizar("Cheque-especial")).toBe("cheque especial");
    expect(normalizar("**Pagar**")).toBe("pagar");
  });
});

describe("buscarArtigos", () => {
  const lista = [
    art("a", "Empréstimo pessoal", { palavras: ["banco"] }),
    art("b", "Cartão atrasado", { resumo: "fatura do banco" }),
    art("c", "Outro assunto", { blocos: [{ tipo: "p", texto: "Fala de cartão no meio do texto." }] }),
  ];

  it("ignora acento e maiúsculas", () => {
    expect(buscarArtigos(lista, "CARTAO").map((a) => a.id)).toEqual(["b", "c"]);
    expect(buscarArtigos(lista, "emprestimo").map((a) => a.id)).toEqual(["a"]);
  });

  it("aceita só o começo da palavra", () => {
    expect(buscarArtigos(lista, "empre").map((a) => a.id)).toEqual(["a"]);
    expect(buscarArtigos(lista, "mpréstimo")).toEqual([]);
  });

  it("título vale mais que palavra-chave, que vale mais que o texto", () => {
    expect(buscarArtigos(lista, "cartao").map((a) => a.id)).toEqual(["b", "c"]);
    expect(buscarArtigos(lista, "banco").map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("exige todas as palavras digitadas", () => {
    expect(buscarArtigos(lista, "cartao atrasado").map((a) => a.id)).toEqual(["b"]);
    expect(buscarArtigos(lista, "cartao emprestimo")).toEqual([]);
  });

  it("termo vazio devolve tudo na ordem original", () => {
    expect(buscarArtigos(lista, "")).toEqual(lista);
    expect(buscarArtigos(lista, "   ")).toEqual(lista);
  });

  it("termo sem resultado devolve lista vazia", () => {
    expect(buscarArtigos(lista, "zzzz")).toEqual([]);
    expect(buscarArtigos(lista, "de a o")).toEqual([]);
  });
});

describe("artigosDaTela", () => {
  it("filtra pela aba e mantém a ordem", () => {
    const lista = [art("a", "A", { telas: ["plano"] }), art("b", "B", { telas: ["minhas", "plano"] }), art("c", "C", { telas: ["minhas"] })];
    expect(artigosDaTela(lista, "plano").map((a) => a.id)).toEqual(["a", "b"]);
    expect(artigosDaTela(lista, "consultor")).toEqual([]);
  });
});

describe("conteúdo da Central de Ajuda das dívidas", () => {
  const ids = ARTIGOS_DIVIDAS.map((a) => a.id);

  it("os ids são únicos e no formato certo", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("todo artigo tem título, resumo, assunto válido, tela e conteúdo", () => {
    const assuntos: string[] = ASSUNTOS_AJUDA.map((s) => s.valor);
    for (const a of ARTIGOS_DIVIDAS) {
      expect(a.titulo.trim(), a.id).not.toBe("");
      expect(a.resumo.trim(), a.id).not.toBe("");
      expect(assuntos, a.id).toContain(a.assunto);
      expect(a.telas.length, a.id).toBeGreaterThan(0);
      expect(a.blocos.length, a.id).toBeGreaterThan(0);
    }
  });

  it("todo 'veja também' aponta para um artigo que existe", () => {
    for (const a of ARTIGOS_DIVIDAS) {
      for (const r of a.relacionados ?? []) {
        expect(ids, `${a.id} -> ${r}`).toContain(r);
        expect(r, `${a.id} aponta para si mesmo`).not.toBe(a.id);
      }
    }
  });

  it("cada uma das 6 telas tem pelo menos 3 artigos", () => {
    for (const t of TELAS) expect(artigosDaTela(ARTIGOS_DIVIDAS, t).length, t).toBeGreaterThanOrEqual(3);
  });

  it("nenhum texto tem travessão", () => {
    for (const a of ARTIGOS_DIVIDAS) for (const t of textosDoArtigo(a)) expect(t, a.id).not.toContain("—");
  });

  it("achar o artigo certo em primeiro lugar", () => {
    const primeiro = (termo: string) => buscarArtigos(ARTIGOS_DIVIDAS, termo)[0]?.id;
    expect(primeiro("cartao vencido")).toBe("cartao-atrasado");
    expect(primeiro("cheque especial")).toBe("cheque-especial");
    expect(primeiro("financiamento carro")).toBe("financiamento-veiculo-imovel");
    expect(primeiro("agiota")).toBe("divida-com-pessoa");
    expect(primeiro("parente")).toBe("divida-com-pessoa");
  });
});
