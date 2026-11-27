"use client";

import { Archive, ArchiveRestore, Bell, ChevronDown, Eye, MessageSquarePlus, Pencil, Send, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListaAlertas } from "@/components/dividas/alertas";
import { AbasDividas } from "@/components/dividas/comuns";
import { Botao } from "@/components/ui/botao";
import { CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { PERGUNTAS_PRONTAS, interpretarPergunta, type IdPergunta, type Resposta } from "@/lib/dividas/consultor/perguntas";
import type { Alerta } from "@/lib/dividas/consultor/regras";
import { AVISO_PRIVACIDADE_IA } from "@/lib/dividas/consultor/ia/textos";
import type { AssuntoLinha, MensagemLinha } from "@/lib/dividas/consultor/servidor";
import { arquivarAssunto, criarAssunto, perguntarAoConsultor, renomearAssunto, verResumoIA, type ResumoParaVer } from "./acoes";

const CAMINHO = "/gestao/dividas/consultor";

type Pedido = { id: IdPergunta; valor: string; parcelas: string };
export type StatusIAConsultor = { ligado: boolean; pronto: boolean; chaveCadastrada: boolean; provedor: string; usadasHoje: number; limiteDiario: number };

export function TelaConsultor({ assuntos, escolhido, mensagens, alertas, mostrarArquivados, ia }: { ia: StatusIAConsultor; assuntos: AssuntoLinha[]; escolhido: number | null; mensagens: MensagemLinha[]; alertas: { visiveis: Alerta[]; escondidos: Alerta[] }; mostrarArquivados: boolean }) {
  const router = useRouter();
  const assunto = escolhido !== null ? assuntos.find((a) => a.id === escolhido) ?? null : null;
  const [texto, setTexto] = useState("");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [erro, setErro] = useState("");
  const [janela, setJanela] = useState<"novo" | "renomear" | null>(null);
  const [titulo, setTitulo] = useState("");
  const [ocupado, iniciar] = useTransition();
  const [resumo, setResumo] = useState<ResumoParaVer | null>(null);

  const abertos = assuntos.filter((a) => a.situacao === "aberto");
  const arquivados = assuntos.filter((a) => a.situacao === "arquivado");
  const irPara = (id: number | null) => router.push(id === null ? CAMINHO : `${CAMINHO}?assunto=${id}${mostrarArquivados ? "&arquivados=1" : ""}`);
  const arquivado = assunto?.situacao === "arquivado";

  const enviar = (entrada: { pergunta: string | null; texto: string; valor: string; parcelas: string }) =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await perguntarAoConsultor(assunto?.id ?? null, entrada);
        if (!r.ok) return setErro(r.erro);
        setTexto("");
        setPedido(null);
        irPara(r.id ?? null);
      } catch {
        setErro("Não foi possível perguntar agora. Tente de novo.");
      }
    });

  const perguntarPronta = (id: IdPergunta) => {
    const pede = PERGUNTAS_PRONTAS.find((p) => p.id === id)!.pede;
    if (pede.length) return setPedido({ id, valor: "", parcelas: "" });
    setPedido(null);
    enviar({ pergunta: id, texto: "", valor: "", parcelas: "" });
  };

  const perguntarTexto = () => {
    const lida = interpretarPergunta(texto);
    // Quando entende a pergunta mas falta um número, pede o número antes de calcular (sem ir ao servidor).
    if (lida.id && PERGUNTAS_PRONTAS.find((p) => p.id === lida.id)!.pede.some((d) => (d === "valor" ? !lida.valorCentavos : !lida.parcelas))) {
      setPedido({ id: lida.id, valor: lida.valorCentavos ? String(lida.valorCentavos / 100).replace(".", ",") : "", parcelas: lida.parcelas ? String(lida.parcelas) : "" });
      return;
    }
    enviar({ pergunta: null, texto, valor: "", parcelas: "" });
  };

  const verEnviado = () =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await verResumoIA();
        if (!r.ok) return setErro(r.erro);
        setResumo(r);
      } catch {
        setErro("Não foi possível montar o resumo agora. Tente de novo.");
      }
    });

  const criar = () =>
    iniciar(async () => {
      setErro("");
      const r = await criarAssunto(titulo);
      if (!r.ok) return setErro(r.erro);
      setJanela(null);
      setTitulo("");
      irPara(r.id ?? null);
    });

  const renomear = () =>
    iniciar(async () => {
      if (!assunto) return;
      setErro("");
      const r = await renomearAssunto(assunto.id, titulo);
      if (!r.ok) return setErro(r.erro);
      setJanela(null);
      router.refresh();
    });

  const arquivar = (arquivar: boolean) =>
    iniciar(async () => {
      if (!assunto) return;
      setErro("");
      const r = await arquivarAssunto(assunto.id, arquivar);
      if (!r.ok) return setErro(r.erro);
      router.refresh();
    });

  return (
    <>
      <AbasDividas ativa={CAMINHO} />
      <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      {ia.ligado && (
        <section className="rounded-xl border border-amarelo-borda bg-amarelo px-4 py-3 text-sm text-amarelo-texto" aria-label="Aviso de privacidade da IA">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" /> Consultor com IA ligado
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium">
              {ia.provedor} · {ia.usadasHoje} de {ia.limiteDiario} perguntas hoje
            </span>
          </p>
          <p className="mt-1">Perguntas que não são das prontas vão para um serviço de fora, com um resumo anonimizado dos seus números. Nos planos gratuitos, o provedor pode usar o conteúdo para melhorar os produtos dele. Não escreva nomes, documentos ou números de conta na pergunta.</p>
          {!ia.pronto && <p className="mt-1 font-medium">Falta cadastrar a chave da IA (GUI_IA_CHAVE): enquanto isso, nada é enviado e as perguntas prontas seguem funcionando.</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Botao type="button" variante="secundario" icone={<Eye className="h-4 w-4" />} carregando={ocupado} onClick={verEnviado}>
              Ver o que será enviado
            </Botao>
          </div>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        {/* Assuntos */}
        <aside className="space-y-3" aria-label="Assuntos do Consultor">
          <Botao type="button" icone={<MessageSquarePlus className="h-4 w-4" />} className="w-full" onClick={() => { setTitulo(""); setErro(""); setJanela("novo"); }}>
            Novo assunto
          </Botao>
          <nav className="rounded-xl border border-borda bg-white p-1.5 shadow-cartao">
            <ItemAssunto ativo={assunto === null} aoClicar={() => irPara(null)} icone={<Bell className="h-4 w-4" />} titulo="Alertas" detalhe={alertas.visiveis.length === 0 ? "Nenhum alerta agora" : `${alertas.visiveis.length} ${alertas.visiveis.length === 1 ? "alerta" : "alertas"}`} />
            {abertos.map((a) => (
              <ItemAssunto key={a.id} ativo={a.id === assunto?.id} aoClicar={() => irPara(a.id)} titulo={a.titulo} detalhe={`${formatarData(a.atualizadoEm.slice(0, 10))} · ${a.mensagens} ${a.mensagens === 1 ? "mensagem" : "mensagens"}`} />
            ))}
            {abertos.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">Suas conversas aparecem aqui, uma por assunto, com o histórico guardado.</p>}
          </nav>
          {arquivados.length > 0 && (
            <div>
              <Link href={mostrarArquivados ? `${CAMINHO}${assunto ? `?assunto=${assunto.id}` : ""}` : `${CAMINHO}?${assunto ? `assunto=${assunto.id}&` : ""}arquivados=1`} className="text-sm font-medium text-gray-500 hover:text-verde">
                {mostrarArquivados ? "Esconder" : "Mostrar"} {arquivados.length} {arquivados.length === 1 ? "assunto arquivado" : "assuntos arquivados"}
              </Link>
              {mostrarArquivados && (
                <nav className="mt-2 rounded-xl border border-borda bg-white p-1.5 shadow-cartao">
                  {arquivados.map((a) => (
                    <ItemAssunto key={a.id} ativo={a.id === assunto?.id} aoClicar={() => irPara(a.id)} titulo={a.titulo} detalhe="Arquivado" />
                  ))}
                </nav>
              )}
            </div>
          )}
        </aside>

        {/* Conversa */}
        <section className="min-w-0 space-y-4" aria-label="Conversa">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{assunto ? assunto.titulo : "Alertas"}</h2>
            {assunto && (
              <div className="flex gap-2">
                <Botao type="button" variante="secundario" icone={<Pencil className="h-4 w-4" />} onClick={() => { setTitulo(assunto.titulo); setErro(""); setJanela("renomear"); }}>
                  Renomear
                </Botao>
                <Botao type="button" variante="secundario" icone={arquivado ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} carregando={ocupado} onClick={() => arquivar(!arquivado)}>
                  {arquivado ? "Desarquivar" : "Arquivar"}
                </Botao>
              </div>
            )}
          </header>

          {assunto === null ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">O Consultor Gui lê as suas dívidas, contas e reserva e aponta o que merece atenção. Cada alerta mostra o cálculo em <strong>Por quê?</strong>. Para perguntar, escolha uma pergunta pronta abaixo: a conversa vira um assunto com histórico.</p>
              <ListaAlertas visiveis={alertas.visiveis} escondidos={alertas.escondidos} vazio="Nenhum alerta por enquanto. Quando algo precisar da sua atenção, aparece aqui com o cálculo." />
            </div>
          ) : mensagens.length === 0 ? (
            <p className="rounded-xl border border-dashed border-borda bg-white py-8 text-center text-sm text-gray-500">Este assunto ainda não tem perguntas. Escolha uma pergunta pronta ou escreva a sua abaixo.</p>
          ) : (
            <ol className="space-y-3">
              {mensagens.map((m) => (
                <li key={m.id}>
                  <Mensagem m={m} />
                </li>
              ))}
            </ol>
          )}

          {!arquivado && (
            <div className="space-y-3 rounded-xl border border-borda bg-white p-4 shadow-cartao">
              <p className="text-sm font-semibold text-gray-800">Perguntas prontas</p>
              {(["Minha situação", "Meu plano", "O que fazer", "Antes de comprar"] as const).map((grupo) => (
                <div key={grupo}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{grupo}</p>
                  <div className="flex flex-wrap gap-2">
                    {PERGUNTAS_PRONTAS.filter((p) => p.grupo === grupo).map((p) => (
                      <button key={p.id} type="button" disabled={ocupado} onClick={() => perguntarPronta(p.id)} className={cn("rounded-full border px-3 py-1.5 text-sm hover:border-verde hover:text-verde disabled:opacity-60", pedido?.id === p.id ? "border-verde bg-verde-claro text-verde" : "border-borda bg-white text-gray-700")}>
                        {p.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {pedido && (
                <div className="flex flex-wrap items-end gap-3 rounded-lg bg-subcabecalho p-3">
                  <CampoValor rotulo={pedido.id === "compra" ? "Valor da compra" : pedido.id === "extra" ? "Valor a mais por mês" : "Valor da parcela"} valor={pedido.valor} aoMudar={(v) => setPedido({ ...pedido, valor: v })} className="w-44" />
                  {pedido.id === "compra" && <CampoTexto rotulo="Em quantas vezes" valor={pedido.parcelas} aoMudar={(v) => setPedido({ ...pedido, parcelas: v.replace(/\D/g, "").slice(0, 3) })} inputMode="numeric" maxLength={3} className="w-36" />}
                  <Botao type="button" carregando={ocupado} onClick={() => enviar({ pergunta: pedido.id, texto: "", valor: pedido.valor, parcelas: pedido.parcelas })}>
                    Perguntar
                  </Botao>
                  <Botao type="button" variante="fantasma" onClick={() => setPedido(null)}>
                    Cancelar
                  </Botao>
                </div>
              )}
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  perguntarTexto();
                }}
              >
                <CampoTexto rotulo="Ou escreva a sua pergunta" valor={texto} aoMudar={setTexto} maxLength={300} placeholder='Ex.: "quanto devo", "pagar primeiro", "cabe R$ 300"' className="min-w-64 flex-1" ajuda={ia.ligado ? "Perguntas que não são das prontas vão para a IA (resposta marcada como \"Resposta com IA\"). As prontas continuam sendo calculadas pelo Gui." : "O Consultor ainda não conversa em texto livre: ele reconhece palavras-chave e números e leva você à pergunta pronta certa. Quando não entende, diz isso."} />
                <Botao type="submit" icone={<Send className="h-4 w-4" />} carregando={ocupado} disabled={!texto.trim()}>
                  Perguntar
                </Botao>
              </form>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-xs text-gray-500">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />O Consultor Gui faz contas com os seus dados e não substitui um profissional. Decisões e pagamentos são sempre seus.
          </p>
        </section>
      </div>

      <Modal
        aberto={resumo !== null}
        aoFechar={() => setResumo(null)}
        titulo="O que será enviado à IA"
        resumo="Exatamente este texto sai do Gui quando você faz uma pergunta livre."
        largura="larga"
        rodape={
          <Botao type="button" variante="secundario" onClick={() => setResumo(null)}>
            Fechar
          </Botao>
        }
      >
        {resumo?.ok && (
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Provedor: <strong>{resumo.provedor}</strong> · Modelo: <strong>{resumo.modelo}</strong>
              {resumo.semChave && " · sem chave cadastrada: nada é enviado"}
            </p>
            <div>
              <p className="mb-1 font-semibold text-gray-900">Resumo dos seus números + a sua pergunta</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-borda bg-subcabecalho p-3 text-xs leading-relaxed">{resumo.texto}</pre>
            </div>
            <details className="rounded-lg border border-borda px-3 py-2">
              <summary className="cursor-pointer font-medium text-gray-800">Instrução fixa que acompanha a pergunta</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{resumo.instrucao}</pre>
            </details>
            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500">
              {AVISO_PRIVACIDADE_IA.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <Modal
        aberto={janela !== null}
        aoFechar={() => setJanela(null)}
        titulo={janela === "novo" ? "Novo assunto" : "Renomear assunto"}
        resumo="Um assunto guarda as perguntas, as respostas e os cálculos de uma conversa."
        rodape={
          <>
            <Botao type="button" variante="secundario" onClick={() => setJanela(null)}>
              Voltar
            </Botao>
            <Botao type="button" carregando={ocupado} onClick={janela === "novo" ? criar : renomear}>
              Salvar
            </Botao>
          </>
        }
      >
        <CampoTexto rotulo="Título do assunto" obrigatorio valor={titulo} aoMudar={setTitulo} maxLength={80} placeholder="Ex.: Dívida do cartão, Plano 2027" />
      </Modal>
    </>
  );
}

function ItemAssunto({ ativo, aoClicar, titulo, detalhe, icone }: { ativo: boolean; aoClicar: () => void; titulo: string; detalhe: string; icone?: React.ReactNode }) {
  return (
    <button type="button" onClick={aoClicar} aria-current={ativo ? "true" : undefined} className={cn("flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-verde-claro/60", ativo && "bg-verde-claro")}>
      {icone && <span className="mt-0.5 text-verde">{icone}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", ativo ? "font-semibold text-verde" : "font-medium text-gray-800")}>{titulo}</span>
        <span className="block truncate text-xs text-gray-500">{detalhe}</span>
      </span>
    </button>
  );
}

function Mensagem({ m }: { m: MensagemLinha }) {
  if (m.autor === "pessoa") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-verde px-4 py-2 text-sm text-white">{m.texto}</p>
      </div>
    );
  }
  if (m.autor === "gui_ia") {
    const ia = m.dados as { acoes?: { rotulo: string; href: string }[]; numerosFora?: string[] } | null;
    return (
      <article className="max-w-3xl rounded-2xl rounded-bl-sm border border-borda bg-white p-4 shadow-cartao">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Consultor Gui <span className="inline-flex items-center gap-1 rounded-full bg-amarelo px-2 py-0.5 normal-case tracking-normal text-amarelo-texto"><Sparkles className="h-3 w-3" />Resposta com IA</span>
        </p>
        <p className="mt-1 whitespace-pre-line text-sm text-gray-900">{m.texto}</p>
        {ia?.numerosFora && ia.numerosFora.length > 0 && (
          <p className="mt-3 rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-xs text-amarelo-texto">
            Confira antes de usar: {ia.numerosFora.join(", ")} {ia.numerosFora.length === 1 ? "não está" : "não estão"} nos números enviados à IA. Os números oficiais são os calculados pelo Gui.
          </p>
        )}
        {ia?.acoes && ia.acoes.length > 0 && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {ia.acoes.map((a) => (
                <Link key={a.href + a.rotulo} href={a.href} className="inline-flex h-8 items-center rounded-md border border-verde px-3 text-sm font-semibold text-verde hover:bg-verde-claro">
                  {a.rotulo}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">A IA só sugere: os botões abrem a tela certa. Nada é pago ou alterado sem você confirmar na janela.</p>
          </>
        )}
        <p className="mt-2 text-[11px] text-gray-400">Resposta de uma IA externa a partir de um resumo dos seus números. Pode errar e não substitui um profissional.</p>
      </article>
    );
  }
  const dados = m.dados as { tipo?: string; resposta?: Resposta } | null;
  const r = dados?.tipo === "resposta" ? dados.resposta : undefined;
  if (!r) {
    return (
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-amarelo-borda bg-amarelo px-4 py-3 text-sm text-amarelo-texto">
        <p>{m.texto}</p>
      </div>
    );
  }
  return (
    <article className={cn("max-w-3xl rounded-2xl rounded-bl-sm border bg-white p-4 shadow-cartao", r.cuidado ? "border-amarelo-borda" : "border-borda")}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Consultor Gui <span className="rounded-full bg-gray-100 px-2 py-0.5 normal-case tracking-normal text-gray-500">calculado pelo Gui</span>
      </p>
      <p className={cn("mt-1 text-sm font-semibold", r.cuidado ? "text-amarelo-texto" : "text-gray-900")}>{r.conclusao}</p>
      {r.numeros.length > 0 && (
        <dl className="mt-3 divide-y divide-borda rounded-lg border border-borda text-sm">
          {r.numeros.map((n, i) => (
            <div key={`${n.rotulo}-${i}`} className="flex flex-wrap justify-between gap-x-4 px-3 py-1.5">
              <dt className="text-gray-600">{n.rotulo}</dt>
              <dd className="font-medium text-gray-900">{n.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-sm text-gray-600">
        <span className="font-medium text-gray-800">Critério:</span> {r.criterio}
      </p>
      <details className="group mt-2 rounded-md border border-borda bg-subcabecalho px-3 py-2 text-sm text-gray-600">
        <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-gray-800">
          Como calculei <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
          {r.comoCalculei.map((linha, i) => (
            <li key={i}>{linha}</li>
          ))}
        </ul>
      </details>
      {r.acoes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.acoes.map((a) => (
            <Link key={a.href} href={a.href} className="inline-flex h-8 items-center rounded-md border border-verde px-3 text-sm font-semibold text-verde hover:bg-verde-claro">
              {a.rotulo}
            </Link>
          ))}
        </div>
      )}
      {r.acoes.length > 0 && <p className="mt-2 text-[11px] text-gray-400">Os botões só abrem a tela certa. Nada é pago ou alterado sem você confirmar na janela.</p>}
    </article>
  );
}
