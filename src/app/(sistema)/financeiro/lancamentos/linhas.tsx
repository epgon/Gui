"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, Check, CheckCircle2, Circle, Clock, CreditCard, Landmark, MessageSquareText, Paperclip, Trash2 } from "lucide-react";
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
import { type Destaques, TELAS_LISTAGEM, type PreferenciaListagem } from "@/lib/listagem/telas";

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

export function IconeTipo({ l }: { l: LinhaLista }) {
  if (l.tipo === "transferencia_saida" || l.tipo === "transferencia_entrada") return <ArrowLeftRight className="h-4 w-4 text-verde" aria-label="Transferência" />;
  if (eFatura(l)) return <CreditCard className="h-4 w-4 text-despesa" aria-label="Fatura" />;
  if (l.tipo === "saldo_inicial") return <Landmark className="h-4 w-4 text-gray-400" aria-label="Saldo inicial" />;
  return l.valorCentavos >= 0 ? <ArrowDown className="h-4 w-4 text-receita" aria-label="Receita" /> : <ArrowUp className="h-4 w-4 text-despesa" aria-label="Despesa" />;
}

const SELO = "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-xs";
const SELO_VERDE = "border-green-200 bg-green-50 text-green-700";
const SELO_VERMELHO = "border-red-200 bg-red-50 text-red-600";
const SELO_AZUL = "border-blue-200 bg-blue-50 text-receita";
const SELO_NEUTRO = "border-gray-200 bg-gray-50 text-gray-600";

/** Etiqueta retangular da situação, com o ícone depois do texto. Sem `colorida`, fica toda cinza. */
export function EtiquetaSituacao({ l, colorida = true }: { l: LinhaLista; colorida?: boolean }) {
  const cor = (c: string) => (colorida ? c : SELO_NEUTRO);
  if (eFatura(l)) {
    if (l.situacao === "realizado") {
      return (
        <span className={cn(SELO, cor(SELO_VERDE))} title={l.dataPagamento ? `Paga em ${formatarData(l.dataPagamento)}` : undefined}>
          Paga <Check className="h-3 w-3" />
        </span>
      );
    }
    const fechada = l.faturaSituacao === "fechada";
    return (
      <span
        className={cn(SELO, cor(l.situacao === "vencido" ? SELO_VERMELHO : fechada ? "border-amber-200 bg-amber-50 text-amber-800" : SELO_NEUTRO))}
        title={fechada ? "Fatura fechada: já pode ser paga" : "Fatura aberta: ainda recebe compras"}
      >
        {l.situacao === "vencido" ? "Vencida" : fechada ? "Fechada" : "Aberta"} <CreditCard className="h-3 w-3" />
      </span>
    );
  }
  if (l.situacao === "realizado") {
    const texto = l.tipo.startsWith("transferencia") ? "Transferido" : l.valorCentavos >= 0 ? "Recebido" : "Pago";
    return (
      <span className={cn(SELO, cor(SELO_VERDE))} title={l.dataPagamento ? `Em ${formatarData(l.dataPagamento)}` : undefined}>
        {texto} <Check className="h-3 w-3" />
      </span>
    );
  }
  const recorrente = !!l.recorrenciaId || !!l.previsto;
  if (l.situacao === "vencido") {
    return (
      <span className={cn(SELO, cor(SELO_VERMELHO))}>
        Vencido {recorrente ? <Clock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      </span>
    );
  }
  return (
    <span className={cn(SELO, cor(SELO_AZUL))} title={l.realizarAutomaticamente ? "Será realizado automaticamente no dia do vencimento" : recorrente ? "Lançamento recorrente" : undefined}>
      A Vencer {l.realizarAutomaticamente || recorrente ? <Clock className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
    </span>
  );
}

/** Pago ou recebido com valor diferente do lançamento: parcial, desconto ou juros. */
function EtiquetaValorDiferente({ atual, original, receita }: { atual: number; original: number; receita: boolean }) {
  const verbo = receita ? "Recebido" : "Pago";
  const texto = atual > original ? "Com juros" : "Parcial";
  return (
    <span className="rounded bg-gray-100 px-1.5 text-[11px] text-gray-600" title={`${verbo} R$ ${formatarCentavos(atual)} de R$ ${formatarCentavos(original)}.`}>
      {texto}
    </span>
  );
}

/** Colunas da lista na ordem em que aparecem (as mesmas das Configurações da Listagem). */
/** Colunas sem largura própria (extra vazio) ficam do tamanho do conteúdo; as de texto livre dividem o que sobra. */
const TITULOS: Record<string, { titulo: string; alinhar?: "direita"; extra?: string }> = {
  codigo: { titulo: "Código" },
  data: { titulo: "Data" },
  dataCompra: { titulo: "Data de Compra" },
  dataReferencia: { titulo: "Data de Referência" },
  dataPagamento: { titulo: "Data de Pagamento" },
  banco: { titulo: "" },
  conta: { titulo: "Conta ou Cartão" },
  contato: { titulo: "Cliente ou Fornecedor", extra: "min-w-36" },
  cor: { titulo: "" },
  descricao: { titulo: "Descrição", extra: "min-w-48" },
  documento: { titulo: "Documento" },
  categoria: { titulo: "Categoria" },
  forma: { titulo: "Forma de Pagamento" },
  tags: { titulo: "Tags" },
  observacao: { titulo: "Obs." },
  anexos: { titulo: "Anexos" },
  valorPago: { titulo: "Valor Pago", alinhar: "direita" },
  valor: { titulo: "Valor", alinhar: "direita" },
  situacao: { titulo: "" },
  saldo: { titulo: "Saldo", alinhar: "direita" },
};
const ORDEM_COLUNAS = TELAS_LISTAGEM.lancamentos.colunas.map((c) => c.chave);

/** Como a lista é desenhada: colunas visíveis, aparência e destaques (vêm das Configurações da Listagem). */
export type VisualLinhas = {
  /** Chaves das colunas visíveis (qualquer ordem; a ordem de exibição é a da tela). */
  colunas: string[];
  compacta: boolean;
  zebra: boolean;
  destaques: Destaques;
  hoje: string;
  /** Saldo Acumulado de cada linha (chave da linha); null = sem saldo (filtrando cartão). */
  saldos?: Record<string, number | null>;
};

export function visualDe(pref: PreferenciaListagem, hoje: string, saldos?: VisualLinhas["saldos"]): VisualLinhas {
  return { colunas: pref.colunas, compacta: pref.compactar, zebra: pref.destacarPares, destaques: pref.destaques, hoje, saldos };
}

const visiveis = (v: VisualLinhas) => ORDEM_COLUNAS.filter((c) => v.colunas.includes(c) && (c !== "saldo" || !!v.saldos));

/** Cabeçalho da tabela: caixa de marcar, ícone do tipo, as colunas visíveis e a coluna do menu (com a engrenagem). */
export function CabecalhoLinhas({ visual, marcarTodos, engrenagem, className }: {
  visual: VisualLinhas;
  className?: string;
  marcarTodos?: { marcado: boolean; aoMudar: () => void };
  engrenagem?: React.ReactNode;
}) {
  const p = visual.compacta ? "py-1.5" : "py-2.5";
  const th = cn("px-3 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-gray-600", p);
  return (
    <thead className={cn("border-b border-borda bg-white", className)}>
      <tr>
        <th className={cn("w-9 pr-0 pl-4", p)}>
          {marcarTodos && <input type="checkbox" aria-label="Selecionar todos" checked={marcarTodos.marcado} onChange={marcarTodos.aoMudar} className="h-3.5 w-3.5 accent-verde" />}
        </th>
        <th className={cn("w-6 px-1", p)} />
        {visiveis(visual).map((c) => {
          const t = TITULOS[c];
          return (
            <th key={c} className={cn(th, t.alinhar === "direita" && "text-right", t.extra ?? "w-px")}>
              {t.titulo || <span className="sr-only">{c === "banco" ? "Banco ou cartão" : c === "cor" ? "Cor da categoria" : "Situação"}</span>}
            </th>
          );
        })}
        <th className={cn("w-10 px-3 text-right", p)}>{engrenagem ?? <span className="sr-only">Opções</span>}</th>
      </tr>
    </thead>
  );
}

const SELO_PEQUENO = "rounded bg-gray-100 px-1.5 text-[11px] text-gray-600";

export function LinhaComFilhos({ linha: l, visual, ocultar, marcado, aoMarcar, aoAbrir, menu, expandida, filhos, aoEditarFilho }: {
  linha: LinhaLista;
  visual: VisualLinhas;
  ocultar: boolean;
  marcado: boolean;
  aoMarcar?: () => void;
  aoAbrir: () => void;
  menu: React.ReactNode;
  expandida: boolean;
  filhos: LinhaLista[];
  aoEditarFilho: (id: number) => void;
}) {
  const colunas = visiveis(visual);
  const fatura = eFatura(l);
  const p = visual.compacta ? "py-0.5" : "py-2";
  const td = cn("px-3 align-middle whitespace-nowrap text-gray-700", p);
  const sinal = l.valorCentavos < 0 ? -1 : 1;
  const d = visual.destaques;
  // Vencidos em creme, o que vence hoje em verde bem claro (a marcação manual vence os dois).
  const fundo = marcado
    ? "bg-verde-claro/60"
    : d.vencidos && l.situacao === "vencido"
      ? "bg-orange-50/70"
      : d.hoje && l.data === visual.hoje
        ? "bg-verde-claro/50"
        : visual.zebra && "even:bg-gray-50/70";
  const valor = (centavos: number, extra?: string) => <ValorOculto centavos={centavos} ocultar={ocultar} className={cn("font-normal!", extra)} />;

  const celula = (c: string): React.ReactNode => {
    switch (c) {
      case "codigo":
        return l.id ?? "";
      case "data":
        return formatarData(l.data);
      case "dataCompra":
        return formatarData(l.dataCompra);
      case "dataReferencia":
        return formatarData(l.dataReferencia);
      case "dataPagamento":
        return formatarData(l.dataPagamento);
      case "banco":
        return <IconeBanco codigo={l.bancoCodigo} nome={l.bancoNome ?? "Outro"} className="h-6! w-6! text-[9px]!" />;
      case "conta":
        return l.contaOuCartao;
      case "contato":
        return l.contato ?? "";
      case "cor":
        return l.categoriaCor ? <span className="block h-2 w-2 rounded-full" style={{ background: l.categoriaCor }} title={l.categoria ?? undefined} /> : null;
      case "descricao":
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={aoAbrir} className="text-left text-receita hover:underline">
              {l.descricao}
            </button>
            {(l.parcelamentoId || l.parcela || l.recorrenciaId) && (
              <span className="text-despesa" title={l.recorrenciaId ? "Recorrente" : "Parcelado"}>
                *
              </span>
            )}
            {fatura && <span className={SELO_PEQUENO}>{l.compras.length} {l.compras.length === 1 ? "compra" : "compras"}</span>}
            {l.previsto && (
              <span className={SELO_PEQUENO} title="Calculado a partir do recorrente. É gravado quando você paga, recebe ou edita.">
                Previsto
              </span>
            )}
            {l.parcela && !l.descricao.includes(l.parcela) && <span className={SELO_PEQUENO}>{l.parcela}</span>}
            {l.formato === "detalhado" && <span className="rounded bg-verde-claro px-1.5 text-[11px] text-verde">Detalhado</span>}
            {l.dividaId && l.dividaNome && (
              <Link href={`/gestao/dividas/minhas?detalhar=${l.dividaId}`} className="rounded bg-red-50 px-1.5 text-[11px] text-despesa hover:underline" title={`Parte da dívida ${l.dividaNome}. Clique para abrir.`}>
                Dívida
              </Link>
            )}
            {l.restante && (
              <span className="rounded bg-amarelo px-1.5 text-[11px] text-amarelo-texto" title="O que faltou pagar ou receber de um pagamento parcial.">
                Restante
              </span>
            )}
            {l.valorOriginalCentavos != null && <EtiquetaValorDiferente atual={Math.abs(l.valorCentavos)} original={l.valorOriginalCentavos} receita={l.valorCentavos >= 0} />}
            {l.observacao && !colunas.includes("observacao") && <MessageSquareText className="h-3.5 w-3.5 text-amarelo-texto" aria-label="Tem observação" />}
            {l.anexos > 0 && !colunas.includes("anexos") && <Paperclip className="h-3.5 w-3.5 text-gray-500" aria-label={`${l.anexos} anexo(s)`} />}
            {!colunas.includes("tags") &&
              l.tags.map((t) => (
                <span key={t} className="rounded-full bg-verde-claro px-2 text-[11px] text-verde">
                  {t}
                </span>
              ))}
          </span>
        );
      case "documento":
        return l.documento ?? "";
      case "categoria":
        return l.categoria ?? (l.itens.length ? "Detalhado" : "");
      case "forma":
        return l.forma ?? "";
      case "tags":
        return l.tags.length ? (
          <span className="flex gap-1">
            {l.tags.map((t) => (
              <span key={t} className="rounded-full bg-verde-claro px-2 text-[11px] text-verde">
                {t}
              </span>
            ))}
          </span>
        ) : null;
      case "observacao":
        return l.observacao ? <MessageSquareText className="h-3.5 w-3.5 text-amarelo-texto" aria-label="Tem observação" /> : null;
      case "anexos":
        return l.anexos > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3.5 w-3.5 text-gray-500" /> {l.anexos}
          </span>
        ) : null;
      case "valorPago":
        return l.valorPagoCentavos !== null ? valor(sinal * l.valorPagoCentavos) : null;
      case "valor":
        return valor(l.valorCentavos);
      case "situacao":
        return <EtiquetaSituacao l={l} colorida={d.situacao} />;
      case "saldo": {
        const saldo = visual.saldos?.[l.chave];
        return saldo === undefined || saldo === null ? <span className="text-gray-400">—</span> : valor(saldo);
      }
    }
    return null;
  };
  const alinhaDireita = (c: string) => TITULOS[c].alinhar === "direita";
  // Linhas de baixo (itens do detalhado e compras da fatura): a descrição e o valor ficam nas colunas deles.
  const linhaFilha = (chave: string, data: string, descricao: React.ReactNode, centavos: number) => (
    <tr key={chave} className="border-b border-borda bg-subcabecalho/60 text-xs">
      <td colSpan={2} />
      {colunas.map((c) => (
        <td key={c} className={cn("px-3 py-1.5", alinhaDireita(c) && "text-right")}>
          {c === "data" ? <span className="text-gray-500">{data}</span> : c === "descricao" ? descricao : c === "valor" ? <ValorOculto centavos={centavos} ocultar={ocultar} className="font-normal!" /> : null}
        </td>
      ))}
      <td />
    </tr>
  );
  return (
    <>
      <tr className={cn("border-b border-borda text-[13px] last:border-0 hover:bg-verde-claro/50", fundo)}>
        <td className={cn("pr-0 pl-4", p)}>
          {aoMarcar && <input type="checkbox" aria-label={`Selecionar ${l.descricao}`} checked={marcado} onChange={aoMarcar} className="h-3.5 w-3.5 accent-verde" />}
        </td>
        <td className={cn("px-1", p)}>
          <IconeTipo l={l} />
        </td>
        {colunas.map((c) => (
          <td key={c} className={cn(td, alinhaDireita(c) && "text-right", c === "descricao" && "whitespace-normal")}>
            {celula(c)}
          </td>
        ))}
        <td className={cn("px-3 text-right", p)}>{menu}</td>
      </tr>
      {expandida &&
        l.itens.map((i) =>
          linhaFilha(
            `i${i.id}`,
            "",
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: i.categoriaCor }} />
              <span className="text-gray-800">{i.descricao}</span>
              <span className="text-gray-500">· {i.categoria}</span>
            </span>,
            i.valorCentavos,
          ),
        )}
      {expandida &&
        filhos.map((f) =>
          linhaFilha(
            f.chave,
            f.dataCompra ? formatarData(f.dataCompra) : "",
            <button type="button" onClick={() => aoEditarFilho(f.id!)} className="flex items-center gap-1.5 text-left hover:underline">
              {f.categoriaCor && <span className="h-2 w-2 rounded-full" style={{ background: f.categoriaCor }} />}
              <span className="text-gray-800">{f.descricao}</span>
              <span className="text-gray-500">· {f.categoria}</span>
            </button>,
            f.valorCentavos,
          ),
        )}
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
