"use client";

import { comoSaida } from "@/lib/cartoes/regras";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Lock, LockOpen, RotateCcw, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { abrirFatura, desfazerPagamentoFatura, fecharFatura, moverCompra, pagarFatura, reabrirFatura } from "@/app/(sistema)/cadastros/cartoes-de-credito/faturas-acoes";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import type { SituacaoFatura } from "@/lib/cartoes/regras";
import { ROTULO_SITUACAO_FATURA } from "@/lib/cartoes/regras";
import type { DetalheFatura } from "@/lib/cartoes/servidor";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";

/** Pílula da situação da fatura (Aberta, Fechada, Paga ou Vencida). */
export function EtiquetaFatura({ situacao, vencida }: { situacao: SituacaoFatura; vencida?: boolean }) {
  const texto = situacao !== "paga" && vencida ? "Vencida" : ROTULO_SITUACAO_FATURA[situacao];
  const cor =
    situacao === "paga" ? "bg-pago-fundo text-pago-texto" : vencida ? "bg-orange-100 text-despesa" : situacao === "fechada" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-receita";
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", cor)}>{texto}</span>;
}

/**
 * Janela de uma fatura: compras, pagamentos e as ações Pagar, Desfazer pagamento, Fechar, Reabrir
 * e mover compra para outra fatura. aoMudar avisa quem abriu (para recarregar os totais).
 */
export function JanelaFatura({ faturaId, aoFechar, aoMudar }: { faturaId: number; aoFechar: () => void; aoMudar?: () => void }) {
  const [dados, setDados] = useState<DetalheFatura | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [contaId, setContaId] = useState("");
  const [data, setData] = useState("");
  const [confirmarDesfazer, setConfirmarDesfazer] = useState(false);
  const [carregando, iniciarCarga] = useTransition();
  const [ocupado, iniciar] = useTransition();

  const carregar = () =>
    iniciarCarga(async () => {
      try {
        const d = await abrirFatura(faturaId);
        if (!d) {
          setErro("Esta fatura não existe mais.");
          return;
        }
        setDados(d);
        setErro("");
        setData((atual) => atual || d.hoje);
        setContaId((atual) => atual || String(d.contas.find((c) => c.id === d.cartao?.contaPagamentoId)?.id ?? d.contas.find((c) => c.ativo)?.id ?? ""));
      } catch {
        setErro("Não foi possível carregar a fatura agora. Tente de novo.");
      }
    });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executar = (acao: () => Promise<{ ok: boolean; erro?: string }>) =>
    iniciar(async () => {
      setAviso("");
      try {
        const r = await acao();
        if (!r.ok) {
          setAviso(r.erro ?? "Não foi possível concluir.");
          return;
        }
        setConfirmarDesfazer(false);
        carregar();
        aoMudar?.();
      } catch {
        setAviso("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });

  const f = dados?.fatura;
  const c = dados?.cartao;
  const vencida = !!f && f.situacao !== "paga" && f.pendenteCentavos > 0 && f.dataVencimento < (dados?.hoje ?? "");

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        <span className="flex items-center gap-3">
          <IconeBanco codigo={c?.bancoCodigo ?? null} nome={c?.bancoNome ?? "Outro"} />
          <span>
            {f ? `Fatura de ${f.rotulo}` : "Fatura"}
            {f && c && (
              <span className="block text-sm font-normal text-gray-500">
                {c.descricao} · fecha {formatarData(f.dataFechamento)} · vence {formatarData(f.dataVencimento)}
              </span>
            )}
          </span>
        </span>
      }
      rodape={
        f && c ? (
          <>
            <Link
              href={`/financeiro/lancamentos?destino=cartao:${c.id}&mes=${f.dataVencimento.slice(0, 7)}`}
              className="mr-auto inline-flex h-9 items-center gap-1 text-sm font-semibold text-verde hover:underline"
            >
              Abrir em Lançamentos <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            {f.podeFechar && (
              <Botao variante="secundario" icone={<Lock className="h-4 w-4" />} carregando={ocupado} onClick={() => executar(() => fecharFatura(f.id))}>
                Fechar fatura
              </Botao>
            )}
            {f.podeReabrir && (
              <Botao variante="secundario" icone={<LockOpen className="h-4 w-4" />} carregando={ocupado} onClick={() => executar(() => reabrirFatura(f.id))}>
                Reabrir
              </Botao>
            )}
            {f.pagoCentavos > 0 &&
              (confirmarDesfazer ? (
                <Botao variante="perigo" icone={<RotateCcw className="h-4 w-4" />} carregando={ocupado} onClick={() => executar(() => desfazerPagamentoFatura(f.id))}>
                  Confirmar: desfazer pagamento
                </Botao>
              ) : (
                <Botao variante="secundario" icone={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmarDesfazer(true)}>
                  Desfazer pagamento
                </Botao>
              ))}
            <Botao variante="secundario" onClick={aoFechar}>
              Voltar
            </Botao>
          </>
        ) : undefined
      }
    >
      <ProvedorOcultar>
        {!f || !dados ? (
          <p className="py-10 text-center text-sm text-gray-500">{erro || "Carregando..."}</p>
        ) : (
          <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
            <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>
            {confirmarDesfazer && (
              <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-despesa">
                Desfazer apaga a saída de <strong>R$ {formatarCentavos(f.pagoCentavos)}</strong> da conta e as compras voltam a ficar em aberto. Clique em
                &quot;Confirmar&quot; no rodapé para seguir.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-4">
              <Quadro titulo="Situação">
                <EtiquetaFatura situacao={f.situacao} vencida={vencida} />
              </Quadro>
              <Quadro titulo="Total da Fatura" dica="Compras menos estornos desta fatura.">
                <ValorOcultavel centavos={comoSaida(f.totalCentavos)} />
              </Quadro>
              <Quadro titulo="Pago">
                <ValorOcultavel centavos={f.pagoCentavos} />
                {f.ultimoPagamento && <span className="block text-xs text-gray-500">em {formatarData(f.ultimoPagamento)}</span>}
              </Quadro>
              <Quadro titulo="A pagar" destaque={f.pendenteCentavos > 0}>
                <ValorOcultavel centavos={comoSaida(Math.max(0, f.pendenteCentavos))} />
              </Quadro>
            </div>

            {f.podePagar && (
              <div className="rounded-lg border border-verde/30 bg-verde-claro/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-verde">
                  <Wallet className="h-4 w-4" /> Pagar fatura
                </p>
                {dados.contas.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    Cadastre uma <Link href="/cadastros/contas-financeiras" className="font-semibold text-verde underline">Conta Financeira</Link> para pagar a fatura.
                  </p>
                ) : (
                  <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <CampoSelecao
                      rotulo="Conta para Pagamento"
                      obrigatorio
                      ajuda="De onde o dinheiro sai. O padrão é a conta escolhida no cadastro do cartão."
                      valor={contaId}
                      aoMudar={setContaId}
                      opcoes={[{ valor: "", rotulo: "Selecione" }, ...dados.contas.map((x) => ({ valor: String(x.id), rotulo: x.ativo ? x.descricao : `${x.descricao} (inativa)` }))]}
                    />
                    <CampoTexto rotulo="Data do Pagamento" obrigatorio type="date" valor={data} aoMudar={setData} ajuda="Dia em que o dinheiro saiu da conta." />
                    <Botao icone={<CheckCircle2 className="h-4 w-4" />} carregando={ocupado} onClick={() => executar(() => pagarFatura(f.id, { contaId, data }))}>
                      Pagar R$ {formatarCentavos(f.pendenteCentavos)}
                    </Botao>
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  O pagamento sai da conta, mas não conta como despesa de novo: os gastos já estão nas compras, cada uma na sua categoria.
                </p>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-borda">
              <div className="flex items-center justify-between border-b border-borda bg-subcabecalho px-3 py-2 text-sm font-semibold text-gray-700">
                <span>
                  Compras ({f.compras})
                </span>
                <ValorOcultavel centavos={comoSaida(f.totalCentavos)} className="text-sm" />
              </div>
              <ul className="max-h-80 divide-y divide-borda overflow-y-auto text-sm">
                {dados.compras.length === 0 && <li className="px-3 py-8 text-center text-gray-500">Nenhuma compra nesta fatura.</li>}
                {dados.compras.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-12 shrink-0 text-xs text-gray-500">{formatarData(x.dataCompra).slice(0, 5)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-gray-800">{x.descricao}</span>
                        {x.parcela && !x.descricao.includes(x.parcela) && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{x.parcela}</span>}
                      </span>
                      {x.categoria && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: x.categoriaCor ?? "#9CA3AF" }} />
                          {x.categoria}
                        </span>
                      )}
                    </span>
                    {x.pago && <CheckCircle2 className="h-4 w-4 shrink-0 text-pago-texto" aria-label="Paga com a fatura" />}
                    <ValorOcultavel centavos={x.valorCentavos} className="w-28 shrink-0 text-right" />
                    <span className="w-8 shrink-0">
                      {!x.pago && (
                        <MenuLinha
                          rotulo={x.descricao}
                          itens={[
                            { rotulo: "Mover para a fatura anterior", icone: <ArrowLeft className="h-4 w-4" />, aoClicar: () => executar(() => moverCompra(x.id, -1)) },
                            { rotulo: "Mover para a próxima fatura", icone: <ArrowRight className="h-4 w-4" />, aoClicar: () => executar(() => moverCompra(x.id, 1)) },
                          ]}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {dados.pagamentos.length > 0 && (
              <div className="rounded-lg border border-borda">
                <p className="border-b border-borda bg-subcabecalho px-3 py-2 text-sm font-semibold text-gray-700">Pagamentos</p>
                <ul className="divide-y divide-borda text-sm">
                  {dados.pagamentos.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-20 shrink-0 text-xs text-gray-500">{formatarData(p.dataPagamento)}</span>
                      <span className="flex-1 text-gray-700">{p.conta}</span>
                      <ValorOcultavel centavos={comoSaida(p.valorCentavos)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </ProvedorOcultar>
    </Modal>
  );
}

export function Quadro({ titulo, dica, children, destaque, className }: { titulo: string; dica?: string; children: React.ReactNode; destaque?: boolean; className?: string }) {
  return (
    <div title={dica} className={cn("rounded-lg border p-3", destaque ? "border-blue-100 bg-blue-50/70" : "border-borda bg-white", className)}>
      <p className="text-xs font-medium text-gray-500">{titulo}</p>
      <div className="mt-1 text-lg">{children}</div>
    </div>
  );
}
