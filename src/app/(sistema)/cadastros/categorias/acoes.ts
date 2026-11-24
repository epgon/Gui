"use server";

import { eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria, type Transacao } from "@/lib/auditoria";
import { alturaAbaixo, descendentes, montarArvore, NIVEL_MAXIMO } from "@/lib/categorias";
import { falha, idValido, obrigatorio, primeiroErro, type Resultado } from "@/lib/cadastros/resultado";
import { exigirLogin } from "@/lib/sessao";

const { categoria } = schema;
const TELA = "Categorias";
const ENTIDADE = "Categoria";

const formulario = z.object({
  nome: obrigatorio("Nome", 60),
  categoriaPaiId: z
    .string()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Selecione uma **Categoria Pai** válida."),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Escolha uma **Cor** válida."),
  natureza: z.enum(["receita", "despesa"], { error: "Escolha se a categoria é de **Receita** ou **Despesa**." }),
});

export type DadosCategoria = { nome: string; categoriaPaiId: string; cor: string; natureza: "receita" | "despesa" };

/** Todas as categorias, travadas para alteração até o fim da transação. */
async function carregarTodas(tx: Transacao) {
  return tx.select().from(categoria).for("update");
}

export async function salvarCategoria(id: number | null, entrada: DadosCategoria): Promise<Resultado> {
  await exigirLogin();
  const v = formulario.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  if (id !== null && !idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  const { nome, categoriaPaiId } = v.data;

  return getDb().transaction(async (tx) => {
    const todas = await carregarTodas(tx);
    const arvore = montarArvore(todas);
    const atual = id === null ? null : todas.find((c) => c.id === id);
    if (id !== null && !atual) return falha("Esta categoria não existe mais.");
    if (atual?.especial) return falha("As categorias especiais (**Acerto de Saldo**, **Cartão de Crédito** e **Transferência**) são usadas pelo sistema e não podem ser alteradas.");

    let natureza = v.data.natureza;
    let cor: string | null = v.data.cor.toUpperCase();
    if (categoriaPaiId !== null) {
      const pai = arvore.find((c) => c.id === categoriaPaiId);
      if (!pai) return falha("A **Categoria Pai** escolhida não existe mais.");
      if (pai.especial) return falha("As categorias especiais não podem ter filhas. Escolha outra **Categoria Pai**.");
      if (id !== null && (pai.id === id || descendentes(todas, id).includes(pai.id))) {
        return falha("Uma categoria não pode ficar dentro dela mesma. Escolha outra **Categoria Pai**.");
      }
      const altura = id === null ? 0 : alturaAbaixo(todas, id);
      if (pai.nivel + 1 + altura > NIVEL_MAXIMO) {
        return falha(`As categorias vão até ${NIVEL_MAXIMO} níveis (ex.: 9.4.1.). Escolha uma **Categoria Pai** mais acima.`);
      }
      if (!pai.ativo && (id === null || atual?.categoriaPaiId !== pai.id)) {
        return falha(`A categoria **${pai.nome}** está inativa. Ative-a antes de colocar categorias dentro dela.`);
      }
      const raiz = todas.find((c) => c.id === pai.raizId)!;
      natureza = raiz.natureza;
      cor = null; // filhas herdam a cor da raiz
    }

    const irmaRepetida = todas.find(
      (c) => c.categoriaPaiId === categoriaPaiId && !c.especial && c.id !== id && c.nome.toLowerCase() === nome.toLowerCase(),
    );
    if (irmaRepetida) return falha(`Já existe a categoria **${nome}** neste mesmo nível.`);

    const proximaOrdem = Math.max(0, ...todas.filter((c) => c.categoriaPaiId === categoriaPaiId && !c.especial).map((c) => c.ordem)) + 1;

    if (id === null || !atual) {
      const dados = { nome, categoriaPaiId, cor, natureza, ordem: proximaOrdem };
      const [nova] = await tx.insert(categoria).values(dados).returning();
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: nova.id, acao: "cadastrou", descricao: `a Categoria ${nova.nome}`, dados });
      refresh();
      return { ok: true, id: nova.id } as const;
    }

    const mudouPai = atual.categoriaPaiId !== categoriaPaiId;
    const dados = { nome, categoriaPaiId, cor, natureza, ordem: mudouPai ? proximaOrdem : atual.ordem };
    await tx.update(categoria).set(dados).where(eq(categoria.id, id));
    const filhas = descendentes(todas, id);
    if (filhas.length && natureza !== atual.natureza) {
      await tx.update(categoria).set({ natureza }).where(inArray(categoria.id, filhas));
    }
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `a Categoria ${nome}`, dados: diferencas(atual, dados) });
    refresh();
    return { ok: true, id } as const;
  });
}

/** Inativar ou ativar leva junto as filhas; ativar exige que a pai esteja ativa. */
export async function alterarSituacaoCategoria(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Cadastro não encontrado.");
  return getDb().transaction(async (tx) => {
    const todas = await carregarTodas(tx);
    const alvo = todas.find((c) => c.id === id);
    if (!alvo) return falha("Esta categoria não existe mais.");
    if (alvo.especial) return falha(`A categoria **${alvo.nome}** é usada pelo sistema e não pode ser inativada.`);

    if (ativo) {
      const pai = todas.find((c) => c.id === alvo.categoriaPaiId);
      if (pai && !pai.ativo) return falha(`Ative primeiro a categoria pai **${pai.nome}**.`);
    }
    const filhas = descendentes(todas, id).filter((f) => todas.find((c) => c.id === f)?.ativo !== ativo);
    await tx.update(categoria).set({ ativo }).where(inArray(categoria.id, [id, ...filhas]));
    await registrarAuditoria(tx, {
      tela: TELA,
      entidade: ENTIDADE,
      entidadeId: id,
      acao: ativo ? "ativou" : "inativou",
      descricao: `a Categoria ${alvo.nome}${filhas.length ? ` e ${filhas.length} subcategoria(s)` : ""}`,
      dados: filhas.length ? { subcategorias: filhas } : undefined,
    });
    refresh();
    return { ok: true } as const;
  });
}
