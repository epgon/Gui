"use client";

import { CheckCircle2, ExternalLink, Handshake, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { detalharNegociacao, excluirProposta, recusarProposta, salvarNegociacao, salvarProposta, type DadosNegociacao, type DadosProposta } from "@/app/(sistema)/gestao/dividas/negociacoes/acoes";
import { Botao } from "@/components/ui/botao";
import { CampoAreaTexto, CampoSelecao, CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { analisarProposta, CANAIS_NEGOCIACAO, negociacaoAberta, rotuloCanal, SITUACOES_NEGOCIACAO } from "@/lib/dividas/negociacao";
import { estaAtiva } from "@/lib/dividas/regras";
import type { LinhaDivida, LinhaNegociacao, PropostaLinha } from "@/lib/dividas/tipos";
import { Conferencia } from "./assistente-renegociacao";
import { PilulaNegociacao, PilulaSituacao } from "./comuns";

const reais = (c: number) => `R$ ${formatarCentavos(c)}`;
const centavos = (texto: string) => (texto.trim() ? (lerValorEmCentavos(texto) ?? 0) : 0);

export function dadosVaziosNegociacao(hoje: string): DadosNegociacao {
  return { contatoId: "", dividaIds: [], canal: "telefone", protocolo: "", dataInicio: hoje, prazoResposta: "", sobraMensal: "", observacao: "", situacao: "em_andamento" };
}

export function dadosDaNegociacao(n: LinhaNegociacao): DadosNegociacao {
  return {
    contatoId: String(n.contatoId),
    dividaIds: n.dividas.map((d) => d.id),
    canal: n.canal,
    protocolo: n.protocolo ?? "",
    dataInicio: n.dataInicio,
    prazoResposta: n.prazoResposta ?? "",
    sobraMensal: n.sobraMensalCentavos ? formatarCentavos(n.sobraMensalCentavos) : "",
    observacao: n.observacao ?? "",
    situacao: n.situacao === "aceita" ? "em_andamento" : n.situacao,
  };
}

function useEnvio(aoFechar: () => void) {
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const enviar = (acao: () => Promise<{ ok: boolean; erro?: string }>) =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await acao();
        if (!r.ok) return setErro(r.erro ?? "Não foi possível concluir agora.");
        aoFechar();
      } catch {
        setErro("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });
  return { erro, setErro, ocupado, enviar };
}

function Rodape({ ocupado, aoFechar, rotulo }: { ocupado: boolean; aoFechar: () => void; rotulo: React.ReactNode }) {
  return (
    <>
      <Botao variante="secundario" type="button" onClick={aoFechar} disabled={ocupado}>
        Voltar
      </Botao>
      {rotulo}
    </>
  );
}

// ---------------------------------------------------------------------------
// Nova negociação / editar
// ---------------------------------------------------------------------------

export function ModalNegociacao({ id, inicial, dividas, hoje, aoFechar }: { id: number | null; inicial: DadosNegociacao; dividas: LinhaDivida[]; hoje: string; aoFechar: () => void }) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const [d, setD] = useState(inicial);
  const mudar = <K extends keyof DadosNegociacao>(chave: K, valor: DadosNegociacao[K]) => setD((x) => ({ ...x, [chave]: valor }));
  const edicao = id !== null;
  const lista = dividas.filter((x) => estaAtiva(x.situacao) || d.dividaIds.includes(x.id));
  const credores = [...new Map(lista.map((x) => [x.contatoId, x.credor])).entries()].map(([cid, nome]) => ({ id: cid, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const doCredor = lista.filter((x) => String(x.contatoId) === d.contatoId);
  const alternar = (dividaId: number) => mudar("dividaIds", d.dividaIds.includes(dividaId) ? d.dividaIds.filter((x) => x !== dividaId) : [...d.dividaIds, dividaId]);
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={edicao ? "Editar negociação" : "Nova negociação"}
      resumo="Acompanhe a conversa com o credor antes de virar acordo. Nada muda em Lançamentos até você aceitar uma proposta."
      rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} rotulo={<Botao type="button" carregando={ocupado} icone={<CheckCircle2 className="h-4 w-4" />} onClick={() => enviar(() => salvarNegociacao(id, d))}>Salvar</Botao>} />}
    >
      <div className="space-y-4">
        {credores.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda py-8 text-center text-sm text-gray-500">Cadastre uma dívida ativa em Minhas Dívidas para abrir uma negociação.</p>
        ) : (
          <>
            <CampoSelecao rotulo="Credor" obrigatorio valor={d.contatoId} aoMudar={(v) => setD((x) => ({ ...x, contatoId: v, dividaIds: [] }))} opcoes={[{ valor: "", rotulo: "Selecione" }, ...credores.map((c) => ({ valor: String(c.id), rotulo: c.nome }))]} />
            {d.contatoId && (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">
                  Dívidas da negociação <span className="text-despesa">*</span>
                </p>
                <ul className="divide-y divide-borda rounded-lg border border-borda">
                  {doCredor.map((x) => (
                    <li key={x.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                        <input type="checkbox" className="accent-verde" checked={d.dividaIds.includes(x.id)} onChange={() => alternar(x.id)} />
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{x.descricao}</span>
                        <span className="text-sm font-medium text-gray-700">{reais(x.saldo.exibido)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoSelecao rotulo="Canal" valor={d.canal} aoMudar={(v) => mudar("canal", v)} opcoes={CANAIS_NEGOCIACAO.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))} />
              <CampoTexto rotulo="Protocolo" maxLength={60} valor={d.protocolo} aoMudar={(v) => mudar("protocolo", v)} ajuda="Número do atendimento, se o credor deu um." />
              <CampoTexto rotulo="Data de Início" type="date" obrigatorio valor={d.dataInicio || hoje} aoMudar={(v) => mudar("dataInicio", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoTexto rotulo="Prazo de Resposta" type="date" valor={d.prazoResposta} aoMudar={(v) => mudar("prazoResposta", v)} ajuda="Até quando o credor ou você precisa responder." />
              <CampoValor rotulo="Sobra Mensal" valor={d.sobraMensal} aoMudar={(v) => mudar("sobraMensal", v)} ajuda="Quanto sobra por mês para pagar o acordo. Usada para dizer se a parcela cabe. Digitada por enquanto; a sobra calculada chega com o Simulador." />
              {edicao && (
                <CampoSelecao
                  rotulo="Situação"
                  valor={d.situacao}
                  aoMudar={(v) => mudar("situacao", v)}
                  opcoes={SITUACOES_NEGOCIACAO.filter((s) => s.valor !== "aceita").map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
                />
              )}
            </div>
            <CampoAreaTexto rotulo="Observação" linhas={3} valor={d.observacao} aoMudar={(v) => mudar("observacao", v)} />
          </>
        )}
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Proposta
// ---------------------------------------------------------------------------

export function dadosVaziosProposta(hoje: string): DadosProposta {
  return { data: hoje, quemPropos: "credor", modalidade: "parcelada", entrada: "", parcelas: "12", valorParcela: "", primeiroVencimento: hoje, validade: "", observacao: "" };
}

function dadosDaProposta(p: PropostaLinha): DadosProposta {
  return {
    data: p.data,
    quemPropos: p.quemPropos,
    modalidade: p.modalidade,
    entrada: p.entradaCentavos ? formatarCentavos(p.entradaCentavos) : "",
    parcelas: p.parcelas ? String(p.parcelas) : "12",
    valorParcela: p.valorParcelaCentavos ? formatarCentavos(p.valorParcelaCentavos) : "",
    primeiroVencimento: p.primeiroVencimento ?? p.data,
    validade: p.validade ?? "",
    observacao: p.observacao ?? "",
  };
}

export function ModalProposta({ negociacao, proposta, hoje, aoFechar }: { negociacao: LinhaNegociacao; proposta: PropostaLinha | null; hoje: string; aoFechar: () => void }) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const [d, setD] = useState(proposta ? dadosDaProposta(proposta) : dadosVaziosProposta(hoje));
  const mudar = <K extends keyof DadosProposta>(chave: K, valor: DadosProposta[K]) => setD((x) => ({ ...x, [chave]: valor }));
  const aVista = d.modalidade === "a_vista";
  const condicoes = { entradaCentavos: centavos(d.entrada), parcelas: aVista ? 0 : Math.max(0, Math.floor(Number(d.parcelas) || 0)), valorParcelaCentavos: aVista ? 0 : centavos(d.valorParcela) };
  const analise = analisarProposta({ ...condicoes, saldoCentavos: negociacao.saldoCentavos, sobraMensalCentavos: negociacao.sobraMensalCentavos });
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={proposta ? "Editar proposta" : "Nova proposta"}
      resumo={`${negociacao.credor} · saldo atual das dívidas: ${reais(negociacao.saldoCentavos)}`}
      rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} rotulo={<Botao type="button" carregando={ocupado} icone={<CheckCircle2 className="h-4 w-4" />} onClick={() => enviar(() => salvarProposta(negociacao.id, proposta?.id ?? null, d))}>Salvar</Botao>} />}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoSelecao rotulo="Quem Propôs" valor={d.quemPropos} aoMudar={(v) => mudar("quemPropos", v)} opcoes={[{ valor: "credor", rotulo: "O credor" }, { valor: "eu", rotulo: "Eu" }]} />
          <CampoTexto rotulo="Data da Proposta" type="date" obrigatorio valor={d.data} aoMudar={(v) => mudar("data", v)} />
          <CampoTexto rotulo="Validade" type="date" valor={d.validade} aoMudar={(v) => mudar("validade", v)} ajuda="Até quando a proposta vale." />
        </div>
        <CampoSelecao rotulo="Modalidade" valor={d.modalidade} aoMudar={(v) => mudar("modalidade", v)} opcoes={[{ valor: "parcelada", rotulo: "Parcelada (com ou sem entrada)" }, { valor: "a_vista", rotulo: "À vista, com desconto" }]} />
        <div className="rounded-lg bg-creme p-4">
          {aVista ? (
            <CampoValor rotulo="Valor à Vista" obrigatorio valor={d.entrada} aoMudar={(v) => mudar("entrada", v)} ajuda="Quanto o credor aceita para encerrar a dívida de uma vez." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-4">
              <CampoValor rotulo="Entrada" valor={d.entrada} aoMudar={(v) => mudar("entrada", v)} ajuda="Opcional." />
              <CampoTexto rotulo="Quantidade de Parcelas" obrigatorio inputMode="numeric" maxLength={3} valor={d.parcelas} aoMudar={(v) => mudar("parcelas", v.replace(/\D/g, ""))} />
              <CampoValor rotulo="Valor da Parcela" obrigatorio valor={d.valorParcela} aoMudar={(v) => mudar("valorParcela", v)} />
              <CampoTexto rotulo="Primeiro Vencimento" type="date" obrigatorio valor={d.primeiroVencimento} aoMudar={(v) => mudar("primeiroVencimento", v)} />
            </div>
          )}
          <Conferencia analise={analise} condicoes={condicoes} temSobra={negociacao.sobraMensalCentavos !== null} />
        </div>
        <CampoAreaTexto rotulo="Observação" linhas={2} valor={d.observacao} aoMudar={(v) => mudar("observacao", v)} />
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detalhando negociação
// ---------------------------------------------------------------------------

export function DetalhandoNegociacao({ negociacaoId, versao, hoje, aoFechar, aoNovaProposta, aoEditarProposta, aoAceitar, aoMudou, aoAbrirDivida }: {
  negociacaoId: number;
  versao: number;
  hoje: string;
  aoFechar: () => void;
  aoNovaProposta: (n: LinhaNegociacao) => void;
  aoEditarProposta: (n: LinhaNegociacao, p: PropostaLinha) => void;
  aoAceitar: (n: LinhaNegociacao, p: PropostaLinha) => void;
  aoMudou: () => void;
  aoAbrirDivida: (id: number) => void;
}) {
  const [n, setN] = useState<LinhaNegociacao | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    detalharNegociacao(negociacaoId)
      .then((x) => vivo && (x ? setN(x) : setErro("Negociação não encontrada.")))
      .catch(() => vivo && setErro("Não foi possível carregar a negociação agora."));
    return () => {
      vivo = false;
    };
  }, [negociacaoId, versao]);

  const acao = (p: PropostaLinha, qual: "recusar" | "excluir") =>
    iniciar(async () => {
      setErro("");
      try {
        const r = qual === "recusar" ? await recusarProposta(p.negociacaoId, p.id) : await excluirProposta(p.negociacaoId, p.id);
        if (!r.ok) return setErro(r.erro);
        aoMudou();
      } catch {
        setErro("Não foi possível concluir agora. Tente de novo.");
      }
    });

  const aberta = n ? negociacaoAberta(n.situacao) : false;
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        <span>
          Detalhando Negociação
          {n && <span className="block text-sm font-normal text-gray-500">{[`#${n.id}`, n.credor, rotuloCanal(n.canal), n.protocolo ? `protocolo ${n.protocolo}` : ""].filter(Boolean).join(" · ")}</span>}
        </span>
      }
    >
      <ProvedorOcultar>
        {!n ? (
          <p className="py-10 text-center text-sm text-gray-500">{erro || "Carregando..."}</p>
        ) : (
          <div className={cn("space-y-4 transition-opacity", ocupado && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-3">
              <PilulaNegociacao situacao={n.situacao} />
              <span className="text-sm text-gray-600">Início em {formatarData(n.dataInicio)}</span>
              {n.prazoResposta && <span className={cn("text-sm", aberta && n.prazoResposta < hoje ? "font-semibold text-despesa" : "text-gray-600")}>Resposta até {formatarData(n.prazoResposta)}{aberta && n.prazoResposta < hoje ? " (prazo vencido)" : ""}</span>}
              {n.sobraMensalCentavos !== null && <span className="text-sm text-gray-600">Sobra mensal informada: {reais(n.sobraMensalCentavos)}</span>}
              {n.acordoId && (
                <button type="button" className="inline-flex items-center gap-1 text-sm text-verde hover:underline" onClick={() => aoAbrirDivida(n.acordoId!)}>
                  Ver o acordo <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              {aberta && (
                <Botao className="ml-auto h-8" icone={<Plus className="h-4 w-4" />} onClick={() => aoNovaProposta(n)}>
                  Nova proposta
                </Botao>
              )}
            </div>
            {n.observacao && <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{n.observacao}</p>}

            <div>
              <p className="mb-1 text-sm font-semibold text-gray-700">Dívidas da negociação</p>
              <ul className="divide-y divide-borda rounded-lg border border-borda">
                {n.dividas.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-3 py-2">
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-900 hover:text-verde hover:underline" onClick={() => aoAbrirDivida(x.id)}>
                      {x.descricao}
                    </button>
                    <PilulaSituacao situacao={x.situacao} />
                    <ValorOcultavel centavos={-x.saldoCentavos} />
                  </li>
                ))}
                <li className="flex justify-between bg-creme px-3 py-2 text-sm font-semibold text-gray-700">
                  <span>Saldo atual das dívidas ativas</span>
                  <ValorOcultavel centavos={-n.saldoCentavos} />
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-gray-700">Propostas</p>
              {n.propostas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-borda py-8 text-center text-sm text-gray-500">Nenhuma proposta ainda. Use &quot;Nova proposta&quot; para registrar o que o credor ofereceu ou o que você pediu.</p>
              ) : (
                <ul className="space-y-3">
                  {n.propostas.map((p) => (
                    <CartaoProposta key={p.id} n={n} p={p} hoje={hoje} melhor={p.id === n.melhorPropostaId && n.propostas.filter((x) => x.situacao === "aberta").length > 1} aberta={aberta} aoAceitar={() => aoAceitar(n, p)} aoEditar={() => aoEditarProposta(n, p)} aoRecusar={() => acao(p, "recusar")} aoExcluir={() => acao(p, "excluir")} />
                  ))}
                </ul>
              )}
            </div>
            <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
            <p className="text-xs text-gray-500">
              Os números comparam cada proposta com o saldo de hoje das dívidas. Os juros implícitos são a taxa que faz as parcelas valerem o que você deve hoje.{" "}
              <Link href="/gestao/dividas/minhas" className="text-verde hover:underline">Ver Minhas Dívidas</Link>
            </p>
          </div>
        )}
      </ProvedorOcultar>
    </Modal>
  );
}

const ROTULO_PROPOSTA = { aberta: "Em aberto", aceita: "Aceita", recusada: "Recusada" } as const;

function CartaoProposta({ n, p, hoje, melhor, aberta, aoAceitar, aoEditar, aoRecusar, aoExcluir }: { n: LinhaNegociacao; p: PropostaLinha; hoje: string; melhor: boolean; aberta: boolean; aoAceitar: () => void; aoEditar: () => void; aoRecusar: () => void; aoExcluir: () => void }) {
  const a = analisarProposta({ entradaCentavos: p.entradaCentavos, parcelas: p.parcelas, valorParcelaCentavos: p.valorParcelaCentavos, saldoCentavos: n.saldoCentavos, sobraMensalCentavos: n.sobraMensalCentavos });
  const emAberto = p.situacao === "aberta";
  const vencida = emAberto && p.validade !== null && p.validade < hoje;
  return (
    <li className={cn("rounded-lg border p-3", emAberto ? "border-borda" : "border-borda bg-gray-50/70", p.situacao === "aceita" && "border-verde")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{p.modalidade === "a_vista" ? `À vista: ${reais(p.totalCentavos)}` : `${p.entradaCentavos ? `Entrada de ${reais(p.entradaCentavos)} + ` : ""}${p.parcelas} × ${reais(p.valorParcelaCentavos)}`}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", p.situacao === "aberta" ? "bg-amarelo text-amarelo-texto" : p.situacao === "aceita" ? "bg-pago-fundo text-pago-texto" : "bg-gray-100 text-gray-500")}>{ROTULO_PROPOSTA[p.situacao]}</span>
        {melhor && <span className="rounded-full bg-verde-claro px-2 py-0.5 text-xs font-semibold text-verde">Menor total</span>}
        {vencida && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-despesa">Validade vencida</span>}
        <span className="ml-auto text-xs text-gray-500">
          {p.quemPropos === "credor" ? "Proposta do credor" : "Sua proposta"} em {formatarData(p.data)}
          {p.validade ? ` · vale até ${formatarData(p.validade)}` : ""}
        </span>
      </div>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Dado titulo="Total a pagar" valor={reais(a.totalCentavos)} />
        <Dado titulo={a.maisCaro ? "Acréscimo sobre o saldo" : "Desconto sobre o saldo"} valor={a.maisCaro ? reais(a.acrescimoCentavos) : `${reais(a.descontoCentavos)} (${String(a.descontoPct).replace(".", ",")}%)`} alerta={a.maisCaro} bom={!a.maisCaro && a.descontoCentavos > 0} />
        {p.parcelas > 0 && <Dado titulo="Juros implícitos" valor={a.jurosImplicitosMensal === null ? "Sem juros" : `${String(a.jurosImplicitosMensal).replace(".", ",")}% ao mês`} />}
        {a.cabeNaSobra !== null && <Dado titulo="Cabe na sobra mensal?" valor={a.cabeNaSobra ? `Sim (folga de ${reais(a.folgaCentavos ?? 0)})` : `Não (faltam ${reais(-(a.folgaCentavos ?? 0))})`} alerta={!a.cabeNaSobra} bom={a.cabeNaSobra} />}
      </div>
      {p.primeiroVencimento && p.parcelas > 0 && <p className="mt-1 text-xs text-gray-500">Primeira parcela em {formatarData(p.primeiroVencimento)}.</p>}
      {p.observacao && <p className="mt-1 text-xs text-gray-600">{p.observacao}</p>}
      {aberta && emAberto && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao className="h-8" icone={<Handshake className="h-4 w-4" />} onClick={aoAceitar}>Aceitar e renegociar</Botao>
          <Botao variante="secundario" className="h-8" icone={<Pencil className="h-4 w-4" />} onClick={aoEditar}>Editar</Botao>
          <Botao variante="secundario" className="h-8" icone={<XCircle className="h-4 w-4" />} onClick={aoRecusar}>Recusar</Botao>
          <Botao variante="secundario" className="h-8" icone={<Trash2 className="h-4 w-4" />} onClick={aoExcluir}>Excluir</Botao>
        </div>
      )}
    </li>
  );
}

function Dado({ titulo, valor, alerta, bom }: { titulo: string; valor: string; alerta?: boolean; bom?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={cn("font-medium", alerta ? "text-despesa" : bom ? "text-pago-texto" : "text-gray-900")}>{valor}</p>
    </div>
  );
}
