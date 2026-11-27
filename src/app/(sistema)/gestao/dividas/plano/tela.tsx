"use client";

import { CalendarPlus, CheckCircle2, ClipboardList, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CampoDestino } from "@/app/(sistema)/financeiro/lancamentos/campos";
import { AvisoAntesDeConfirmar } from "@/components/dividas/aviso-confirmar";
import { AbasDividas, BarraProgresso } from "@/components/dividas/comuns";
import { Diferenca, GraficoPlano, PilulaMes } from "@/components/dividas/plano-comuns";
import { Avisos, ComoCalculei, GraficoSaldo, Indicador, TabelaMeses } from "@/components/dividas/simulador-comuns";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { ListaOrdenavel } from "@/components/ui/lista-ordenavel";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { montarPlano, mesesEntre, ROTULO_SITUACAO_PLANO, type ConfigPlano, type MesComparado, type SituacaoPlano } from "@/lib/dividas/plano";
import type { AjusteLinha, AnalisePlano, PlanoLinha } from "@/lib/dividas/plano-servidor";
import { avisosDaSituacao, ESTRATEGIAS, formatarReais, indiceDoMes, rotuloEstrategia, rotuloMes, somarMesesYm, type DividaSim, type Estrategia, type SituacaoFinanceira } from "@/lib/dividas/simulador";
import type { LinhaDivida } from "@/lib/dividas/tipos";
import type { OpcaoDestino } from "@/lib/lancamentos/tipos";
import { agendarExtra, aprovarAjuste, aprovarPlano, encerrarPlano, manterComoEsta, type OpcaoEscolhida } from "./acoes";

export type AnaliseTela = Omit<AnalisePlano, "previsao" | "paraConsultor"> & { previsao: { quitouTudo: boolean; mesFinal: string | null; mesesAteQuitar: number | null; totalJurosCentavos: number } | null };

export type RascunhoInicial = {
  origem: "simulacao" | "zero";
  simulacao: string;
  estrategia: string;
  dividaIds: number[];
  /** Ordem da estratégia Personalizada (ids do Simulador, "d12"). */
  ordem: string[];
  /** undefined = usar o valor sugerido; null = pagar só as parcelas. */
  valorMensalCentavos?: number | null;
  reservaCentavos: number;
  extraValorCentavos: number;
  extraMes: string;
};

type DividaPlano = { linha: LinhaDivida; sim: DividaSim };

type Props = {
  hoje: string;
  inicioYm: string;
  situacao: SituacaoFinanceira;
  dividas: DividaPlano[];
  nomes: Record<number, string>;
  pagoNoMes: Record<number, number>;
  analise: AnaliseTela | null;
  historico: { planos: PlanoLinha[]; ajustes: AjusteLinha[] };
  guardadas: { id: number; nome: string; modo: string; criadoEm: string }[];
  rascunho: RascunhoInicial | null;
  destinos: OpcaoDestino[];
  contaPadrao: string;
  versao: { plano: PlanoLinha; meses: MesComparado[] } | null;
};

const centavos = (t: string) => Math.max(0, lerValorEmCentavos(t || "") ?? 0);
const texto = (c: number) => (c ? formatarCentavos(c) : "");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const PLANO = "/gestao/dividas/plano";

/** Roda uma ação do servidor e mostra o erro na faixa amarela. */
function useEnvio() {
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const enviar = (acao: () => Promise<{ ok: boolean; erro?: string }>, aoOk: () => void) =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await acao();
        if (!r.ok) return setErro(r.erro ?? "Não foi possível concluir agora.");
        aoOk();
      } catch {
        setErro("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });
  return { erro, setErro, ocupado, enviar };
}

export function TelaPlano(p: Props) {
  return (
    <>
      <AbasDividas ativa={PLANO} />
      {p.rascunho ? <EditorPlano {...p} rascunho={p.rascunho} /> : p.analise ? <PlanoAtivo {...p} analise={p.analise} /> : <SemPlano {...p} />}
      {!p.rascunho && <Historico historico={p.historico} ativoId={p.analise?.plano.id ?? null} versao={p.versao} nomes={p.nomes} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sem plano ativo
// ---------------------------------------------------------------------------

function SemPlano({ dividas, guardadas }: Props) {
  if (!dividas.length) {
    return (
      <Cartao>
        <EstadoVazio titulo="Nenhuma dívida ativa para planejar" texto="Cadastre uma dívida em Minhas Dívidas. O plano usa o saldo, a taxa e as parcelas dela." acao={{ rotulo: "Ir para Minhas Dívidas", href: "/gestao/dividas/minhas" }} />
      </Cartao>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao titulo="Você ainda não tem um plano ativo">
        <p className="text-sm text-gray-600">O Plano de Quitação diz quanto pagar de cada dívida em cada mês e acompanha o que de fato foi pago. Se você pagar menos que o planejado, o Gui mostra o desvio e propõe um ajuste. <strong>Nada muda sem a sua aprovação.</strong></p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`${PLANO}?novo=1`} className="inline-flex h-9 items-center gap-2 rounded-md bg-verde px-4 text-sm font-semibold text-white hover:bg-verde-escuro">
            <ClipboardList className="h-4 w-4" /> Criar plano do zero
          </Link>
          <Link href="/gestao/dividas/simulador?modo=estrategias" className="inline-flex h-9 items-center rounded-md border border-borda bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Comparar estratégias no Simulador
          </Link>
        </div>
      </Cartao>
      <Cartao titulo="Criar a partir de uma simulação guardada">
        {guardadas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma simulação guardada. No Simulador, escolha uma estratégia e use <em>Criar plano a partir desta simulação</em>.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {guardadas.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-800">{g.nome}</span>
                  <span className="text-xs text-gray-500">Guardada em {formatarData(g.criadoEm)}</span>
                </span>
                <Link href={`${PLANO}?simulacao=${g.id}`} className="shrink-0 text-sm font-semibold text-verde hover:underline">
                  Criar plano
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Criar plano (rascunho): nada é gravado até o "Aprovar plano"
// ---------------------------------------------------------------------------

function EditorPlano({ hoje, inicioYm, situacao, dividas, pagoNoMes, analise, rascunho: r }: Props & { rascunho: RascunhoInicial }) {
  const router = useRouter();
  const { erro, ocupado, enviar } = useEnvio();
  const [nome, setNome] = useState(`Plano ${rotuloMes(inicioYm)}`);
  const [ids, setIds] = useState<number[]>(r.dividaIds);
  const [estrategia, setEstrategia] = useState<Estrategia>(ESTRATEGIAS.some((e) => e.valor === r.estrategia) ? (r.estrategia as Estrategia) : "avalanche");
  const [ordem, setOrdem] = useState<string[]>(r.ordem);
  const [soParcelas, setSoParcelas] = useState(r.valorMensalCentavos === null);
  const [valor, setValor] = useState(r.valorMensalCentavos ? texto(r.valorMensalCentavos) : "");
  const [extraValor, setExtraValor] = useState(texto(r.extraValorCentavos));
  const [extraMes, setExtraMes] = useState(r.extraMes || somarMesesYm(inicioYm, 1));
  const [reserva, setReserva] = useState(texto(r.reservaCentavos));
  const [aviso, setAviso] = useState(false);

  const escolhidas = useMemo(() => dividas.filter((d) => ids.includes(d.linha.id)), [dividas, ids]);
  const sims = useMemo(() => escolhidas.map((d) => d.sim), [escolhidas]);
  const parcelasRef = sims.reduce((s, d) => s + d.parcelaReferenciaCentavos, 0);
  const sugerido = situacao.sobraMensalCentavos > 0 ? Math.max(situacao.sobraMensalCentavos, parcelasRef) : parcelasRef;
  const valorMensal = soParcelas ? null : valor.trim() ? centavos(valor) : sugerido;
  const reservaUsada = centavos(reserva);
  const extraCentavos = centavos(extraValor);
  const extras = useMemo(() => (extraCentavos > 0 && /^\d{4}-\d{2}$/.test(extraMes) && extraMes >= inicioYm ? [{ mes: extraMes, valorCentavos: extraCentavos }] : []), [extraCentavos, extraMes, inicioYm]);
  const ordemExibida = useMemo(() => [...ordem.filter((id) => sims.some((s) => s.id === id)), ...sims.map((s) => s.id).filter((id) => !ordem.includes(id))], [ordem, sims]);
  const config: ConfigPlano = useMemo(() => ({ estrategia, personalizada: ordemExibida, valorMensalCentavos: valorMensal, extras, reservaUsadaCentavos: reservaUsada }), [estrategia, ordemExibida, valorMensal, extras, reservaUsada]);
  const montado = useMemo(() => (sims.length ? montarPlano({ dividas: sims, config, inicioYm, realizadoNoMes: pagoNoMes }) : null), [sims, config, inicioYm, pagoNoMes]);

  const avisos = useMemo(() => {
    if (!montado) return [];
    const extrasPontuais = extras.map((x) => ({ indice: indiceDoMes(inicioYm, x.mes), valorCentavos: x.valorCentavos }));
    return [...montado.resultado.avisos, ...avisosDaSituacao(montado.resultado, situacao, { reservaUsadaCentavos: reservaUsada, extras: extrasPontuais, inicioYm })];
  }, [montado, extras, inicioYm, reservaUsada, situacao]);
  const antesDeAprovar = [...avisos.filter((a) => a.tipo === "mes_negativo" || a.tipo === "reserva_minima" || a.tipo === "sobra_negativa").map((a) => a.texto), ...(analise ? [`Já existe o plano ativo "${analise.plano.nome}" (versão ${analise.plano.versao}). Aprovar este plano o deixa como Substituído.`] : [])];

  const aprovar = () =>
    enviar(
      () => aprovarPlano({ nome, origem: r.origem, simulacao: r.simulacao, estrategia, valorMensal: soParcelas ? "" : valor.trim() ? valor : formatarCentavos(sugerido), personalizada: ordemExibida, dividaIds: ids, extras: extras.map((x) => ({ mes: x.mes, valor: formatarCentavos(x.valorCentavos) })), reservaUsada: reserva }),
      () => {
        setAviso(false);
        router.push(PLANO);
        router.refresh();
      },
    );
  const clicar = () => (antesDeAprovar.length ? setAviso(true) : aprovar());
  const pode = !!montado && montado.quitouTudo && nome.trim().length > 0 && ids.length > 0;

  return (
    <>
      <AvisoAntesDeConfirmar
        aberto={aviso}
        titulo="Antes de aprovar este plano"
        motivos={antesDeAprovar}
        aoVoltar={() => setAviso(false)}
        aoContinuar={() => {
          setAviso(false);
          aprovar();
        }}
        rotuloContinuar="Aprovar mesmo assim"
      />
      <div className="flex items-center gap-2 rounded-md border border-amarelo-borda bg-amarelo px-4 py-2 text-sm font-medium text-amarelo-texto" role="note">
        Rascunho: o plano só passa a valer quando você clicar em <strong>Aprovar plano</strong>. Antes disso nada é gravado.
        {r.simulacao && <span className="ml-1 font-normal">Veio da simulação: {r.simulacao}.</span>}
      </div>
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Cartao titulo="Plano">
            <div className="space-y-3">
              <CampoTexto rotulo="Nome do Plano" obrigatorio maxLength={80} valor={nome} aoMudar={setNome} />
              <CampoSelecao rotulo="Estratégia" valor={estrategia} aoMudar={(v) => setEstrategia(v as Estrategia)} opcoes={ESTRATEGIAS.map((e) => ({ valor: e.valor, rotulo: e.rotulo }))} />
              <p className="text-xs text-gray-500">{ESTRATEGIAS.find((e) => e.valor === estrategia)?.texto}</p>
              {estrategia === "personalizada" && (
                <ListaOrdenavel itens={ordemExibida} chave={(id) => id} conteudo={(id) => <span className="text-sm">{sims.find((s) => s.id === id)?.nome ?? id}</span>} aoMudar={(nova) => setOrdem([...nova, ...ordem.filter((x) => !nova.includes(x))])} vazio="Marque as dívidas do plano." />
              )}
            </div>
          </Cartao>
          <Cartao titulo="Dívidas do plano">
            <ul className="space-y-2">
              {dividas.map(({ linha, sim }) => {
                const marcada = ids.includes(linha.id);
                return (
                  <li key={linha.id} className="rounded-md border border-borda px-3 py-2">
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" checked={marcada} onChange={() => setIds(marcada ? ids.filter((x) => x !== linha.id) : [...ids, linha.id])} className="mt-0.5 h-4 w-4 accent-verde" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-800">{sim.nome}</span>
                        <span className="block text-xs text-gray-500">
                          {sim.credor} · {formatarReais(linha.saldo.exibido)}
                          {sim.taxaMensalPct > 0 ? ` · ${String(sim.taxaMensalPct).replace(".", ",")}% a.m.` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Cartao>
          <Cartao titulo="Quanto pagar">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={soParcelas} onChange={(e) => setSoParcelas(e.target.checked)} className="h-4 w-4 accent-verde" /> Pagar só as parcelas
              </label>
              {!soParcelas && (
                <>
                  <CampoValor rotulo="Valor Mensal (total, parcelas incluídas)" valor={valor} aoMudar={setValor} ajuda="Em branco usa o valor sugerido: a sua sobra mensal (ou as parcelas, se a sobra for menor)." />
                  <p className="text-xs text-gray-500">
                    Sugerido: {formatarReais(sugerido)}. Sua sobra mensal média é {formatarReais(situacao.sobraMensalCentavos)}; as parcelas somam {formatarReais(parcelasRef)}.
                  </p>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <CampoValor rotulo="Pagamento Extra" valor={extraValor} aoMudar={setExtraValor} ajuda="Um valor a mais em um mês só (ex.: 13º)." />
                <CampoTexto rotulo="Mês do Extra" type="month" valor={extraMes} aoMudar={setExtraMes} min={inicioYm} />
              </div>
              <CampoValor rotulo="Reserva a Usar" valor={reserva} aoMudar={setReserva} ajuda="Quanto da reserva entra no primeiro mês." />
              <p className="text-xs text-gray-500">
                Reserva hoje: {formatarReais(situacao.reservaCentavos)} (mínima {formatarReais(situacao.reservaMinimaCentavos)}).
              </p>
            </div>
          </Cartao>
        </div>

        <div className="min-w-0 space-y-4">
          {!montado ? (
            <Cartao>
              <p className="py-6 text-center text-sm text-gray-500">Marque pelo menos uma dívida para montar o plano.</p>
            </Cartao>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Indicador titulo="Termina em" valor={montado.mesFinal ? rotuloMes(montado.mesFinal) : "Sem previsão"} nota={montado.resultado.mesesAteQuitar ? plural(montado.resultado.mesesAteQuitar, "mês", "meses") : undefined} destaque />
                <Indicador titulo="Valor mensal" valor={valorMensal === null ? "Só as parcelas" : formatarReais(valorMensal)} />
                <Indicador titulo="Total de juros" valor={formatarReais(montado.resultado.totalJurosCentavos)} />
                <Indicador titulo="Total pago" valor={formatarReais(montado.resultado.totalPagoCentavos)} />
              </div>
              <Avisos avisos={avisos} />
              <Cartao titulo="Saldo devedor planejado">
                <GraficoSaldo resultado={montado.resultado} dividas={sims} />
              </Cartao>
              <TabelaMeses resultado={montado.resultado} dividas={sims} />
              <ComoCalculei>
                <p>É a mesma conta do Simulador: em cada mês pagam-se as parcelas de todas as dívidas e o que sobra do valor mensal vai para a dívida da vez ({rotuloEstrategia(estrategia)}). Depois os juros do mês incidem sobre o restante.</p>
                <p>O que já foi pago neste mês entra no planejado de {rotuloMes(inicioYm)} e sai do que falta pagar, para a conta fechar.</p>
              </ComoCalculei>
              <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
              <div className="flex flex-wrap justify-end gap-2">
                <Botao variante="secundario" type="button" onClick={() => router.push(PLANO)} disabled={ocupado}>
                  Cancelar
                </Botao>
                <Botao type="button" carregando={ocupado} disabled={!pode} onClick={clicar} icone={<CheckCircle2 className="h-4 w-4" />}>
                  Aprovar plano
                </Botao>
              </div>
              {!montado.quitouTudo && <p className="text-right text-xs text-despesa">Com esse valor as dívidas não terminam em 30 anos: aumente o valor mensal para poder aprovar.</p>}
              <p className="text-right text-xs text-gray-500">Hoje é {formatarData(hoje)}. Aprovar não cria lançamentos: os pagamentos extras só viram lançamento quando você clicar em Agendar.</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Plano ativo
// ---------------------------------------------------------------------------

function PlanoAtivo({ hoje, inicioYm, analise: a, nomes, destinos, contaPadrao, dividas }: Props & { analise: AnaliseTela }) {
  const router = useRouter();
  const p = a.plano;
  const { erro, ocupado, enviar } = useEnvio();
  const [agendando, setAgendando] = useState<AnaliseTela["agendaveis"][number] | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const fim = p.parametros.mesFinalPlanejado;
  const prev = a.previsao?.quitouTudo ? a.previsao.mesFinal : null;
  const atraso = fim && prev ? mesesEntre(fim, prev) : a.previsao && !a.previsao.quitouTudo ? 999 : 0;
  const contaDaDivida = (id: number) => {
    const d = dividas.find((x) => x.linha.id === id)?.linha;
    return d?.contaId ? `conta:${d.contaId}` : contaPadrao;
  };

  return (
    <>
      {agendando && <JanelaAgendar item={agendando} planoId={p.id} nome={nomes[agendando.dividaId] ?? "dívida"} hoje={hoje} inicioYm={inicioYm} destinos={destinos} conta={contaDaDivida(agendando.dividaId)} aoFechar={() => setAgendando(null)} />}
      <Modal
        aberto={encerrando}
        aoFechar={() => setEncerrando(false)}
        titulo="Encerrar plano"
        rodape={
          <>
            <Botao variante="secundario" type="button" onClick={() => setEncerrando(false)}>
              Voltar
            </Botao>
            <Botao type="button" carregando={ocupado} onClick={() => enviar(() => encerrarPlano(p.id), () => { setEncerrando(false); router.refresh(); })}>
              Encerrar plano
            </Botao>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          O plano <strong>{p.nome}</strong> fica como <strong>Encerrado</strong> e deixa de ser acompanhado. Nada é apagado: ele continua no histórico. Os lançamentos e as dívidas não mudam.
        </p>
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {p.nome} <span className="ml-1 rounded-full bg-pago-fundo px-2 py-0.5 align-middle text-xs font-semibold text-pago-texto">Versão {p.versao} · Ativo</span>
          </h2>
          <p className="text-xs text-gray-500">
            {rotuloEstrategia(p.estrategia)} · aprovado em {formatarData(p.aprovadoEm)} · {p.parametros.origem === "simulacao" ? `veio da simulação ${p.parametros.simulacao ?? ""}`.trim() : p.parametros.origem === "ajuste" ? "versão criada por um ajuste aprovado" : "criado do zero"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`${PLANO}?novo=1`} className="inline-flex h-9 items-center rounded-md border border-borda bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Criar outro plano
          </Link>
          <Botao variante="secundario" onClick={() => setEncerrando(true)}>
            Encerrar plano
          </Botao>
        </div>
      </div>

      {a.concluido && (
        <div className="rounded-md border border-pago-texto/30 bg-pago-fundo px-4 py-3 text-sm text-pago-texto">
          Todas as dívidas do plano foram quitadas. Parabéns! Você pode <strong>encerrar o plano</strong> para guardá-lo no histórico.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Valor mensal" valor={p.valorMensalCentavos === null ? "Só as parcelas" : formatarReais(p.valorMensalCentavos)} nota={`Reserva mínima: ${formatarReais(p.reservaMinimaCentavos)}`} />
        <Indicador titulo="Termina (no plano)" valor={fim ? rotuloMes(fim) : "-"} />
        <Indicador titulo="Previsão recalculada" valor={a.concluido ? "Quitado" : prev ? rotuloMes(prev) : "Sem previsão"} alerta={atraso > 0} nota={atraso >= 999 ? "Com o ritmo atual não termina em 30 anos." : atraso > 0 ? `${plural(atraso, "mês", "meses")} depois do plano` : a.concluido ? undefined : "No prazo do plano"} destaque={atraso === 0 && !a.concluido} />
        <Indicador titulo="Falta pagar" valor={formatarReais(a.saldoHojeCentavos)} nota={`${a.progressoGeralPct}% do saldo de partida já foi quitado`} />
      </div>
      <Cartao>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Progresso geral</p>
            <BarraProgresso percentual={a.progressoGeralPct} rotulo="Progresso geral do plano" />
            <p className="mt-1 text-xs text-gray-500">{a.progressoGeralPct}% do saldo de partida ({formatarReais(p.parametros.saldoInicialCentavos)}) já foi quitado.</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Meta paga até agora</p>
            <BarraProgresso percentual={a.cumprimentoPct} cor={a.cumprimentoPct >= 100 ? "verde" : a.cumprimentoPct >= 70 ? "amarelo" : "laranja"} rotulo="Quanto da meta do plano já foi pago" />
            <p className="mt-1 text-xs text-gray-500">{a.cumprimentoPct}% do que o plano previu até este mês foi pago.</p>
          </div>
        </div>
      </Cartao>

      {a.propostaVisivel && a.proposta && <CartaoAjuste a={a} />}
      {a.desvios.length > 0 && !a.propostaVisivel && (
        <div className="rounded-md border border-borda bg-white px-4 py-3 text-sm text-gray-600">
          Você escolheu manter o plano como está. Desvios que continuam: {a.desvios.map((d) => d.texto).join(" ")} O aviso volta se o desvio mudar.
        </div>
      )}

      <TabelaPlano a={a} nomes={nomes} inicioYm={inicioYm} />

      {a.agendaveis.length > 0 && (
        <Cartao titulo="Pagamentos para agendar (mês atual e seguinte)">
          <p className="mb-2 text-xs text-gray-500">O que o plano prevê pagar além do que já está em Lançamentos. Cada clique em Agendar cria um lançamento ainda não pago, ligado à dívida. Nada é criado sozinho.</p>
          <ul className="divide-y divide-borda">
            {a.agendaveis.map((x) => (
              <li key={`${x.mes}-${x.dividaId}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-800">{nomes[x.dividaId] ?? "Dívida"}</span>
                  <span className="text-xs text-gray-500">
                    {rotuloMes(x.mes)}: o plano prevê {formatarReais(x.planejadoCentavos)}; já em Lançamentos {formatarReais(x.jaNosLancamentosCentavos)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatarReais(x.agendarCentavos)}</span>
                  <Botao variante="secundario" className="h-8" icone={<CalendarPlus className="h-4 w-4" />} onClick={() => setAgendando(x)}>
                    Agendar
                  </Botao>
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao titulo="Saldo devedor: planejado x realizado">
        <GraficoPlano serie={a.serie} />
      </Cartao>

      <ComoCalculei>
        <p>
          <strong>Realizado</strong> = soma dos lançamentos pagos ligados às dívidas do plano, no mês do pagamento (parcela, pagamento parcial e o restante, amortização, quitação e encargo). Ele nunca é gravado: se você voltar um lançamento para não pago, a tela muda.
        </p>
        <p>
          <strong>Situação do mês</strong>: Cumprido (pagou o planejado, com tolerância de R$ 1,00), Parcial (pagou parte), Não cumprido (nada), Em andamento (mês de hoje) e Futuro. Dívida quitada, renegociada ou cancelada deixa de ser cobrada depois do mês em que acabou.
        </p>
        <p>
          <strong>Previsão recalculada</strong> = simulação com o que falta pagar hoje, o valor mensal e os extras que ainda vêm do plano. Meses fechados que ficaram abaixo, a previsão passar do prazo, a sobra cair mais de 20% ou dívida nova pedem ajuste.
        </p>
      </ComoCalculei>
    </>
  );
}

function CartaoAjuste({ a }: { a: AnaliseTela }) {
  const router = useRouter();
  const proposta = a.proposta!;
  const { erro, ocupado, enviar } = useEnvio();
  const [opcao, setOpcao] = useState<OpcaoEscolhida>(proposta.recomendada);
  const opcoes = [proposta.aumentar, proposta.adiar].filter((o): o is NonNullable<typeof o> => !!o);
  return (
    <section className="rounded-xl border border-amarelo-borda bg-amarelo/40 shadow-cartao" aria-label="Seu plano precisa de ajuste">
      <header className="border-b border-amarelo-borda px-4 py-3">
        <h2 className="text-sm font-semibold text-amarelo-texto">Seu plano precisa de ajuste</h2>
      </header>
      <div className="space-y-3 p-4 text-sm text-gray-800">
        <ul className="list-disc space-y-1 pl-5">
          {proposta.desvios.map((d) => (
            <li key={d.tipo}>{d.texto}</li>
          ))}
        </ul>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Proposta (escolha uma)</legend>
          {opcoes.map((o) => (
            <label key={o.opcao} className={cn("flex cursor-pointer items-start gap-3 rounded-md border bg-white px-3 py-2", opcao === o.opcao ? "border-verde" : "border-borda")}>
              <input type="radio" name="opcao-ajuste" className="mt-1 accent-verde" checked={opcao === o.opcao} onChange={() => setOpcao(o.opcao)} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {o.titulo}
                  {proposta.recomendada === o.opcao && <span className="ml-2 rounded-full bg-pago-fundo px-2 py-0.5 text-xs font-semibold text-pago-texto">Recomendada</span>}
                </span>
                <span className="mt-0.5 block text-xs text-gray-600">
                  {o.valorMensalCentavos === null ? "Só as parcelas" : `Valor mensal: ${formatarReais(o.valorMensalCentavos)}`}
                  {o.mesFinal ? ` · termina em ${rotuloMes(o.mesFinal)}` : ""}
                  {o.cabeNaSobra === false ? " · passa da sua sobra mensal" : o.cabeNaSobra === true ? " · cabe na sua sobra mensal" : ""}
                </span>
                <details className="mt-1 text-xs text-gray-600">
                  <summary className="cursor-pointer font-medium text-gray-700">Como calculei</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {o.calculo.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </details>
              </span>
            </label>
          ))}
        </fieldset>
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-600">Nada muda sem o seu clique. Aprovar cria a versão {a.plano.versao + 1}; a versão {a.plano.versao} continua no histórico.</p>
          <div className="flex gap-2">
            <Botao variante="secundario" disabled={ocupado} onClick={() => enviar(() => manterComoEsta(a.plano.id, proposta.assinatura), () => router.refresh())}>
              Manter como está
            </Botao>
            <Botao carregando={ocupado} icone={<CheckCircle2 className="h-4 w-4" />} onClick={() => enviar(() => aprovarAjuste(a.plano.id, opcao, proposta.assinatura), () => router.refresh())}>
              Aprovar ajuste
            </Botao>
          </div>
        </div>
      </div>
    </section>
  );
}

const LINHAS_INICIAIS = 24;

function TabelaPlano({ a, nomes, inicioYm }: { a: Pick<AnaliseTela, "meses">; nomes: Record<number, string>; inicioYm: string }) {
  const [tudo, setTudo] = useState(false);
  const [porDivida, setPorDivida] = useState(false);
  const meses = tudo ? a.meses : a.meses.slice(0, LINHAS_INICIAIS);
  const total = (f: (m: MesComparado) => number) => a.meses.reduce((s, m) => s + f(m), 0);
  const celula = "px-3 py-2 text-right tabular-nums";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Planejado x realizado, mês a mês</h3>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={porDivida} onChange={(e) => setPorDivida(e.target.checked)} className="h-4 w-4 accent-verde" />
          Detalhar por dívida
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-borda bg-white shadow-cartao">
        <table className="w-full text-sm">
          <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Mês</th>
              <th className={cn(celula, "font-semibold")}>Planejado</th>
              <th className={cn(celula, "font-semibold")}>Realizado</th>
              <th className={cn(celula, "font-semibold")}>Diferença</th>
              <th className="px-3 py-2 text-left font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody>
            {meses.flatMap((m) => [
              <tr key={m.mes} className={cn("border-b border-borda", m.mes === inicioYm ? "bg-verde/5" : "even:bg-gray-50/70")}>
                <td className="px-3 py-1.5 font-medium">{rotuloMes(m.mes)}</td>
                <td className={cn(celula, "py-1.5")}>{formatarReais(m.planejadoCentavos)}</td>
                <td className={cn(celula, "py-1.5")}>{m.mes > inicioYm ? "-" : formatarReais(m.realizadoCentavos)}</td>
                <td className={cn(celula, "py-1.5")}>{m.mes > inicioYm ? "-" : <Diferenca centavos={m.diferencaCentavos} />}</td>
                <td className="px-3 py-1.5">
                  <PilulaMes situacao={m.situacao} />
                </td>
              </tr>,
              ...(porDivida
                ? m.porDivida.map((d) => (
                    <tr key={`${m.mes}-${d.dividaId}`} className="border-b border-borda text-xs text-gray-600">
                      <td className="py-1 pl-8 pr-3">{nomes[d.dividaId] ?? "Dívida"}</td>
                      <td className={cn(celula, "py-1")}>{formatarReais(d.planejadoCentavos)}</td>
                      <td className={cn(celula, "py-1")}>{m.mes > inicioYm ? "-" : formatarReais(d.realizadoCentavos)}</td>
                      <td className={cn(celula, "py-1")}>{m.mes > inicioYm ? "-" : <Diferenca centavos={d.realizadoCentavos - d.planejadoCentavos} />}</td>
                      <td />
                    </tr>
                  ))
                : []),
            ])}
          </tbody>
          <tfoot>
            <tr className="border-t border-amarelo-borda bg-amarelo font-semibold text-amarelo-texto">
              <td className="px-3 py-2">Total ({a.meses.length} {a.meses.length === 1 ? "mês" : "meses"})</td>
              <td className={celula}>{formatarReais(total((m) => m.planejadoCentavos))}</td>
              <td className={celula}>{formatarReais(total((m) => (m.mes <= inicioYm ? m.realizadoCentavos : 0)))}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      {a.meses.length > LINHAS_INICIAIS && (
        <div className="mt-2 text-center">
          <Botao variante="fantasma" className="h-8" onClick={() => setTudo((t) => !t)}>
            {tudo ? "Mostrar só os primeiros meses" : `Mostrar todos os ${a.meses.length} meses`}
          </Botao>
        </div>
      )}
    </div>
  );
}

function JanelaAgendar({ item, planoId, nome, hoje, inicioYm, destinos, conta: contaInicial, aoFechar }: { item: AnaliseTela["agendaveis"][number]; planoId: number; nome: string; hoje: string; inicioYm: string; destinos: OpcaoDestino[]; conta: string; aoFechar: () => void }) {
  const router = useRouter();
  const { erro, ocupado, enviar } = useEnvio();
  const [valor, setValor] = useState(formatarCentavos(item.agendarCentavos));
  const [vencimento, setVencimento] = useState(item.mes === inicioYm ? hoje : `${item.mes}-05`);
  const [conta, setConta] = useState(contaInicial);
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Agendar pagamento do plano"
      resumo={`${nome} · ${rotuloMes(item.mes)}`}
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar} disabled={ocupado}>
            Voltar
          </Botao>
          <Botao type="button" carregando={ocupado} icone={<CalendarPlus className="h-4 w-4" />} onClick={() => enviar(() => agendarExtra(planoId, { mes: item.mes, dividaId: item.dividaId, valor, vencimento, contaId: conta.replace("conta:", "") }), () => { aoFechar(); router.refresh(); })}>
            Agendar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Cria uma despesa ainda não paga, ligada à dívida, que aparece em Lançamentos, na Agenda e nos Vencidos. Quando você pagar, o realizado do plano sobe. Nas dívidas com parcelas, o mesmo valor sai das últimas parcelas em aberto, para o saldo não contar duas vezes.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoValor rotulo="Valor" obrigatorio valor={valor} aoMudar={setValor} ajuda={`No máximo ${formatarReais(item.agendarCentavos)}, o que falta agendar neste mês.`} />
          <CampoTexto rotulo="Vencimento" type="date" valor={vencimento} aoMudar={setVencimento} min={`${item.mes}-01`} max={`${item.mes}-31`} />
        </div>
        <CampoDestino rotulo="Conta de Pagamento" soContas valor={conta} aoMudar={setConta} destinos={destinos} ajuda="Conta de onde o dinheiro sai." />
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Versões e histórico
// ---------------------------------------------------------------------------

function Historico({ historico, ativoId, versao, nomes }: { historico: Props["historico"]; ativoId: number | null; versao: Props["versao"]; nomes: Record<number, string> }) {
  if (!historico.planos.length) return null;
  const situacao = (s: SituacaoPlano) => ROTULO_SITUACAO_PLANO[s];
  return (
    <>
      {versao && (
        <Cartao
          titulo={`${versao.plano.nome} (versão ${versao.plano.versao}, ${situacao(versao.plano.situacao).toLowerCase()})`}
          acoes={
            <Link href={PLANO} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <X className="h-4 w-4" /> Fechar
            </Link>
          }
        >
          <p className="mb-2 text-xs text-gray-500">Só leitura: é o que esta versão previa, comparado com o que foi pago.</p>
          <TabelaPlano a={{ meses: versao.meses }} nomes={nomes} inicioYm={versao.meses.find((m) => m.situacao === "em_andamento")?.mes ?? "9999-99"} />
        </Cartao>
      )}
      <Cartao titulo="Versões e histórico do plano">
        <ul className="divide-y divide-borda">
          {historico.planos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-800">
                  {p.nome} · versão {p.versao}
                  {p.id === ativoId && <span className="ml-2 rounded-full bg-pago-fundo px-2 py-0.5 text-xs font-semibold text-pago-texto">Ativo</span>}
                  {p.id !== ativoId && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{situacao(p.situacao)}</span>}
                </span>
                <span className="text-xs text-gray-500">
                  {rotuloEstrategia(p.estrategia)} · {p.valorMensalCentavos === null ? "só as parcelas" : `${formatarReais(p.valorMensalCentavos)} por mês`} · previa terminar em {p.parametros.mesFinalPlanejado ? rotuloMes(p.parametros.mesFinalPlanejado) : "-"} · aprovado em {formatarData(p.aprovadoEm)}
                </span>
              </span>
              <Link href={`${PLANO}?versao=${p.id}`} className="shrink-0 text-sm font-semibold text-verde hover:underline">
                Ver
              </Link>
            </li>
          ))}
        </ul>
        {historico.ajustes.length > 0 && (
          <div className="mt-4 border-t border-borda pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Ajustes decididos</h3>
            <ul className="space-y-2 text-sm">
              {historico.ajustes
                .filter((x) => x.situacao !== "pendente")
                .map((x) => (
                  <li key={x.id} className="text-gray-700">
                    <span className={cn("mr-2 rounded-full px-2 py-0.5 text-xs font-semibold", x.situacao === "aprovado" ? "bg-pago-fundo text-pago-texto" : "bg-gray-100 text-gray-600")}>{x.situacao === "aprovado" ? "Aprovado" : "Mantido como estava"}</span>
                    {formatarData(x.decididoEm)}: {x.titulo ?? x.motivo}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Cartao>
    </>
  );
}
