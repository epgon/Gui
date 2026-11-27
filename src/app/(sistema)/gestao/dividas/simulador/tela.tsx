"use client";

import { FolderOpen, Printer, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AbasDividas } from "@/components/dividas/comuns";
import { Avisos, ComoCalculei, FaixaSimulacao, GraficoSaldo, Indicador, TabelaMeses } from "@/components/dividas/simulador-comuns";
import { useSistema } from "@/components/layout/provedor-sistema";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { CampoSelecao, CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { ListaOrdenavel } from "@/components/ui/lista-ordenavel";
import { AvisoAntesDeConfirmar } from "@/components/dividas/aviso-confirmar";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { analisarProposta } from "@/lib/dividas/negociacao";
import {
  analisarQuitacao,
  avisosDaSituacao,
  CENARIOS,
  compararEstrategias,
  compararProposta,
  criarDividaHipotetica,
  destacarComparacao,
  ESTRATEGIAS,
  formatarReais,
  fraseComparacao,
  indiceDoMes,
  pagamentoParaQuitarEm,
  quitarComExtraMensal,
  reservaUsavel,
  rotuloEstrategia,
  rotuloMes,
  simular,
  simularPagamentoFixo,
  somarMesesYm,
  valoresDoCenario,
  type Cenario,
  type DividaSim,
  type Estrategia,
  type ExtraPontual,
  type ResultadoSimulacao,
} from "@/lib/dividas/simulador";
import type { DadosSimulador } from "@/lib/dividas/simulador-servidor";
import { excluirSimulacao, guardarSimulacao } from "./acoes";

type Modo = "quitar" | "estrategias" | "cenarios" | "proposta";

const MODOS: { valor: Modo; rotulo: string }[] = [
  { valor: "quitar", rotulo: "Quitar uma dívida" },
  { valor: "estrategias", rotulo: "Comparar estratégias" },
  { valor: "cenarios", rotulo: "Cenários" },
  { valor: "proposta", rotulo: "Proposta de negociação" },
];

type Estado = {
  modo: Modo;
  selecionadas: string[];
  /** Pagamento mínimo digitado das dívidas sem parcelas. */
  minimos: Record<string, string>;
  semExtra: boolean;
  valorMensal: string;
  extraValor: string;
  extraMes: string;
  reservaUsada: string;
  estrategia: Estrategia;
  ordem: string[];
  hip: { ativa: boolean; nome: string; valor: string; taxa: string; parcelas: string; comoExtra: boolean };
  quitar: { dividaId: string; meses: string; extra: string };
  proposta: { negociacaoId: string; propostaId: string; entrada: string; parcelas: string; valorParcela: string; primeiroVencimento: string };
};

export type InicioSimulador = { modo: Modo | null; divida: string | null; negociacao: string | null; proposta: string | null };

const centavos = (t: string) => Math.max(0, lerValorEmCentavos(t || "") ?? 0);
const numero = (t: string) => {
  const n = Number((t ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const texto = (c: number) => (c ? formatarCentavos(c) : "");
const reais = formatarReais;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function estadoInicial(dados: DadosSimulador, inicio: InicioSimulador): Estado {
  const ids = dados.dividas.map((d) => d.sim.id);
  const negociacao = dados.negociacoes.find((n) => String(n.id) === inicio.negociacao) ?? dados.negociacoes.find((n) => n.propostas.some((p) => String(p.id) === inicio.proposta));
  const proposta = negociacao?.propostas.find((p) => String(p.id) === inicio.proposta) ?? negociacao?.propostas.find((p) => p.situacao === "aberta") ?? negociacao?.propostas[0];
  const dividaPedida = inicio.divida && ids.includes(`d${inicio.divida}`) ? `d${inicio.divida}` : (ids[0] ?? "");
  const modo: Modo = inicio.modo === "proposta" && negociacao ? "proposta" : inicio.modo === "quitar" || inicio.divida ? "quitar" : (inicio.modo ?? "estrategias");
  return {
    modo,
    selecionadas: ids,
    minimos: {},
    semExtra: false,
    valorMensal: "",
    extraValor: "",
    extraMes: somarMesesYm(dados.inicioYm, 1),
    reservaUsada: "",
    estrategia: "avalanche",
    ordem: ids,
    hip: { ativa: false, nome: "Empréstimo novo", valor: "", taxa: "2", parcelas: "24", comoExtra: true },
    quitar: { dividaId: dividaPedida, meses: "12", extra: "100,00" },
    proposta: {
      negociacaoId: negociacao ? String(negociacao.id) : "",
      propostaId: proposta ? String(proposta.id) : "",
      entrada: proposta ? texto(proposta.entradaCentavos) : "",
      parcelas: proposta ? String(proposta.parcelas) : "",
      valorParcela: proposta ? texto(proposta.valorParcelaCentavos) : "",
      primeiroVencimento: proposta?.primeiroVencimento ?? "",
    },
  };
}

/** Abre uma simulação guardada: ignora dívidas que não existem mais. */
function estadoGuardado(dados: DadosSimulador, p: unknown): Estado {
  const base = estadoInicial(dados, { modo: null, divida: null, negociacao: null, proposta: null });
  if (!p || typeof p !== "object") return base;
  const g = p as Partial<Estado>;
  const ids = new Set(dados.dividas.map((d) => d.sim.id));
  return {
    ...base,
    ...g,
    selecionadas: (g.selecionadas ?? base.selecionadas).filter((id) => ids.has(id)),
    ordem: [...(g.ordem ?? []).filter((id) => ids.has(id)), ...base.ordem.filter((id) => !(g.ordem ?? []).includes(id))],
    hip: { ...base.hip, ...(g.hip ?? {}) },
    quitar: { ...base.quitar, ...(g.quitar ?? {}), dividaId: ids.has(g.quitar?.dividaId ?? "") ? (g.quitar?.dividaId as string) : base.quitar.dividaId },
    proposta: { ...base.proposta, ...(g.proposta ?? {}) },
  };
}

export function TelaSimulador({ dados, inicio }: { dados: DadosSimulador; inicio: InicioSimulador }) {
  const router = useRouter();
  const { recursos } = useSistema();
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(dados, inicio));
  const [cenarioAberto, setCenarioAberto] = useState<Cenario>("intermediario");
  const [avisoReserva, setAvisoReserva] = useState(false);
  const [avisadaReserva, setAvisadaReserva] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const mudar = <K extends keyof Estado>(k: K, v: Estado[K]) => setEstado((e) => ({ ...e, [k]: v }));

  const { situacao, inicioYm } = dados;
  const porId = useMemo(() => new Map(dados.dividas.map((d) => [d.sim.id, d])), [dados.dividas]);

  // As dívidas que entram na simulação (com o mínimo digitado das que não têm parcelas) e a hipotética.
  const hipotetica = useMemo<DividaSim | null>(() => {
    const h = estado.hip;
    const valor = centavos(h.valor);
    const parcelas = Math.floor(numero(h.parcelas));
    if (!h.ativa || valor <= 0 || parcelas < 1 || parcelas > 360) return null;
    return criarDividaHipotetica({ id: "h1", nome: h.nome.trim() || "Empréstimo novo", valorCentavos: valor, taxaMensalPct: Math.max(0, numero(h.taxa)), parcelas });
  }, [estado.hip]);

  const dividasSim = useMemo<DividaSim[]>(() => {
    const reaisSim = dados.dividas
      .filter((d) => estado.selecionadas.includes(d.sim.id))
      .map(({ sim }) => {
        const digitado = estado.minimos[sim.id];
        if (sim.cronograma.length === 0 && digitado !== undefined && digitado !== "") {
          const m = centavos(digitado);
          return { ...sim, parcelaMinimaCentavos: m, parcelaReferenciaCentavos: m };
        }
        return sim;
      });
    return hipotetica ? [...reaisSim, hipotetica] : reaisSim;
  }, [dados.dividas, estado.selecionadas, estado.minimos, hipotetica]);

  const parcelasRef = dividasSim.reduce((s, d) => s + d.parcelaReferenciaCentavos, 0);
  const sugerido = situacao.sobraMensalCentavos > 0 ? Math.max(situacao.sobraMensalCentavos, parcelasRef) : parcelasRef;
  const valorMensal = estado.semExtra ? null : estado.valorMensal.trim() ? centavos(estado.valorMensal) : sugerido;
  const reservaUsada = centavos(estado.reservaUsada);
  const usavel = reservaUsavel(situacao);

  const extrasPontuais = useMemo<ExtraPontual[]>(() => {
    const lista: ExtraPontual[] = [];
    const v = centavos(estado.extraValor);
    if (v > 0 && /^\d{4}-\d{2}$/.test(estado.extraMes)) lista.push({ indice: indiceDoMes(inicioYm, estado.extraMes), valorCentavos: v });
    if (hipotetica && estado.hip.comoExtra) lista.push({ indice: 0, valorCentavos: hipotetica.saldoCentavos });
    return lista;
  }, [estado.extraValor, estado.extraMes, estado.hip.comoExtra, hipotetica, inicioYm]);
  const extras = useMemo<ExtraPontual[]>(() => (reservaUsada > 0 ? [...extrasPontuais, { indice: 0, valorCentavos: reservaUsada }] : extrasPontuais), [extrasPontuais, reservaUsada]);

  const entradaBase = { dividas: dividasSim, valorMensalCentavos: valorMensal, inicioYm, personalizada: estado.ordem };
  const avisosFinanceiros = (r: ResultadoSimulacao, reservaDoCenario = reservaUsada) => avisosDaSituacao(r, situacao, { reservaUsadaCentavos: reservaDoCenario, extras: extrasPontuais, inicioYm });

  // ---- Resultados por modo ----
  const comparacao = useMemo(
    () => (estado.modo === "estrategias" && dividasSim.length ? compararEstrategias({ ...entradaBase, extras }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estado.modo, dividasSim, valorMensal, extras, estado.ordem],
  );
  const escolhida = comparacao.find((c) => c.estrategia === estado.estrategia) ?? comparacao[0];

  const cenarios = useMemo(
    () =>
      estado.modo === "cenarios" && dividasSim.length
        ? CENARIOS.map((c) => {
            const v = valoresDoCenario(c.valor, { parcelasReferenciaCentavos: parcelasRef, sobraMensalCentavos: situacao.sobraMensalCentavos, percentuais: dados.percentuais, reservaUsavelCentavos: usavel });
            const ex = v.reservaUsadaCentavos > 0 ? [...extrasPontuais, { indice: 0, valorCentavos: v.reservaUsadaCentavos }] : extrasPontuais;
            const resultado = simular({ dividas: dividasSim, estrategia: estado.estrategia, personalizada: estado.ordem, valorMensalCentavos: v.valorMensalCentavos, extras: ex, inicioYm });
            return { ...c, ...v, resultado };
          })
        : [],
    [estado.modo, estado.estrategia, estado.ordem, dividasSim, parcelasRef, situacao.sobraMensalCentavos, dados.percentuais, usavel, extrasPontuais, inicioYm],
  );

  const quitar = useMemo(() => {
    const alvo = porId.get(estado.quitar.dividaId);
    if (estado.modo !== "quitar" || !alvo) return null;
    const digitado = estado.minimos[alvo.sim.id];
    const sim = alvo.sim.cronograma.length === 0 && digitado ? { ...alvo.sim, parcelaMinimaCentavos: centavos(digitado), parcelaReferenciaCentavos: centavos(digitado) } : alvo.sim;
    const analise = analisarQuitacao(sim, inicioYm);
    const meses = Math.max(1, Math.floor(numero(estado.quitar.meses)));
    const fixo = pagamentoParaQuitarEm(sim, meses, inicioYm);
    const emMeses = simularPagamentoFixo(sim, fixo, inicioYm);
    const extra = quitarComExtraMensal(sim, centavos(estado.quitar.extra), inicioYm);
    return { alvo, sim, analise, meses, fixo, emMeses, extra };
  }, [estado.modo, estado.quitar, estado.minimos, porId, inicioYm]);

  const proposta = useMemo(() => {
    if (estado.modo !== "proposta") return null;
    const n = dados.negociacoes.find((x) => String(x.id) === estado.proposta.negociacaoId);
    if (!n) return null;
    const alvo = n.dividas.map((d) => porId.get(`d${d.id}`)).filter((d): d is NonNullable<typeof d> => !!d);
    if (!alvo.length) return { n, vazio: true as const };
    const saldo = alvo.reduce((s, d) => s + d.linha.saldo.exibido, 0);
    const condicoes = { entradaCentavos: centavos(estado.proposta.entrada), parcelas: Math.max(0, Math.floor(numero(estado.proposta.parcelas))), valorParcelaCentavos: centavos(estado.proposta.valorParcela) };
    const continuar = simular({ dividas: alvo.map((d) => d.sim), estrategia: "avalanche", valorMensalCentavos: null, inicioYm });
    const comparacao = compararProposta({ saldoCentavos: saldo, proposta: { ...condicoes, primeiroVencimento: estado.proposta.primeiroVencimento || null }, continuar, inicioYm, reservaCentavos: situacao.reservaCentavos, reservaMinimaCentavos: situacao.reservaMinimaCentavos, sobraMensalCentavos: situacao.sobraMensalCentavos });
    const analise = analisarProposta({ ...condicoes, saldoCentavos: saldo, sobraMensalCentavos: situacao.sobraMensalCentavos });
    return { n, vazio: false as const, alvo, saldo, condicoes, continuar, comparacao, analise };
  }, [estado.modo, estado.proposta, dados.negociacoes, porId, inicioYm, situacao]);

  const semDividas = dados.dividas.length === 0;

  // ---- Guardar, abrir, excluir ----
  const resumoAtual = (): { resumo: unknown; frase: string } => {
    if (estado.modo === "estrategias" && escolhida) {
      const d = destacarComparacao(comparacao);
      return { frase: fraseComparacao(comparacao), resumo: { estrategia: rotuloEstrategia(escolhida.estrategia), menorJuros: d.menorJuros, mesFinal: escolhida.resultado.mesFinal, totalJurosCentavos: escolhida.resultado.totalJurosCentavos, totalPagoCentavos: escolhida.resultado.totalPagoCentavos } };
    }
    if (estado.modo === "cenarios" && cenarios.length) return { frase: "Cenários", resumo: { cenarios: cenarios.map((c) => ({ cenario: c.valor, valorMensalCentavos: c.valorMensalCentavos, mesFinal: c.resultado.mesFinal, totalJurosCentavos: c.resultado.totalJurosCentavos })) } };
    if (estado.modo === "quitar" && quitar) return { frase: `Quitar ${quitar.alvo.sim.nome}`, resumo: { divida: quitar.alvo.sim.nome, quitarHojeCentavos: quitar.analise.quitarHojeCentavos, economiaHojeCentavos: quitar.analise.economiaHojeCentavos } };
    if (estado.modo === "proposta" && proposta && !proposta.vazio) return { frase: "Proposta", resumo: { opcoes: proposta.comparacao.opcoes.map((o) => ({ rotulo: o.rotulo, totalCentavos: o.totalCentavos })) } };
    return { frase: "", resumo: {} };
  };

  const guardar = () =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await guardarSimulacao(nome, estado.modo, estado, resumoAtual().resumo);
        if (!r.ok) return setErro(r.erro);
        setGuardando(false);
        setNome("");
        router.refresh();
      } catch {
        setErro("Não foi possível guardar agora. Tente de novo.");
      }
    });

  const excluir = (id: number, n: string) => {
    if (!confirm(`Excluir a simulação ${n}?`)) return;
    iniciar(async () => {
      try {
        const r = await excluirSimulacao(id);
        if (!r.ok) return alert(r.erro);
        router.refresh();
      } catch {
        alert("Não foi possível excluir agora. Tente de novo.");
      }
    });
  };

  const imprimir = () => {
    document.body.classList.add("imprimindo-simulacao");
    window.addEventListener("afterprint", () => document.body.classList.remove("imprimindo-simulacao"), { once: true });
    window.print();
  };

  const ordemExibida = [...estado.ordem.filter((id) => estado.selecionadas.includes(id)), ...estado.selecionadas.filter((id) => !estado.ordem.includes(id))];

  return (
    <>
      <AvisoAntesDeConfirmar
        aberto={avisoReserva}
        titulo="Uso da reserva acima do recomendado"
        motivos={[`Você informou ${reais(reservaUsada)}, mas o que passa da reserva mínima é ${reais(usavel)} (reserva ${reais(situacao.reservaCentavos)}, mínima ${reais(situacao.reservaMinimaCentavos)}). Usar mais deixa a reserva abaixo do mínimo e reduz sua proteção contra imprevistos.`]}
        aoVoltar={() => {
          setAvisoReserva(false);
          mudar("reservaUsada", usavel > 0 ? texto(usavel) : "");
        }}
        aoContinuar={() => setAvisoReserva(false)}
      />
      <AbasDividas ativa="/gestao/dividas/simulador" />
      <FaixaSimulacao />

      {semDividas ? (
        <Cartao>
          <EstadoVazio titulo="Nenhuma dívida ativa para simular" texto="Cadastre uma dívida em Minhas Dívidas. O simulador usa o saldo, a taxa e as parcelas dela, e também aceita uma dívida hipotética." acao={{ rotulo: "Ir para Minhas Dívidas", href: "/gestao/dividas/minhas" }} />
        </Cartao>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Entradas */}
          <div className="space-y-4">
            <Cartao titulo="Dívidas que entram">
              <ul className="space-y-2">
                {dados.dividas.map(({ linha, sim }) => {
                  const marcada = estado.selecionadas.includes(sim.id);
                  return (
                    <li key={sim.id} className="rounded-md border border-borda px-3 py-2">
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input type="checkbox" checked={marcada} onChange={() => mudar("selecionadas", marcada ? estado.selecionadas.filter((x) => x !== sim.id) : [...estado.selecionadas, sim.id])} className="mt-0.5 h-4 w-4 accent-verde" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-800">{sim.nome}</span>
                          <span className="block text-xs text-gray-500">
                            {sim.credor} · {reais(linha.saldo.exibido)}
                            {sim.taxaMensalPct > 0 ? ` · ${String(sim.taxaMensalPct).replace(".", ",")}% a.m.` : ""}
                            {linha.diasAtraso > 0 ? ` · atrasada ${linha.diasAtraso} d` : ""}
                          </span>
                        </span>
                      </label>
                      {marcada && sim.cronograma.length === 0 && (
                        <CampoValor className="mt-2" rotulo="Pagamento mínimo por mês" valor={estado.minimos[sim.id] ?? texto(sim.parcelaMinimaCentavos)} aoMudar={(v) => mudar("minimos", { ...estado.minimos, [sim.id]: v })} ajuda="Esta dívida não tem parcelas. O padrão são os juros do mês (o saldo não cresce)." />
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 border-t border-borda pt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={estado.hip.ativa} onChange={(e) => mudar("hip", { ...estado.hip, ativa: e.target.checked })} className="h-4 w-4 accent-verde" />
                  Incluir uma dívida hipotética
                </label>
                {estado.hip.ativa && (
                  <div className="mt-2 space-y-3">
                    <CampoTexto rotulo="Nome" valor={estado.hip.nome} maxLength={40} aoMudar={(v) => mudar("hip", { ...estado.hip, nome: v })} />
                    <CampoValor rotulo="Valor do empréstimo" valor={estado.hip.valor} aoMudar={(v) => mudar("hip", { ...estado.hip, valor: v })} />
                    <div className="grid grid-cols-2 gap-3">
                      <CampoTexto rotulo="Juros ao mês (%)" valor={estado.hip.taxa} maxLength={6} aoMudar={(v) => mudar("hip", { ...estado.hip, taxa: v })} />
                      <CampoTexto rotulo="Parcelas" valor={estado.hip.parcelas} maxLength={3} inputMode="numeric" aoMudar={(v) => mudar("hip", { ...estado.hip, parcelas: v })} />
                    </div>
                    <label className="flex items-start gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={estado.hip.comoExtra} onChange={(e) => mudar("hip", { ...estado.hip, comoExtra: e.target.checked })} className="mt-0.5 h-4 w-4 accent-verde" />
                      O dinheiro do empréstimo entra como pagamento extra no primeiro mês (ex.: para quitar o cartão).
                    </label>
                    {!hipotetica && <p className="text-xs text-gray-500">Informe o valor, os juros e de 1 a 360 parcelas para a dívida entrar na conta.</p>}
                  </div>
                )}
              </div>
            </Cartao>

            <Cartao titulo="Quanto pagar">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={estado.semExtra} onChange={(e) => mudar("semExtra", e.target.checked)} className="h-4 w-4 accent-verde" />
                  Pagar só as parcelas (sem valor extra)
                </label>
                {!estado.semExtra && (
                  <div>
                    <CampoValor rotulo="Valor por mês, no total" valor={estado.valorMensal} aoMudar={(v) => mudar("valorMensal", v)} ajuda="O que você paga por mês em todas as dívidas, parcelas incluídas. O que passa das parcelas vai para a dívida da vez." />
                    <p className="mt-1 text-xs text-gray-500">
                      {estado.valorMensal.trim() ? (
                        <button type="button" className="text-verde hover:underline" onClick={() => mudar("valorMensal", "")}>
                          Voltar ao sugerido: {reais(sugerido)}
                        </button>
                      ) : (
                        <>Sugerido: {reais(sugerido)} ({situacao.sobraMensalCentavos > 0 ? "a sua sobra mensal" : "só as parcelas: a sobra mensal não é positiva"}).</>
                      )}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-[1fr_12rem] gap-3">
                  <CampoValor rotulo="Pagamento extra pontual" valor={estado.extraValor} aoMudar={(v) => mudar("extraValor", v)} ajuda="Dinheiro de fora de uma vez só (ex.: 13º salário)." />
                  <CampoTexto rotulo="No mês" type="month" valor={estado.extraMes} min={inicioYm} aoMudar={(v) => mudar("extraMes", v)} />
                </div>
                <div>
                  <CampoValor rotulo="Usar da reserva agora" valor={estado.reservaUsada} aoMudar={(v) => mudar("reservaUsada", v)} aoSair={() => { if (reservaUsada > usavel && reservaUsada !== avisadaReserva) { setAvisadaReserva(reservaUsada); setAvisoReserva(true); } }} ajuda="Dinheiro da sua reserva usado como pagamento extra no primeiro mês." />
                  <p className="mt-1 text-xs text-gray-500">
                    Reserva: {reais(situacao.reservaCentavos)} · mínima: {reais(situacao.reservaMinimaCentavos)}.
                    {usavel > 0 && (
                      <>
                        {" "}
                        <button type="button" className="text-verde hover:underline" onClick={() => mudar("reservaUsada", texto(usavel))}>
                          Usar o que passa do mínimo ({reais(usavel)})
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Cartao>

            <Cartao titulo="Estratégia">
              <div className="space-y-2">
                {ESTRATEGIAS.map((e) => (
                  <label key={e.valor} className={cn("flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm", estado.estrategia === e.valor ? "border-verde bg-verde-claro/60" : "border-borda")}>
                    <input type="radio" name="estrategia" checked={estado.estrategia === e.valor} onChange={() => mudar("estrategia", e.valor)} className="mt-0.5 h-4 w-4 accent-verde" />
                    <span>
                      <span className="block font-medium text-gray-800">{e.rotulo}</span>
                      <span className="block text-xs text-gray-500">{e.texto}</span>
                    </span>
                  </label>
                ))}
              </div>
              {estado.estrategia === "personalizada" && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-gray-500">Arraste (ou use as setas) para escolher a ordem em que o dinheiro extra vai para as dívidas.</p>
                  <ListaOrdenavel
                    itens={ordemExibida}
                    chave={(id) => id}
                    conteudo={(id) => <span className="text-sm">{porId.get(id)?.sim.nome ?? id}</span>}
                    aoMudar={(nova) => mudar("ordem", [...nova, ...estado.ordem.filter((x) => !nova.includes(x))])}
                    vazio="Marque as dívidas que entram."
                  />
                </div>
              )}
            </Cartao>
          </div>

          {/* Resultados */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda" role="tablist">
              <div className="flex gap-1">
                {MODOS.map((m) => (
                  <button key={m.valor} type="button" role="tab" aria-selected={estado.modo === m.valor} onClick={() => mudar("modo", m.valor)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", estado.modo === m.valor ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}>
                    {m.rotulo}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pb-1">
                <Botao variante="secundario" className="h-8" icone={<Save className="h-4 w-4" />} onClick={() => { setErro(""); setGuardando(true); }}>
                  Guardar simulação
                </Botao>
                {recursos.impressao && (
                  <Botao variante="secundario" className="h-8" icone={<Printer className="h-4 w-4" />} onClick={imprimir}>
                    Imprimir/PDF
                  </Botao>
                )}
              </div>
            </div>

            <div id="area-impressao" className="space-y-4">
              <h2 className="hidden text-lg font-semibold print:block">Simulação de dívidas: {MODOS.find((m) => m.valor === estado.modo)?.rotulo}</h2>
              <p className="hidden text-xs text-gray-500 print:block">Simulação: nenhum dado real é alterado. Gerada em {formatarData(dados.hoje)}.</p>

              {dividasSim.length === 0 && estado.modo !== "proposta" && estado.modo !== "quitar" ? (
                <Cartao>
                  <p className="py-6 text-center text-sm text-gray-500">Marque pelo menos uma dívida para simular.</p>
                </Cartao>
              ) : null}

              {estado.modo === "estrategias" && escolhida && (
                <>
                  <Cartao>
                    <p className="text-sm font-medium text-gray-800" data-testid="frase-resumo">{fraseComparacao(comparacao)}</p>
                  </Cartao>
                  <ComparacaoEstrategias comparacao={comparacao} escolhida={escolhida.estrategia} aoEscolher={(e) => mudar("estrategia", e)} />
                  <Detalhe titulo={`Detalhe: ${rotuloEstrategia(escolhida.estrategia)}`} resultado={escolhida.resultado} dividas={dividasSim} avisos={[...escolhida.resultado.avisos, ...avisosFinanceiros(escolhida.resultado)]} />
                </>
              )}

              {estado.modo === "cenarios" && cenarios.length > 0 && (
                <>
                  <p className="text-sm text-gray-600">
                    Nos cenários o valor mensal e o uso da reserva vêm de cada cenário (a sobra mensal e os percentuais dos Parâmetros), e a estratégia é a {rotuloEstrategia(estado.estrategia)}. O extra pontual continua valendo.
                  </p>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {cenarios.map((c) => {
                      const sobraFica = situacao.sobraMensalCentavos - c.valorMensalCentavos;
                      const reservaDepois = situacao.reservaCentavos - c.reservaUsadaCentavos;
                      return (
                        <button key={c.valor} type="button" onClick={() => setCenarioAberto(c.valor)} className={cn("rounded-xl border bg-white p-4 text-left shadow-cartao", cenarioAberto === c.valor ? "border-verde" : "border-borda")}>
                          <p className="text-sm font-semibold text-gray-800">{c.rotulo}</p>
                          <p className="text-xs text-gray-500">{c.texto}</p>
                          <dl className="mt-3 space-y-1 text-sm">
                            <Linha t="Por mês" v={reais(c.valorMensalCentavos)} />
                            <Linha t="Termina em" v={c.resultado.mesFinal ? rotuloMes(c.resultado.mesFinal) : "não quita"} alerta={!c.resultado.quitouTudo} />
                            <Linha t="Total de juros" v={reais(c.resultado.totalJurosCentavos)} />
                            <Linha t="Sobra no mês" v={reais(sobraFica)} alerta={sobraFica < 0} />
                            <Linha t="Reserva depois" v={reais(Math.max(0, reservaDepois))} alerta={reservaDepois < situacao.reservaMinimaCentavos} />
                          </dl>
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const c = cenarios.find((x) => x.valor === cenarioAberto) ?? cenarios[1];
                    return <Detalhe titulo={`Detalhe: ${c.rotulo}`} resultado={c.resultado} dividas={dividasSim} avisos={[...c.resultado.avisos, ...avisosDaSituacao(c.resultado, situacao, { reservaUsadaCentavos: c.reservaUsadaCentavos, extras: extrasPontuais, inicioYm })]} />;
                  })()}
                </>
              )}

              {estado.modo === "quitar" && (
                <>
                  <Cartao titulo="Qual dívida?">
                    <CampoSelecao rotulo="Dívida" valor={estado.quitar.dividaId} aoMudar={(v) => mudar("quitar", { ...estado.quitar, dividaId: v })} opcoes={dados.dividas.map((d) => ({ valor: d.sim.id, rotulo: `${d.sim.nome} (${reais(d.linha.saldo.exibido)})` }))} />
                  </Cartao>
                  {quitar && <PainelQuitar q={quitar} estado={estado} aoMudar={(q) => mudar("quitar", q)} />}
                </>
              )}

              {estado.modo === "proposta" && (
                <PainelProposta dados={dados} estado={estado} aoMudar={(p) => mudar("proposta", p)} proposta={proposta} />
              )}

              <ComoCalculei>
                <p>
                  <strong>Sobra mensal</strong>: média, nos últimos {plural(dados.base.mesesMedia, "mês fechado", "meses fechados")} ({formatarData(dados.base.inicio)} a {formatarData(dados.base.fim)}), de receitas menos despesas pagas, <em>sem</em> as parcelas de dívida. É a mesma conta do Fluxo de Caixa, por data de pagamento. Hoje: {reais(situacao.sobraMensalCentavos)}.
                </p>
                <p>
                  <strong>Reserva</strong>: saldo atual de {dados.base.contasReserva.length ? dados.base.contasReserva.map((c) => c.nome).join(", ") : "nenhuma conta (marque as contas da reserva em Parâmetros)"} ({dados.base.reservaPorTipo ? "contas de Poupança e Investimento" : "contas escolhidas em Parâmetros"}): {reais(situacao.reservaCentavos)}. <strong>Reserva mínima</strong>: {dados.base.reservaMeses} meses de despesas médias ({reais(situacao.despesaMediaCentavos)} por mês): {reais(situacao.reservaMinimaCentavos)}.
                </p>
                <p>
                  <strong>Cada mês</strong>: pagam-se as parcelas e o extra (na dívida da vez, na ordem da estratégia) e, sobre o que sobra de cada dívida, incidem os juros do mês. As parcelas futuras de cada dívida são trazidas a valor presente pela taxa dela, e o atraso estimado entra no mês atual. Quando uma dívida acaba, o valor dela passa para a próxima. Limite de 360 meses. São estimativas: o valor certo é o que o credor informar.
                </p>
                <p>
                  <Link href="/configuracoes/parametros?secao=dividas" className="text-verde hover:underline">
                    Ajustar reserva, meses da média e percentuais dos cenários em Parâmetros
                  </Link>
                </p>
              </ComoCalculei>
            </div>
          </div>
        </div>
      )}

      <Cartao titulo="Simulações guardadas">
        {dados.guardadas.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">Nenhuma simulação guardada. Use Guardar simulação para comparar depois.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {dados.guardadas.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">{g.nome}</p>
                  <p className="text-xs text-gray-500">
                    {MODOS.find((m) => m.valor === g.modo)?.rotulo ?? g.modo} · guardada em {formatarData(g.criadoEm.slice(0, 10))}
                  </p>
                </div>
                <Botao variante="secundario" className="h-8" icone={<FolderOpen className="h-4 w-4" />} onClick={() => { setEstado(estadoGuardado(dados, g.parametros)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  Abrir
                </Botao>
                <Botao variante="fantasma" className="h-8 text-despesa" icone={<Trash2 className="h-4 w-4" />} disabled={ocupado} onClick={() => excluir(g.id, g.nome)}>
                  Excluir
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Modal
        aberto={guardando}
        aoFechar={() => setGuardando(false)}
        titulo="Guardar simulação"
        resumo="Guarda só as escolhas desta tela e o resumo. Nenhum dado real é alterado."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setGuardando(false)}>
              Voltar
            </Botao>
            <Botao carregando={ocupado} icone={<Save className="h-4 w-4" />} onClick={guardar}>
              Guardar
            </Botao>
          </>
        }
      >
        <div className="space-y-3">
          <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
          <CampoTexto rotulo="Nome" obrigatorio valor={nome} maxLength={80} aoMudar={setNome} placeholder="Ex.: Avalanche com o 13º" />
        </div>
      </Modal>
    </>
  );
}

function Linha({ t, v, alerta }: { t: string; v: React.ReactNode; alerta?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-gray-500">{t}</dt>
      <dd className={cn("font-medium tabular-nums", alerta ? "text-despesa" : "text-gray-900")}>{v}</dd>
    </div>
  );
}

function Detalhe({ titulo, resultado, dividas, avisos }: { titulo: string; resultado: ResultadoSimulacao; dividas: DividaSim[]; avisos: ResultadoSimulacao["avisos"] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">{titulo}</h3>
      <Avisos avisos={avisos} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Quita tudo em" valor={resultado.mesFinal ? rotuloMes(resultado.mesFinal) : "Não quita"} nota={resultado.mesesAteQuitar ? plural(resultado.mesesAteQuitar, "mês", "meses") : "no prazo de 30 anos"} alerta={!resultado.quitouTudo} destaque={resultado.quitouTudo} />
        <Indicador titulo="Total pago" valor={reais(resultado.totalPagoCentavos)} nota={`Saldo de hoje: ${reais(resultado.saldoInicialCentavos)}`} />
        <Indicador titulo="Total de juros" valor={reais(resultado.totalJurosCentavos)} />
        <Indicador titulo="Primeira dívida quitada" valor={resultado.primeiraQuitada ? rotuloMes(resultado.primeiraQuitada.mes) : "-"} nota={resultado.primeiraQuitada?.nome} />
      </div>
      <Cartao titulo="Quando cada dívida acaba">
        <ul className="divide-y divide-borda text-sm">
          {[...resultado.dividas].sort((a, b) => (a.quitadaEmIndice ?? 1e9) - (b.quitadaEmIndice ?? 1e9)).map((d) => (
            <li key={d.id} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="truncate text-gray-800">{d.nome}</span>
              <span className="shrink-0 tabular-nums text-gray-600">
                {d.quitadaEm ? rotuloMes(d.quitadaEm) : "não quita"} · juros {reais(d.totalJurosCentavos)}
              </span>
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao titulo="Saldo devedor">
        <GraficoSaldo resultado={resultado} dividas={dividas} />
      </Cartao>
      <TabelaMeses resultado={resultado} dividas={dividas} />
    </div>
  );
}

function ComparacaoEstrategias({ comparacao, escolhida, aoEscolher }: { comparacao: ReturnType<typeof compararEstrategias>; escolhida: Estrategia; aoEscolher: (e: Estrategia) => void }) {
  const d = destacarComparacao(comparacao);
  const marca = (e: Estrategia) => [d.menorJuros === e && "Menos juros", d.quitaTudoAntes === e && "Quita tudo antes", d.primeiraAntes === e && "Libera a primeira antes"].filter(Boolean) as string[];
  return (
    <div className="overflow-x-auto rounded-xl border border-borda bg-white shadow-cartao">
      <table className="w-full text-sm">
        <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold">Estratégia</th>
            <th className="px-4 py-2.5 text-left font-semibold">Quita tudo em</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total pago</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total de juros</th>
            <th className="px-4 py-2.5 text-left font-semibold">Primeira dívida quitada</th>
          </tr>
        </thead>
        <tbody>
          {comparacao.map(({ estrategia, resultado: r }) => (
            <tr key={estrategia} onClick={() => aoEscolher(estrategia)} className={cn("cursor-pointer border-b border-borda last:border-0 hover:bg-verde-claro/50", escolhida === estrategia && "bg-verde-claro/60")}>
              <td className="px-4 py-2.5">
                <span className="font-medium text-gray-800">{rotuloEstrategia(estrategia)}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {marca(estrategia).map((m) => (
                    <span key={m} className="rounded-full bg-pago-fundo px-2 py-0.5 text-[11px] font-semibold text-pago-texto">
                      {m}
                    </span>
                  ))}
                </span>
              </td>
              <td className="px-4 py-2.5">{r.mesFinal ? `${rotuloMes(r.mesFinal)} (${plural(r.mesesAteQuitar ?? 0, "mês", "meses")})` : <span className="text-despesa">não quita</span>}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais(r.totalPagoCentavos)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais(r.totalJurosCentavos)}</td>
              <td className="px-4 py-2.5">{r.primeiraQuitada ? `${r.primeiraQuitada.nome} (${rotuloMes(r.primeiraQuitada.mes)})` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-borda px-4 py-2 text-xs text-gray-500">Clique numa linha para ver o detalhe abaixo.</p>
    </div>
  );
}

type Quitar = {
  alvo: DadosSimulador["dividas"][number];
  sim: DividaSim;
  analise: ReturnType<typeof analisarQuitacao>;
  meses: number;
  fixo: number;
  emMeses: ResultadoSimulacao;
  extra: ReturnType<typeof quitarComExtraMensal>;
};

function PainelQuitar({ q, estado, aoMudar }: { q: Quitar; estado: Estado; aoMudar: (v: Estado["quitar"]) => void }) {
  const seguirAcaba = q.analise.comoEsta.quitouTudo;
  return (
    <div className="space-y-4">
      <Cartao>
        <p className="text-sm font-medium text-gray-800">
          {seguirAcaba
            ? `Quitando hoje você paga ${reais(q.analise.quitarHojeCentavos)} em vez de ${reais(q.analise.seguirComoEstaCentavos)}${q.analise.economiaHojeCentavos > 0 ? `: economiza ${reais(q.analise.economiaHojeCentavos)}` : ""}.`
            : `Seguindo só o pagamento mínimo, ${q.sim.nome} não quita em 30 anos. Quitar hoje custa ${reais(q.analise.quitarHojeCentavos)}.`}
        </p>
      </Cartao>
      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao titulo="Quitar hoje">
          <dl className="space-y-1 text-sm">
            <Linha t="Saldo da dívida" v={reais(q.alvo.linha.saldo.exibido)} />
            <Linha t="Custo para quitar hoje" v={reais(q.analise.quitarHojeCentavos)} />
            <Linha t="Seguindo as parcelas" v={seguirAcaba ? reais(q.analise.seguirComoEstaCentavos) : "não quita"} />
            <Linha t="Você economiza" v={reais(q.analise.economiaHojeCentavos)} />
          </dl>
          <p className="mt-2 text-xs text-gray-500">Custo = parcelas futuras trazidas a valor presente pela taxa da dívida, mais o atraso estimado. Confira com o credor.</p>
        </Cartao>
        <Cartao titulo="Acabar em X meses">
          <CampoTexto rotulo="Meses" valor={estado.quitar.meses} maxLength={3} inputMode="numeric" aoMudar={(v) => aoMudar({ ...estado.quitar, meses: v })} />
          <dl className="mt-3 space-y-1 text-sm">
            <Linha t="Pagando por mês" v={reais(q.fixo)} />
            <Linha t="Termina em" v={q.emMeses.mesFinal ? rotuloMes(q.emMeses.mesFinal) : "não quita"} />
            <Linha t="Total pago" v={reais(q.emMeses.totalPagoCentavos)} />
            <Linha t="Total de juros" v={reais(q.emMeses.totalJurosCentavos)} />
          </dl>
        </Cartao>
        <Cartao titulo="Pagando R$ Y a mais por mês">
          <CampoValor rotulo="A mais por mês" valor={estado.quitar.extra} aoMudar={(v) => aoMudar({ ...estado.quitar, extra: v })} />
          <dl className="mt-3 space-y-1 text-sm">
            <Linha t="Termina em" v={q.extra.resultado.mesFinal ? rotuloMes(q.extra.resultado.mesFinal) : "não quita"} alerta={!q.extra.resultado.quitouTudo} />
            <Linha t="Meses a menos" v={q.extra.mesesAntecipados === null ? "-" : String(q.extra.mesesAntecipados)} />
            <Linha t="Juros economizados" v={reais(q.extra.economiaJurosCentavos)} />
            <Linha t="Total pago" v={reais(q.extra.resultado.totalPagoCentavos)} />
          </dl>
        </Cartao>
      </div>
      <Detalhe titulo="Detalhe: pagando a mais por mês" resultado={q.extra.resultado} dividas={[q.sim]} avisos={q.extra.resultado.avisos} />
    </div>
  );
}

function PainelProposta({ dados, estado, aoMudar, proposta }: { dados: DadosSimulador; estado: Estado; aoMudar: (p: Estado["proposta"]) => void; proposta: ResultadoProposta }) {
  const p = estado.proposta;
  const n = dados.negociacoes.find((x) => String(x.id) === p.negociacaoId);
  const escolherNegociacao = (id: string) => {
    const neg = dados.negociacoes.find((x) => String(x.id) === id);
    const pr = neg?.propostas.find((x) => x.situacao === "aberta") ?? neg?.propostas[0];
    aoMudar({ negociacaoId: id, propostaId: pr ? String(pr.id) : "", entrada: pr ? texto(pr.entradaCentavos) : "", parcelas: pr ? String(pr.parcelas) : "", valorParcela: pr ? texto(pr.valorParcelaCentavos) : "", primeiroVencimento: pr?.primeiroVencimento ?? "" });
  };
  const escolherProposta = (id: string) => {
    const pr = n?.propostas.find((x) => String(x.id) === id);
    aoMudar(pr ? { ...p, propostaId: id, entrada: texto(pr.entradaCentavos), parcelas: String(pr.parcelas), valorParcela: texto(pr.valorParcelaCentavos), primeiroVencimento: pr.primeiroVencimento ?? "" } : { ...p, propostaId: id });
  };
  if (dados.negociacoes.length === 0) {
    return (
      <Cartao>
        <EstadoVazio titulo="Nenhuma negociação com propostas" texto="Abra uma negociação e registre a proposta do credor. Depois use o botão Simular na proposta para comparar com continuar como está e com quitar usando a reserva." acao={{ rotulo: "Ir para Negociações", href: "/gestao/dividas/negociacoes" }} />
      </Cartao>
    );
  }
  return (
    <div className="space-y-4">
      <Cartao titulo="Qual proposta?">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoSelecao rotulo="Negociação" valor={p.negociacaoId} aoMudar={escolherNegociacao} opcoes={[{ valor: "", rotulo: "Selecione" }, ...dados.negociacoes.map((x) => ({ valor: String(x.id), rotulo: `${x.credor} (${plural(x.propostas.length, "proposta", "propostas")})` }))]} />
          <CampoSelecao rotulo="Proposta" valor={p.propostaId} aoMudar={escolherProposta} opcoes={[{ valor: "", rotulo: "Digitar condições" }, ...(n?.propostas ?? []).map((x) => ({ valor: String(x.id), rotulo: `${x.quemPropos === "credor" ? "Do credor" : "Minha"} em ${formatarData(x.data)}: ${reais(x.totalCentavos)}` }))]} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <CampoValor rotulo="Entrada (ou à vista)" valor={p.entrada} aoMudar={(v) => aoMudar({ ...p, entrada: v })} />
          <CampoTexto rotulo="Parcelas" valor={p.parcelas} maxLength={3} inputMode="numeric" aoMudar={(v) => aoMudar({ ...p, parcelas: v })} />
          <CampoValor rotulo="Valor da parcela" valor={p.valorParcela} aoMudar={(v) => aoMudar({ ...p, valorParcela: v })} />
          <CampoTexto rotulo="1º vencimento" type="date" valor={p.primeiroVencimento} aoMudar={(v) => aoMudar({ ...p, primeiroVencimento: v })} />
        </div>
      </Cartao>
      {!proposta && <p className="text-sm text-gray-500">Escolha uma negociação para comparar.</p>}
      {proposta?.vazio && <p className="text-sm text-gray-500">As dívidas desta negociação não estão mais ativas.</p>}
      {proposta && !proposta.vazio && (
        <>
          <Cartao>
            <p className="text-sm font-medium text-gray-800">
              {proposta.analise.maisCaro
                ? `A proposta custa ${reais(proposta.analise.totalCentavos)}, ${reais(proposta.analise.acrescimoCentavos)} a mais que o saldo de hoje (${reais(proposta.saldo)}).`
                : proposta.analise.descontoCentavos > 0
                  ? `A proposta custa ${reais(proposta.analise.totalCentavos)}: ${reais(proposta.analise.descontoCentavos)} (${String(proposta.analise.descontoPct).replace(".", ",")}%) a menos que o saldo de hoje (${reais(proposta.saldo)}).`
                  : `A proposta custa ${reais(proposta.analise.totalCentavos)}, o mesmo que o saldo de hoje (${reais(proposta.saldo)}).`}
              {proposta.analise.jurosImplicitosMensal !== null ? ` Juros implícitos: ${String(proposta.analise.jurosImplicitosMensal).replace(".", ",")}% ao mês.` : ""}
            </p>
          </Cartao>
          <Avisos
            avisos={[
              ...(proposta.comparacao.cabeNaSobra === false ? [{ tipo: "mes_negativo" as const, texto: `A parcela de ${reais(proposta.condicoes.valorParcelaCentavos)} não cabe na sua sobra mensal de ${reais(dados.situacao.sobraMensalCentavos)}: faltam ${reais(-(proposta.comparacao.folgaCentavos ?? 0))} por mês.` }] : []),
              ...(proposta.comparacao.quitarComReserva.possivel && proposta.comparacao.quitarComReserva.deixaAbaixoDoMinimo ? [{ tipo: "reserva_minima" as const, texto: `Quitar hoje com a reserva deixa ${reais(proposta.comparacao.quitarComReserva.sobraDaReservaCentavos)}, abaixo da reserva mínima de ${reais(dados.situacao.reservaMinimaCentavos)}.` }] : []),
              ...(!proposta.comparacao.quitarComReserva.possivel ? [{ tipo: "reserva_minima" as const, texto: `A reserva (${reais(dados.situacao.reservaCentavos)}) não cobre o saldo de ${reais(proposta.saldo)}.` }] : []),
            ]}
          />
          <div className="overflow-x-auto rounded-xl border border-borda bg-white shadow-cartao">
            <table className="w-full text-sm">
              <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Caminho</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Agora</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Por mês</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total a pagar</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Contra o saldo de hoje</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Termina em</th>
                </tr>
              </thead>
              <tbody>
                {proposta.comparacao.opcoes.map((o) => (
                  <tr key={o.rotulo} className="border-b border-borda last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{o.rotulo}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{o.agoraCentavos ? reais(o.agoraCentavos) : "-"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{o.valorParcelaCentavos ? `${o.parcelas} × ${reais(o.valorParcelaCentavos)}` : "-"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{reais(o.totalCentavos)}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums", o.diferencaSaldoCentavos < 0 ? "text-verde-vivo" : o.diferencaSaldoCentavos > 0 ? "text-despesa" : "")}>{o.diferencaSaldoCentavos === 0 ? "igual" : `${o.diferencaSaldoCentavos < 0 ? "-" : "+"}${reais(Math.abs(o.diferencaSaldoCentavos))}`}</td>
                    <td className="px-4 py-2.5">{o.fim ? rotuloMes(o.fim) : "não termina"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Detalhe titulo="Detalhe: continuar como está" resultado={proposta.continuar} dividas={proposta.alvo.map((d) => d.sim)} avisos={proposta.continuar.avisos} />
        </>
      )}
    </div>
  );
}

type ResultadoProposta =
  | { n: unknown; vazio: true }
  | { n: unknown; vazio: false; alvo: DadosSimulador["dividas"]; saldo: number; condicoes: { entradaCentavos: number; parcelas: number; valorParcelaCentavos: number }; continuar: ResultadoSimulacao; comparacao: ReturnType<typeof compararProposta>; analise: ReturnType<typeof analisarProposta> }
  | null;
