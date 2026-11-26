"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, CheckCircle2, Circle, Clock, CreditCard, Landmark, MessageSquareText, Paperclip, Trash2 } from "lucide-react";
import { useState } from "react";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { useSistema } from "@/components/layout/provedor-sistema";
import { Botao } from "@/components/ui/botao";
import { CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import type { LinhaLista } from "@/lib/lancamentos/tipos";

/* Peças da lista de lançamentos, usadas na tela Lançamentos e na Agenda. */

/** Linha da fatura do cartão (agrupa as compras). */
export const eFatura = (l: LinhaLista) => l.id === null && !l.previsto;

export function BotaoAtalho({ rotulo, cor, onClick, children }: { rotulo: string; cor: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={rotulo} aria-label={rotulo} className={cn("h-9 rounded-md border border-borda bg-white px-2.5 hover:bg-gray-50", cor)}>
      {children}
    </button>
  );
}

export function ValorOculto({ centavos, ocultar, className }: { centavos: number; ocultar: boolean; className?: string }) {
  return ocultar ? <span className="font-semibold tracking-widest text-gray-400">•••••</span> : <Valor centavos={centavos} className={className} />;
}

export function FaixaSaldo({ rotulo, dica, centavos, ocultar, embutida, acao }: { rotulo: string; dica: string; centavos: number; ocultar: boolean; embutida?: boolean; acao?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-amarelo-texto", !embutida && "border-b border-amarelo-borda bg-amarelo")} title={dica}>
      <span className="font-semibold">{rotulo}</span>
      <span className="flex items-center gap-2">
        <ValorOculto centavos={centavos} ocultar={ocultar} className="text-base" />
        {acao}
      </span>
    </div>
  );
}

export function IconeTipo({ l }: { l: LinhaLista }) {
  if (l.tipo === "transferencia_saida" || l.tipo === "transferencia_entrada") return <ArrowLeftRight className="h-4 w-4 text-verde" aria-label="Transferência" />;
  if (eFatura(l)) return <CreditCard className="h-4 w-4 text-despesa" aria-label="Fatura" />;
  if (l.tipo === "saldo_inicial") return <Landmark className="h-4 w-4 text-gray-400" aria-label="Saldo inicial" />;
  return l.valorCentavos >= 0 ? <ArrowDown className="h-4 w-4 text-receita" aria-label="Receita" /> : <ArrowUp className="h-4 w-4 text-despesa" aria-label="Despesa" />;
}

export function EtiquetaSituacao({ l }: { l: LinhaLista }) {
  if (eFatura(l)) {
    if (l.situacao === "realizado") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-pago-fundo px-2 py-0.5 text-xs font-semibold text-pago-texto" title={l.dataPagamento ? `Paga em ${formatarData(l.dataPagamento)}` : undefined}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Paga
        </span>
      );
    }
    const fechada = l.faturaSituacao === "fechada";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          l.situacao === "vencido" ? "bg-orange-100 text-despesa" : fechada ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600",
        )}
        title={fechada ? "Fatura fechada: já pode ser paga" : "Fatura aberta: ainda recebe compras"}
      >
        <CreditCard className="h-3.5 w-3.5" /> {l.situacao === "vencido" ? "Vencida" : fechada ? "Fechada" : "Aberta"}
      </span>
    );
  }
  if (l.situacao === "realizado") {
    const texto = l.tipo.startsWith("transferencia") ? "Transferido" : l.valorCentavos >= 0 ? "Recebido" : "Pago";
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-pago-fundo px-2 py-0.5 text-xs font-semibold text-pago-texto" title={l.dataPagamento ? `Em ${formatarData(l.dataPagamento)}` : undefined}>
        <CheckCircle2 className="h-3.5 w-3.5" /> {texto}
      </span>
    );
  }
  if (l.situacao === "vencido") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-despesa">
        <AlertTriangle className="h-3.5 w-3.5" /> Vencido
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-receita"
      title={l.realizarAutomaticamente ? "Será realizado automaticamente no dia do vencimento" : l.recorrenciaId ? "Lançamento recorrente" : undefined}
    >
      {l.realizarAutomaticamente || l.recorrenciaId ? <Clock className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />} A Vencer
    </span>
  );
}

/** Pago ou recebido com valor diferente do lançamento: parcial, desconto ou juros. */
function EtiquetaValorDiferente({ atual, original, receita }: { atual: number; original: number; receita: boolean }) {
  const verbo = receita ? "Recebido" : "Pago";
  const texto = atual > original ? "Com juros" : "Parcial";
  return (
    <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600" title={`${verbo} R$ ${formatarCentavos(atual)} de R$ ${formatarCentavos(original)}.`}>
      {texto}
    </span>
  );
}

export function LinhaComFilhos({ linha: l, ocultar, marcado, aoMarcar, aoAbrir, menu, expandida, filhos, aoEditarFilho }: {
  linha: LinhaLista;
  ocultar: boolean;
  marcado: boolean;
  aoMarcar?: () => void;
  aoAbrir: () => void;
  menu: React.ReactNode;
  expandida: boolean;
  filhos: LinhaLista[];
  aoEditarFilho: (id: number) => void;
}) {
  const fatura = eFatura(l);
  return (
    <>
      <tr className={cn("border-b border-borda last:border-0 even:bg-gray-50/70 hover:bg-verde-claro/50", marcado && "bg-verde-claro/60")}>
        <td className="px-3 py-2.5 text-center">
          {aoMarcar && <input type="checkbox" aria-label={`Selecionar ${l.descricao}`} checked={marcado} onChange={aoMarcar} className="h-4 w-4 accent-verde" />}
        </td>
        <td className="px-1 py-2.5">
          <IconeTipo l={l} />
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
          {formatarData(l.data).slice(0, 5)}
          {l.dataCompra && l.dataCompra !== l.data && <span className="block text-xs text-gray-400">compra {formatarData(l.dataCompra).slice(0, 5)}</span>}
        </td>
        <td className="px-3 py-2.5">
          <button type="button" onClick={aoAbrir} className="flex w-full items-center gap-3 text-left">
            <IconeBanco codigo={l.bancoCodigo} nome={l.bancoNome ?? "Outro"} className="h-7 w-7 shrink-0 text-[10px]" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-gray-900">{l.descricao}</span>
                {(l.parcelamentoId || l.parcela || l.recorrenciaId) && (
                  <span className="text-despesa" title={l.recorrenciaId ? "Recorrente" : "Parcelado"}>
                    *
                  </span>
                )}
                {l.previsto && (
                  <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-500" title="Calculado a partir do recorrente. É gravado quando você paga, recebe ou edita.">
                    Previsto
                  </span>
                )}
                {l.parcela && !l.descricao.includes(l.parcela) && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{l.parcela}</span>}
                {l.formato === "detalhado" && <span className="rounded bg-verde-claro px-1.5 text-xs text-verde">Detalhado</span>}
                {l.dividaId && l.dividaNome && (
                  <Link href={`/gestao/dividas/minhas?detalhar=${l.dividaId}`} onClick={(e) => e.stopPropagation()} className="rounded bg-red-50 px-1.5 text-xs text-despesa hover:underline" title={`Parte da dívida ${l.dividaNome}. Clique para abrir.`}>
                    Dívida
                  </Link>
                )}
                {l.restante && (
                  <span className="rounded bg-amarelo px-1.5 text-xs text-amarelo-texto" title="O que faltou pagar ou receber de um pagamento parcial.">
                    Restante
                  </span>
                )}
                {l.valorOriginalCentavos != null && <EtiquetaValorDiferente atual={Math.abs(l.valorCentavos)} original={l.valorOriginalCentavos} receita={l.valorCentavos >= 0} />}
                {l.observacao && <MessageSquareText className="h-3.5 w-3.5 text-amarelo-texto" aria-label="Tem observação" />}
                {l.anexos > 0 && <Paperclip className="h-3.5 w-3.5 text-gray-500" aria-label={`${l.anexos} anexo(s)`} />}
                {l.tags.map((t) => (
                  <span key={t} className="rounded-full bg-verde-claro px-2 text-xs text-verde">
                    {t}
                  </span>
                ))}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                {l.categoriaCor && <span className="h-2 w-2 rounded-full" style={{ background: l.categoriaCor }} />}
                {[fatura ? `${l.compras.length} ${l.compras.length === 1 ? "compra" : "compras"}` : l.categoria, l.contaOuCartao, l.contato, l.forma].filter(Boolean).join(" · ")}
              </span>
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <ValorOculto centavos={l.valorCentavos} ocultar={ocultar} />
        </td>
        <td className="px-3 py-2.5 text-center">
          <EtiquetaSituacao l={l} />
        </td>
        <td className="px-3 py-2.5 text-right">{menu}</td>
      </tr>
      {expandida &&
        l.itens.map((i) => (
          <tr key={`i${i.id}`} className="border-b border-borda bg-subcabecalho/60 text-xs">
            <td colSpan={3} />
            <td className="py-1.5 pr-3 pl-13">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: i.categoriaCor }} />
                <span className="text-gray-800">{i.descricao}</span>
                <span className="text-gray-500">· {i.categoria}</span>
              </span>
            </td>
            <td className="px-3 py-1.5 text-right">
              <ValorOculto centavos={i.valorCentavos} ocultar={ocultar} />
            </td>
            <td colSpan={2} />
          </tr>
        ))}
      {expandida &&
        filhos.map((c) => (
          <tr key={c.chave} className="border-b border-borda bg-subcabecalho/60 text-xs">
            <td colSpan={2} />
            <td className="px-3 py-1.5 text-gray-500">{c.dataCompra ? formatarData(c.dataCompra).slice(0, 5) : ""}</td>
            <td className="py-1.5 pr-3 pl-13">
              <button type="button" onClick={() => aoEditarFilho(c.id!)} className="flex items-center gap-1.5 text-left hover:underline">
                {c.categoriaCor && <span className="h-2 w-2 rounded-full" style={{ background: c.categoriaCor }} />}
                <span className="text-gray-800">{c.descricao}</span>
                <span className="text-gray-500">· {c.categoria}</span>
              </button>
            </td>
            <td className="px-3 py-1.5 text-right">
              <ValorOculto centavos={c.valorCentavos} ocultar={ocultar} />
            </td>
            <td colSpan={2} />
          </tr>
        ))}
    </>
  );
}

/** Um lançamento pago sozinho: dá para pagar outro valor (parcial, desconto ou juros). */
export type PagamentoUnico = { valorCentavos: number; vencimento: string; receita: boolean };
export type EscolhaPagamento = { data: string; valor: { valorPago: string; gerarRestante: boolean; vencimentoRestante: string } | null };

export function ModalPagar({ titulo, hoje, ocupado, unico, erro, aoFechar, aoConfirmar }: {
  titulo: string;
  erro?: string;
  hoje: string;
  ocupado: boolean;
  /** Presente quando dá para informar o Valor Pago. */
  unico?: PagamentoUnico | null;
  aoFechar: () => void;
  aoConfirmar: (e: EscolhaPagamento) => void;
}) {
  const [data, setData] = useState(hoje);
  const [valorPago, setValorPago] = useState(unico ? formatarCentavos(unico.valorCentavos) : "");
  const parcialLigado = useSistema().parametros.pagamentoParcial;
  const [escolheuRestante, setGerarRestante] = useState(true);
  const gerarRestante = parcialLigado && escolheuRestante;
  const [vencimentoRestante, setVencimentoRestante] = useState(unico ? (unico.vencimento < hoje ? hoje : unico.vencimento) : hoje);
  const pago = unico ? lerValorEmCentavos(valorPago) : null;
  const diferenca = unico && pago !== null && pago > 0 ? unico.valorCentavos - pago : 0;
  const verbo = unico?.receita ? "recebido" : "pago";
  const confirmar = () => aoConfirmar({ data, valor: unico && pago !== unico.valorCentavos ? { valorPago, gerarRestante, vencimentoRestante } : null });
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={unico?.receita ? "Receber" : unico ? "Pagar" : "Pagar / Receber"}
      resumo={titulo}
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="button" carregando={ocupado} onClick={confirmar} icone={<CheckCircle2 className="h-4 w-4" />}>
            Confirmar
          </Botao>
        </>
      }
    >
      <FaixaErro className="mb-3">{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto rotulo={`Data do ${unico?.receita ? "Recebimento" : "Pagamento"}`} type="date" valor={data} aoMudar={setData} ajuda="Dia em que o dinheiro saiu ou entrou na conta." />
        {unico && (
          <CampoValor
            rotulo={unico.receita ? "Valor Recebido" : "Valor Pago"}
            valor={valorPago}
            aoMudar={setValorPago}
            ajuda={
              parcialLigado
                ? `Se ${verbo} menos que R$ ${formatarCentavos(unico.valorCentavos)}, o que faltou pode virar um novo lançamento (pagamento parcial). Se ${verbo} mais, a diferença fica como juros ou multa.`
                : `Se ${verbo} menos que R$ ${formatarCentavos(unico.valorCentavos)}, a diferença fica como desconto. Se ${verbo} mais, fica como juros ou multa.`
            }
          />
        )}
      </div>
      {unico && diferenca > 0 && (
        <div className="mt-4 space-y-3 rounded-md border border-amarelo-borda bg-amarelo px-3 py-3 text-sm text-amarelo-texto">
          <p>
            Faltam <strong>R$ {formatarCentavos(diferenca)}</strong> de R$ {formatarCentavos(unico.valorCentavos)}.
          </p>
          {parcialLigado && (
          <label className="flex items-start gap-2">
            <input type="radio" name="restante" checked={gerarRestante} onChange={() => setGerarRestante(true)} className="mt-0.5 accent-verde" />
            <span>
              <strong>Pagamento parcial:</strong> criar um novo lançamento com o restante, ainda não {verbo}.
            </span>
          </label>
          )}
          {gerarRestante && (
            <CampoTexto rotulo="Vencimento do Restante" type="date" valor={vencimentoRestante} aoMudar={setVencimentoRestante} ajuda="Quando o restante deve ser pago ou recebido." className="pl-6" />
          )}
          <label className="flex items-start gap-2">
            <input type="radio" name="restante" checked={!gerarRestante} onChange={() => setGerarRestante(false)} className="mt-0.5 accent-verde" disabled={!parcialLigado} />
            <span>
              <strong>Desconto:</strong> não falta nada, o lançamento fica com o valor {verbo}.
            </span>
          </label>
        </div>
      )}
      {unico && diferenca < 0 && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          R$ {formatarCentavos(-diferenca)} a mais (juros ou multa). O lançamento passa a valer R$ {formatarCentavos(pago!)}.
        </p>
      )}
      {!unico && <p className="mt-2 text-xs text-gray-500">O valor pago é o valor de cada lançamento. Para pagar outro valor (pagamento parcial), pague um lançamento por vez. Compras no cartão são pagas junto com a fatura (menu da linha Fatura-Cartão).</p>}
      {unico && <p className="mt-3 text-xs text-gray-500">&quot;Voltar para não pago&quot; desfaz tudo: o lançamento volta ao valor de antes e o restante é apagado.</p>}
    </Modal>
  );
}

export function ModalExcluir({ titulo, parcelado, recorrente, ocupado, aoFechar, aoConfirmar }: {
  titulo: string;
  parcelado: boolean;
  recorrente?: boolean;
  ocupado: boolean;
  aoFechar: () => void;
  aoConfirmar: (escopo: "esta" | "proximas" | "todas") => void;
}) {
  const [escopo, setEscopo] = useState<"esta" | "proximas" | "todas">("esta");
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Excluir lançamento"
      resumo={titulo}
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao variante="perigo" type="button" carregando={ocupado} onClick={() => aoConfirmar(escopo)} icone={<Trash2 className="h-4 w-4" />}>
            Excluir
          </Botao>
        </>
      }
    >
      <p className="text-sm text-gray-700">Tem certeza? Transferências são excluídas nas duas contas. A exclusão fica registrada na auditoria.</p>
      {recorrente && (
        <p className="mt-2 rounded-md bg-amarelo px-3 py-2 text-sm text-amarelo-texto">
          Lançamentos de recorrente: só esta ocorrência é excluída e não volta a aparecer. As próximas continuam. Para parar de vez, inative o recorrente em
          Financeiro &gt; Recorrentes.
        </p>
      )}
      {parcelado && (
        <fieldset className="mt-4 space-y-2 text-sm">
          <legend className="mb-1 font-semibold text-gray-800">Este lançamento é uma parcela. Excluir:</legend>
          {(
            [
              ["esta", "Só esta parcela"],
              ["proximas", "Esta e as próximas"],
              ["todas", "Todas as parcelas"],
            ] as const
          ).map(([v, r]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="escopo" checked={escopo === v} onChange={() => setEscopo(v)} className="accent-verde" /> {r}
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
}
