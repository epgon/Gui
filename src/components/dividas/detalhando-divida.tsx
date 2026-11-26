"use client";

import { Banknote, Calculator, ExternalLink, Gauge, Handshake, Link2Off, NotebookPen, Scale, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { desligarVinculoDivida, detalharDivida } from "@/app/(sistema)/gestao/dividas/acoes";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Quadro } from "@/components/cartoes/janela-fatura";
import { Botao } from "@/components/ui/botao";
import { CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { estaAtiva, rotuloGarantia, rotuloTipoDivida } from "@/lib/dividas/regras";
import type { DetalheDivida, LinhaObrigacao } from "@/lib/dividas/tipos";
import { PilulaSituacao, NotaSaldo } from "./comuns";
import { useAnotacao } from "./janelas-divida";

type Aba = "resumo" | "parcelas" | "historico" | "vinculos";
export type AcaoDivida = "pagar" | "amortizar" | "quitar" | "saldo" | "encargo" | "renegociar" | "desfazer";

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "resumo", rotulo: "Resumo" },
  { chave: "parcelas", rotulo: "Parcelas" },
  { chave: "historico", rotulo: "Histórico" },
  { chave: "vinculos", rotulo: "Vínculos" },
];

/**
 * Janela "Detalhando Dívida", no padrão do Detalhando Conta e Cartão: Resumo, Parcelas, Histórico e Vínculos.
 * `versao` muda quando algo foi gravado fora da janela (pagar, amortizar...), para ela recarregar.
 */
export function DetalhandoDivida({ dividaId, versao, aoFechar, aoAcao, aoPagarParcela, aoAbrirDivida }: {
  dividaId: number;
  versao: number;
  aoFechar: () => void;
  aoAcao: (acao: AcaoDivida) => void;
  aoPagarParcela: (o: LinhaObrigacao) => void;
  /** Abre outra dívida (o acordo ou uma original) sem sair da tela. */
  aoAbrirDivida?: (id: number) => void;
}) {
  const [dados, setDados] = useState<DetalheDivida | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<Aba>("resumo");
  const [carregando, iniciar] = useTransition();

  const carregar = () =>
    iniciar(async () => {
      try {
        const d = await detalharDivida(dividaId);
        if (d) {
          setDados(d);
          setErro("");
        } else setErro("Dívida não encontrada.");
      } catch {
        setErro("Não foi possível carregar a dívida agora. Tente de novo.");
      }
    });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao]);

  const d = dados?.divida;
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        <span>
          Detalhando Dívida
          {d && <span className="block text-sm font-normal text-gray-500">{[`#${d.id}`, d.descricao, d.credor, rotuloTipoDivida(d.tipo)].join(" · ")}</span>}
        </span>
      }
    >
      <ProvedorOcultar>
        {!dados || !d ? (
          <p className="py-10 text-center text-sm text-gray-500">{erro || "Carregando..."}</p>
        ) : (
          <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
            <div role="tablist" className="flex gap-1 border-b border-borda">
              {ABAS.map((a) => (
                <button key={a.chave} role="tab" type="button" aria-selected={aba === a.chave} onClick={() => setAba(a.chave)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", aba === a.chave ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}>
                  {a.rotulo}
                </button>
              ))}
            </div>
            {aba === "resumo" && <Resumo dados={dados} aoAcao={aoAcao} />}
            {aba === "parcelas" && <Parcelas dados={dados} aoPagar={aoPagarParcela} />}
            {aba === "historico" && <Historico dados={dados} aoMudar={carregar} />}
            {aba === "vinculos" && <Vinculos dados={dados} aoMudar={carregar} aoAbrirDivida={aoAbrirDivida} />}
          </div>
        )}
      </ProvedorOcultar>
    </Modal>
  );
}

function Anel({ percentual }: { percentual: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`${percentual}% pago`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#16a34a" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percentual / 100)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-lg font-semibold text-gray-800">
        {percentual}%<span className="text-[10px] font-normal text-gray-500">pago</span>
      </span>
    </div>
  );
}

function Resumo({ dados, aoAcao }: { dados: DetalheDivida; aoAcao: (a: AcaoDivida) => void }) {
  const d = dados.divida;
  const ativa = estaAtiva(d.situacao);
  const maior = Math.max(1, ...dados.evolucao.map((e) => e.saldoCentavos));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PilulaSituacao situacao={d.situacao} diasAtraso={d.diasAtraso} />
        {d.parcelasAtrasadas > 0 && <span className="text-xs text-gray-500">{d.parcelasAtrasadas} {d.parcelasAtrasadas === 1 ? "parcela vencida" : "parcelas vencidas"}</span>}
        {ativa && (
          <span className="ml-auto flex flex-wrap gap-2">
            {d.forma === "sem_parcelas" ? (
              <Botao variante="secundario" className="h-8" icone={<Wallet className="h-4 w-4" />} onClick={() => aoAcao("pagar")}>Pagar</Botao>
            ) : (
              <Botao variante="secundario" className="h-8" icone={<Banknote className="h-4 w-4" />} onClick={() => aoAcao("amortizar")}>Amortizar</Botao>
            )}
            <Botao variante="secundario" className="h-8" icone={<Gauge className="h-4 w-4" />} onClick={() => aoAcao("saldo")}>Atualizar saldo</Botao>
            <Botao variante="secundario" className="h-8" icone={<NotebookPen className="h-4 w-4" />} onClick={() => aoAcao("encargo")}>Lançar encargo</Botao>
            <Botao variante="secundario" className="h-8" icone={<Handshake className="h-4 w-4" />} onClick={() => aoAcao("renegociar")}>Renegociar</Botao>
            <Botao variante="secundario" className="h-8" icone={<Scale className="h-4 w-4" />} onClick={() => aoAcao("quitar")}>Quitar</Botao>
            <Link href={`/gestao/dividas/simulador?modo=quitar&divida=${d.id}`} className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-borda bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              <Calculator className="h-4 w-4" /> Simular
            </Link>
          </span>
        )}
      </div>
      {d.situacao === "em_negociacao" && <p className="rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-sm text-amarelo-texto">Há uma negociação em andamento com este credor. Veja na aba Negociações.</p>}
      {d.situacao === "renegociada" && <p className="rounded-md border border-borda bg-gray-50 px-3 py-2 text-sm text-gray-600">Esta dívida foi substituída por um acordo. As parcelas não pagas saíram de Lançamentos e estão guardadas no Histórico. Veja o acordo na aba Vínculos.</p>}
      {dados.desfazerRenegociacao && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-borda bg-gray-50 px-3 py-2 text-sm text-gray-600">
          <span className="flex-1">
            Este acordo substituiu {d.originaisIds.length === 1 ? "uma dívida" : `${d.originaisIds.length} dívidas`}.{" "}
            {dados.desfazerRenegociacao.pode ? "Enquanto nenhuma parcela do acordo for paga, dá para desfazer e voltar tudo como estava." : dados.desfazerRenegociacao.motivo}
          </span>
          {dados.desfazerRenegociacao.pode && (
            <Botao variante="secundario" className="h-8" icone={<Undo2 className="h-4 w-4" />} onClick={() => aoAcao("desfazer")}>
              Desfazer renegociação
            </Botao>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Quadro titulo="Saldo devedor" dica="O que falta pagar hoje. Mostra o saldo informado pelo credor (se for recente) ou a estimativa." destaque>
          <ValorOcultavel centavos={-d.saldo.exibido} className="text-2xl" />
          <NotaSaldo saldo={d.saldo} />
        </Quadro>
        <Quadro titulo="Pelas parcelas" dica="Soma das parcelas que ainda não foram pagas.">
          <ValorOcultavel centavos={-d.saldo.pelasParcelas} />
        </Quadro>
        <Quadro titulo="Estimado com atraso" dica="Parcelas mais a estimativa de multa e juros de mora das vencidas. É aproximado: cada credor calcula de um jeito.">
          <ValorOcultavel centavos={-d.saldo.estimado} />
          {d.saldo.atrasoCentavos > 0 && <span className="block text-xs text-despesa">{formatarCentavos(d.saldo.atrasoCentavos)} de multa e juros</span>}
        </Quadro>
      </div>
      {d.saldo.informado !== null && (
        <p className="text-xs text-gray-500">
          Saldo informado pelo credor em {formatarData(d.saldo.informadoEm)}, já com os pagamentos feitos depois: <strong>R$ {formatarCentavos(d.saldo.informado)}</strong>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-borda p-4">
        <Anel percentual={d.progresso} />
        <div className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
          <Item rotulo="Total já pago"><ValorOcultavel centavos={-d.pagoCentavos || 0} className="text-base" /></Item>
          <Item rotulo="Juros, multa e encargos pagos"><ValorOcultavel centavos={-dados.jurosPagosCentavos || 0} className="text-base" /></Item>
          <Item rotulo="Valor original">{d.valorOriginalCentavos ? <ValorOcultavel centavos={d.valorOriginalCentavos} className="text-base" /> : <span className="text-gray-400">Não informado</span>}</Item>
          <Item rotulo="Parcelas">{d.forma === "parcelas_fixas" ? `${d.parcelasPagas} de ${d.parcelasTotal} pagas` : <span className="text-gray-500">Sem parcelas definidas</span>}</Item>
          <Item rotulo="Próximo vencimento">{d.proximoVencimento ? formatarData(d.proximoVencimento) : "—"}</Item>
          <Item rotulo="Previsão de término">{dados.previsaoTermino ? formatarData(dados.previsaoTermino) : "—"}</Item>
          <Item rotulo="Taxa de juros">{d.taxaMensal !== null ? `${String(d.taxaMensal).replace(".", ",")}% ao mês${dados.taxaAnual ? ` (${String(dados.taxaAnual).replace(".", ",")}% ao ano)` : ""}` : <span className="text-gray-400">Não informada (cálculos aproximados)</span>}</Item>
          <Item rotulo="Garantia">{rotuloGarantia(d.garantia)}</Item>
        </div>
      </div>

      {dados.valorPresenteCentavos !== null && (
        <p className="rounded-md bg-subcabecalho px-3 py-2 text-sm text-gray-600" title="As parcelas futuras trazidas a hoje pela taxa da dívida. Serve para conferir se o desconto que o credor oferece é real.">
          Valor presente das parcelas em aberto: <strong>R$ {formatarCentavos(dados.valorPresenteCentavos)}</strong> (quanto deveria custar quitar hoje, pela taxa da dívida).
        </p>
      )}

      {dados.evolucao.length > 1 && (
        <div className="rounded-lg border border-borda p-4">
          <h3 className="text-sm font-semibold text-gray-800">Saldo ao longo do tempo</h3>
          <p className="text-xs text-gray-500">Cai a cada pagamento (valores das parcelas, sem juros de atraso).</p>
          <div className="mt-3 flex items-end gap-1" style={{ height: 90 }}>
            {dados.evolucao.map((e, i) => (
              <div key={i} className="flex-1 rounded-t bg-receita/70" style={{ height: `${Math.max(2, (e.saldoCentavos / maior) * 100)}%` }} title={`${formatarData(e.data)}: R$ ${formatarCentavos(e.saldoCentavos)}`} />
            ))}
          </div>
        </div>
      )}
      {d.observacao && <p className="text-sm text-gray-600">{d.observacao}</p>}
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{rotulo}</p>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}

const PILULA_PARCELA = {
  realizado: "bg-pago-fundo text-pago-texto",
  a_vencer: "bg-gray-100 text-gray-600",
  vencido: "bg-orange-100 text-despesa",
} as const;
const ROTULO_PARCELA = { realizado: "Pago", a_vencer: "A Vencer", vencido: "Vencido" } as const;

function Parcelas({ dados, aoPagar }: { dados: DetalheDivida; aoPagar: (o: LinhaObrigacao) => void }) {
  if (!dados.obrigacoes.length) {
    return <p className="rounded-lg border border-dashed border-borda py-8 text-center text-sm text-gray-500">{dados.divida.forma === "sem_parcelas" ? "Esta dívida não tem parcelas: o saldo é informado e cada pagamento é registrado pelo botão Pagar." : "Nenhuma parcela."}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-borda">
      <table className="w-full text-sm">
        <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Vencimento</th>
            <th className="px-3 py-2 text-left font-semibold">Parcela</th>
            <th className="px-3 py-2 text-center font-semibold">Situação</th>
            <th className="px-3 py-2 text-right font-semibold">Valor</th>
            <th className="px-3 py-2 text-right font-semibold">Com atraso (est.)</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {dados.obrigacoes.map((o) => (
            <tr key={o.chave} className="border-b border-borda last:border-0 even:bg-gray-50/70">
              <td className="px-3 py-2 whitespace-nowrap">{formatarData(o.vencimento)}{o.dataPagamento && <span className="block text-xs text-gray-400">pago em {formatarData(o.dataPagamento)}</span>}</td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-gray-900">{o.descricao}</span>
                  {o.restante && <span className="rounded bg-amarelo px-1.5 text-xs text-amarelo-texto">Restante</span>}
                  {o.encargo && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">Encargo</span>}
                  {o.ajustada && <span className="rounded bg-verde-claro px-1.5 text-xs text-verde" title="O valor foi reduzido por uma amortização. O valor anterior está no histórico.">Ajustada</span>}
                  {o.valorOriginalCentavos !== null && o.valorOriginalCentavos !== o.valorCentavos && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{o.valorCentavos > o.valorOriginalCentavos ? "Com juros" : "Parcial"}</span>}
                  {o.origem === "fatura" && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">Fatura</span>}
                </span>
              </td>
              <td className="px-3 py-2 text-center"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", PILULA_PARCELA[o.situacao])}>{ROTULO_PARCELA[o.situacao]}</span></td>
              <td className="px-3 py-2 text-right"><ValorOcultavel centavos={-o.valorCentavos} /></td>
              <td className="px-3 py-2 text-right text-xs">{o.acrescimoCentavos > 0 ? <span title={`${o.atrasoDias} dias de atraso`}><ValorOcultavel centavos={-(o.valorCentavos + o.acrescimoCentavos)} className="text-xs" /></span> : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2 text-right">
                <MenuLinha
                  rotulo={o.descricao}
                  itens={[
                    ...(o.podePagarAqui ? [{ rotulo: "Pagar", aoClicar: () => aoPagar(o) }] : []),
                    { rotulo: "Ver em Lançamentos", aoClicar: () => window.location.assign(o.origem === "lancamento" ? `/financeiro/lancamentos?mes=${o.vencimento.slice(0, 7)}&busca=${encodeURIComponent(o.descricao)}` : "/cadastros/cartoes-de-credito") },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COR_EVENTO: Record<string, string> = { pagamento: "bg-verde-vivo", quitacao: "bg-verde-vivo", atualizacao_saldo: "bg-receita", amortizacao: "bg-receita", encargo: "bg-despesa", cancelamento: "bg-gray-400", vinculo: "bg-dourado", anotacao: "bg-gray-400", cadastro: "bg-verde", renegociacao: "bg-dourado", desfeito: "bg-gray-400" };

function Historico({ dados, aoMudar }: { dados: DetalheDivida; aoMudar: () => void }) {
  const nota = useAnotacao(dados.divida.id, aoMudar);
  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          nota.salvar();
        }}
      >
        <CampoTexto className="flex-1" rotulo="Anotação" maxLength={500} valor={nota.texto} aoMudar={nota.setTexto} ajuda="Registre uma conversa com o credor, um protocolo ou qualquer lembrete. Fica na linha do tempo." />
        <Botao type="submit" carregando={nota.ocupado} className="mb-0.5">Anotar</Botao>
      </form>
      <FaixaErro>{nota.erro && <TextoComDestaque texto={nota.erro} />}</FaixaErro>
      <ol className="relative space-y-3 border-l-2 border-borda pl-5">
        {dados.historico.map((e) => (
          <li key={e.chave} className="relative">
            <span className={cn("absolute top-1.5 -left-[1.6rem] h-2.5 w-2.5 rounded-full ring-2 ring-white", COR_EVENTO[e.tipo] ?? "bg-gray-400")} />
            <p className="text-xs text-gray-500">{formatarData(e.data)}</p>
            <p className="text-sm text-gray-800">
              {e.descricao}
              {e.lancamentoId !== null && (
                <Link href={`/financeiro/lancamentos?busca=${encodeURIComponent(e.descricao.replace(/^Pagamento: /, ""))}`} className="ml-2 inline-flex items-center gap-0.5 text-xs text-verde hover:underline">
                  ver lançamento <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Vinculos({ dados, aoMudar, aoAbrirDivida }: { dados: DetalheDivida; aoMudar: () => void; aoAbrirDivida?: (id: number) => void }) {
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const desligar = (tipo: "fatura" | "recorrencia" | "lancamento" | "divida", id: number) =>
    iniciar(async () => {
      if (tipo === "divida") return;
      setErro("");
      try {
        const r = await desligarVinculoDivida(dados.divida.id, { tipo, id });
        if (!r.ok) return setErro(r.erro);
        aoMudar();
      } catch {
        setErro("Não foi possível desligar agora. Tente de novo.");
      }
    });
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Faturas, recorrentes e lançamentos que esta dívida acompanha, e o acordo ou as dívidas originais quando há renegociação. Cada obrigação continua existindo uma vez só, no lugar de origem: desligar não apaga nada.
      </p>
      <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      {dados.vinculos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda py-8 text-center text-sm text-gray-500">Nada ligado a esta dívida. Em Minhas Dívidas, use &quot;Acompanhar como dívida&quot; nas contas em aberto.</p>
      ) : (
        <ul className="divide-y divide-borda rounded-lg border border-borda">
          {dados.vinculos.map((v) => (
            <li key={v.chave} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{v.rotulo}</p>
                <p className="text-xs text-gray-500">{v.detalhe}</p>
              </div>
              {v.tipo === "divida" && aoAbrirDivida ? (
                <button type="button" onClick={() => aoAbrirDivida(v.id)} className="inline-flex items-center gap-1 text-sm text-verde hover:underline">
                  Abrir <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Link href={v.href} className="inline-flex items-center gap-1 text-sm text-verde hover:underline">
                  Abrir <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              {v.tipo !== "divida" && (
                <Botao variante="secundario" className="h-8" disabled={ocupado} icone={<Link2Off className="h-4 w-4" />} onClick={() => desligar(v.tipo, v.id)}>
                  Desligar
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
