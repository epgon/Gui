"use client";

import { AlertTriangle, CalendarClock, ChevronRight, HandCoins, Landmark, ListChecks, Settings2, TrendingDown } from "lucide-react";
import Link from "next/link";
import { AbasDividas, BarraProgresso, PilulaSituacao } from "@/components/dividas/comuns";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { BotaoOlho, ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Cartao } from "@/components/ui/cartao";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { rotuloTipoDivida } from "@/lib/dividas/regras";
import type { LinhaDivida, ResumoDividas } from "@/lib/dividas/tipos";

/** Visão Geral do módulo (versão simples da D1): Total devido, Em atraso e Vence em 30 dias. */
export function TelaVisaoGeralDividas({ resumo, linhas, abertas, hoje }: { resumo: ResumoDividas; linhas: LinhaDivida[]; abertas: { quantidade: number; valorCentavos: number }; hoje: string }) {
  const ativas = linhas.filter((d) => d.situacao === "em_dia" || d.situacao === "em_atraso");
  return (
    <>
      <AbasDividas ativa="/gestao/dividas" />
      {linhas.length === 0 ? (
        <Cartao>
          <EstadoVazio titulo="Você ainda não cadastrou dívidas" texto="Cadastre um empréstimo, financiamento ou conta atrasada para acompanhar o saldo, as parcelas e os pagamentos num lugar só. As parcelas aparecem em Lançamentos como contas a pagar." acao={{ rotulo: "Cadastrar dívida", href: "/gestao/dividas/minhas?nova=1" }} />
          <p className="pb-6 text-center text-sm">
            <Link href="/gestao/dividas/minhas#contas-em-aberto" className="text-verde hover:underline">
              Ver contas em aberto no Gui
            </Link>
            {abertas.quantidade > 0 && <span className="text-gray-500"> ({abertas.quantidade} {abertas.quantidade === 1 ? "conta" : "contas"})</span>}
          </p>
        </Cartao>
      ) : (
        <ProvedorOcultar>
          <div className="flex items-center gap-1">
            <h2 className="text-lg font-semibold text-gray-900">Como estão suas dívidas</h2>
            <BotaoOlho />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Indicador titulo="Total devido" icone={<Landmark className="h-5 w-5 text-despesa" />} destaque href="/gestao/dividas/minhas" dica="Soma do saldo devedor das dívidas ativas.">
              <ValorOcultavel centavos={-resumo.totalDevidoCentavos || 0} className="text-3xl" />
              <p className="mt-1 text-xs text-gray-500">
                {resumo.dividasAtivas} {resumo.dividasAtivas === 1 ? "dívida ativa" : "dívidas ativas"}
                {resumo.estimado ? " · inclui valores estimados" : ""}
              </p>
            </Indicador>
            <Indicador titulo="Em atraso" icone={<AlertTriangle className="h-5 w-5 text-despesa" />} href="/gestao/dividas/minhas?situacao=em_atraso" dica="Parcelas vencidas e não pagas das dívidas ativas.">
              <ValorOcultavel centavos={-resumo.atrasoCentavos || 0} className="text-3xl" />
              <p className="mt-1 text-xs text-gray-500">
                {resumo.atrasoParcelas === 0 ? "Nenhuma parcela vencida" : `${resumo.atrasoParcelas} ${resumo.atrasoParcelas === 1 ? "parcela" : "parcelas"}, a mais antiga há ${resumo.atrasoMaisAntigaDias} ${resumo.atrasoMaisAntigaDias === 1 ? "dia" : "dias"}`}
              </p>
            </Indicador>
            <Indicador titulo="Vence em 30 dias" icone={<CalendarClock className="h-5 w-5 text-dourado" />} href="/gestao/dividas/minhas" dica="Parcelas que vencem de hoje até daqui a 30 dias.">
              <ValorOcultavel centavos={-resumo.vence30Centavos} className="text-3xl" />
              <p className="mt-1 text-xs text-gray-500">{resumo.vence30Parcelas === 0 ? "Nada vence neste período" : `${resumo.vence30Parcelas} ${resumo.vence30Parcelas === 1 ? "parcela" : "parcelas"}`}</p>
            </Indicador>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao titulo="Progresso do pagamento">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Já pago</span>
                <span className="font-semibold text-gray-800">{resumo.progresso}%</span>
              </div>
              <BarraProgresso percentual={resumo.progresso} className="mt-2" />
              <p className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Pago: <ValorOcultavel centavos={-resumo.pagoCentavos || 0} className="text-xs" />
                </span>
                <span>
                  Falta: <ValorOcultavel centavos={-resumo.totalDevidoCentavos || 0} className="text-xs" />
                </span>
              </p>
            </Cartao>
            <Cartao titulo="Contas em aberto no Gui">
              <p className="text-sm text-gray-600">
                {abertas.quantidade === 0 ? "Nenhuma fatura fechada ou despesa vencida fora das suas dívidas." : `${abertas.quantidade} ${abertas.quantidade === 1 ? "conta" : "contas"} (faturas fechadas e despesas vencidas) que você pode acompanhar como dívida.`}
              </p>
              {abertas.quantidade > 0 && (
                <p className="mt-1">
                  <ValorOcultavel centavos={-abertas.valorCentavos || 0} className="text-xl" />
                </p>
              )}
              <Link href="/gestao/dividas/minhas#contas-em-aberto" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-verde hover:underline">
                <ListChecks className="h-4 w-4" /> Ver contas em aberto <ChevronRight className="h-4 w-4" />
              </Link>
            </Cartao>
          </div>

          <Cartao titulo="Dívidas ativas">
            {ativas.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">Nenhuma dívida ativa. Tudo quitado!</p>
            ) : (
              <ul className="divide-y divide-borda">
                {ativas.map((d) => (
                  <li key={d.id}>
                    <Link href={`/gestao/dividas/minhas?detalhar=${d.id}`} className="flex items-center gap-3 rounded-md px-1 py-2.5 hover:bg-verde-claro/50">
                      <HandCoins className="h-5 w-5 shrink-0 text-verde" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{d.descricao}</span>
                        <span className="block truncate text-xs text-gray-500">
                          {d.credor} · {rotuloTipoDivida(d.tipo).replace(" (rotativo ou parcelamento de fatura)", "")}
                          {d.proximoVencimento ? ` · próximo vencimento ${formatarData(d.proximoVencimento)}` : ""}
                        </span>
                      </span>
                      <PilulaSituacao situacao={d.situacao} diasAtraso={d.diasAtraso} />
                      <span className={cn("w-28 text-right")}>
                        <ValorOcultavel centavos={-d.saldo.exibido || 0} />
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <TrendingDown className="h-3.5 w-3.5" /> Os valores em atraso são estimativas (multa e juros de mora). O saldo certo é o que o credor informa: use Atualizar saldo em Minhas Dívidas. Atualizado em {formatarData(hoje)}.
          </p>
        </ProvedorOcultar>
      )}
    </>
  );
}

function Indicador({ titulo, icone, children, href, dica, destaque }: { titulo: string; icone: React.ReactNode; children: React.ReactNode; href: string; dica: string; destaque?: boolean }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-borda bg-white p-4 shadow-cartao", destaque && "border-blue-100 bg-blue-50/60")} title={dica}>
      <header className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {icone}
          {titulo}
        </h3>
        <MenuLinha rotulo={titulo} itens={[{ rotulo: "Ver as dívidas", icone: <Settings2 className="h-4 w-4" />, aoClicar: () => window.location.assign(href) }]} />
      </header>
      {children}
    </section>
  );
}
