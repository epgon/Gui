"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { falha, idValido, type Resultado } from "@/lib/cadastros/resultado";
import { gravarConfiguracao } from "@/lib/configuracao";
import { hojeIso } from "@/lib/datas";
import { dadosFaltando, interpretarPergunta, PERGUNTAS_PRONTAS, responder, rotuloPergunta, textoDaPergunta, TEXTO_NAO_ENTENDI, type IdPergunta } from "@/lib/dividas/consultor/perguntas";
import { atualizarEstadoAlertas, CHAVE_ESTADO_ALERTAS, lerEstadoAlertas, type AcaoAlerta } from "@/lib/dividas/consultor/regras";
import { INSTRUCAO_FIXA, montarMensagem } from "@/lib/dividas/consultor/ia/prompt";
import { montarResumo } from "@/lib/dividas/consultor/ia/resumo";
import { perguntarParaIA } from "@/lib/dividas/consultor/ia/servico";
import { dependenciasIA, lerConfigIA, registrarFalhaIA } from "@/lib/dividas/consultor/ia/servidor";
import type { TurnoIA } from "@/lib/dividas/consultor/ia/tipos";
import { carregarPainelDividas } from "@/lib/dividas/consultor/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { erro, executar, exigirRecurso, lerTexto, lerValor, ErroFormulario } from "@/lib/dividas/validacao";
import { lerConfiguracao } from "@/lib/configuracao";

const { consultorAssunto, consultorMensagem } = schema;
const TELA = "Gestão de Dívidas";
const ENTIDADE = "Assunto do Consultor";

const IDS = new Set<string>(PERGUNTAS_PRONTAS.map((p) => p.id));

/**
 * Faz uma pergunta ao Consultor Gui (devolve o id do assunto) e guarda a resposta no assunto (ou abre um assunto novo).
 * O Consultor só calcula: grava apenas o texto da conversa (assunto e mensagens), nunca dívida, lançamento ou saldo.
 * `pergunta` vem do botão de pergunta pronta; sem ela, o texto digitado é lido por palavras-chave.
 */
export async function perguntarAoConsultor(assuntoId: number | null, entrada: { pergunta: string | null; texto: string; valor: string; parcelas: string }): Promise<Resultado> {
  await exigirRecurso();
  // Texto livre que não é nenhuma pergunta pronta: com o Consultor com IA ligado, vai para a IA. As perguntas prontas nunca vão.
  if (!entrada.pergunta && (entrada.texto ?? "").trim() && interpretarPergunta(entrada.texto).id === null && (await recursoAtivo("consultor_ia"))) {
    const r = await executar(() => perguntarComIA(assuntoId, entrada.texto));
    if (r.ok) refresh();
    return r;
  }
  const r = await executar(() =>
    getDb().transaction(async (tx) => {
      if (assuntoId !== null && !idValido.safeParse(assuntoId).success) return erro("Assunto não encontrado.");
      const digitado = lerTexto(entrada.texto ?? "", "Pergunta", 300, false) ?? "";
      let id: IdPergunta | null = null;
      let valorCentavos: number | null = null;
      let parcelas: number | null = null;
      if (entrada.pergunta) {
        if (!IDS.has(entrada.pergunta)) return erro("Escolha uma das perguntas prontas.");
        id = entrada.pergunta as IdPergunta;
      } else {
        if (!digitado) return erro("Escreva a sua pergunta ou escolha uma das prontas.");
        const lida = interpretarPergunta(digitado);
        id = lida.id;
        valorCentavos = lida.valorCentavos;
        parcelas = lida.parcelas;
      }
      // Valores digitados nos campos da pergunta pronta valem mais que o texto.
      if (entrada.valor?.trim()) valorCentavos = lerValor(entrada.valor, "Valor");
      if (entrada.parcelas?.trim()) {
        const n = Number(entrada.parcelas);
        if (!Number.isInteger(n) || n < 1 || n > 360) return erro("Informe de 1 a 360 parcelas.");
        parcelas = n;
      }
      if (id && dadosFaltando(id, { valorCentavos, parcelas }).length) return erro(id === "compra" ? "Informe o **valor** da compra e o **número de parcelas**." : "Informe o **valor** da pergunta.");

      const hoje = hojeIso();
      const pergunta = id ? textoDaPergunta(id, { valorCentavos, parcelas }) : digitado;
      let assunto: { id: number; titulo: string };
      if (assuntoId === null) {
        const titulo = (id ? rotuloPergunta(id).replace(" R$ X", "").replace(" N vezes", "") : digitado).slice(0, 80);
        const [novo] = await tx.insert(consultorAssunto).values({ titulo }).returning({ id: consultorAssunto.id, titulo: consultorAssunto.titulo });
        await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novo.id, acao: "cadastrou", descricao: `o Assunto ${titulo} do Consultor Gui`, dados: { titulo } });
        assunto = novo;
      } else {
        const [a] = await tx.select({ id: consultorAssunto.id, titulo: consultorAssunto.titulo, situacao: consultorAssunto.situacao }).from(consultorAssunto).where(eq(consultorAssunto.id, assuntoId));
        if (!a) return erro("Este assunto não existe mais.");
        if (a.situacao === "arquivado") return erro("Este assunto está arquivado. Desarquive para continuar a conversa.");
        assunto = a;
      }

      await tx.insert(consultorMensagem).values({ assuntoId: assunto.id, autor: "pessoa", texto: pergunta, dados: id ? { pergunta: id, valorCentavos, parcelas } : null });
      if (id) {
        const painel = await carregarPainelDividas(hoje);
        const resposta = responder(id, painel.ctx, { valorCentavos, parcelas });
        await tx.insert(consultorMensagem).values({ assuntoId: assunto.id, autor: "gui", texto: resposta.conclusao, dados: { tipo: "resposta", pergunta: id, resposta } });
      } else {
        await tx.insert(consultorMensagem).values({ assuntoId: assunto.id, autor: "gui", texto: TEXTO_NAO_ENTENDI, dados: { tipo: "nao_entendi" } });
      }
      await tx.update(consultorAssunto).set({ atualizadoEm: new Date() }).where(eq(consultorAssunto.id, assunto.id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: assunto.id, acao: "alterou", descricao: `o Assunto ${assunto.titulo} do Consultor Gui com uma pergunta`, dados: { pergunta, entendida: id !== null } });
      return { ok: true as const, id: assunto.id };
    }),
  );
  if (r.ok) refresh();
  return r;
}

/**
 * Pergunta livre respondida pela IA externa (recurso Consultor com IA ligado). A IA só devolve texto e botões que abrem as janelas
 * normais: nada de dívida, lançamento ou saldo é gravado aqui, só a conversa. A chamada de rede acontece FORA de qualquer transação.
 * Se a IA estiver sem chave, sem limite ou fora do ar, a pergunta fica no assunto com um aviso e as perguntas prontas seguem valendo.
 */
async function perguntarComIA(assuntoId: number | null, texto: string): Promise<Resultado> {
  if (assuntoId !== null && !idValido.safeParse(assuntoId).success) return erro("Assunto não encontrado.");
  const pergunta = lerTexto(texto ?? "", "Pergunta", 300, true)!;
  const db = getDb();
  let historico: TurnoIA[] = [];
  if (assuntoId !== null) {
    const [a] = await db.select({ situacao: consultorAssunto.situacao }).from(consultorAssunto).where(eq(consultorAssunto.id, assuntoId));
    if (!a) return erro("Este assunto não existe mais.");
    if (a.situacao === "arquivado") return erro("Este assunto está arquivado. Desarquive para continuar a conversa.");
    // Histórico resumido: só as últimas perguntas da pessoa e respostas da IA (anonimizadas). O texto calculado pelo Gui cita nomes e nunca é enviado.
    const recentes = await db
      .select({ autor: consultorMensagem.autor, texto: consultorMensagem.texto, dados: consultorMensagem.dados })
      .from(consultorMensagem)
      .where(and(eq(consultorMensagem.assuntoId, assuntoId), inArray(consultorMensagem.autor, ["pessoa", "gui_ia"])))
      .orderBy(desc(consultorMensagem.id))
      .limit(4);
    historico = recentes.reverse().map((m) => {
      if (m.autor === "pessoa") return { papel: "pessoa" as const, texto: m.texto.slice(0, 300) };
      const anonimo = (m.dados as { textoAnonimo?: string } | null)?.textoAnonimo;
      return { papel: "ia" as const, texto: (anonimo ?? "").slice(0, 600) };
    }).filter((t) => t.texto);
  }

  const hoje = hojeIso();
  const [cfg, painel] = await Promise.all([lerConfigIA(hoje), carregarPainelDividas(hoje)]);
  const resumo = montarResumo(painel.ctx);
  const r = await perguntarParaIA({ pergunta, historico, resumo }, dependenciasIA(cfg, hoje));
  if (!r.ok && (r.motivo === "falha" || r.motivo === "limite_provedor" || r.motivo === "resposta_vazia")) await registrarFalhaIA(hoje);

  return getDb().transaction(async (tx) => {
    let assunto: { id: number; titulo: string };
    if (assuntoId === null) {
      const titulo = pergunta.slice(0, 80);
      const [novo] = await tx.insert(consultorAssunto).values({ titulo }).returning({ id: consultorAssunto.id, titulo: consultorAssunto.titulo });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novo.id, acao: "cadastrou", descricao: `o Assunto ${titulo} do Consultor Gui`, dados: { titulo } });
      assunto = novo;
    } else {
      const [a] = await tx.select({ id: consultorAssunto.id, titulo: consultorAssunto.titulo }).from(consultorAssunto).where(eq(consultorAssunto.id, assuntoId));
      if (!a) return erro("Este assunto não existe mais.");
      assunto = a;
    }
    await tx.insert(consultorMensagem).values({ assuntoId: assunto.id, autor: "pessoa", texto: pergunta, dados: { tipo: "pergunta_livre" } });
    if (r.ok) {
      await tx.insert(consultorMensagem).values({ assuntoId: assunto.id, autor: "gui_ia", texto: r.texto, dados: { tipo: "ia", textoAnonimo: r.textoAnonimo, acoes: r.acoes, numerosFora: r.numerosFora, provedor: cfg.provedorId, modelo: cfg.modelo } });
    } else {
      await tx.insert(consultorMensagem).values({ assuntoId: assunto.id, autor: "gui", texto: r.aviso, dados: { tipo: "ia_indisponivel", motivo: r.motivo } });
    }
    await tx.update(consultorAssunto).set({ atualizadoEm: new Date() }).where(eq(consultorAssunto.id, assunto.id));
    await registrarAuditoria(tx, {
      tela: TELA,
      entidade: ENTIDADE,
      entidadeId: assunto.id,
      acao: "alterou",
      descricao: `o Assunto ${assunto.titulo} do Consultor Gui com uma pergunta ${r.ok ? "respondida pela IA" : "que a IA não respondeu"}`,
      dados: { pergunta, resultado: r.ok ? "respondida" : r.motivo, provedor: cfg.provedorId, modelo: cfg.modelo },
    });
    return { ok: true as const, id: assunto.id };
  });
}

export type ResumoParaVer = { ok: true; texto: string; instrucao: string; provedor: string; modelo: string; semChave: boolean } | { ok: false; erro: string };

/** "Ver o que será enviado": o resumo anonimizado exato e a instrução fixa. Não chama a IA e não gasta o limite do dia. */
export async function verResumoIA(): Promise<ResumoParaVer> {
  await exigirRecurso();
  if (!(await recursoAtivo("consultor_ia"))) return { ok: false, erro: "O Consultor com IA está desligado em Configurações > Recursos." };
  const hoje = hojeIso();
  const [cfg, painel] = await Promise.all([lerConfigIA(hoje), carregarPainelDividas(hoje)]);
  const resumo = montarResumo(painel.ctx);
  return { ok: true, texto: montarMensagem(resumo, "(a sua pergunta entra aqui, sem e-mails, documentos nem números longos)"), instrucao: INSTRUCAO_FIXA, provedor: cfg.provedor?.rotulo ?? cfg.provedorId, modelo: cfg.modelo, semChave: !cfg.pronto };
}

export async function criarAssunto(titulo: string): Promise<Resultado> {
  await exigirRecurso();
  const r = await executar(() =>
    getDb().transaction(async (tx) => {
      const limpo = lerTexto(titulo, "Título do assunto", 80, true)!;
      const [novo] = await tx.insert(consultorAssunto).values({ titulo: limpo }).returning({ id: consultorAssunto.id });
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novo.id, acao: "cadastrou", descricao: `o Assunto ${limpo} do Consultor Gui`, dados: { titulo: limpo } });
      return { ok: true as const, id: novo.id };
    }),
  );
  if (r.ok) refresh();
  return r;
}

export async function renomearAssunto(id: number, titulo: string): Promise<Resultado> {
  await exigirRecurso();
  const r = await executar(() =>
    getDb().transaction(async (tx) => {
      if (!idValido.safeParse(id).success) return erro("Assunto não encontrado.");
      const limpo = lerTexto(titulo, "Título do assunto", 80, true)!;
      const [a] = await tx.select({ titulo: consultorAssunto.titulo }).from(consultorAssunto).where(eq(consultorAssunto.id, id));
      if (!a) return erro("Este assunto não existe mais.");
      await tx.update(consultorAssunto).set({ titulo: limpo }).where(eq(consultorAssunto.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `o Título do Assunto ${a.titulo} do Consultor Gui`, dados: { titulo: { antes: a.titulo, depois: limpo } } });
      return { ok: true as const };
    }),
  );
  if (r.ok) refresh();
  return r;
}

/** Arquiva (ou volta a abrir) um assunto. Nada é apagado: o histórico fica guardado. */
export async function arquivarAssunto(id: number, arquivar: boolean): Promise<Resultado> {
  await exigirRecurso();
  const r = await executar(() =>
    getDb().transaction(async (tx) => {
      if (!idValido.safeParse(id).success) return erro("Assunto não encontrado.");
      const [a] = await tx.select({ titulo: consultorAssunto.titulo }).from(consultorAssunto).where(eq(consultorAssunto.id, id));
      if (!a) return erro("Este assunto não existe mais.");
      await tx.update(consultorAssunto).set({ situacao: arquivar ? "arquivado" : "aberto" }).where(eq(consultorAssunto.id, id));
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: arquivar ? "inativou" : "ativou", descricao: `o Assunto ${a.titulo} do Consultor Gui`, dados: { situacao: arquivar ? "arquivado" : "aberto" } });
      return { ok: true as const };
    }),
  );
  if (r.ok) refresh();
  return r;
}

const ACOES_ALERTA = ["dispensar", "lembrar", "restaurar"];

/** Dispensar um alerta, lembrar dele em 7 dias ou trazê-lo de volta. Só guarda o estado do alerta em Configurações. */
export async function tratarAlerta(alertaId: string, acao: AcaoAlerta): Promise<Resultado> {
  await exigirRecurso();
  try {
    if (!ACOES_ALERTA.includes(acao)) return falha("Ação inválida.");
    if (typeof alertaId !== "string" || !/^R\d{1,2}(:[\w-]{1,20})?$/.test(alertaId)) return falha("Alerta não encontrado.");
    const estado = lerEstadoAlertas(await lerConfiguracao(CHAVE_ESTADO_ALERTAS));
    const novo = atualizarEstadoAlertas(estado, alertaId, acao, hojeIso());
    const verbo = acao === "dispensar" ? "Dispensou" : acao === "lembrar" ? "Adiou por 7 dias" : "Trouxe de volta";
    await getDb().transaction((tx) => gravarConfiguracao(tx, CHAVE_ESTADO_ALERTAS, novo, { tela: TELA, descricao: `o Alerta ${alertaId} do Consultor Gui (${verbo})` }));
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof ErroFormulario) return falha(e.message);
    throw e;
  }
}
