import { describe, expect, it } from "vitest";
import { MODULOS_AJUDA, agruparArtigos, artigosDaTelaCatalogo, telaDoCaminho } from "./catalogo";
import { ARTIGOS_DIVIDAS } from "./dividas";

const rotulo = (c: string) => {
  const r = telaDoCaminho(c);
  return r ? `${r.modulo.rotulo}/${r.tela.rotulo}` : null;
};

describe("telaDoCaminho", () => {
  it("casos", () => {
    expect(rotulo("/")).toBe("Geral/Visão Geral");
    expect(rotulo("/gestao/dividas")).toBe("Gestão/Gestão de Dívidas");
    expect(rotulo("/gestao/dividas/minhas")).toBe("Gestão/Gestão de Dívidas - Minhas Dívidas");
    expect(rotulo("/gestao/dividas/minhas?x=1")).toBe("Gestão/Gestão de Dívidas - Minhas Dívidas");
    expect(rotulo("/financeiro/importacoes/nova")).toBe("Financeiro/Importações");
    expect(rotulo("/configuracoes/recursos")).toBe("Configurações/Recursos");
    expect(rotulo("/notificacoes")).toBe("Geral/Notificações");
  });
  it("desconhecido", () => {
    expect(telaDoCaminho("/qualquer/coisa")).toBeNull();
  });
});

describe("MODULOS_AJUDA", () => {
  const telas = MODULOS_AJUDA.flatMap((m) => m.telas);
  it("não repete endereços", () => {
    expect(new Set(telas.map((t) => t.href)).size).toBe(telas.length);
  });
  it("toda aba de dívidas tem artigos", () => {
    const dividas = telas.filter((t) => t.tela);
    expect(dividas).toHaveLength(6);
    for (const t of dividas) expect(artigosDaTelaCatalogo(t).length).toBeGreaterThan(0);
  });
  it("telas sem artigos devolvem lista vazia", () => {
    expect(artigosDaTelaCatalogo({ id: "x", rotulo: "X", href: "/x" })).toEqual([]);
  });
});

describe("agruparArtigos", () => {
  it("separa principais e grupos na ordem dos assuntos, sem grupos vazios", () => {
    const { principais, grupos } = agruparArtigos(ARTIGOS_DIVIDAS);
    expect(principais.every((a) => a.assunto === "telas")).toBe(true);
    expect(grupos.length).toBeGreaterThan(0);
    for (const g of grupos) {
      expect(g.rotulo.startsWith("Sobre")).toBe(true);
      expect(g.artigos.length).toBeGreaterThan(0);
    }
  });
  it("sem artigos de telas, o primeiro grupo vira principal", () => {
    const base = ARTIGOS_DIVIDAS.filter((a) => a.assunto !== "telas");
    const { principais, grupos } = agruparArtigos(base);
    expect(principais[0]?.assunto).toBe(base[0]?.assunto);
    expect(grupos.every((g) => g.artigos[0]?.assunto !== principais[0]?.assunto)).toBe(true);
  });
  it("vazio", () => {
    expect(agruparArtigos([])).toEqual({ principais: [], grupos: [] });
  });
});
