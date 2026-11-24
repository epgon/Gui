"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, Ban, CalendarCheck, ChevronDown, Clock, Layers, List, Pencil, Plus, Power, Save, Search, Wallet } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { BotaoImprimir } from "@/components/exportacao/botao-imprimir";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { useSituacao } from "@/components/cadastros/use-situacao";
import { BlocoRecorrencia, recorrenciaPadrao } from "@/components/recorrentes/bloco-recorrencia";
import { Botao } from "@/components/ui/botao";
import { CampoAreaTexto, CampoSelecao, CampoTexto, CampoValor, Rotulo, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { totalDetalhado } from "@/lib/lancamentos/regras";
import type { ItemFormulario, Opcoes } from "@/lib/lancamentos/tipos";
import { INTERVALOS, OPCOES_MEDIA } from "@/lib/recorrentes/regras";
import type { AbaRecorrente, DadosPlano, DadosRecorrente, FiltrosRecorrentes, LinhaPlano, LinhaRecorrente } from "@/lib/recorrentes/tipos";
import { AlternadorTipo, CampoCategoria, CampoComNovo, CampoDestino, CampoTags } from "../lancamentos/campos";
import { ListaDetalhes, mesclar, ModalDetalhe, ModalNovaTag, ModalNovoContato } from "../lancamentos/formulario";
import { alterarSituacaoPlano, alterarSituacaoRecorrente, carregarRecorrente, salvarPlano, salvarRecorrente } from "./acoes";

const ABAS: { valor: FiltrosRecorrentes["aba"]; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "receitas", rotulo: "Receitas" },
  { valor: "despesas", rotulo: "Despesas" },
  { valor: "transferencias", rotulo: "Transferências" },
];

function vazio(opcoes: Opcoes, hoje: string, aba: AbaRecorrente = "simples", tipo: "receita" | "despesa" = "despesa"): DadosRecorrente {
  const contas = opcoes.destinos.filter((d) => d.grupo === "Contas" && d.ativo);
  return {
    aba,
    tipo,
    planoId: "",
    descricao: aba === "transferencia" ? "Transferência" : "",
    modoValor: "valor",
    mediaUltimos: "3",
    valor: "",
    categoriaId: "",
    destino: contas[0]?.valor ?? "",
    contaDestinoId: aba === "transferencia" ? (contas[1]?.valor.slice(6) ?? "") : "",
    formaPagamentoId: "",
    contatoId: "",
    tagIds: [],
    itens: [],
    observacao: "",
    realizarAutomaticamente: false,
    recorrencia: recorrenciaPadrao(hoje),
  };
}

type Pedido = { chave: number; id: number | null; dados: DadosRecorrente };

export function TelaRecorrentes({ linhas, filtros, opcoes, planos, hoje, caminho, editarId }: {
  linhas: LinhaRecorrente[];
  filtros: FiltrosRecorrentes;
  opcoes: Opcoes;
  planos: LinhaPlano[];
  hoje: string;
  caminho: string;
  editarId: number | null;
}) {
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [verPlanos, setVerPlanos] = useState(false);
  const [aviso, setAviso] = useState("");
  const [abrindo, iniciarAbertura] = useTransition();
  const situacao = useSituacao(alterarSituacaoRecorrente);

  const parametros: Record<string, string> = {
    aba: filtros.aba === "todos" ? "" : filtros.aba,
    destino: filtros.destino,
    intervalo: filtros.intervalo,
    situacao: filtros.situacao === "ativos" ? "" : filtros.situacao,
    busca: filtros.busca,
    detalhar: filtros.detalhar ? "1" : "",
    categoria: filtros.categoria,
    forma: filtros.forma,
    contato: filtros.contato,
    tag: filtros.tag,
    plano: filtros.plano,
  };
  const link = (mudancas: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries({ ...parametros, ...mudancas }).filter(([, v]) => v));
    const qs = sp.toString();
    return qs ? `${caminho}?${qs}` : caminho;
  };

  const novo = (aba: AbaRecorrente = "simples", tipo: "receita" | "despesa" = "despesa") => {
    const dados = vazio(opcoes, hoje, aba, tipo);
    if (filtros.destino && (aba !== "transferencia" || filtros.destino.startsWith("conta:"))) dados.destino = filtros.destino;
    setPedido({ chave: Date.now(), id: null, dados });
  };

  const editar = (id: number) =>
    iniciarAbertura(async () => {
      setAviso("");
      const dados = await carregarRecorrente(id);
      if (!dados) {
        setAviso("Este recorrente não existe mais.");
        return;
      }
      setPedido({ chave: Date.now(), id, dados });
    });

  // Vindo de "Editar o recorrente" na lista de Lançamentos: abre a edição direto.
  const pedidoUrl = useRef(editarId);
  useEffect(() => {
    if (!pedidoUrl.current) return;
    const id = pedidoUrl.current;
    pedidoUrl.current = null;
    editar(id);
    router.replace(link({}), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const destinoAtual = opcoes.destinos.find((d) => d.valor === filtros.destino);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Botao icone={<Plus className="h-4 w-4" />} onClick={() => novo()}>
          Adicionar
        </Botao>
        <Botao variante="secundario" icone={<Layers className="h-4 w-4" />} onClick={() => setVerPlanos(true)}>
          Planos
        </Botao>
        {abrindo && <span className="text-sm text-gray-500">Abrindo...</span>}
        <BotaoImprimir tela="recorrentes" parametros={parametros} className="ml-auto" />
        <Form action={caminho} className="flex w-full items-center sm:w-72" role="search">
          {Object.entries(parametros)
            .filter(([k, v]) => k !== "busca" && v)
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <label className="flex h-9 w-full items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm focus-within:border-verde">
            <Search className="h-4 w-4 text-gray-400" />
            <input name="busca" defaultValue={filtros.busca} key={filtros.busca} placeholder="Buscar recorrente" aria-label="Buscar recorrente" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
          </label>
        </Form>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-white px-4 py-3 shadow-cartao">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Conta ou Cartão</span>
          {destinoAtual ? <IconeBanco codigo={destinoAtual.bancoCodigo} nome={destinoAtual.bancoNome ?? "Outro"} className="h-7 w-7 text-[10px]" /> : <Wallet className="h-5 w-5 text-gray-400" />}
          <select value={filtros.destino} onChange={(e) => router.push(link({ destino: e.target.value }))} className="h-9 rounded-md border border-borda bg-white px-2 text-sm">
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
          </select>
        </label>
        <select value={filtros.intervalo} onChange={(e) => router.push(link({ intervalo: e.target.value }))} aria-label="Intervalo" className="h-9 rounded-md border border-borda bg-white px-2 text-sm">
          <option value="">Todos os intervalos</option>
          {INTERVALOS.map((i) => (
            <option key={i.valor} value={i.valor}>
              {i.rotulo}
            </option>
          ))}
        </select>
        <div className="ml-auto" title="Mostra os itens dos recorrentes detalhados e as tags">
          <Chave ligada={filtros.detalhar} aoMudar={(v) => router.push(link({ detalhar: v ? "1" : "" }))} rotulo="Detalhar" />
        </div>
      </div>

      <div className="flex gap-1 border-b border-borda" role="tablist">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={link({ aba: a.valor === "todos" ? "" : a.valor })}
            role="tab"
            aria-selected={filtros.aba === a.valor}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", filtros.aba === a.valor ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}
          >
            {a.rotulo}
          </Link>
        ))}
      </div>

      <FaixaErro>{(aviso || situacao.aviso) && <TextoComDestaque texto={aviso || situacao.aviso} />}</FaixaErro>

      <div className="overflow-hidden rounded-xl border border-borda bg-white shadow-cartao">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5 text-left font-semibold">Intervalo</th>
                <th className="px-3 py-2.5 text-left font-semibold">Dia</th>
                <th className="px-3 py-2.5 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2.5 text-center font-semibold">Realizar</th>
                <th className="px-3 py-2.5 text-center font-semibold">Dia Útil</th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                <th className="w-12 px-3 py-2.5 text-center font-semibold">
                  <span className="sr-only">Ativo</span>
                </th>
                <th className="w-10 px-3 py-2.5">
                  <span className="sr-only">Opções</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    {opcoes.destinos.length === 0 ? (
                      <>
                        Cadastre primeiro uma{" "}
                        <Link href="/cadastros/contas-financeiras" className="font-semibold text-verde hover:underline">
                          Conta Financeira
                        </Link>
                        .
                      </>
                    ) : (
                      <>
                        Nenhum recorrente{filtros.busca || filtros.destino || filtros.intervalo || filtros.aba !== "todos" ? " com esses filtros" : " cadastrado"}. Use{" "}
                        <strong>Adicionar</strong> para contas que se repetem, como aluguel, salário e assinaturas.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                linhas.map((l) => (
                  <LinhaTabela
                    key={l.id}
                    l={l}
                    detalhar={filtros.detalhar}
                    aoEditar={() => editar(l.id)}
                    situacao={<ChaveSituacao ativo={l.ativo} ocupado={situacao.ocupadoId === l.id} aoMudar={() => situacao.alternar(l.id, l.ativo)} rotulo={l.descricao} />}
                    menu={
                      <MenuLinha
                        rotulo={l.descricao}
                        itens={[
                          { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(l.id) },
                          { rotulo: l.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => situacao.alternar(l.id, l.ativo) },
                        ]}
                      />
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borda px-4 py-3 text-sm text-gray-500">
          <span>{linhas.length === 0 ? "0 itens" : `1 a ${linhas.length}`}</span>
          <span>Inativar para de gerar os próximos lançamentos. Os que já foram lançados continuam.</span>
        </div>
      </div>

      {pedido && <ModalRecorrente key={pedido.chave} pedido={pedido} opcoes={opcoes} planos={planos} hoje={hoje} aoFechar={() => setPedido(null)} />}
      {verPlanos && <ModalPlanos planos={planos} aoFechar={() => setVerPlanos(false)} />}
    </>
  );
}

function LinhaTabela({ l, detalhar, aoEditar, situacao, menu }: { l: LinhaRecorrente; detalhar: boolean; aoEditar: () => void; situacao: React.ReactNode; menu: React.ReactNode }) {
  const transferencia = l.formato === "transferencia";
  return (
    <>
      <tr className={cn("border-b border-borda last:border-0 even:bg-gray-50/70 hover:bg-verde-claro/50", !l.ativo && "text-gray-400")}>
        <td className="px-3 py-2.5">
          {transferencia ? (
            <ArrowLeftRight className="h-4 w-4 text-verde" aria-label="Transferência" />
          ) : l.tipo === "receita" ? (
            <ArrowDown className="h-4 w-4 text-receita" aria-label="Receita" />
          ) : (
            <ArrowUp className="h-4 w-4 text-despesa" aria-label="Despesa" />
          )}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">{l.intervalo}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">{l.dia}</td>
        <td className="px-3 py-2.5">
          <button type="button" onClick={aoEditar} className="flex w-full items-center gap-3 text-left">
            <IconeBanco codigo={l.bancoCodigo} nome={l.bancoNome ?? "Outro"} className="h-7 w-7 shrink-0 text-[10px]" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={cn("font-medium", l.ativo ? "text-gray-900" : "text-gray-400")}>{l.descricao}</span>
                {l.formato === "detalhado" && <span className="rounded bg-verde-claro px-1.5 text-xs text-verde">Detalhado</span>}
                {l.plano && <span className="rounded bg-amarelo px-1.5 text-xs text-amarelo-texto">Plano {l.plano}</span>}
                {!l.ativo && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-500">Inativo</span>}
                {detalhar &&
                  l.tags.map((t) => (
                    <span key={t} className="rounded-full bg-verde-claro px-2 text-xs text-verde">
                      {t}
                    </span>
                  ))}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                {l.categoriaCor && <span className="h-2 w-2 rounded-full" style={{ background: l.categoriaCor }} />}
                {[l.categoria, transferencia ? `${l.contaOuCartao} → ${l.contaDestino ?? "?"}` : l.contaOuCartao, l.contato, l.fim].filter(Boolean).join(" · ")}
              </span>
              {l.proximo && <span className="block text-xs text-verde">Próximo: {formatarData(l.proximo)}</span>}
              {l.ativo && !l.proximo && <span className="block text-xs text-gray-400">Sem próximos lançamentos</span>}
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5 text-center">
          {l.realizarAutomaticamente ? (
            <Clock className="mx-auto h-4 w-4 text-verde" aria-label="Realiza automaticamente" />
          ) : (
            <Ban className="mx-auto h-4 w-4 text-gray-300" aria-label="Não realiza automaticamente" />
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {l.apenasDiaUtil ? <CalendarCheck className="mx-auto h-4 w-4 text-verde" aria-label="Apenas dia útil" /> : <Ban className="mx-auto h-4 w-4 text-gray-300" aria-label="Qualquer dia" />}
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <Valor centavos={l.valorCentavos} className={transferencia ? "text-gray-700!" : undefined} />
          {l.mediaUltimos > 0 && <span className="block text-xs text-gray-500">{l.mediaUltimos === 1 ? "último valor" : `média de ${l.mediaUltimos}`}</span>}
        </td>
        <td className="px-3 py-2.5 text-center">{situacao}</td>
        <td className="px-3 py-2.5 text-right">{menu}</td>
      </tr>
      {detalhar &&
        l.itens.map((i) => (
          <tr key={`i${i.id}`} className="border-b border-borda bg-subcabecalho/60 text-xs">
            <td colSpan={3} />
            <td className="py-1.5 pr-3 pl-13">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: i.categoriaCor }} />
                <span className="text-gray-800">{i.descricao}</span>
                <span className="text-gray-500">· {i.categoria}</span>
              </span>
            </td>
            <td colSpan={2} />
            <td className="px-3 py-1.5 text-right">
              <Valor centavos={i.valorCentavos} />
            </td>
            <td colSpan={2} />
          </tr>
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Novo / Editando Recorrente
// ---------------------------------------------------------------------------

function ModalRecorrente({ pedido, opcoes, planos, hoje, aoFechar }: { pedido: Pedido; opcoes: Opcoes; planos: LinhaPlano[]; hoje: string; aoFechar: () => void }) {
  const novo = pedido.id === null;
  const [d, setD] = useState<DadosRecorrente>(pedido.dados);
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const [continuar, setContinuar] = useState(false);
  const [salvos, setSalvos] = useState(0);
  const [maisInfo, setMaisInfo] = useState(!!pedido.dados.observacao);
  const [sub, setSub] = useState<null | "detalhe" | "tag" | "contato">(null);
  const [itemEditando, setItemEditando] = useState<ItemFormulario | null>(null);
  const [extras, setExtras] = useState<{ tags: Opcoes["tags"]; contatos: Opcoes["contatos"] }>({ tags: [], contatos: [] });
  const tags = mesclar(opcoes.tags, extras.tags);
  const contatos = mesclar(opcoes.contatos, extras.contatos);

  const mudar = <K extends keyof DadosRecorrente>(campo: K, valor: DadosRecorrente[K]) => {
    setD((x) => ({ ...x, [campo]: valor }));
    setErro("");
  };

  const aba = d.aba;
  const detalhado = aba === "detalhado";
  const transferencia = aba === "transferencia";
  const eCartao = d.destino.startsWith("cartao:");
  const total = totalDetalhado(d.itens.map((i) => ({ tipo: i.tipo, valorCentavos: lerValorEmCentavos(i.valor) ?? 0 })));
  const tipoEfetivo = detalhado && d.itens.length ? total.tipo : d.tipo;
  const valorCentavos = detalhado ? total.valorCentavos : (lerValorEmCentavos(d.valor) ?? 0);
  const plano = planos.find((p) => String(p.id) === d.planoId);
  const planosDoTipo = planos.filter((p) => p.tipo === d.tipo && (p.ativo || String(p.id) === d.planoId));
  const media = d.modoValor === "media";

  const trocarAba = (nova: AbaRecorrente) => {
    if (nova === aba) return;
    setErro("");
    setD((x) => {
      const base = vazio(opcoes, hoje, nova, x.tipo);
      return {
        ...base,
        descricao: nova === "transferencia" ? "Transferência" : x.descricao === "Transferência" ? "" : x.descricao,
        valor: x.valor,
        destino: nova === "transferencia" && !x.destino.startsWith("conta:") ? base.destino : x.destino,
        formaPagamentoId: x.formaPagamentoId,
        contatoId: nova === "transferencia" ? "" : x.contatoId,
        tagIds: x.tagIds,
        observacao: x.observacao,
        categoriaId: nova === "simples" ? x.categoriaId : "",
        realizarAutomaticamente: x.realizarAutomaticamente,
        recorrencia: x.recorrencia,
      };
    });
  };

  const escolherPlano = (id: string) => {
    const p = planos.find((x) => String(x.id) === id);
    setD((x) => ({ ...x, planoId: id, ...(p ? { descricao: p.descricao, valor: formatarCentavos(p.valorCentavos), modoValor: "valor" as const } : {}) }));
    setErro("");
  };

  const salvar = () =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await salvarRecorrente(pedido.id, { ...d, tipo: tipoEfetivo });
        if (!r.ok) return setErro(r.erro);
        if (continuar && novo) {
          setD({ ...vazio(opcoes, hoje, aba, d.tipo), destino: d.destino });
          setSalvos((n) => n + 1);
        } else aoFechar();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua conexão e tente de novo.");
      }
    });

  const resumo = [d.descricao || "Descrição", `${tipoEfetivo === "receita" && !transferencia ? "" : "-"}${formatarCentavos(valorCentavos)}`, media ? "pela média" : null].filter(Boolean).join(" · ");

  return (
    <>
      <Modal
        aberto
        aoFechar={aoFechar}
        largura="larga"
        titulo={novo ? "Novo Recorrente" : "Editando Recorrente"}
        resumo={resumo}
        rodape={
          <>
            {novo && (
              <div className="mr-auto">
                <Chave ligada={continuar} aoMudar={setContinuar} rotulo="Salvar e Adicionar Novo" />
              </div>
            )}
            <Botao variante="secundario" type="button" onClick={aoFechar}>
              Voltar
            </Botao>
            <Botao type="submit" form="formulario-recorrente" carregando={salvando} icone={<Save className="h-4 w-4" />}>
              Salvar
            </Botao>
          </>
        }
      >
        <form
          id="formulario-recorrente"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
          className="space-y-4"
        >
          {novo && (
            <div className="flex gap-1 border-b border-borda" role="tablist">
              {(["simples", "detalhado", "transferencia"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  role="tab"
                  aria-selected={aba === a}
                  onClick={() => trocarAba(a)}
                  className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", aba === a ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}
                >
                  {a === "simples" ? "Simples" : a === "detalhado" ? "Detalhado" : "Transferência"}
                </button>
              ))}
            </div>
          )}

          {salvos > 0 && novo && !erro && (
            <p className="rounded-md bg-pago-fundo px-3 py-2 text-sm text-pago-texto">{salvos === 1 ? "1 recorrente salvo." : `${salvos} recorrentes salvos.`} Preencha o próximo.</p>
          )}

          {!novo && (
            <p className="rounded-md bg-amarelo px-3 py-2 text-xs text-amarelo-texto">
              As mudanças valem para os próximos lançamentos ainda não pagos. Os que já foram pagos ou editados continuam como estão.
            </p>
          )}

          {!transferencia && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {detalhado ? (
                <Botao type="button" variante="novo" icone={<Plus className="h-4 w-4" />} onClick={() => { setItemEditando(null); setSub("detalhe"); }}>
                  Novo Detalhe
                </Botao>
              ) : (
                <AlternadorTipo
                  valor={d.tipo}
                  aoMudar={(t) => setD((x) => ({ ...x, tipo: t, categoriaId: "", planoId: "" }))}
                />
              )}
            </div>
          )}

          {aba === "simples" && (planosDoTipo.length > 0 || d.planoId) && (
            <CampoSelecao
              rotulo="Plano"
              ajuda="Com um plano, a descrição e o valor vêm dele. Ao editar o plano, todos os recorrentes ligados são atualizados."
              valor={d.planoId}
              aoMudar={escolherPlano}
              opcoes={[{ valor: "", rotulo: "Nenhum (opcional)" }, ...planosDoTipo.map((p) => ({ valor: String(p.id), rotulo: `${p.nome} · ${formatarCentavos(p.valorCentavos)}` }))]}
            />
          )}

          <CampoTexto
            rotulo="Descrição"
            obrigatorio
            autoFocus
            maxLength={120}
            desabilitado={!!plano}
            valor={d.descricao}
            aoMudar={(v) => mudar("descricao", v)}
            ajuda="Você pode usar as variáveis #ano# e #mes#: elas são trocadas pelo ano e mês do vencimento. Ex.: Luz #mes#/#ano# vira Luz 11/2026."
          />

          {detalhado && (
            <ListaDetalhes
              itens={d.itens}
              opcoes={opcoes}
              aoEditar={(i) => {
                setItemEditando(i);
                setSub("detalhe");
              }}
              aoExcluir={(i) => mudar("itens", d.itens.filter((x) => x.chave !== i.chave))}
            />
          )}

          {detalhado ? (
            <div className="sm:w-1/2">
              <Rotulo texto="Valor" ajuda="Soma dos detalhes: receitas menos despesas." />
              <div className="flex h-10 items-center justify-end rounded-md border border-borda bg-gray-50 px-3 text-sm tabular-nums text-gray-500">
                {d.itens.length ? `${total.tipo === "despesa" ? "-" : ""}${formatarCentavos(total.valorCentavos)}` : "0,00"}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 flex items-center gap-4 text-sm font-medium text-gray-700" role="radiogroup" aria-label="Média ou Valor">
                <label className="flex items-center gap-1.5" title="Escolha uma opção para calcular o valor médio">
                  <input type="radio" name="modo-valor" checked={media} disabled={!!plano} onChange={() => mudar("modoValor", "media")} className="accent-verde" /> Média
                </label>
                <label className="flex items-center gap-1.5" title="Defina o valor exato para gerar os lançamentos">
                  <input type="radio" name="modo-valor" checked={!media} onChange={() => mudar("modoValor", "valor")} className="accent-verde" /> Valor
                  <span className="text-despesa">*</span>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {media && (
                  <CampoSelecao rotulo="Calcular pela" valor={d.mediaUltimos} aoMudar={(v) => mudar("mediaUltimos", v)} opcoes={OPCOES_MEDIA} ajuda="Usa os últimos lançamentos já pagos deste recorrente." />
                )}
                <CampoValor
                  rotulo={media ? "Valor de referência" : "Valor"}
                  obrigatorio
                  desabilitado={!!plano}
                  valor={d.valor}
                  aoMudar={(v) => mudar("valor", v)}
                  ajuda={media ? "Usado enquanto ainda não houver lançamentos pagos para calcular a média." : undefined}
                />
              </div>
            </div>
          )}

          {transferencia ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoDestino rotulo="Conta Financeira" valor={d.destino} aoMudar={(v) => mudar("destino", v)} destinos={opcoes.destinos} soContas ajuda="Conta de onde o dinheiro sai." />
              <CampoDestino
                rotulo="Conta de Destino"
                valor={d.contaDestinoId ? `conta:${d.contaDestinoId}` : ""}
                aoMudar={(v) => mudar("contaDestinoId", v.slice(6))}
                destinos={opcoes.destinos}
                soContas
                excluir={d.destino}
              />
              <CampoComNovo rotulo="Forma de Pagamento" valor={d.formaPagamentoId} aoMudar={(v) => mudar("formaPagamentoId", v)} opcoes={opcoes.formas} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {!detalhado && <CampoCategoria valor={d.categoriaId} aoMudar={(v) => mudar("categoriaId", v)} categorias={opcoes.categorias} natureza={d.tipo} />}
              <CampoDestino rotulo="Conta ou Cartão" valor={d.destino} aoMudar={(v) => mudar("destino", v)} destinos={opcoes.destinos} />
              <CampoComNovo rotulo="Forma de Pagamento" valor={d.formaPagamentoId} aoMudar={(v) => mudar("formaPagamentoId", v)} opcoes={opcoes.formas} />
              <CampoComNovo
                rotulo="Cliente ou Fornecedor"
                valor={d.contatoId}
                aoMudar={(v) => mudar("contatoId", v)}
                opcoes={contatos}
                aoCriar={() => setSub("contato")}
                rotuloNovo="Novo Cliente ou Fornecedor"
              />
            </div>
          )}

          <CampoTags valor={d.tagIds} aoMudar={(v) => mudar("tagIds", v)} tags={tags} aoCriar={() => setSub("tag")} />

          <BlocoRecorrencia
            valor={d.recorrencia}
            aoMudar={(p) => {
              setD((x) => ({ ...x, recorrencia: { ...x.recorrencia, ...p } }));
              setErro("");
            }}
            realizar={d.realizarAutomaticamente}
            aoMudarRealizar={(v) => mudar("realizarAutomaticamente", v)}
            eCartao={eCartao}
          />

          <div>
            <button type="button" onClick={() => setMaisInfo((m) => !m)} className="flex items-center gap-1 text-sm font-semibold text-verde">
              <ChevronDown className={cn("h-4 w-4 transition", maisInfo && "rotate-180")} /> Mais Informações
            </button>
            {maisInfo && (
              <div className="mt-3">
                <CampoAreaTexto rotulo="Observação" valor={d.observacao} aoMudar={(v) => mudar("observacao", v.slice(0, 1000))} linhas={3} ajuda="Vai junto em cada lançamento gerado." />
              </div>
            )}
          </div>

          <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        </form>
      </Modal>

      {sub === "detalhe" && (
        <ModalDetalhe
          item={itemEditando}
          opcoes={opcoes}
          aoFechar={() => setSub(null)}
          aoSalvar={(i) => {
            setD((x) => ({ ...x, itens: x.itens.some((y) => y.chave === i.chave) ? x.itens.map((y) => (y.chave === i.chave ? i : y)) : [...x.itens, i] }));
            setErro("");
          }}
        />
      )}
      {sub === "tag" && (
        <ModalNovaTag
          aoFechar={() => setSub(null)}
          aoCriar={(id, rotulo) => {
            setExtras((o) => ({ ...o, tags: [...o.tags, { id, rotulo, ativo: true }] }));
            mudar("tagIds", [...d.tagIds, id]);
            setSub(null);
          }}
        />
      )}
      {sub === "contato" && (
        <ModalNovoContato
          tipo={tipoEfetivo}
          aoFechar={() => setSub(null)}
          aoCriar={(id, rotulo) => {
            setExtras((o) => ({ ...o, contatos: [...o.contatos, { id, rotulo, ativo: true }] }));
            mudar("contatoId", String(id));
            setSub(null);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

const PLANO_VAZIO: DadosPlano = { nome: "", descricao: "", tipo: "despesa", valor: "" };

function ModalPlanos({ planos, aoFechar }: { planos: LinhaPlano[]; aoFechar: () => void }) {
  const [editando, setEditando] = useState<{ id: number | null; dados: DadosPlano } | null>(null);
  const situacao = useSituacao(alterarSituacaoPlano);
  return (
    <>
      <Modal
        aberto
        aoFechar={aoFechar}
        largura="larga"
        titulo="Planos"
        resumo="Utilize os planos para gerenciar os recorrentes que possuem a mesma descrição e valor. Ao editar a descrição ou o valor de um plano, todos os recorrentes vinculados a esse plano serão atualizados automaticamente."
        rodape={
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
        }
      >
        <div className="mb-3 flex items-center gap-2">
          <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando({ id: null, dados: PLANO_VAZIO })}>
            Adicionar
          </Botao>
        </div>
        <FaixaErro>{situacao.aviso && <TextoComDestaque texto={situacao.aviso} />}</FaixaErro>
        {planos.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-borda px-4 py-10 text-center text-sm text-gray-500">
            <List className="h-6 w-6 text-gray-400" />
            <strong className="text-gray-800">Nenhum Plano</strong>
            Não existem registros até o momento.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-borda">
            <table className="w-full text-sm">
              <thead className="bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="w-12 px-3 py-2" />
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {planos.map((p) => {
                  const dados: DadosPlano = { nome: p.nome, descricao: p.descricao, tipo: p.tipo, valor: formatarCentavos(p.valorCentavos) };
                  return (
                    <tr key={p.id} className={cn("border-t border-borda", !p.ativo && "text-gray-400")}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setEditando({ id: p.id, dados })} className="text-left font-medium hover:underline">
                          {p.nome}
                        </button>
                        <span className="block text-xs text-gray-500">{p.usos === 1 ? "1 recorrente" : `${p.usos} recorrentes`}</span>
                      </td>
                      <td className="px-3 py-2">{p.descricao}</td>
                      <td className="px-3 py-2 text-right">
                        <Valor centavos={p.tipo === "receita" ? p.valorCentavos : -p.valorCentavos} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <ChaveSituacao ativo={p.ativo} ocupado={situacao.ocupadoId === p.id} aoMudar={() => situacao.alternar(p.id, p.ativo)} rotulo={p.nome} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MenuLinha
                          rotulo={p.nome}
                          itens={[
                            { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => setEditando({ id: p.id, dados }) },
                            { rotulo: p.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => situacao.alternar(p.id, p.ativo) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-borda px-3 py-2 text-right text-xs text-gray-500">1 a {planos.length}</p>
          </div>
        )}
      </Modal>
      {editando && <ModalPlano key={editando.id ?? "novo"} id={editando.id} inicial={editando.dados} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function ModalPlano({ id, inicial, aoFechar }: { id: number | null; inicial: DadosPlano; aoFechar: () => void }) {
  const [d, setD] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const mudar = (p: Partial<DadosPlano>) => {
    setD((x) => ({ ...x, ...p }));
    setErro("");
  };
  const salvar = () =>
    iniciar(async () => {
      try {
        const r = await salvarPlano(id, d);
        if (!r.ok) return setErro(r.erro);
        aoFechar();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua conexão e tente de novo.");
      }
    });
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={id === null ? "Novo Plano" : "Editando Plano"}
      resumo={id === null ? undefined : "Ao salvar, a descrição e o valor de todos os recorrentes ligados a este plano são atualizados."}
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="submit" form="formulario-plano" carregando={salvando} icone={<Save className="h-4 w-4" />}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="formulario-plano" noValidate onSubmit={(e) => { e.preventDefault(); salvar(); }} className="space-y-4">
        <AlternadorTipo valor={d.tipo} aoMudar={(t) => mudar({ tipo: t })} />
        <CampoTexto rotulo="Nome" obrigatorio autoFocus maxLength={80} valor={d.nome} aoMudar={(v) => mudar({ nome: v })} ajuda="Ex.: Mensalidade Escolar." />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto rotulo="Descrição" obrigatorio maxLength={120} valor={d.descricao} aoMudar={(v) => mudar({ descricao: v })} ajuda="Vira a descrição dos recorrentes ligados. Ex.: Fundamental III." />
          <CampoValor rotulo="Valor" obrigatorio valor={d.valor} aoMudar={(v) => mudar({ valor: v })} />
        </div>
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </form>
    </Modal>
  );
}
