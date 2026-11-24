"use server";

import { and, eq, gt, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { rotuloCategoria } from "@/lib/categorias";
import { formatarCentavos } from "@/lib/dinheiro";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { rotuloCompetencia } from "@/lib/lancamentos/regras";
import { competenciaDe, mudancasDoLimite } from "@/lib/orcamentos/regras";
import { carregarArvore } from "@/lib/relatorios/servidor";
import { exigirLogin } from "@/lib/sessao";

const { orcamentoCategoria, orcamentoLimite, categoria } = schema;
const TELA = "Orçamentos";

/** Grava a lista de categorias raiz do orçamento (as que ficaram ligadas). */
export async function salvarCategoriasOrcamento(ids: number[]): Promise<Resultado> {
  await exigirLogin();
  const v = z.array(idValido).max(500).safeParse(ids);
  if (!v.success) return falha("Categorias inválidas.");
  const escolhidas = [...new Set(v.data)];
  if (!escolhidas.length) return falha("Ligue pelo menos **uma categoria** para montar o orçamento.");

  const arvore = await carregarArvore();
  for (const id of escolhidas) {
    const c = arvore.get(id);
    if (!c) return falha("Uma das categorias não existe mais. Atualize a tela.");
    if (c.especial || c.categoriaPaiId !== null) return falha("Só é possível incluir categorias de **nível 1** (as filhas aparecem sozinhas).");
  }

  return getDb().transaction(async (tx) => {
    const antes = (await tx.select({ id: orcamentoCategoria.categoriaId }).from(orcamentoCategoria)).map((x) => x.id);
    const saem = antes.filter((id) => !escolhidas.includes(id));
    const entram = escolhidas.filter((id) => !antes.includes(id));
    if (saem.length) await tx.delete(orcamentoCategoria).where(inArray(orcamentoCategoria.categoriaId, saem));
    if (entram.length) await tx.insert(orcamentoCategoria).values(entram.map((id) => ({ categoriaId: id, ordem: 0 })));
    // A ordem acompanha a tela de Categorias.
    const posicao = [...arvore.keys()];
    for (const id of escolhidas) await tx.update(orcamentoCategoria).set({ ordem: posicao.indexOf(id) }).where(eq(orcamentoCategoria.categoriaId, id));
    for (const id of entram) {
      await registrarAuditoria(tx, { tela: TELA, entidade: "Orçamento", entidadeId: id, acao: "cadastrou", descricao: `a Categoria ${rotuloCategoria(arvore.get(id)!)} no Orçamento` });
    }
    for (const id of saem) {
      const c = arvore.get(id);
      await registrarAuditoria(tx, { tela: TELA, entidade: "Orçamento", entidadeId: id, acao: "excluiu", descricao: `a Categoria ${c ? rotuloCategoria(c) : id} do Orçamento` });
    }
    refresh();
    return { ok: true } as const;
  });
}

/** Tira uma categoria raiz do orçamento. Os limites ficam guardados (voltam se ela for incluída de novo). */
export async function removerCategoriaOrcamento(id: number): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success) return falha("Categoria não encontrada.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.delete(orcamentoCategoria).where(eq(orcamentoCategoria.categoriaId, id)).returning();
    if (!linha) return falha("Esta categoria já não estava no orçamento.");
    const [c] = await tx.select({ nome: categoria.nome }).from(categoria).where(eq(categoria.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: "Orçamento", entidadeId: id, acao: "excluiu", descricao: `a Categoria ${c?.nome ?? id} do Orçamento` });
    refresh();
    return { ok: true } as const;
  });
}

const entradaLimite = z.object({
  categoriaId: idValido,
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  /** null = sem limite */
  valorCentavos: z.number().int().min(0).max(1e13).nullable(),
  modo: z.enum(["seguintes", "mes"]),
});
export type DadosLimite = z.infer<typeof entradaLimite>;

/** Define (ou tira) o limite de uma categoria a partir do mês escolhido. */
export async function definirLimite(entrada: DadosLimite): Promise<Resultado> {
  await exigirLogin();
  const v = entradaLimite.safeParse(entrada);
  if (!v.success) return falha("Preencha o campo **Limite** com um valor válido.");
  const { categoriaId, mes, valorCentavos, modo } = v.data;
  const competencia = competenciaDe(mes);

  const arvore = await carregarArvore();
  const c = arvore.get(categoriaId);
  if (!c || c.especial) return falha("Categoria não encontrada.");
  const raiz = c.raizId;

  return getDb().transaction(async (tx) => {
    const noOrcamento = await tx.select({ id: orcamentoCategoria.id }).from(orcamentoCategoria).where(eq(orcamentoCategoria.categoriaId, raiz));
    if (!noOrcamento.length) return falha("A categoria não está mais no orçamento. Atualize a tela.");

    const limites = await tx
      .select({ categoriaId: orcamentoLimite.categoriaId, competencia: orcamentoLimite.competencia, valorCentavos: orcamentoLimite.valorCentavos })
      .from(orcamentoLimite)
      .where(eq(orcamentoLimite.categoriaId, categoriaId))
      .for("update");
    const { gravar, apagarDepoisDe } = mudancasDoLimite(limites, categoriaId, competencia, valorCentavos, modo);

    if (apagarDepoisDe) await tx.delete(orcamentoLimite).where(and(eq(orcamentoLimite.categoriaId, categoriaId), gt(orcamentoLimite.competencia, apagarDepoisDe)));
    for (const g of gravar) {
      await tx
        .insert(orcamentoLimite)
        .values({ categoriaId, competencia: g.competencia, valorCentavos: g.valorCentavos })
        .onConflictDoUpdate({ target: [orcamentoLimite.categoriaId, orcamentoLimite.competencia], set: { valorCentavos: g.valorCentavos, atualizadoEm: new Date() } });
    }
    const valorTexto = valorCentavos === null ? "sem limite" : `R$ ${formatarCentavos(valorCentavos)}`;
    await registrarAuditoria(tx, {
      tela: TELA,
      entidade: "Limite do Orçamento",
      entidadeId: categoriaId,
      acao: "alterou",
      descricao: `o Limite da Categoria ${rotuloCategoria(c)} para ${valorTexto} ${modo === "mes" ? `só em ${rotuloCompetencia(competencia)}` : `a partir de ${rotuloCompetencia(competencia)}`}`,
      dados: { competencia, valorCentavos, modo },
    });
    refresh();
    return { ok: true } as const;
  });
}
