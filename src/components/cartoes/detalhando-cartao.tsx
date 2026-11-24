"use client";

import { comoSaida } from "@/lib/cartoes/regras";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { detalharCartao } from "@/app/(sistema)/cadastros/cartoes-de-credito/faturas-acoes";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { GraficoRosca } from "@/components/visao-geral/graficos";
import type { SituacaoFatura } from "@/lib/cartoes/regras";
import type { DetalheCartao } from "@/lib/cartoes/servidor";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { EtiquetaFatura, JanelaFatura, Quadro } from "./janela-fatura";

export type AbaCartao = "resumo" | "faturas";
type FiltroFaturas = "todas" | SituacaoFatura;

/**
 * Janela "Detalhando Cartão de Crédito" (abas Resumo e Faturas).
 * Quem usa mostra a janela só quando há cartão escolhido: {id && <DetalhandoCartao key={id} cartaoId={id} ... />}
 */
export function DetalhandoCartao({ cartaoId, abaInicial = "resumo", aoFechar }: { cartaoId: number; abaInicial?: AbaCartao; aoFechar: () => void }) {
  const [dados, setDados] = useState<DetalheCartao | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<AbaCartao>(abaInicial);
  const [faturaAberta, setFaturaAberta] = useState<number | null>(null);
  const [carregando, iniciar] = useTransition();

  const carregar = () =>
    iniciar(async () => {
      try {
        const d = await detalharCartao(cartaoId);
        if (d) {
          setDados(d);
          setErro("");
        } else setErro("Cartão não encontrado.");
      } catch {
        setErro("Não foi possível carregar o cartão agora. Tente de novo.");
      }
    });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = dados?.cartao;
  return (
    <>
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        <span className="flex items-center gap-3">
          <IconeBanco codigo={c?.bancoCodigo ?? null} nome={c?.bancoNome ?? "Outro"} />
          <span>
            Detalhando Cartão de Crédito
            {c && <span className="block text-sm font-normal text-gray-500">{[`#${c.id}`, c.descricao, c.bancoNome].join(" · ")}</span>}
          </span>
        </span>
      }
      resumo={
        dados && !dados.limite.ilimitado ? (
          <span className="flex items-center gap-1">
            Disponível: <ValorOcultavel centavos={dados.limite.disponivel ?? 0} className="text-sm" />
          </span>
        ) : undefined
      }
    >
      <ProvedorOcultar>
        {!dados ? (
          <p className="py-10 text-center text-sm text-gray-500">{erro || "Carregando..."}</p>
        ) : (
          <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
            <div role="tablist" className="flex gap-1 border-b border-borda">
              {(["resumo", "faturas"] as const).map((a) => (
                <button
                  key={a}
                  role="tab"
                  type="button"
                  aria-selected={aba === a}
                  onClick={() => setAba(a)}
                  className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", aba === a ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}
                >
                  {a === "resumo" ? "Resumo" : "Faturas"}
                </button>
              ))}
            </div>
            {aba === "resumo" ? <Resumo d={dados} aoAbrirFatura={setFaturaAberta} /> : <Faturas d={dados} aoAbrirFatura={setFaturaAberta} />}
          </div>
        )}
      </ProvedorOcultar>
    </Modal>
    {faturaAberta !== null && <JanelaFatura key={faturaAberta} faturaId={faturaAberta} aoFechar={() => setFaturaAberta(null)} aoMudar={carregar} />}
    </>
  );
}

function Resumo({ d, aoAbrirFatura }: { d: DetalheCartao; aoAbrirFatura: (id: number) => void }) {
  const { limite, atual, cartao: c } = d;
  const vencida = atual.situacao !== "paga" && atual.pendenteCentavos > 0 && atual.dataVencimento < d.hoje;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Quadro titulo={`Fatura Atual (${atual.rotulo})`} destaque dica="A fatura fechada que falta pagar ou, se não houver, a que está recebendo as compras de hoje.">
          <span className="flex items-center justify-between gap-2">
            <ValorOcultavel centavos={comoSaida(Math.max(0, atual.totalCentavos))} className="text-2xl text-receita" />
            <EtiquetaFatura situacao={atual.situacao} vencida={vencida} />
          </span>
        </Quadro>
        <Quadro titulo="Próximas Faturas" dica="O que já está lançado nas faturas seguintes (parcelas e compras futuras).">
          <ValorOcultavel centavos={comoSaida(d.proximas)} className="text-2xl" />
        </Quadro>
      </div>

      <div className="grid gap-4 rounded-lg border border-borda p-4 sm:grid-cols-[auto_1fr]">
        {limite.ilimitado ? (
          <div className="flex h-40 w-40 items-center justify-center rounded-full border-[14px] border-blue-100 text-center text-sm font-semibold text-receita">Ilimitado</div>
        ) : (
          <GraficoRosca
            fatias={[
              { nome: "Usado", cor: "#E04F16", percentual: limite.percentualUsado },
              { nome: "Disponível", cor: "#1D6CE0", percentual: limite.percentualDisponivel },
            ].filter((x) => x.percentual > 0)}
            centro={
              <>
                <span className="text-[11px] text-gray-500">Limite</span>
                <ValorOcultavel centavos={limite.limite} className="text-sm" />
              </>
            }
          />
        )}
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-subcabecalho px-3 py-2">
              <p className="text-xs text-gray-500">Fecha dia</p>
              <p className="text-lg font-semibold text-gray-800">{c.diaFechamento}</p>
            </div>
            <div className="rounded-md bg-subcabecalho px-3 py-2">
              <p className="text-xs text-gray-500">Vence dia</p>
              <p className="text-lg font-semibold text-gray-800">{c.diaVencimento}</p>
            </div>
          </div>
          {!limite.ilimitado && (
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-receita" />
                <span className="flex-1 text-gray-600">Limite Disponível ({limite.percentualDisponivel.toLocaleString("pt-BR")}%)</span>
                <ValorOcultavel centavos={limite.disponivel ?? 0} />
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-despesa" />
                <span className="flex-1 text-gray-600">Limite Usado ({limite.percentualUsado.toLocaleString("pt-BR")}%)</span>
                <ValorOcultavel centavos={comoSaida(limite.usado)} />
              </li>
            </ul>
          )}
          <p className="text-xs text-gray-500">O limite usado soma tudo o que ainda não foi pago, inclusive as parcelas das próximas faturas.</p>
          {c.contaPagamento && <p className="text-xs text-gray-500">Conta para pagamento: {c.contaPagamento}</p>}
        </div>
      </div>

      <div className="rounded-lg border border-borda p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Informações da Fatura</h3>
        {atual.id === null ? (
          <p className="text-sm text-gray-500">
            Nenhuma compra na fatura de {atual.rotulo} ainda (fecha {formatarData(atual.dataFechamento)}, vence {formatarData(atual.dataVencimento)}).
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>
              <span className="text-gray-500">Fechamento:</span> {formatarData(atual.dataFechamento)}
            </span>
            <span>
              <span className="text-gray-500">Vencimento:</span> {formatarData(atual.dataVencimento)}
            </span>
            <span>
              <span className="text-gray-500">Compras:</span> {atual.compras}
            </span>
            <span>
              <span className="text-gray-500">A pagar:</span> <ValorOcultavel centavos={comoSaida(Math.max(0, atual.pendenteCentavos))} className="text-sm" />
            </span>
            <Botao variante="secundario" className="ml-auto" icone={<FileText className="h-4 w-4" />} onClick={() => aoAbrirFatura(atual.id!)}>
              {atual.pendenteCentavos > 0 ? "Abrir e pagar" : "Abrir fatura"}
            </Botao>
          </div>
        )}
      </div>
    </div>
  );
}

const FILTROS: { valor: FiltroFaturas; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "aberta", rotulo: "Abertas" },
  { valor: "fechada", rotulo: "Fechadas" },
  { valor: "paga", rotulo: "Pagas" },
];

function Faturas({ d, aoAbrirFatura }: { d: DetalheCartao; aoAbrirFatura: (id: number) => void }) {
  const anoHoje = Number(d.hoje.slice(0, 4));
  const anos = d.faturas.map((f) => Number(f.dataVencimento.slice(0, 4)));
  const [ano, setAno] = useState(anos.includes(anoHoje) || !anos.length ? anoHoje : Math.max(...anos));
  const [filtro, setFiltro] = useState<FiltroFaturas>("todas");
  const lista = d.faturas.filter((f) => Number(f.dataVencimento.slice(0, 4)) === ano && (filtro === "todas" || f.situacao === filtro));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md bg-subcabecalho p-1">
          {FILTROS.map((x) => (
            <button
              key={x.valor}
              type="button"
              onClick={() => setFiltro(x.valor)}
              className={cn("rounded px-3 py-1 text-sm font-semibold", filtro === x.valor ? "bg-white text-verde shadow-cartao" : "text-gray-500 hover:text-gray-800")}
            >
              {x.rotulo}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setAno(ano - 1)} aria-label="Ano anterior" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-14 text-center text-sm font-semibold text-gray-800">{ano}</span>
          <button type="button" onClick={() => setAno(ano + 1)} aria-label="Ano seguinte" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-borda">
        <ul className="max-h-96 divide-y divide-borda overflow-y-auto text-sm">
          {lista.length === 0 && <li className="px-3 py-8 text-center text-gray-500">Nenhuma fatura disponível.</li>}
          {lista.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => aoAbrirFatura(f.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-verde-claro/50" title="Abrir a fatura">
                <span className="w-20 shrink-0 font-semibold text-gray-800 capitalize">{f.rotulo}</span>
                <span className="min-w-0 flex-1 text-xs text-gray-500">
                  Fecha {formatarData(f.dataFechamento)} · vence {formatarData(f.dataVencimento)} · {f.compras} {f.compras === 1 ? "compra" : "compras"}
                </span>
                <EtiquetaFatura situacao={f.situacao} vencida={f.situacao !== "paga" && f.pendenteCentavos > 0 && f.dataVencimento < d.hoje} />
                <ValorOcultavel centavos={comoSaida(f.totalCentavos)} className="w-28 shrink-0 text-right" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Link href={`/financeiro/lancamentos?destino=cartao:${d.cartao.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-verde hover:underline">
        Ver as compras em Lançamentos <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
