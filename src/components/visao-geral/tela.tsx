"use client";

import { comoSaida } from "@/lib/cartoes/regras";
import { AlertTriangle, ArrowDown, ArrowLeftRight, ArrowUp, CalendarCheck, CalendarClock, CalendarX, ChevronRight, ExternalLink, Settings2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarOpcoesVisaoGeral } from "@/app/(sistema)/visao-geral-acoes";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { DetalhandoCartao } from "@/components/cartoes/detalhando-cartao";
import { EtiquetaFatura } from "@/components/cartoes/janela-fatura";
import { DetalhandoConta } from "@/components/contas/detalhando-conta";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { BotaoOlho, ProvedorOcultar, useOcultarValores, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import type { OpcoesVisaoGeral, Prazo } from "@/lib/visao-geral/regras";
import type { carregarPainel } from "@/lib/visao-geral/servidor";
import { GraficoRosca, MiniGrafico } from "./graficos";

export type Painel = Awaited<ReturnType<typeof carregarPainel>>;
type QualOpcao = "vencidos" | "futuro" | "contas" | "categorias" | "faturas";
type QualPrazo = "vencidos" | "vencendo" | "futuro";

const LANCAMENTOS = "/financeiro/lancamentos";

/** Cabeçalho da Visão Geral: saudação, olho, aviso do dia e botões de adicionar. */
export function CabecalhoVisaoGeral({ saudacao, data, aviso }: { saudacao: string; data: string; aviso: { texto: string; alerta: boolean } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-1">
          <h2 className="text-xl font-semibold text-gray-900">{saudacao}</h2>
          <BotaoOlho />
        </div>
        <p className="text-sm text-gray-500 first-letter:uppercase">{data}</p>
        <p className={cn("mt-1 flex items-center gap-1.5 text-sm", aviso.alerta ? "font-medium text-despesa" : "text-gray-600")}>
          {aviso.alerta ? <AlertTriangle className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4 text-pago-texto" />}
          {aviso.texto}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adicionar</span>
        <AtalhoNovo href={`${LANCAMENTOS}?novo=despesa`} rotulo="Despesa" icone={<ArrowUp className="h-4 w-4 text-despesa" />} />
        <AtalhoNovo href={`${LANCAMENTOS}?novo=receita`} rotulo="Receita" icone={<ArrowDown className="h-4 w-4 text-receita" />} />
        <AtalhoNovo href={`${LANCAMENTOS}?novo=transferencia`} rotulo="Transferência" icone={<ArrowLeftRight className="h-4 w-4 text-verde" />} />
      </div>
    </div>
  );
}

function AtalhoNovo({ href, rotulo, icone }: { href: string; rotulo: string; icone: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-borda bg-white px-3 text-sm font-semibold text-gray-700 shadow-cartao hover:border-verde hover:text-verde">
      {icone}
      {rotulo}
    </Link>
  );
}

/** Cartões do painel. */
export function TelaVisaoGeral({ painel, hoje }: { painel: Painel; hoje: string }) {
  const [opcaoAberta, setOpcaoAberta] = useState<QualOpcao | null>(null);
  const [prazoAberto, setPrazoAberto] = useState<QualPrazo | null>(null);
  const [contaAberta, setContaAberta] = useState<number | null>(null);
  const [cartaoAberto, setCartaoAberto] = useState<number | null>(null);
  const [ocultar] = useOcultarValores();
  const router = useRouter();
  const { prazos, mesAtual, opcoes } = painel;
  const mesRotulo = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(hoje + "T12:00:00Z"));
  const contasVisiveis = painel.contas.filter((c) => c.ativo && !opcoes.contasOcultas.includes(c.id));
  const faturasVisiveis = painel.faturas.filter((f) => !opcoes.cartoesOcultos.includes(f.cartao.id));

  return (
    <ProvedorOcultar>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Saldo Atual */}
        <CartaoPainel
          titulo="Saldo Atual"
          className="border-blue-100 bg-blue-50/60"
          menu={[{ rotulo: "Escolher contas do saldo", aoClicar: () => router.push("/cadastros/contas-financeiras") }]}
        >
          <p className="text-xs text-gray-500" title="Tudo o que já foi pago ou recebido até hoje nas contas marcadas &quot;Considerar nos saldos&quot;.">
            Soma das contas que entram nos saldos
          </p>
          <ValorOcultavel centavos={painel.saldoAtual} className="text-3xl" />
          <MiniGrafico serie={painel.serie} ocultar={ocultar} />
          <p className="text-[11px] text-gray-400">Últimos 30 dias</p>
        </CartaoPainel>

        {/* Receitas e Despesas no mês */}
        <CartaoPainel titulo={<span className="first-letter:uppercase">{`Receitas e despesas de ${mesRotulo}`}</span>}>
          <div className="grid grid-cols-2 divide-x divide-borda">
            <Link href={`${LANCAMENTOS}?aba=receitas`} className="group pr-4" title="Ver as receitas do mês">
              <p className="flex items-center gap-1 text-sm font-medium text-gray-600 group-hover:text-verde">
                <ArrowDown className="h-4 w-4 text-receita" /> Receitas no mês
              </p>
              <ValorOcultavel centavos={mesAtual.receitas} className="text-2xl" />
              <p className="mt-1 text-xs text-gray-500">
                Recebido: <ValorOcultavel centavos={mesAtual.recebido} className="text-xs" />
              </p>
            </Link>
            <Link href={`${LANCAMENTOS}?aba=despesas`} className="group pl-4" title="Ver as despesas do mês">
              <p className="flex items-center gap-1 text-sm font-medium text-gray-600 group-hover:text-verde">
                <ArrowUp className="h-4 w-4 text-despesa" /> Despesas no mês
              </p>
              <ValorOcultavel centavos={-mesAtual.despesas} className="text-2xl" />
              <p className="mt-1 text-xs text-gray-500">
                Pago: <ValorOcultavel centavos={-mesAtual.pago} className="text-xs" />
              </p>
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-subcabecalho px-3 py-2 text-sm">
            <span className="font-medium text-gray-600">Resultado do mês</span>
            <ValorOcultavel centavos={mesAtual.receitas - mesAtual.despesas} />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Inclui o que ainda vai vencer no mês (recorrentes e faturas). Transferências entre suas contas não contam.</p>
        </CartaoPainel>
      </div>

      {/* Vencidos, Vencendo e Futuro */}
      <div className="grid gap-4 md:grid-cols-3">
        <CartaoPrazo
          titulo="Vencidos"
          dica={`Últimos ${opcoes.vencidosDias} dias, ainda não pagos ou recebidos`}
          icone={<CalendarX className="h-5 w-5 text-despesa" />}
          prazo={prazos.vencidos}
          aoAbrir={() => setPrazoAberto("vencidos")}
          aoOpcoes={() => setOpcaoAberta("vencidos")}
        />
        <CartaoPrazo
          titulo="Vencendo"
          dica="Hoje"
          icone={<CalendarClock className="h-5 w-5 text-dourado" />}
          prazo={prazos.vencendo}
          aoAbrir={() => setPrazoAberto("vencendo")}
        />
        <CartaoPrazo
          titulo="Futuro"
          dica={`Próximos ${opcoes.futuroDias} dias`}
          icone={<CalendarCheck className="h-5 w-5 text-receita" />}
          prazo={prazos.futuro}
          aoAbrir={() => setPrazoAberto("futuro")}
          aoOpcoes={() => setOpcaoAberta("futuro")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Saldo das Contas */}
        <CartaoPainel titulo="Saldo das Contas" menu={[{ rotulo: "Opções", aoClicar: () => setOpcaoAberta("contas") }]}>
          {contasVisiveis.length === 0 ? (
            <Vazio
              texto={painel.contas.length ? "Nenhuma conta escolhida para aparecer aqui." : "Cadastre suas contas com o saldo de hoje."}
              acao={painel.contas.length ? { rotulo: "Opções", aoClicar: () => setOpcaoAberta("contas") } : { rotulo: "Contas Financeiras", href: "/cadastros/contas-financeiras" }}
            />
          ) : (
            <ul className="divide-y divide-borda">
              {contasVisiveis.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setContaAberta(c.id)} className="flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-left hover:bg-verde-claro/50" title="Detalhar conta">
                    <IconeBanco codigo={c.bancoCodigo} nome={c.bancoNome} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{c.descricao}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {c.bancoNome}, {c.tipo}
                        {!c.considerarNosSaldos && " · fora do Saldo Atual"}
                      </span>
                    </span>
                    <ValorOcultavel centavos={c.saldoCentavos} />
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </button>
                </li>
              ))}
              {contasVisiveis.length > 1 && (
                <li className="flex items-center justify-between px-1 pt-3 text-sm font-semibold text-gray-700">
                  <span>Total</span>
                  <ValorOcultavel centavos={contasVisiveis.reduce((s, c) => s + c.saldoCentavos, 0)} />
                </li>
              )}
            </ul>
          )}
        </CartaoPainel>

        {/* Despesas por Categorias */}
        <CartaoPainel titulo="Despesas por Categorias" menu={[{ rotulo: "Opções", aoClicar: () => setOpcaoAberta("categorias") }]}>
          <p className="-mt-1 mb-3 text-xs text-gray-500">
            {opcoes.categoriasDias === 1 ? "Hoje" : `Últimos ${opcoes.categoriasDias} dias`} ({formatarData(painel.categorias.inicio)} a {formatarData(painel.categorias.fim)})
          </p>
          {painel.categorias.fatias.length === 0 ? (
            <Vazio texto="Nenhuma despesa no período." acao={{ rotulo: "Lançamentos", href: LANCAMENTOS }} />
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <GraficoRosca
                fatias={painel.categorias.fatias}
                centro={
                  <>
                    <span className="text-[11px] text-gray-500">Total</span>
                    <ValorOcultavel centavos={-painel.categorias.total} className="text-sm" />
                  </>
                }
              />
              <ul className="w-full space-y-1.5 text-sm">
                {painel.categorias.fatias.map((f) => {
                  const conteudo = (
                    <>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
                      <span className="min-w-0 flex-1 truncate text-gray-700">{f.nome}</span>
                      <span className="w-12 text-right text-xs font-semibold text-gray-500">{f.percentual.toLocaleString("pt-BR")}%</span>
                      <ValorOcultavel centavos={-f.valorCentavos} className="w-24 text-right text-sm" />
                    </>
                  );
                  return (
                    <li key={f.nome}>
                      {f.id ? (
                        <Link href={`${LANCAMENTOS}?aba=despesas&categoria=${f.id}`} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-verde-claro/50" title="Ver os lançamentos desta categoria no mês">
                          {conteudo}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2 px-1 py-0.5">{conteudo}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CartaoPainel>
      </div>

      {/* Faturas Atuais */}
      <CartaoPainel titulo="Faturas Atuais" menu={[{ rotulo: "Opções", aoClicar: () => setOpcaoAberta("faturas") }]}>
        {faturasVisiveis.length === 0 ? (
          <Vazio
            texto={painel.faturas.length ? "Nenhum cartão escolhido para aparecer aqui." : "Cadastre seus cartões para acompanhar as faturas."}
            acao={painel.faturas.length ? { rotulo: "Opções", aoClicar: () => setOpcaoAberta("faturas") } : { rotulo: "Cartões de Crédito", href: "/cadastros/cartoes-de-credito" }}
          />
        ) : (
          <>
            <div className="-mt-1 mb-3 flex items-center justify-between text-xs text-gray-500">
              <span>A fatura fechada que falta pagar ou, se não houver, a que está aberta agora</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                Total <ValorOcultavel centavos={comoSaida(faturasVisiveis.reduce((s, f) => s + Math.max(0, f.fatura.totalCentavos), 0))} />
              </span>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {faturasVisiveis.map(({ cartao: c, fatura: f, limite }) => {
                const vencida = f.situacao !== "paga" && f.pendenteCentavos > 0 && f.dataVencimento < hoje;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCartaoAberto(c.id)}
                      className="w-full rounded-lg border border-borda p-3 text-left hover:border-verde hover:bg-verde-claro/30"
                      title="Detalhar cartão e faturas"
                    >
                      <span className="flex items-center gap-2">
                        <IconeBanco codigo={c.bancoCodigo} nome={c.bancoNome} className="h-7 w-7 text-[10px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-900">{c.descricao}</span>
                          <span className="block text-xs text-gray-500">
                            Fatura de {f.rotulo} · vence {formatarData(f.dataVencimento)}
                          </span>
                        </span>
                        <EtiquetaFatura situacao={f.situacao} vencida={vencida} />
                      </span>
                      <span className="mt-2 flex items-end justify-between gap-2">
                        <ValorOcultavel centavos={comoSaida(Math.max(0, f.totalCentavos))} className="text-xl" />
                        {f.pagoCentavos > 0 && f.pendenteCentavos > 0 && (
                          <span className="text-xs text-gray-500">
                            falta <ValorOcultavel centavos={comoSaida(f.pendenteCentavos)} className="text-xs" />
                          </span>
                        )}
                      </span>
                      {!limite.ilimitado && (
                        <span className="mt-2 block">
                          <span className="block h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <span
                              className={cn("block h-full rounded-full", limite.percentualUsado >= 90 ? "bg-negativo" : limite.percentualUsado >= 70 ? "bg-dourado" : "bg-receita")}
                              style={{ width: `${limite.percentualUsado}%` }}
                            />
                          </span>
                          <span className="mt-1 flex justify-between text-[11px] text-gray-500">
                            <span>Limite disponível</span>
                            <ValorOcultavel centavos={limite.disponivel ?? 0} className="text-[11px]" />
                          </span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CartaoPainel>

      {prazoAberto && <ModalPrazo qual={prazoAberto} prazo={prazos[prazoAberto]} periodo={prazos.periodos[prazoAberto]} aoFechar={() => setPrazoAberto(null)} />}
      {opcaoAberta && (
        <ModalOpcoes
          key={opcaoAberta}
          qual={opcaoAberta}
          opcoes={opcoes}
          contas={painel.contas.filter((c) => c.ativo)}
          cartoes={painel.faturas.map((f) => f.cartao)}
          aoFechar={() => setOpcaoAberta(null)}
        />
      )}
      {contaAberta !== null && <DetalhandoConta key={contaAberta} contaId={contaAberta} aoFechar={() => setContaAberta(null)} />}
      {cartaoAberto !== null && <DetalhandoCartao key={cartaoAberto} cartaoId={cartaoAberto} aoFechar={() => { setCartaoAberto(null); router.refresh(); }} />}
    </ProvedorOcultar>
  );
}

function CartaoPainel({ titulo, menu, className, children }: {
  titulo: React.ReactNode;
  menu?: { rotulo: string; aoClicar: () => void }[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-borda bg-white p-4 shadow-cartao", className)}>
      <header className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
        {menu && <MenuLinha rotulo={typeof titulo === "string" ? titulo : "cartão"} itens={menu.map((m) => ({ ...m, icone: <Settings2 className="h-4 w-4" /> }))} />}
      </header>
      {children}
    </section>
  );
}

function CartaoPrazo({ titulo, dica, icone, prazo, aoAbrir, aoOpcoes }: {
  titulo: string;
  dica: string;
  icone: React.ReactNode;
  prazo: Prazo;
  aoAbrir: () => void;
  aoOpcoes?: () => void;
}) {
  const quantidade = prazo.linhas.length;
  return (
    <CartaoPainel titulo={titulo} menu={aoOpcoes ? [{ rotulo: "Opções", aoClicar: aoOpcoes }] : undefined}>
      <button type="button" onClick={aoAbrir} className="-mx-1 block w-[calc(100%+0.5rem)] rounded-md px-1 text-left hover:bg-verde-claro/40" title="Ver os lançamentos">
        <span className="mb-2 flex items-center gap-2 text-xs text-gray-500">
          {icone}
          {dica}
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">{quantidade}</span>
        </span>
        <span className="flex items-center justify-between py-1 text-sm">
          <span className="flex items-center gap-1 text-gray-600">
            <ArrowDown className="h-3.5 w-3.5 text-receita" /> Receitas
          </span>
          <ValorOcultavel centavos={prazo.receitas} />
        </span>
        <span className="flex items-center justify-between py-1 text-sm">
          <span className="flex items-center gap-1 text-gray-600">
            <ArrowUp className="h-3.5 w-3.5 text-despesa" /> Despesas
          </span>
          <ValorOcultavel centavos={-prazo.despesas} />
        </span>
      </button>
    </CartaoPainel>
  );
}

function Vazio({ texto, acao }: { texto: string; acao: { rotulo: string; href?: string; aoClicar?: () => void } }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Wallet className="h-10 w-10 text-gray-300" />
      <p className="text-sm text-gray-500">{texto}</p>
      {acao.href ? (
        <Link href={acao.href} className="inline-flex h-9 items-center rounded-md bg-verde px-4 text-sm font-semibold text-white hover:bg-verde-escuro">
          {acao.rotulo}
        </Link>
      ) : (
        <Botao onClick={acao.aoClicar}>{acao.rotulo}</Botao>
      )}
    </div>
  );
}

const TITULOS_PRAZO: Record<QualPrazo, string> = { vencidos: "Vencidos", vencendo: "Vencendo hoje", futuro: "Futuro" };

function ModalPrazo({ qual, prazo, periodo, aoFechar }: { qual: QualPrazo; prazo: Prazo; periodo: { inicio: string; fim: string }; aoFechar: () => void }) {
  const resumoPeriodo = periodo.inicio === periodo.fim ? formatarData(periodo.inicio) : `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`;
  const mes = periodo.inicio.slice(0, 7);
  const situacao = qual === "vencidos" ? "vencido" : "a_vencer";
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={TITULOS_PRAZO[qual]}
      resumo={`${resumoPeriodo} · ainda não pagos ou recebidos`}
      rodape={
        <>
          <Link href={`${LANCAMENTOS}?mes=${mes}&situacao=${situacao}`} className="mr-auto inline-flex h-9 items-center gap-1 text-sm font-semibold text-verde hover:underline">
            Abrir em Lançamentos <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
        </>
      }
    >
      <ProvedorOcultar>
        {prazo.linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Nada por aqui. 🎉</p>
        ) : (
          <ul className="max-h-96 divide-y divide-borda overflow-y-auto text-sm">
            {prazo.linhas.map((l) => (
              <li key={l.chave} className="flex items-center gap-3 py-2">
                {l.valorCentavos >= 0 ? <ArrowDown className="h-4 w-4 shrink-0 text-receita" /> : <ArrowUp className="h-4 w-4 shrink-0 text-despesa" />}
                <span className="w-20 shrink-0 text-xs text-gray-500">{formatarData(l.data)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-800">{l.descricao}</span>
                  <span className="block truncate text-xs text-gray-500">{l.contaOuCartao}</span>
                </span>
                <ValorOcultavel centavos={l.valorCentavos} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex justify-end gap-6 border-t border-borda pt-3 text-sm">
          <span className="text-gray-600">
            Receitas <ValorOcultavel centavos={prazo.receitas} />
          </span>
          <span className="text-gray-600">
            Despesas <ValorOcultavel centavos={-prazo.despesas} />
          </span>
        </div>
      </ProvedorOcultar>
    </Modal>
  );
}

const OPCOES_DIAS = [3, 5, 7, 10, 15, 30, 60, 90];
const OPCOES_PERIODO = [7, 14, 28, 30, 60, 90, 180, 365];
const TITULOS_OPCOES: Record<QualOpcao, string> = {
  vencidos: "Opções: Vencidos",
  futuro: "Opções: Futuro",
  contas: "Opções: Saldo das Contas",
  categorias: "Opções: Despesas por Categorias",
  faturas: "Opções: Faturas Atuais",
};

function ModalOpcoes({ qual, opcoes, contas, cartoes, aoFechar }: {
  qual: QualOpcao;
  opcoes: OpcoesVisaoGeral;
  contas: Painel["contas"];
  cartoes: Painel["faturas"][number]["cartao"][];
  aoFechar: () => void;
}) {
  const [dados, setDados] = useState(opcoes);
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const comAtual = (lista: number[], atual: number) => [...new Set([...lista, atual])].sort((a, b) => a - b).map((n) => ({ valor: String(n), rotulo: `${n} dias` }));

  const salvar = () =>
    iniciar(async () => {
      const mudancas: Partial<OpcoesVisaoGeral> =
        qual === "vencidos"
          ? { vencidosDias: dados.vencidosDias }
          : qual === "futuro"
            ? { futuroDias: dados.futuroDias }
            : qual === "categorias"
              ? { categoriasDias: dados.categoriasDias }
              : qual === "faturas"
                ? { cartoesOcultos: dados.cartoesOcultos }
                : { contasOcultas: dados.contasOcultas };
      const r = await salvarOpcoesVisaoGeral(mudancas);
      if (r.ok) aoFechar();
      else setErro(r.erro);
    });

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={TITULOS_OPCOES[qual]}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        {qual === "vencidos" && (
          <CampoSelecao
            rotulo="Dias para trás"
            ajuda="Até quantos dias para trás procurar o que venceu e não foi pago ou recebido."
            valor={String(dados.vencidosDias)}
            aoMudar={(v) => setDados({ ...dados, vencidosDias: Number(v) })}
            opcoes={comAtual(OPCOES_DIAS, dados.vencidosDias)}
          />
        )}
        {qual === "futuro" && (
          <CampoSelecao
            rotulo="Dias à frente"
            ajuda="Até quantos dias à frente mostrar o que vai vencer."
            valor={String(dados.futuroDias)}
            aoMudar={(v) => setDados({ ...dados, futuroDias: Number(v) })}
            opcoes={comAtual(OPCOES_DIAS, dados.futuroDias)}
          />
        )}
        {qual === "categorias" && (
          <CampoSelecao
            rotulo="Período"
            ajuda="Quantos dias, terminando hoje, entram no gráfico. As 5 categorias com mais gastos aparecem; o resto vira Outras."
            valor={String(dados.categoriasDias)}
            aoMudar={(v) => setDados({ ...dados, categoriasDias: Number(v) })}
            opcoes={comAtual(OPCOES_PERIODO, dados.categoriasDias).map((o) => ({ ...o, rotulo: `Últimos ${o.rotulo}` }))}
          />
        )}
        {qual === "faturas" && (
          <div>
            <p className="mb-2 text-sm text-gray-600">Escolha os cartões que aparecem em Faturas Atuais.</p>
            {cartoes.length === 0 && <p className="text-sm text-gray-500">Nenhum cartão ativo.</p>}
            <ul className="divide-y divide-borda rounded-lg border border-borda">
              {cartoes.map((c) => {
                const visivel = !dados.cartoesOcultos.includes(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <IconeBanco codigo={c.bancoCodigo} nome={c.bancoNome} className="h-7 w-7 text-[10px]" />
                    <Chave
                      ligada={visivel}
                      rotulo={c.descricao}
                      aoMudar={() =>
                        setDados({ ...dados, cartoesOcultos: visivel ? [...dados.cartoesOcultos, c.id] : dados.cartoesOcultos.filter((x) => x !== c.id) })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {qual === "contas" && (
          <div>
            <p className="mb-2 text-sm text-gray-600">Escolha as contas que aparecem no cartão. Isto não muda o Saldo Atual.</p>
            {contas.length === 0 && <p className="text-sm text-gray-500">Nenhuma conta ativa.</p>}
            <ul className="divide-y divide-borda rounded-lg border border-borda">
              {contas.map((c) => {
                const visivel = !dados.contasOcultas.includes(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <IconeBanco codigo={c.bancoCodigo} nome={c.bancoNome} className="h-7 w-7 text-[10px]" />
                    <Chave
                      ligada={visivel}
                      rotulo={c.descricao}
                      aoMudar={() =>
                        setDados({ ...dados, contasOcultas: visivel ? [...dados.contasOcultas, c.id] : dados.contasOcultas.filter((x) => x !== c.id) })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
