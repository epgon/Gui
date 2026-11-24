"use client";

import { ChevronLeft, ChevronRight, CircleDollarSign, Minus, Pencil, Plus, Search, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { DetalhandoCategoria } from "@/components/categorias/detalhando-categoria";
import { Botao } from "@/components/ui/botao";
import { CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { BotaoOlho, ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { cn } from "@/lib/cn";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import type { OpcaoDestino } from "@/lib/lancamentos/tipos";
import { percentualUsado, situacaoDoUso, type CartaoOrcamento, type NoOrcamento, type Orcamento } from "@/lib/orcamentos/regras";
import type { FiltrosOrcamento } from "@/lib/orcamentos/servidor";
import { DATAS_CONSIDERADAS } from "@/lib/relatorios/regras";
import { definirLimite, removerCategoriaOrcamento, salvarCategoriasOrcamento, type DadosLimite } from "./acoes";

export type Raiz = { id: number; numero: string; nome: string; cor: string; natureza: "receita" | "despesa" };
type Mes = { anoMes: string; rotulo: string; anterior: string; seguinte: string };

const campo = "h-9 rounded-md border border-borda bg-white px-2 text-sm outline-none focus:border-verde";

// ---------------------------------------------------------------------------
// Escolha das categorias (primeiro acesso e "Adicionar Categoria")
// ---------------------------------------------------------------------------

function Bolinha({ cor, numero, grande }: { cor: string; numero: string; grande?: boolean }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", grande ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs")}
      style={{ backgroundColor: cor }}
    >
      {numero.replace(/\.$/, "")}
    </span>
  );
}

function ListaDeEscolha({ raizes, ligadas, aoMudar }: { raizes: Raiz[]; ligadas: Set<number>; aoMudar: (id: number, v: boolean) => void }) {
  return (
    <ul className="divide-y divide-borda rounded-lg border border-borda">
      {raizes.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex items-center gap-3 text-sm font-medium text-gray-800">
            <Bolinha cor={r.cor} numero={r.numero} />
            {r.nome}
          </span>
          <Chave ligada={ligadas.has(r.id)} aoMudar={(v) => aoMudar(r.id, v)} rotulo={ligadas.has(r.id) ? "Incluída" : "Fora"} />
        </li>
      ))}
    </ul>
  );
}

function useEscolha(iniciais: number[]) {
  const [ligadas, setLigadas] = useState(() => new Set(iniciais));
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const mudar = (id: number, v: boolean) => {
    setErro("");
    setLigadas((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  };
  const salvar = (depois?: () => void) =>
    iniciar(async () => {
      const r = await salvarCategoriasOrcamento([...ligadas]);
      if (!r.ok) setErro(r.erro);
      else depois?.();
    });
  return { ligadas, setLigadas, mudar, erro, setErro, salvando, salvar };
}

/** Primeiro acesso: "Selecione as Categorias do Orçamento". */
export function PrimeiroAcesso({ raizes }: { raizes: Raiz[] }) {
  // Começa com as de despesa ligadas: é o uso mais comum.
  const e = useEscolha(raizes.filter((r) => r.natureza === "despesa").map((r) => r.id));
  return (
    <section className="mx-auto max-w-xl rounded-xl border border-borda bg-white shadow-cartao">
      <header className="border-b border-borda px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Selecione as Categorias do Orçamento</h2>
        <p className="mt-0.5 text-sm text-gray-500">Na próxima etapa as categorias filhas serão exibidas, e você define o limite de cada uma.</p>
      </header>
      <div className="space-y-3 px-5 py-4">
        <FaixaErro>{e.erro && <TextoComDestaque texto={e.erro} />}</FaixaErro>
        {raizes.length ? (
          <ListaDeEscolha raizes={raizes} ligadas={e.ligadas} aoMudar={e.mudar} />
        ) : (
          <p className="text-sm text-gray-500">Nenhuma categoria ativa. Cadastre categorias em Cadastros &gt; Categorias.</p>
        )}
      </div>
      <footer className="flex justify-end border-t border-borda bg-subcabecalho px-5 py-3">
        <Botao onClick={() => e.salvar()} carregando={e.salvando} icone={<ChevronRight className="h-4 w-4" />}>
          Continuar
        </Botao>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------

const CORES_BARRA = { ok: "bg-verde-vivo", atencao: "bg-dourado", estourou: "bg-negativo", sem: "bg-gray-300" };

function Barra({ orcamento, realizado, fina }: { orcamento: number; realizado: number; fina?: boolean }) {
  const p = percentualUsado(orcamento, realizado);
  const s = situacaoDoUso(orcamento, realizado);
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-gray-100", fina ? "h-1.5" : "h-2.5")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-label={orcamento > 0 ? `${p}% do orçamento usado` : "Sem orçamento definido"}
    >
      <div className={cn("h-full rounded-full transition-all", CORES_BARRA[s])} style={{ width: `${p}%` }} />
    </div>
  );
}

/** Um dos três totais do cartão: Orçamento (+), Despesas (−) e Disponível ($). */
function Total({ rotulo, centavos, tipo }: { rotulo: string; centavos: number; tipo: "orcamento" | "gasto" | "disponivel" }) {
  const estilo = { orcamento: "bg-receita/10 text-receita", gasto: "bg-despesa/10 text-despesa", disponivel: centavos < 0 ? "bg-negativo/10 text-negativo" : "bg-verde-vivo/10 text-verde-vivo" }[tipo];
  const icone = { orcamento: <Plus className="h-4 w-4" />, gasto: <Minus className="h-4 w-4" />, disponivel: <CircleDollarSign className="h-4 w-4" /> }[tipo];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full", estilo)}>{icone}</span>
      <div>
        <p className="text-xs text-gray-500">{rotulo}</p>
        <ValorOcultavel centavos={tipo === "gasto" ? -Math.abs(centavos) || 0 : centavos} className={cn("text-sm", tipo === "orcamento" && "text-receita!", tipo === "disponivel" && centavos >= 0 && "text-verde-vivo!")} />
      </div>
    </div>
  );
}

type Edicao = { no: NoOrcamento; natureza: "receita" | "despesa"; raiz: boolean };

export function TelaOrcamento({ orcamento, mes, filtros, destinos, raizes, escolhidas, hoje }: {
  orcamento: Orcamento;
  mes: Mes;
  filtros: FiltrosOrcamento;
  destinos: OpcaoDestino[];
  raizes: Raiz[];
  escolhidas: number[];
  hoje: string;
}) {
  const router = useRouter();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const [, iniciar] = useTransition();

  const parametros: Record<string, string> = { mes: filtros.mes, destino: filtros.destino, considerar: filtros.considerar === "vencimento" ? "" : filtros.considerar };
  const ir = (mudancas: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries({ ...parametros, ...mudancas }).filter(([, v]) => v));
    router.push(`/gestao/orcamentos?${sp.toString()}`);
  };
  const destinoAtual = destinos.find((d) => d.valor === filtros.destino);

  const remover = (c: CartaoOrcamento) => {
    if (!window.confirm(`Tirar ${c.nome} do orçamento? Os limites ficam guardados e voltam se você incluir a categoria de novo.`)) return;
    setAviso("");
    iniciar(async () => {
      const r = await removerCategoriaOrcamento(c.id);
      if (!r.ok) setAviso(r.erro);
    });
  };

  const menuDo = (no: NoOrcamento, natureza: "receita" | "despesa", raiz: CartaoOrcamento | null) => [
    { rotulo: no.limiteProprio === null ? "Definir limite" : "Alterar limite", icone: <Pencil className="h-4 w-4" />, aoClicar: () => setEdicao({ no, natureza, raiz: !!raiz }) },
    { rotulo: "Detalhar categoria", icone: <Search className="h-4 w-4" />, aoClicar: () => setDetalhe(no.id) },
    ...(raiz ? [{ rotulo: "Tirar do orçamento", icone: <Trash2 className="h-4 w-4" />, aoClicar: () => remover(raiz) }] : []),
  ];

  return (
    <ProvedorOcultar>
      {/* Filtros: Conta ou Cartão, mês e "Considerar" */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-white px-4 py-3 shadow-cartao">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Conta ou Cartão</span>
          {destinoAtual ? <IconeBanco codigo={destinoAtual.bancoCodigo} nome={destinoAtual.bancoNome ?? "Outro"} className="h-7 w-7 text-[10px]" /> : <Wallet className="h-5 w-5 text-gray-400" />}
          <select value={filtros.destino} onChange={(e) => ir({ destino: e.target.value })} className={campo}>
            <option value="">Todas as contas e cartões</option>
            {(["Contas", "Cartões"] as const).map((g) => {
              const itens = destinos.filter((d) => d.grupo === g && (d.ativo || d.valor === filtros.destino));
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
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => ir({ mes: mes.anterior })} aria-label="Mês anterior" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <label className="relative">
            <span className="block min-w-40 cursor-pointer text-center text-sm font-semibold text-gray-900">{mes.rotulo}</span>
            <input type="month" value={mes.anoMes} onChange={(e) => e.target.value && ir({ mes: e.target.value })} aria-label="Escolher mês" className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <button type="button" onClick={() => ir({ mes: mes.seguinte })} aria-label="Próximo mês" className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </button>
          {mes.anoMes !== hoje.slice(0, 7) && (
            <button type="button" onClick={() => ir({ mes: hoje.slice(0, 7) })} className="ml-1 rounded px-2 py-1 text-xs font-semibold text-verde hover:bg-verde-claro">
              Hoje
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Considerar:
          <select value={filtros.considerar} onChange={(e) => ir({ considerar: e.target.value === "vencimento" ? "" : e.target.value })} className={campo}>
            {DATAS_CONSIDERADAS.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.rotulo}
              </option>
            ))}
          </select>
        </label>
        <BotaoOlho className="ml-auto" />
      </div>

      <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>

      {/* Resumo do mês */}
      <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-borda bg-white px-5 py-4 shadow-cartao">
        <div className="min-w-48">
          <p className="text-sm font-semibold text-gray-800">Total do mês</p>
          <p className="text-xs text-gray-500">Soma das categorias de despesa</p>
        </div>
        <Total rotulo="Orçamento" centavos={orcamento.despesas.orcamento} tipo="orcamento" />
        <Total rotulo="Despesas" centavos={orcamento.despesas.realizado} tipo="gasto" />
        <Total rotulo="Disponível" centavos={orcamento.despesas.disponivel} tipo="disponivel" />
        <div className="min-w-40 flex-1">
          <Barra orcamento={orcamento.despesas.orcamento} realizado={orcamento.despesas.realizado} />
          <p className="mt-1 text-xs text-gray-500">
            {orcamento.despesas.orcamento > 0 ? `${percentualUsado(orcamento.despesas.orcamento, orcamento.despesas.realizado)}% usado` : "Defina limites nas categorias abaixo"}
          </p>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-2">
        {orcamento.cartoes.map((c) => (
          <CartaoCategoria key={c.id} cartao={c} menuDo={menuDo} aoDefinir={(no) => setEdicao({ no, natureza: c.natureza, raiz: no.id === c.id })} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAdicionando(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borda bg-white/50 py-4 text-sm font-semibold text-gray-600 hover:border-verde hover:text-verde"
      >
        <Plus className="h-4 w-4" />
        Adicionar Categoria
      </button>

      <p className="text-xs text-gray-500">
        As despesas somam a categoria e as filhas no mês, pela data escolhida em &quot;Considerar&quot;, incluindo parcelas e recorrentes previstos. Compras no cartão entram
        pelas compras, e não pelo pagamento da fatura. Um estorno na categoria diminui o gasto. O limite definido em um mês vale também para os meses seguintes, até
        você mudar de novo.
      </p>

      {edicao && <ModalLimite key={`${edicao.no.id}-${mes.anoMes}`} edicao={edicao} mes={mes} aoFechar={() => setEdicao(null)} />}
      {adicionando && <ModalCategorias raizes={raizes} escolhidas={escolhidas} aoFechar={() => setAdicionando(false)} />}
      <DetalhandoCategoria id={detalhe} aoFechar={() => setDetalhe(null)} />
    </ProvedorOcultar>
  );
}

function CartaoCategoria({ cartao: c, menuDo, aoDefinir }: {
  cartao: CartaoOrcamento;
  menuDo: (no: NoOrcamento, natureza: "receita" | "despesa", raiz: CartaoOrcamento | null) => { rotulo: string; icone: React.ReactNode; aoClicar: () => void }[];
  aoDefinir: (no: NoOrcamento) => void;
}) {
  const receita = c.natureza === "receita";
  const linhas: NoOrcamento[] = [];
  const abrir = (nos: NoOrcamento[]) => nos.forEach((n) => (linhas.push(n), abrir(n.filhos)));
  abrir(c.filhos);

  return (
    <section className="rounded-xl border border-borda bg-white shadow-cartao">
      <header className="space-y-3 border-b border-borda px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-3 text-base font-semibold text-gray-900">
            <Bolinha cor={c.cor} numero={c.numero} grande />
            {c.nome}
            {!c.ativo && <span className="text-xs font-normal text-gray-400">(inativa)</span>}
          </h2>
          <MenuLinha rotulo={c.nome} itens={menuDo(c, c.natureza, c)} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Total rotulo={receita ? "Previsto" : "Orçamento"} centavos={c.orcamento} tipo="orcamento" />
          {receita ? <Total rotulo="Recebido" centavos={c.realizado} tipo="orcamento" /> : <Total rotulo="Despesas" centavos={c.realizado} tipo="gasto" />}
          <Total rotulo={receita ? "Falta receber" : "Disponível"} centavos={c.disponivel} tipo="disponivel" />
        </div>
        <Barra orcamento={c.orcamento} realizado={c.realizado} />
        {c.limiteProprio === null && c.orcamento === 0 && (
          <button type="button" onClick={() => aoDefinir(c)} className="text-xs font-semibold text-verde hover:underline">
            Definir o limite de {c.nome}
          </button>
        )}
        {c.filhasPassam && <AvisoFilhas no={c} />}
      </header>
      {linhas.length > 0 && (
        <ul className="divide-y divide-borda">
          {linhas.map((n) => (
            <li key={n.id} className="flex items-center gap-3 px-4 py-2" style={{ paddingLeft: `${1 + (n.nivel - 2) * 1.25}rem` }}>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", n.ativo ? "text-gray-800" : "text-gray-400")}>
                  <span className="mr-1 text-gray-500">{n.numero}</span>
                  {n.nome}
                </p>
                {n.orcamento > 0 && (
                  <div className="mt-1 max-w-56">
                    <Barra orcamento={n.orcamento} realizado={n.realizado} fina />
                  </div>
                )}
                {n.filhasPassam && <AvisoFilhas no={n} />}
              </div>
              <div className="text-right text-xs">
                <p className="text-gray-500">
                  <ValorOcultavel centavos={receita ? n.realizado : -n.realizado || 0} className="text-xs" />
                  {n.orcamento > 0 ? (
                    <>
                      {" "}de <ValorOcultavel centavos={n.orcamento} className="text-xs" />
                    </>
                  ) : (
                    <span className="text-gray-400"> · sem limite</span>
                  )}
                </p>
                {n.orcamento > 0 && (
                  <p className={cn(n.disponivel < 0 ? "text-negativo" : "text-verde-vivo")}>
                    {n.disponivel < 0 ? (receita ? "Passou " : "Estourou ") : receita ? "Falta " : "Sobra "}
                    <ValorOcultavel centavos={Math.abs(n.disponivel)} className={cn("text-xs", n.disponivel < 0 ? "text-negativo!" : "text-verde-vivo!")} />
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => aoDefinir(n)}
                className="rounded border border-borda px-2 py-1 text-xs font-semibold text-gray-600 hover:border-verde hover:text-verde"
                title={n.limiteProprio === null ? (n.orcamento > 0 ? "Sem limite próprio: soma das filhas" : "Definir limite") : "Alterar limite"}
              >
                Limite
              </button>
              <MenuLinha rotulo={n.nome} itens={menuDo(n, c.natureza, null)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AvisoFilhas({ no }: { no: NoOrcamento }) {
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-amarelo-texto">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      As subcategorias somam R$ {formatarCentavos(no.somaFilhas)}, mais que o limite de R$ {formatarCentavos(no.limiteProprio ?? 0)}.
    </p>
  );
}

function ModalLimite({ edicao, mes, aoFechar }: { edicao: Edicao; mes: Mes; aoFechar: () => void }) {
  const { no } = edicao;
  const [valor, setValor] = useState(no.limiteProprio === null ? "" : formatarCentavos(no.limiteProprio));
  const [modo, setModo] = useState<DadosLimite["modo"]>("seguintes");
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const nomeMes = mes.rotulo;

  const enviar = (valorCentavos: number | null) => {
    setErro("");
    iniciar(async () => {
      const r = await definirLimite({ categoriaId: no.id, mes: mes.anoMes, valorCentavos, modo });
      if (!r.ok) setErro(r.erro);
      else aoFechar();
    });
  };
  const salvar = () => {
    const centavos = lerValorEmCentavos(valor.trim());
    if (centavos === null || centavos < 0) return setErro("Preencha o campo **Limite** com um valor válido.");
    enviar(centavos);
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Limite: ${no.numero} ${no.nome}`}
      resumo={nomeMes}
      rodape={
        <>
          {no.limiteProprio !== null && (
            <Botao variante="fantasma" onClick={() => enviar(null)} disabled={salvando} className="mr-auto">
              Tirar limite
            </Botao>
          )}
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
        <CampoValor rotulo={edicao.natureza === "receita" ? "Quanto espera receber" : "Limite de gasto no mês"} obrigatorio valor={valor} aoMudar={(v) => (setValor(v), setErro(""))} />
        {no.filhos.length > 0 && (
          <p className="text-xs text-gray-500">
            As subcategorias somam hoje R$ {formatarCentavos(no.somaFilhas)}. Se você deixar sem limite, o orçamento de {no.nome} é essa soma.
          </p>
        )}
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium text-gray-700">Vale para</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="modo" checked={modo === "seguintes"} onChange={() => setModo("seguintes")} className="mt-1 accent-verde" />
            <span>
              {nomeMes} e os meses seguintes
              <span className="block text-xs text-gray-500">Substitui os limites que você já tinha definido nos meses depois deste.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="modo" checked={modo === "mes"} onChange={() => setModo("mes")} className="mt-1 accent-verde" />
            <span>
              Só {nomeMes}
              <span className="block text-xs text-gray-500">Os outros meses continuam com o limite que já tinham.</span>
            </span>
          </label>
        </fieldset>
      </div>
    </Modal>
  );
}

function ModalCategorias({ raizes, escolhidas, aoFechar }: { raizes: Raiz[]; escolhidas: number[]; aoFechar: () => void }) {
  const e = useEscolha(escolhidas);
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Categorias do Orçamento"
      resumo="Só categorias de nível 1; as filhas aparecem sozinhas."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={() => e.salvar(aoFechar)} carregando={e.salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <FaixaErro>{e.erro && <TextoComDestaque texto={e.erro} />}</FaixaErro>
        <ListaDeEscolha raizes={raizes} ligadas={e.ligadas} aoMudar={e.mudar} />
        <p className="text-xs text-gray-500">Ao tirar uma categoria, os limites dela ficam guardados e voltam se você incluir de novo.</p>
      </div>
    </Modal>
  );
}
