"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, Funnel, Plus, RotateCcw, Search, Trash2, Upload, Wallet, type LucideIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BotaoImprimir } from "@/components/exportacao/botao-imprimir";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { usePainel } from "@/components/layout/provedor-painel";
import { BotaoConfigurarListagem } from "@/components/listagem/botao-configurar-listagem";
import { Botao } from "@/components/ui/botao";
import { TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { cn } from "@/lib/cn";
import type { Filtros, LinhaLista, Opcoes, Resumo } from "@/lib/lancamentos/tipos";
import type { PreferenciaListagem } from "@/lib/listagem/telas";
import { CabecalhoLinhas, LinhaComFilhos, ValorOculto, visualDe } from "./linhas";
import { alvoDe, useAcoesLista } from "./use-acoes-lista";

type Mes = { anoMes: string; rotulo: string; anterior: string; seguinte: string; inicio: string; fim: string };

const ABAS: { valor: Filtros["aba"]; rotulo: string; icone: LucideIcon; cor?: string }[] = [
  { valor: "todos", rotulo: "Todos", icone: CalendarDays },
  { valor: "receitas", rotulo: "Receitas", icone: ArrowDown, cor: "text-receita" },
  { valor: "despesas", rotulo: "Despesas", icone: ArrowUp, cor: "text-despesa" },
  { valor: "transferencias", rotulo: "Transferências", icone: ArrowUpDown },
  { valor: "recorrentes", rotulo: "Recorrentes", icone: Clock },
];

export const SITUACOES = [
  { valor: "", rotulo: "Todas as situações" },
  { valor: "nao_realizado", rotulo: "Não Realizado" },
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "a_vencer", rotulo: "A Vencer" },
  { valor: "vencido", rotulo: "Vencido" },
];

/** Linhas que podem ser marcadas: lançamentos gravados e recorrentes previstos (não a linha da fatura). */
export const selecionavel = (l: LinhaLista) => l.id !== null || l.previsto !== null;

export function TelaLancamentos({ linhas, total, pagina, saldos, preferencia, resumo, filtros, opcoes, hoje, mes, caminho, abrirNovo }: {
  /** "despesa", "receita" ou "transferencia": abre o Novo Lançamento ao entrar (vindo da Visão Geral). */
  abrirNovo?: string;
  /** Só as linhas da página. */
  linhas: LinhaLista[];
  /** Quantas linhas há ao todo no mês (com os filtros). */
  total: number;
  pagina: number;
  saldos: Record<string, number | null>;
  preferencia: PreferenciaListagem;
  resumo: Resumo;
  filtros: Filtros;
  opcoes: Opcoes;
  hoje: string;
  mes: Mes;
  caminho: string;
}) {
  const router = useRouter();
  const { abrirFiltros } = usePainel();
  const acoes = useAcoesLista({
    opcoes,
    hoje,
    destino: filtros.destino,
    abrirNovo: abrirNovo === "transferencia" ? { aba: "transferencia" } : abrirNovo === "receita" || abrirNovo === "despesa" ? { aba: "simples", tipo: abrirNovo } : null,
  });
  // A seleção vale para a lista que está na tela; quando a lista muda (salvou, filtrou), ela é limpa.
  const [selecao, setSelecao] = useState<{ base: LinhaLista[]; chaves: string[] }>({ base: linhas, chaves: [] });
  const selecionados = selecao.base === linhas ? selecao.chaves : [];
  const setSelecionados = (f: string[] | ((s: string[]) => string[])) => setSelecao({ base: linhas, chaves: typeof f === "function" ? f(selecionados) : f });
  const [ocultar, setOcultar] = useState(false);
  const [expandidas, setExpandidas] = useState<string[]>([]);
  const [previstoAberto, setPrevistoAberto] = useState(false);

  const parametros: Record<string, string> = {
    mes: filtros.mes,
    aba: filtros.aba === "todos" ? "" : filtros.aba,
    destino: filtros.destino,
    situacao: filtros.situacao,
    busca: filtros.busca,
    detalhar: filtros.detalhar ? "1" : "",
    categoria: filtros.categoria,
    forma: filtros.forma,
    contato: filtros.contato,
    tag: filtros.tag,
    categoria_op: filtros.categoriaOp,
    forma_op: filtros.formaOp,
    contato_op: filtros.contatoOp,
    tag_op: filtros.tagOp,
    av: filtros.avancado,
  };
  const link = (mudancas: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries({ ...parametros, ...mudancas }).filter(([, v]) => v));
    const qs = sp.toString();
    return qs ? `${caminho}?${qs}` : caminho;
  };
  const ir = (mudancas: Record<string, string>) => {
    setSelecionados([]);
    router.push(link(mudancas));
  };

  // Tira o "?novo=" do endereço (a janela já abriu), para não abrir de novo ao recarregar.
  useEffect(() => {
    if (abrirNovo) router.replace(link({}), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { novo, abrindo, aviso, ocupado } = acoes;
  const selecionaveis = linhas.filter(selecionavel).map((l) => l.chave);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((c) => selecionados.includes(c));
  const marcar = (c: string) => setSelecionados((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const escolhidas = linhas.filter((l) => selecionavel(l) && selecionados.includes(l.chave));
  const destinoAtual = opcoes.destinos.find((d) => d.valor === filtros.destino);
  const rotuloEscolhidas = `${escolhidas.length} lançamentos`;

  const temSaldo = resumo.saldoAnterior !== null;

  const visual = visualDe(preferencia, hoje, temSaldo ? saldos : {});
  const escopo = destinoAtual?.rotulo ?? "Todos";
  const paginas = preferencia.semPaginacao ? 1 : Math.max(1, Math.ceil(total / preferencia.porPagina));
  const primeiro = total === 0 ? 0 : (pagina - 1) * preferencia.porPagina + 1;
  const ultimo = preferencia.semPaginacao ? total : Math.min(total, pagina * preferencia.porPagina);
  // Números de página: a primeira, a última e duas de cada lado da atual.
  const numeros = Array.from({ length: paginas }, (_, k) => k + 1).filter((n) => n === 1 || n === paginas || Math.abs(n - pagina) <= 2);

  const botaoQuadrado = "inline-flex h-9 w-9 items-center justify-center bg-white text-gray-600 hover:bg-gray-50";
  const vazio =
    opcoes.destinos.length === 0 ? (
      <>
        Cadastre primeiro uma{" "}
        <Link href="/cadastros/contas-financeiras" className="font-semibold text-verde hover:underline">
          Conta Financeira
        </Link>
        .
      </>
    ) : filtros.aba === "recorrentes" ? (
      `Nenhum lançamento recorrente em ${mes.rotulo}${filtros.busca || filtros.situacao || filtros.destino ? " com esses filtros" : ""}. Cadastre em Financeiro > Recorrentes.`
    ) : (
      `Nenhum lançamento em ${mes.rotulo}${filtros.busca || filtros.situacao || filtros.aba !== "todos" ? " com esses filtros" : ""}.`
    );

  return (
    <>
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-2">
        <Botao icone={<Plus className="h-4 w-4" />} onClick={() => novo("simples", "despesa")}>
          Adicionar
        </Botao>
        <div className="inline-flex divide-x divide-borda overflow-hidden rounded-md border border-borda">
          <button type="button" onClick={() => novo("simples", "despesa")} title="Nova despesa" aria-label="Nova despesa" className={cn(botaoQuadrado, "text-despesa")}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => novo("simples", "receita")} title="Nova receita" aria-label="Nova receita" className={cn(botaoQuadrado, "text-receita")}>
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={() => novo("transferencia")} title="Nova transferência" aria-label="Nova transferência" className={cn(botaoQuadrado, "rounded-md border border-borda text-ardosia")}>
          <ArrowUpDown className="h-4 w-4" />
        </button>
        {abrindo && <span className="text-sm text-gray-500">Abrindo...</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <BotaoImprimir tela="lancamentos" parametros={parametros} somente="exportar" />
          <BotaoImprimir tela="lancamentos" parametros={parametros} somente="imprimir" />
          <span className="group/dica relative">
            <Link href="/financeiro/importacoes/nova" aria-label="Importar extrato (OFX ou CSV)" className={cn(botaoQuadrado, "rounded-md border border-borda")}>
              <Upload className="h-4 w-4 text-verde" />
            </Link>
            <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover/dica:opacity-100">
              Importar
            </span>
          </span>
          <Form action={caminho} className="flex w-full items-center sm:w-72" role="search">
            {Object.entries(parametros)
              .filter(([k, v]) => k !== "busca" && v)
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <label className="flex h-9 w-full items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm focus-within:border-verde">
              <input name="busca" defaultValue={filtros.busca} key={filtros.busca} placeholder="Pesquisar" aria-label="Pesquisar lançamento" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
              <button type="submit" aria-label="Pesquisar" className="text-gray-500 hover:text-verde">
                <Search className="h-4 w-4" />
              </button>
            </label>
          </Form>
          <span className="group/dica relative">
            <button type="button" onClick={abrirFiltros} aria-label="Filtros" className={cn(botaoQuadrado, "rounded-md border border-borda")}>
              <Funnel className="h-4 w-4 text-gray-500" />
            </button>
            <span aria-hidden="true" className="pointer-events-none absolute right-0 bottom-full z-50 mb-1.5 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover/dica:opacity-100">
              Filtros
            </span>
          </span>
        </div>
      </div>

      <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>

      {/* Ações em lote */}
      {escolhidas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-verde/30 bg-verde-claro px-4 py-2 text-sm">
          <strong>{escolhidas.length === 1 ? "1 selecionado" : `${escolhidas.length} selecionados`}</strong>
          <Botao variante="secundario" className="h-8" disabled={ocupado} onClick={() => acoes.pedirPagamento(escolhidas, rotuloEscolhidas)} icone={<CheckCircle2 className="h-4 w-4" />}>
            Pagar / Receber
          </Botao>
          <Botao variante="secundario" className="h-8" disabled={ocupado} onClick={() => acoes.estornar(alvoDe(escolhidas, rotuloEscolhidas))} icone={<RotateCcw className="h-4 w-4" />}>
            Voltar para não pago
          </Botao>
          <Botao variante="secundario" className="h-8 text-negativo" disabled={ocupado} onClick={() => acoes.pedirExclusao(escolhidas, rotuloEscolhidas)} icone={<Trash2 className="h-4 w-4" />}>
            Excluir
          </Botao>
          <button type="button" onClick={() => setSelecionados([])} className="ml-auto text-gray-600 hover:underline">
            Limpar seleção
          </button>
        </div>
      )}

      {/* Cartão único: filtros, mês, abas, saldos e lista */}
      <div className="overflow-hidden rounded-md border border-borda bg-white shadow-cartao">
        <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-b border-borda px-4 py-2.5 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-center gap-2">
              {destinoAtual ? <IconeBanco codigo={destinoAtual.bancoCodigo} nome={destinoAtual.bancoNome ?? "Outro"} className="h-5! w-5! text-[8px]!" /> : <Wallet className="h-5 w-5 text-gray-400" />}
              <SeletorTexto rotulo="Conta ou Cartão" texto={destinoAtual?.rotulo ?? "Conta ou Cartão"} valor={filtros.destino} aoMudar={(v) => ir({ destino: v })}>
                <option value="">Todas as contas e cartões</option>
                {(["Contas", "Cartões"] as const).map((g) => {
                  const itens = opcoes.destinos.filter((d) => d.grupo === g && (d.ativo || d.valor === filtros.destino));
                  return itens.length ? (
                    <optgroup key={g} label={g === "Contas" ? "Contas Financeiras" : "Cartões de Crédito"}>
                      {itens.map((d) => (
                        <option key={d.valor} value={d.valor}>
                          {d.rotulo}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </SeletorTexto>
            </span>
            <SeletorTexto rotulo="Situação" texto={filtros.situacao ? SITUACOES.find((x) => x.valor === filtros.situacao)!.rotulo : "Situação"} valor={filtros.situacao} aoMudar={(v) => ir({ situacao: v })}>
              {SITUACOES.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.rotulo}
                </option>
              ))}
            </SeletorTexto>
          </div>
          <div className="flex items-center justify-center gap-5">
            <Link href={link({ mes: mes.anterior })} onClick={() => setSelecionados([])} aria-label="Mês anterior" className="rounded p-1 text-verde hover:bg-verde-claro">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <label className="relative">
              <span className="block min-w-36 cursor-pointer text-center text-sm font-semibold text-verde">{mes.rotulo}</span>
              <input type="month" value={mes.anoMes} onChange={(e) => e.target.value && ir({ mes: e.target.value })} aria-label="Escolher mês" className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <Link href={link({ mes: mes.seguinte })} onClick={() => setSelecionados([])} aria-label="Próximo mês" className="rounded p-1 text-verde hover:bg-verde-claro">
              <ChevronRight className="h-5 w-5" />
            </Link>
            {mes.anoMes !== hoje.slice(0, 7) && (
              <Link href={link({ mes: hoje.slice(0, 7) })} className="rounded px-2 py-0.5 text-xs font-semibold text-verde hover:bg-verde-claro">
                Hoje
              </Link>
            )}
          </div>
          <div className="text-xs text-gray-600 sm:justify-self-end" title="Exibe os itens dos lançamentos detalhados e as compras das faturas">
            <Chave ligada={filtros.detalhar} aoMudar={(v) => ir({ detalhar: v ? "1" : "" })} rotulo="Detalhar" tamanho="p" />
          </div>
        </div>

        <div className="flex overflow-x-auto border-b border-borda" role="tablist">
          {ABAS.map((a) => {
            const ativa = filtros.aba === a.valor;
            return (
              <Link
                key={a.valor}
                href={link({ aba: a.valor === "todos" ? "" : a.valor })}
                role="tab"
                aria-selected={ativa}
                className={cn(
                  "-mb-px flex min-w-32 flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-[13px] whitespace-nowrap",
                  ativa ? "border-verde font-medium text-gray-900" : "border-transparent text-gray-600 hover:bg-gray-50",
                )}
              >
                <a.icone className={cn("h-[18px] w-[18px]", a.cor ?? "text-gray-700")} />
                {a.rotulo}
              </Link>
            );
          })}
        </div>

        {temSaldo && (
          <div className="flex items-center justify-between gap-3 border-b border-amarelo-borda/60 bg-amarelo px-4 py-2" title="Resultado acumulado até o fim do mês anterior (inclui o que ainda não foi pago).">
            <span className="text-xs text-gray-600">
              Saldo Anterior <em className="ml-1.5 text-gray-500">{escopo}</em>
            </span>
            <ValorOculto centavos={resumo.saldoAnterior!} ocultar={ocultar} className="text-base font-normal! text-gray-500!" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <CabecalhoLinhas
              visual={visual}
              marcarTodos={{ marcado: todosMarcados, aoMudar: () => setSelecionados(todosMarcados ? [] : selecionaveis) }}
              engrenagem={<BotaoConfigurarListagem tela="lancamentos" pref={preferencia} />}
            />
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-4 py-10 text-center text-sm text-gray-500">
                    {vazio}
                  </td>
                </tr>
              ) : (
                linhas.map((l) => {
                  const expandida = filtros.detalhar || expandidas.includes(l.chave);
                  return (
                    <LinhaComFilhos
                      key={l.chave}
                      linha={l}
                      visual={visual}
                      ocultar={ocultar}
                      marcado={selecionados.includes(l.chave)}
                      aoMarcar={selecionavel(l) ? () => marcar(l.chave) : undefined}
                      aoAbrir={acoes.abrirLinha(l) ?? (() => setExpandidas((e) => (e.includes(l.chave) ? e.filter((x) => x !== l.chave) : [...e, l.chave])))}
                      menu={<MenuLinha rotulo={l.descricao} itens={acoes.menuDe(l, (cartaoId) => ir({ destino: `cartao:${cartaoId}` }))} />}
                      expandida={expandida}
                      filhos={l.compras}
                      aoEditarFilho={acoes.editar}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borda bg-subcabecalho px-4 py-2.5">
          <span className="text-xs text-gray-600">Total dos Lançamentos</span>
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            <ValorOculto centavos={resumo.receitas} ocultar={ocultar} className="font-normal!" />
            <span className="text-gray-400">-</span>
            <ValorOculto centavos={resumo.despesas} ocultar={ocultar} className="font-normal! text-despesa!" />
            <span className="text-gray-400">=</span>
            <ValorOculto centavos={resumo.total} ocultar={ocultar} className="font-normal!" />
          </span>
        </div>
        {temSaldo && (
          <div className="border-t border-amarelo-borda/60 bg-amarelo px-4 py-3" title="Só o que já foi pago ou recebido até o fim deste mês. É o número que deve bater com o extrato do banco.">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-gray-700">
                Saldo Atual
                <button type="button" onClick={() => setOcultar((o) => !o)} aria-label={ocultar ? "Mostrar valores" : "Ocultar valores"} className="rounded p-1 text-gray-600 hover:bg-white/60">
                  {ocultar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPrevistoAberto((a) => !a)}
                  aria-expanded={previstoAberto}
                  aria-label={previstoAberto ? "Ocultar o Saldo Previsto" : "Mostrar o Saldo Previsto"}
                  className="rounded p-1 text-gray-600 hover:bg-white/60"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", previstoAberto && "rotate-180")} />
                </button>
                <ValorOculto centavos={resumo.saldoAtual!} ocultar={ocultar} className="text-2xl font-normal!" />
              </span>
            </div>
            {previstoAberto && (
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-amarelo-borda/60 pt-2" title="Saldo anterior mais todos os lançamentos do mês, pagos ou não.">
                <span className="text-xs text-gray-600">Saldo Previsto</span>
                <ValorOculto centavos={resumo.saldoPrevisto!} ocultar={ocultar} className="text-base font-normal!" />
              </div>
            )}
          </div>
        )}
        {!temSaldo && (
          <p className="border-t border-borda bg-subcabecalho px-4 py-2 text-xs text-gray-500">
            Filtrando por cartão: aparecem as compras separadas, pela data de vencimento da fatura. Para pagar, use o menu da linha Fatura-Cartão (sem filtro) ou Cadastros &gt; Cartões de Crédito &gt; Faturas.
          </p>
        )}

        {/* Páginas */}
        <div className="flex items-center justify-between gap-3 border-t border-borda bg-subcabecalho px-4 py-3 text-xs text-gray-600">
          <nav aria-label="Páginas" className="flex items-center gap-1">
            {!preferencia.semPaginacao &&
              total > 0 &&
              numeros.map((n, k) => (
                <span key={n} className="flex items-center gap-1">
                  {k > 0 && n - numeros[k - 1] > 1 && <span className="px-1 text-gray-400">...</span>}
                  {n === pagina ? (
                    <span aria-current="page" className="flex h-7 min-w-7 items-center justify-center rounded bg-white px-2 shadow-sm ring-1 ring-borda">
                      {n}
                    </span>
                  ) : (
                    <Link href={link({ pagina: n === 1 ? "" : String(n) })} onClick={() => setSelecionados([])} className="flex h-7 min-w-7 items-center justify-center rounded px-2 hover:bg-white">
                      {n}
                    </Link>
                  )}
                </span>
              ))}
          </nav>
          <span>{total === 0 ? "0 itens" : `${primeiro} a ${ultimo}`}</span>
        </div>
      </div>

      {acoes.modais}
    </>
  );
}

/** Seleção que parece texto (com a setinha): a lista nativa fica por cima, invisível. */
function SeletorTexto({ rotulo, texto, valor, aoMudar, children }: { rotulo: string; texto: string; valor: string; aoMudar: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-700 hover:text-verde">
      <span className="max-w-48 truncate">{texto}</span>
      <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} aria-label={rotulo} className="absolute inset-0 w-full cursor-pointer opacity-0">
        {children}
      </select>
    </label>
  );
}
