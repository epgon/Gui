"use client";

import { AlertTriangle, CalendarClock, CalendarCheck, ChevronRight, HandCoins, Landmark, ListChecks, MessageSquareText, Percent, PieChart, Settings2, Sparkles, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MenuLinha, type ItemMenuLinha } from "@/components/cadastros/menu-linha";
import { ListaAlertas } from "@/components/dividas/alertas";
import { AbasDividas, BarraProgresso, MiniEvolucao, PilulaSituacao } from "@/components/dividas/comuns";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { BotaoOlho, ProvedorOcultar, useOcultarValores, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { GraficoRosca } from "@/components/visao-geral/graficos";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import type { Alerta } from "@/lib/dividas/consultor/regras";
import type { PrevisaoQuitacao } from "@/lib/dividas/painel";
import { estaAtiva, rotuloTipoDivida } from "@/lib/dividas/regras";
import type { LinhaDivida, ResumoDividas } from "@/lib/dividas/tipos";

type Fatia = { id: number | null; nome: string; cor: string; percentual: number; valorCentavos: number };

export type DadosVisaoGeralDividas = {
  resumo: ResumoDividas;
  linhas: LinhaDivida[];
  jurosMesCentavos: number;
  parcelasMesCentavos: number;
  percentualRenda: number | null;
  nivelRenda: "ok" | "atencao" | "alta";
  limitesRenda: { atencao: number; alta: number };
  previsao: PrevisaoQuitacao;
  evolucao: { mes: string; totalCentavos: number }[];
  porCredor: Fatia[];
  porTipo: Fatia[];
  visiveis: Alerta[];
  escondidos: Alerta[];
};

const COR_NIVEL = { ok: "verde", atencao: "amarelo", alta: "laranja" } as const;
const TEXTO_NIVEL = { ok: "Dentro do limite", atencao: "Atenção: acima do limite", alta: "Alta: acima do limite alto" } as const;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Visão Geral do módulo: indicadores e, abaixo, as Análises e recomendações do Consultor Gui. */
export function TelaVisaoGeralDividas({ dados, abertas, hoje }: { dados: DadosVisaoGeralDividas; abertas: { quantidade: number; valorCentavos: number }; hoje: string }) {
  const { resumo, linhas } = dados;
  const ativas = linhas.filter((d) => estaAtiva(d.situacao));
  const [roscaPor, setRoscaPor] = useState<"credor" | "tipo">("credor");
  const fatias = roscaPor === "credor" ? dados.porCredor : dados.porTipo;
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
            <TotalDevido dados={dados} />
            <Indicador titulo="Em atraso" icone={<AlertTriangle className="h-5 w-5 text-despesa" />} href="/gestao/dividas/minhas?situacao=em_atraso" dica="Parcelas vencidas e não pagas das dívidas ativas.">
              <ValorOcultavel centavos={-resumo.atrasoCentavos || 0} className="text-3xl" />
              <p className="mt-1 text-xs text-gray-500">
                {resumo.atrasoParcelas === 0 ? "Nenhuma parcela vencida" : `${plural(resumo.atrasoParcelas, "parcela", "parcelas")}, a mais antiga há ${plural(resumo.atrasoMaisAntigaDias, "dia", "dias")}`}
              </p>
            </Indicador>
            <Indicador titulo="Vence em 30 dias" icone={<CalendarClock className="h-5 w-5 text-dourado" />} href="/gestao/dividas/minhas" dica="Parcelas que vencem de hoje até daqui a 30 dias.">
              <ValorOcultavel centavos={-resumo.vence30Centavos} className="text-3xl" />
              <p className="mt-1 text-xs text-gray-500">{resumo.vence30Parcelas === 0 ? "Nada vence neste período" : plural(resumo.vence30Parcelas, "parcela", "parcelas")}</p>
            </Indicador>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <ParcelasDoMes dados={dados} />
            <Indicador titulo="Juros estimados por mês" icone={<Percent className="h-5 w-5 text-despesa" />} href="/gestao/dividas/minhas" dica="Saldo de cada dívida com taxa vezes a taxa ao mês. Dívidas sem taxa informada não entram.">
              <ValorOcultavel centavos={-dados.jurosMesCentavos || 0} className="text-3xl" />
              <p className="mt-1 text-xs text-gray-500">{dados.jurosMesCentavos > 0 ? "É quanto as dívidas com taxa custam por mês (estimativa)" : "Nenhuma dívida com taxa informada"}</p>
            </Indicador>
            <Previsao previsao={dados.previsao} />
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
              <div className="mt-4 border-t border-borda pt-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">Contas em aberto no Gui:</span>{" "}
                  {abertas.quantidade === 0 ? "nenhuma fatura fechada ou despesa vencida fora das suas dívidas." : `${plural(abertas.quantidade, "conta", "contas")} que você pode acompanhar como dívida.`}
                </p>
                {abertas.quantidade > 0 && (
                  <p className="mt-1">
                    <ValorOcultavel centavos={-abertas.valorCentavos || 0} className="text-xl" />
                  </p>
                )}
                <Link href="/gestao/dividas/minhas#contas-em-aberto" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-verde hover:underline">
                  <ListChecks className="h-4 w-4" /> Ver contas em aberto <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </Cartao>
            <CartaoRosca fatias={fatias} por={roscaPor} aoTrocar={setRoscaPor} />
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

          <section id="analises" aria-labelledby="analises-titulo" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="analises-titulo" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Sparkles className="h-5 w-5 text-verde" /> Análises e recomendações
              </h2>
              <Link href="/gestao/dividas/consultor" className="inline-flex items-center gap-1 text-sm font-medium text-verde hover:underline">
                <MessageSquareText className="h-4 w-4" /> Perguntar ao Consultor Gui
              </Link>
            </div>
            <p className="-mt-1 text-xs text-gray-500">Calculado agora com os seus dados, em ordem de gravidade. São contas e regras claras, não um conselho profissional: a decisão é sempre sua.</p>
            <ListaAlertas visiveis={dados.visiveis} escondidos={dados.escondidos} vazio="Nenhum alerta por enquanto. Quando algo precisar da sua atenção, aparece aqui com o cálculo." />
          </section>

          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <TrendingDown className="h-3.5 w-3.5" /> Os valores em atraso são estimativas (multa e juros de mora). O saldo certo é o que o credor informa: use Atualizar saldo em Minhas Dívidas. Atualizado em {formatarData(hoje)}.
          </p>
        </ProvedorOcultar>
      )}
    </>
  );
}

function TotalDevido({ dados }: { dados: DadosVisaoGeralDividas }) {
  const [ocultar] = useOcultarValores();
  const { resumo } = dados;
  return (
    <Indicador titulo="Total devido" icone={<Landmark className="h-5 w-5 text-despesa" />} destaque href="/gestao/dividas/minhas" dica="Soma do saldo devedor das dívidas ativas.">
      <ValorOcultavel centavos={-resumo.totalDevidoCentavos || 0} className="text-3xl" />
      <p className="mt-1 text-xs text-gray-500">
        {plural(resumo.dividasAtivas, "dívida ativa", "dívidas ativas")}
        {resumo.estimado ? " · inclui valores estimados" : ""}
      </p>
      <div className="mt-2">
        <MiniEvolucao serie={dados.evolucao} ocultar={ocultar} />
        {dados.evolucao.length >= 2 && <p className="text-[11px] text-gray-400">Últimos {dados.evolucao.length} meses (pelas parcelas)</p>}
      </div>
    </Indicador>
  );
}

function ParcelasDoMes({ dados }: { dados: DadosVisaoGeralDividas }) {
  const p = dados.percentualRenda;
  const router = useRouter();
  return (
    <Indicador
      titulo="Parcelas do mês"
      icone={<CalendarCheck className="h-5 w-5 text-verde" />}
      href="/gestao/dividas/minhas"
      dica="O que as dívidas tiram deste mês (parcelas com vencimento no mês) e quanto isso é da sua renda média."
      itens={[{ rotulo: "Alterar os limites", icone: <Settings2 className="h-4 w-4" />, aoClicar: () => router.push("/configuracoes/parametros?secao=dividas") }]}
    >
      <ValorOcultavel centavos={-dados.parcelasMesCentavos || 0} className="text-3xl" />
      {p === null ? (
        <p className="mt-1 text-xs text-gray-500">Ainda sem renda média para comparar (faltam meses fechados com receitas).</p>
      ) : (
        <>
          <p className="mt-1 flex items-center justify-between text-xs text-gray-600">
            <span>
              <span className="font-semibold text-gray-800">{p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span> da renda média
            </span>
            <span className={cn(dados.nivelRenda === "alta" ? "font-semibold text-despesa" : dados.nivelRenda === "atencao" ? "font-semibold text-amarelo-texto" : "text-gray-500")}>{TEXTO_NIVEL[dados.nivelRenda]}</span>
          </p>
          <BarraProgresso percentual={p} cor={COR_NIVEL[dados.nivelRenda]} rotulo="Parcelas do mês na renda" className="mt-1.5" />
          <p className="mt-1 text-[11px] text-gray-400">
            Verde até {dados.limitesRenda.atencao}%, amarelo até {dados.limitesRenda.alta}%, laranja acima.
          </p>
        </>
      )}
    </Indicador>
  );
}

function Previsao({ previsao }: { previsao: PrevisaoQuitacao }) {
  return (
    <Indicador titulo="Previsão de quitação" icone={<CalendarCheck className="h-5 w-5 text-pago-texto" />} href={previsao.tipo === "data" && previsao.doPlano ? "/gestao/dividas/plano" : "/gestao/dividas/simulador"} dica="Mês em que tudo acaba pagando só as parcelas. Quando há um Plano de Quitação ativo, vale a previsão dele, recalculada com o que falta pagar." labelMenu={previsao.tipo === "data" && previsao.doPlano ? "Ver o Plano de Quitação" : "Ver o Simulador"}>
      {previsao.tipo === "data" ? (
        <>
          <p className="text-3xl font-semibold capitalize text-gray-900">{previsao.rotulo}</p>
          <p className="mt-1 text-xs text-gray-500">
            Em {plural(previsao.meses, "mês", "meses")}, {previsao.doPlano ? "seguindo o plano de quitação ativo" : "pagando só as parcelas"}{previsao.aproximada ? " (aproximado: há dívida sem parcelas definidas)" : ""}
          </p>
        </>
      ) : previsao.tipo === "sem_previsao" ? (
        <>
          <p className="text-xl font-semibold text-gray-900">Sem previsão</p>
          <p className="mt-1 text-xs text-gray-500">{previsao.motivo}</p>
        </>
      ) : (
        <>
          <p className="text-xl font-semibold text-pago-texto">Tudo quitado</p>
          <p className="mt-1 text-xs text-gray-500">Nenhuma dívida ativa com saldo.</p>
        </>
      )}
    </Indicador>
  );
}

function CartaoRosca({ fatias, por, aoTrocar }: { fatias: Fatia[]; por: "credor" | "tipo"; aoTrocar: (p: "credor" | "tipo") => void }) {
  return (
    <section className="min-w-0 rounded-xl border border-borda bg-white p-4 shadow-cartao">
      <header className="mb-3 flex min-h-7 items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <PieChart className="h-5 w-5 text-verde" /> Dívidas por {por === "credor" ? "credor" : "tipo"}
        </h3>
        <MenuLinha
          rotulo="Dívidas por credor ou tipo"
          itens={[
            { rotulo: "Ver por credor", aoClicar: () => aoTrocar("credor"), desabilitado: por === "credor" },
            { rotulo: "Ver por tipo", aoClicar: () => aoTrocar("tipo"), desabilitado: por === "tipo" },
          ]}
        />
      </header>
      {fatias.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Nenhuma dívida ativa com saldo.</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <GraficoRosca
            fatias={fatias}
            centro={
              <>
                <span className="text-[11px] text-gray-500">Total</span>
                <ValorOcultavel centavos={-fatias.reduce((s, f) => s + f.valorCentavos, 0)} className="text-sm" />
              </>
            }
          />
          <ul className="w-full space-y-1.5 text-sm">
            {fatias.map((f) => (
              <li key={f.nome} className="flex items-center gap-2 rounded px-1 py-0.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
                <span className="min-w-0 flex-1 truncate text-gray-700">{f.nome}</span>
                <span className="w-12 text-right text-xs font-semibold text-gray-500">{f.percentual.toLocaleString("pt-BR")}%</span>
                <ValorOcultavel centavos={-f.valorCentavos} className="w-24 text-right text-sm" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Indicador({ titulo, icone, children, href, dica, destaque, itens, labelMenu = "Ver as dívidas" }: { titulo: string; icone: React.ReactNode; children: React.ReactNode; href: string; dica: string; destaque?: boolean; itens?: ItemMenuLinha[]; labelMenu?: string }) {
  const router = useRouter();
  return (
    <section className={cn("min-w-0 rounded-xl border border-borda bg-white p-4 shadow-cartao", destaque && "border-blue-100 bg-blue-50/60")} title={dica}>
      <header className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {icone}
          {titulo}
        </h3>
        <MenuLinha rotulo={titulo} itens={[{ rotulo: labelMenu, icone: <Settings2 className="h-4 w-4" />, aoClicar: () => router.push(href) }, ...(itens ?? [])]} />
      </header>
      {children}
    </section>
  );
}
