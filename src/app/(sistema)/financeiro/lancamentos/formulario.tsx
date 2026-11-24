"use client";

import { ArrowLeftRight, CalendarClock, ChevronDown, EllipsisVertical, FileText, Layers, MessageSquareText, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, CampoTexto, CampoValor, Rotulo, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { ACEITAR_ANEXO, TAMANHO_MAXIMO_ANEXO, tipoAnexoPermitido } from "@/lib/lancamentos/anexos";
import { faturaDaCompra, gerarParcelas, PERIODICIDADES, rotuloCompetencia, totalDetalhado, type Periodicidade } from "@/lib/lancamentos/regras";
import type { AnexoInfo, DadosLancamento, DadosParcelar, ItemFormulario, LancamentoEdicao, Opcoes, ParcelaFormulario } from "@/lib/lancamentos/tipos";
import { salvarContato } from "../../cadastros/clientes-e-fornecedores/acoes";
import { salvarTag } from "../../cadastros/tags/acoes";
import { excluirAnexo, salvarLancamento } from "./acoes";
import { AlternadorTipo, CampoCategoria, CampoComNovo, CampoDestino, CampoTags } from "./campos";

export type Aba = DadosLancamento["aba"];

/** Formulário em branco, com a primeira conta já escolhida. */
export function dadosVazios(opcoes: Opcoes, hoje: string, aba: Aba = "simples", tipo: "receita" | "despesa" = "despesa"): DadosLancamento {
  const contas = opcoes.destinos.filter((d) => d.grupo === "Contas" && d.ativo);
  return {
    aba,
    tipo,
    descricao: aba === "transferencia" ? "Transferência" : "",
    valor: "",
    data: hoje,
    pago: false,
    dataPagamento: "",
    realizarAutomaticamente: false,
    destino: contas[0]?.valor ?? "",
    contaDestinoId: aba === "transferencia" ? (contas[1]?.valor.slice(6) ?? "") : "",
    categoriaId: "",
    formaPagamentoId: "",
    contatoId: "",
    tagIds: [],
    documento: "",
    dataReferencia: "",
    observacao: "",
    itens: [],
    parcelar: null,
  };
}

const PARCELAR_PADRAO: DadosParcelar = { periodicidade: "mensal", quantidade: "2", iniciarNaParcela: "1", dividirValor: true, incluirParcelaNaDescricao: true, parcelas: [] };
const MAX_OBSERVACAO = 1000;
let contadorItens = 0;

export type Pedido = { chave: number; inicial: DadosLancamento; edicao?: LancamentoEdicao };

/** Modal "Novo Lançamento" com as abas Simples, Detalhado e Transferência. */
export function ModalLancamento({ pedido, opcoes, hoje, aoFechar }: { pedido: Pedido; opcoes: Opcoes; hoje: string; aoFechar: () => void }) {
  const router = useRouter();
  const edicao = pedido.edicao;
  const novo = !edicao;
  const [dados, setDados] = useState<DadosLancamento>(edicao?.dados ?? pedido.inicial);
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const [continuar, setContinuar] = useState(false);
  const [salvos, setSalvos] = useState(0);
  const [maisInfo, setMaisInfo] = useState(!!(dados.documento || dados.dataReferencia));
  const [menu, setMenu] = useState(false);
  const [sub, setSub] = useState<null | "detalhe" | "parcelas" | "observacao" | "anexos" | "tag" | "contato">(null);
  const [itemEditando, setItemEditando] = useState<ItemFormulario | null>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [anexos, setAnexos] = useState<AnexoInfo[]>(edicao?.anexos ?? []);
  const [opcoesExtras, setOpcoesExtras] = useState<{ tags: Opcoes["tags"]; contatos: Opcoes["contatos"] }>({ tags: [], contatos: [] });

  const tags = mesclar(opcoes.tags, opcoesExtras.tags);
  const contatos = mesclar(opcoes.contatos, opcoesExtras.contatos);

  const mudar = <K extends keyof DadosLancamento>(campo: K, valor: DadosLancamento[K]) => {
    setDados((d) => {
      const novoDados = { ...d, [campo]: valor };
      // Mudou algo que muda as parcelas: a conferência de "Ver Parcelas" precisa ser refeita.
      if (d.parcelar && ["valor", "data", "descricao"].includes(campo as string)) novoDados.parcelar = { ...d.parcelar, parcelas: [] };
      return novoDados;
    });
    setErro("");
  };
  const mudarParcelar = (p: Partial<DadosParcelar>) =>
    setDados((d) => ({ ...d, parcelar: d.parcelar ? { ...d.parcelar, parcelas: [], ...p } : null }));

  const aba = dados.aba;
  const transferencia = aba === "transferencia";
  const detalhado = aba === "detalhado";
  const eCartao = dados.destino.startsWith("cartao:");
  const contasAtivas = opcoes.destinos.filter((d) => d.grupo === "Contas" && d.ativo);
  const semOutraConta = transferencia && novo && contasAtivas.length < 2;
  const total = totalDetalhado(dados.itens.map((i) => ({ tipo: i.tipo, valorCentavos: lerValorEmCentavos(i.valor) ?? 0 })));
  const tipoEfetivo = detalhado && dados.itens.length ? total.tipo : dados.tipo;
  const valorCentavos = detalhado ? total.valorCentavos : (lerValorEmCentavos(dados.valor) ?? 0);

  // Em qual fatura a compra cai.
  const cartao = eCartao ? opcoes.cartoes.find((c) => `cartao:${c.id}` === dados.destino) : undefined;
  const fatura = cartao && /^\d{4}-\d{2}-\d{2}$/.test(dados.data) ? faturaDaCompra(dados.data, cartao.diaFechamento, cartao.diaVencimento) : null;

  const parcelasPrevistas = (() => {
    const p = dados.parcelar;
    const quantidade = Number(p?.quantidade);
    const inicio = Number(p?.iniciarNaParcela || 1);
    if (!p || !Number.isInteger(quantidade) || quantidade < 2 || quantidade > 360 || !Number.isInteger(inicio) || inicio < 1 || inicio > quantidade || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) return [];
    return gerarParcelas({
      descricao: dados.descricao.trim() || "Lançamento",
      valorCentavos,
      quantidade,
      iniciarNaParcela: inicio,
      dividirValor: p.dividirValor,
      incluirParcelaNaDescricao: p.incluirParcelaNaDescricao,
      primeiraData: dados.data,
      periodicidade: p.periodicidade as Periodicidade,
    });
  })();

  const trocarAba = (nova: Aba) => {
    if (nova === aba) return;
    setErro("");
    setDados((d) => {
      const base = dadosVazios(opcoes, hoje, nova, d.tipo);
      return {
        ...base,
        descricao: nova === "transferencia" ? "Transferência" : d.descricao === "Transferência" ? "" : d.descricao,
        valor: d.valor,
        data: d.data,
        pago: d.pago,
        dataPagamento: d.dataPagamento,
        destino: nova === "transferencia" && !d.destino.startsWith("conta:") ? base.destino : d.destino,
        contaDestinoId: nova === "transferencia" ? (contasAtivas.find((c) => c.valor !== d.destino)?.valor.slice(6) ?? "") : "",
        formaPagamentoId: d.formaPagamentoId,
        contatoId: nova === "transferencia" ? "" : d.contatoId,
        tagIds: d.tagIds,
        documento: d.documento,
        dataReferencia: d.dataReferencia,
        observacao: d.observacao,
        categoriaId: nova === "simples" ? d.categoriaId : "",
      };
    });
  };

  const salvar = () => {
    setErro("");
    if (semOutraConta) {
      setErro("Você não possui outra conta para transferir. Cadastre mais uma Conta Financeira.");
      return;
    }
    iniciar(async () => {
      try {
        const envio: DadosLancamento = { ...dados, tipo: tipoEfetivo, parcelar: novo && aba === "simples" ? dados.parcelar : null };
        const r = await salvarLancamento(edicao?.id ?? null, envio);
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        // Anexos vão depois que o lançamento existe (na 1ª parcela, se parcelado).
        const falhas: string[] = [];
        for (const arquivo of arquivos) {
          const corpo = new FormData();
          corpo.set("lancamentoId", String(r.id));
          corpo.set("arquivo", arquivo);
          const resposta = await fetch("/api/anexos", { method: "POST", body: corpo }).catch(() => null);
          if (!resposta?.ok) {
            const msg = await resposta?.json().catch(() => null);
            falhas.push(msg?.erro ?? `Não foi possível enviar **${arquivo.name}**.`);
          }
        }
        if (arquivos.length) router.refresh();
        if (falhas.length) {
          setArquivos([]);
          setErro(`Lançamento salvo, mas ${falhas.length === 1 ? "um anexo falhou" : "alguns anexos falharam"}: ${falhas.join(" ")} Edite o lançamento para anexar de novo.`);
          return;
        }
        if (continuar && novo) {
          const base = dadosVazios(opcoes, hoje, aba, dados.tipo);
          setDados({ ...base, destino: dados.destino, data: dados.data, contaDestinoId: dados.contaDestinoId || base.contaDestinoId });
          setArquivos([]);
          setSalvos((n) => n + 1);
          setMaisInfo(false);
        } else {
          aoFechar();
        }
      } catch {
        setErro("Não foi possível salvar agora. Confira sua conexão e tente de novo.");
      }
    });
  };

  const titulo = novo ? (transferencia ? "Nova Transferência" : "Novo Lançamento") : transferencia ? "Editando Transferência" : "Editando Lançamento";
  const resumo = [
    dados.descricao || "Descrição",
    `${tipoEfetivo === "receita" && !transferencia ? "" : "-"}${formatarCentavos(valorCentavos)}`,
    edicao?.parcela ? `Parcela ${edicao.parcela}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const qtdAnexos = anexos.length + arquivos.length;

  return (
    <>
      <Modal
        aberto
        aoFechar={aoFechar}
        largura="larga"
        titulo={titulo}
        resumo={resumo}
        rodape={
          <>
            {novo && (
              <div className="mr-auto">
                <Chave ligada={continuar} aoMudar={setContinuar} rotulo="Salvar e Adicionar Novo" />
              </div>
            )}
            {!transferencia && (
              <MenuOpcoes
                aberto={menu}
                alternar={() => setMenu((m) => !m)}
                fechar={() => setMenu(false)}
                itens={[
                  {
                    rotulo: dados.parcelar ? "Parcelar (aberto)" : "Parcelar",
                    icone: <Layers className="h-4 w-4" />,
                    desabilitado: !novo || detalhado,
                    dica: !novo ? "Só ao criar um lançamento" : detalhado ? "Use a aba Simples para parcelar" : undefined,
                    aoClicar: () => setDados((d) => ({ ...d, parcelar: d.parcelar ?? { ...PARCELAR_PADRAO } })),
                  },
                  { rotulo: "Gerar Recorrente", icone: <CalendarClock className="h-4 w-4" />, desabilitado: true, dica: "Chega na Fase 4", aoClicar: () => {} },
                  { rotulo: `Anexar Arquivo${qtdAnexos ? ` (${qtdAnexos})` : ""}`, icone: <Paperclip className="h-4 w-4" />, aoClicar: () => setSub("anexos") },
                  { rotulo: dados.observacao ? "Editar Observação" : "Adicionar Observação", icone: <MessageSquareText className="h-4 w-4" />, aoClicar: () => setSub("observacao") },
                ]}
              />
            )}
            <Botao variante="secundario" type="button" onClick={aoFechar}>
              Voltar
            </Botao>
            <Botao type="submit" form="formulario-lancamento" carregando={salvando} icone={<Save className="h-4 w-4" />}>
              Salvar
            </Botao>
          </>
        }
      >
        <form
          id="formulario-lancamento"
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
                  className={cn(
                    "-mb-px border-b-2 px-4 py-2 text-sm font-semibold",
                    aba === a ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800",
                  )}
                >
                  {a === "simples" ? "Simples" : a === "detalhado" ? "Detalhado" : "Transferência"}
                </button>
              ))}
            </div>
          )}

          {salvos > 0 && novo && !erro && (
            <p className="rounded-md bg-pago-fundo px-3 py-2 text-sm text-pago-texto">
              {salvos === 1 ? "1 lançamento salvo." : `${salvos} lançamentos salvos.`} Preencha o próximo.
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
                  valor={dados.tipo}
                  aoMudar={(t) => {
                    mudar("tipo", t);
                    mudar("categoriaId", "");
                  }}
                />
              )}
              {!eCartao && (
                <Chave
                  ligada={dados.realizarAutomaticamente}
                  aoMudar={(v) => mudar("realizarAutomaticamente", v)}
                  rotulo="Realizar Automaticamente"
                />
              )}
            </div>
          )}

          {semOutraConta && <FaixaErro>Você não possui outra conta para transferir. Cadastre mais uma Conta Financeira.</FaixaErro>}

          <CampoTexto
            rotulo="Descrição"
            obrigatorio
            autoFocus
            maxLength={120}
            valor={dados.descricao}
            aoMudar={(v) => mudar("descricao", v)}
            ajuda="Ex.: Aluguel, Mercado, Salário."
          />

          {detalhado && (
            <ListaDetalhes
              itens={dados.itens}
              opcoes={opcoes}
              aoEditar={(i) => {
                setItemEditando(i);
                setSub("detalhe");
              }}
              aoExcluir={(i) => mudar("itens", dados.itens.filter((x) => x.chave !== i.chave))}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {detalhado ? (
              <div>
                <Rotulo texto="Valor" ajuda="Soma dos detalhes: receitas menos despesas." />
                <div className="flex h-10 items-center justify-end rounded-md border border-borda bg-gray-50 px-3 text-sm tabular-nums text-gray-500">
                  {dados.itens.length ? `${total.tipo === "despesa" ? "-" : ""}${formatarCentavos(total.valorCentavos)}` : "0,00"}
                </div>
              </div>
            ) : (
              <CampoValor rotulo={dados.parcelar?.dividirValor ? "Valor Total" : dados.parcelar ? "Valor da Parcela" : "Valor"} obrigatorio valor={dados.valor} aoMudar={(v) => mudar("valor", v)} />
            )}
            <div>
              <CampoTexto
                rotulo={eCartao ? "Data da Compra" : "Data de Vencimento"}
                obrigatorio
                type="date"
                valor={dados.data}
                aoMudar={(v) => mudar("data", v)}
              />
              {!eCartao && (
                <div className="mt-2">
                  <Chave
                    ligada={dados.pago}
                    aoMudar={(v) => {
                      mudar("pago", v);
                      if (v && !dados.dataPagamento) mudar("dataPagamento", dados.data <= hoje ? dados.data : hoje);
                    }}
                    rotulo={transferencia ? "Transferido" : tipoEfetivo === "receita" ? "Recebido" : "Pago"}
                  />
                </div>
              )}
            </div>
          </div>

          {dados.pago && !eCartao && (
            <CampoTexto
              rotulo={transferencia ? "Data da Transferência" : tipoEfetivo === "receita" ? "Data do Recebimento" : "Data do Pagamento"}
              type="date"
              valor={dados.dataPagamento}
              aoMudar={(v) => mudar("dataPagamento", v)}
              className="sm:w-1/2"
            />
          )}

          {transferencia ? (
            <>
              <CampoDestino rotulo="Conta Financeira" valor={dados.destino} aoMudar={(v) => mudar("destino", v)} destinos={opcoes.destinos} soContas ajuda="Conta de onde o dinheiro sai." />
              <fieldset className="rounded-lg bg-creme p-4">
                <legend className="flex items-center gap-1 px-1 text-sm font-semibold text-verde">
                  <ArrowLeftRight className="h-4 w-4" /> Destino
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoDestino
                    rotulo="Conta de Destino"
                    valor={dados.contaDestinoId ? `conta:${dados.contaDestinoId}` : ""}
                    aoMudar={(v) => mudar("contaDestinoId", v.slice(6))}
                    destinos={opcoes.destinos}
                    soContas
                    excluir={dados.destino}
                  />
                  <CampoComNovo rotulo="Forma de Pagamento" valor={dados.formaPagamentoId} aoMudar={(v) => mudar("formaPagamentoId", v)} opcoes={opcoes.formas} />
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {!detalhado && (
                  <CampoCategoria valor={dados.categoriaId} aoMudar={(v) => mudar("categoriaId", v)} categorias={opcoes.categorias} natureza={dados.tipo} />
                )}
                <div>
                  <CampoDestino rotulo="Conta ou Cartão" valor={dados.destino} aoMudar={(v) => mudar("destino", v)} destinos={opcoes.destinos} />
                  {fatura && (
                    <p className="mt-1 text-xs text-gray-600">
                      Cai na fatura de <strong>{rotuloCompetencia(fatura.competencia)}</strong> (fecha {formatarData(fatura.dataFechamento)}, vence{" "}
                      {formatarData(fatura.dataVencimento)}).
                    </p>
                  )}
                </div>
                <CampoComNovo rotulo="Forma de Pagamento" valor={dados.formaPagamentoId} aoMudar={(v) => mudar("formaPagamentoId", v)} opcoes={opcoes.formas} />
                <CampoComNovo
                  rotulo="Cliente ou Fornecedor"
                  valor={dados.contatoId}
                  aoMudar={(v) => mudar("contatoId", v)}
                  opcoes={contatos}
                  aoCriar={() => setSub("contato")}
                  rotuloNovo="Novo Cliente ou Fornecedor"
                />
              </div>
            </>
          )}

          <CampoTags valor={dados.tagIds} aoMudar={(v) => mudar("tagIds", v)} tags={tags} aoCriar={() => setSub("tag")} />

          {dados.parcelar && (
            <BlocoParcelar
              p={dados.parcelar}
              mudar={mudarParcelar}
              fechar={() => mudar("parcelar", null)}
              quantidadeGerada={parcelasPrevistas.length}
              aoVer={() => {
                if (!parcelasPrevistas.length) {
                  setErro("Confira os campos **Parcelas** e **Iniciar na Parcela**.");
                  return;
                }
                setSub("parcelas");
              }}
              conferidas={dados.parcelar.parcelas.length > 0}
            />
          )}

          <div>
            <button type="button" onClick={() => setMaisInfo((m) => !m)} className="flex items-center gap-1 text-sm font-semibold text-verde">
              <ChevronDown className={cn("h-4 w-4 transition", maisInfo && "rotate-180")} /> Mais Informações
            </button>
            {maisInfo && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <CampoTexto rotulo="Documento" maxLength={60} valor={dados.documento} aoMudar={(v) => mudar("documento", v)} ajuda="Número da nota, boleto ou recibo." />
                <CampoTexto
                  rotulo="Data de Referência"
                  type="date"
                  valor={dados.dataReferencia}
                  aoMudar={(v) => mudar("dataReferencia", v)}
                  ajuda="Mês a que a conta se refere (ex.: conta de luz de outubro paga em novembro)."
                />
              </div>
            )}
          </div>

          {(dados.observacao || qtdAnexos > 0) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {dados.observacao && (
                <button type="button" onClick={() => setSub("observacao")} className="inline-flex items-center gap-1 rounded-full bg-amarelo px-2.5 py-1 text-amarelo-texto">
                  <MessageSquareText className="h-3.5 w-3.5" /> Observação
                </button>
              )}
              {qtdAnexos > 0 && (
                <button type="button" onClick={() => setSub("anexos")} className="inline-flex items-center gap-1 rounded-full bg-verde-claro px-2.5 py-1 text-verde">
                  <Paperclip className="h-3.5 w-3.5" /> {qtdAnexos === 1 ? "1 anexo" : `${qtdAnexos} anexos`}
                </button>
              )}
            </div>
          )}

          <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        </form>
      </Modal>

      {sub === "detalhe" && (
        <ModalDetalhe
          item={itemEditando}
          opcoes={opcoes}
          aoFechar={() => setSub(null)}
          aoSalvar={(i) => {
            setDados((d) => ({ ...d, itens: d.itens.some((x) => x.chave === i.chave) ? d.itens.map((x) => (x.chave === i.chave ? i : x)) : [...d.itens, i] }));
            setErro("");
          }}
        />
      )}
      {sub === "parcelas" && dados.parcelar && (
        <ModalParcelas
          inicial={
            dados.parcelar.parcelas.length
              ? dados.parcelar.parcelas
              : parcelasPrevistas.map((p) => ({ numero: p.numero, descricao: p.descricao, data: p.data, valor: formatarCentavos(p.valorCentavos) }))
          }
          incluir={dados.parcelar.incluirParcelaNaDescricao}
          descricaoBase={dados.descricao.trim() || "Lançamento"}
          quantidade={Number(dados.parcelar.quantidade)}
          aoFechar={() => setSub(null)}
          aoConfirmar={(parcelas, incluir) => {
            setDados((d) => ({ ...d, parcelar: d.parcelar ? { ...d.parcelar, incluirParcelaNaDescricao: incluir, parcelas } : null }));
            setSub(null);
          }}
        />
      )}
      {sub === "observacao" && (
        <ModalObservacao
          valor={dados.observacao}
          aoFechar={() => setSub(null)}
          aoSalvar={(v) => {
            mudar("observacao", v);
            setSub(null);
          }}
        />
      )}
      {sub === "anexos" && (
        <ModalAnexos
          arquivos={arquivos}
          setArquivos={setArquivos}
          anexos={anexos}
          aoExcluirAnexo={async (a) => {
            const r = await excluirAnexo(a.id);
            if (r.ok) setAnexos((lista) => lista.filter((x) => x.id !== a.id));
            return r.ok ? "" : r.erro;
          }}
          aoFechar={() => setSub(null)}
        />
      )}
      {sub === "tag" && (
        <ModalNovaTag
          aoFechar={() => setSub(null)}
          aoCriar={(id, rotulo) => {
            setOpcoesExtras((o) => ({ ...o, tags: [...o.tags, { id, rotulo, ativo: true }] }));
            mudar("tagIds", [...dados.tagIds, id]);
            setSub(null);
          }}
        />
      )}
      {sub === "contato" && (
        <ModalNovoContato
          tipo={tipoEfetivo}
          aoFechar={() => setSub(null)}
          aoCriar={(id, rotulo) => {
            setOpcoesExtras((o) => ({ ...o, contatos: [...o.contatos, { id, rotulo, ativo: true }] }));
            mudar("contatoId", String(id));
            setSub(null);
          }}
        />
      )}
    </>
  );
}

/** Junta as opções do servidor com as criadas agora (sem repetir). */
function mesclar<T extends { id: number }>(base: T[], extras: T[]): T[] {
  return [...base, ...extras.filter((e) => !base.some((b) => b.id === e.id))];
}

// ---------------------------------------------------------------------------
// Menu de três pontos do rodapé
// ---------------------------------------------------------------------------

function MenuOpcoes({ aberto, alternar, fechar, itens }: {
  aberto: boolean;
  alternar: () => void;
  fechar: () => void;
  itens: { rotulo: string; icone: React.ReactNode; aoClicar: () => void; desabilitado?: boolean; dica?: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const ao = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && fechar();
    document.addEventListener("mousedown", ao);
    return () => document.removeEventListener("mousedown", ao);
  }, [aberto, fechar]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={alternar} aria-label="Mais opções" aria-expanded={aberto} className="h-9 rounded-md border border-borda bg-white px-2 text-gray-600 hover:bg-gray-50">
        <EllipsisVertical className="h-4 w-4" />
      </button>
      {aberto && (
        <ul role="menu" className="absolute right-0 bottom-11 z-10 min-w-56 overflow-hidden rounded-lg border border-borda bg-white py-1 text-sm shadow-lg">
          {itens.map((i) => (
            <li key={i.rotulo}>
              <button
                type="button"
                role="menuitem"
                disabled={i.desabilitado}
                title={i.dica}
                onClick={() => {
                  fechar();
                  i.aoClicar();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-verde-claro disabled:cursor-not-allowed disabled:opacity-50"
              >
                {i.icone}
                <span>{i.rotulo}</span>
                {i.dica && i.desabilitado && <span className="ml-auto text-xs text-gray-400">{i.dica}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalhado
// ---------------------------------------------------------------------------

function ListaDetalhes({ itens, opcoes, aoEditar, aoExcluir }: { itens: ItemFormulario[]; opcoes: Opcoes; aoEditar: (i: ItemFormulario) => void; aoExcluir: (i: ItemFormulario) => void }) {
  return (
    <div>
      <Rotulo texto="Detalhes" obrigatorio ajuda="Cada item tem a sua categoria. O valor do lançamento é a soma dos itens." />
      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed border-borda px-3 py-3 text-sm text-gray-500">Nenhum adicionado. Clique em Novo Detalhe.</p>
      ) : (
        <ul className="divide-y divide-borda rounded-md border border-borda">
          {itens.map((i) => {
            const c = opcoes.categorias.find((x) => String(x.id) === i.categoriaId);
            return (
              <li key={i.chave} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c?.cor ?? "#d1d5db" }} />
                <button type="button" onClick={() => aoEditar(i)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium text-gray-900">{i.descricao}</span>
                  <span className="block truncate text-xs text-gray-500">{c?.rotulo ?? "Sem categoria"}</span>
                </button>
                <span className={cn("font-semibold tabular-nums", i.tipo === "receita" ? "text-receita" : "text-negativo")}>
                  {i.tipo === "despesa" ? "-" : ""}
                  {i.valor}
                </span>
                <button type="button" onClick={() => aoExcluir(i)} aria-label={`Tirar ${i.descricao}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-negativo">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ModalDetalhe({ item, opcoes, aoFechar, aoSalvar }: { item: ItemFormulario | null; opcoes: Opcoes; aoFechar: () => void; aoSalvar: (i: ItemFormulario) => void }) {
  const vazio = (tipo: "receita" | "despesa" = "despesa"): ItemFormulario => ({ chave: `n${++contadorItens}`, tipo, descricao: "", valor: "", categoriaId: "" });
  const [i, setI] = useState<ItemFormulario>(item ?? vazio());
  const [erro, setErro] = useState("");
  const [continuar, setContinuar] = useState(false);
  const [salvos, setSalvos] = useState(0);
  const mudar = (p: Partial<ItemFormulario>) => {
    setI((x) => ({ ...x, ...p }));
    setErro("");
  };
  const salvar = () => {
    const centavos = lerValorEmCentavos(i.valor);
    if (!i.descricao.trim()) return setErro("Preencha o campo **Descrição**.");
    if (!i.valor.trim()) return setErro("Preencha o campo **Valor**.");
    if (centavos === null || centavos <= 0) return setErro("Informe um valor maior que zero no campo **Valor**.");
    if (!i.categoriaId) return setErro("Selecione o campo **Categoria**.");
    aoSalvar({ ...i, descricao: i.descricao.trim(), valor: formatarCentavos(centavos) });
    if (continuar && !item) {
      setI(vazio(i.tipo));
      setSalvos((n) => n + 1);
    } else aoFechar();
  };
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={item ? "Editando Detalhe" : "Novo Detalhe"}
      rodape={
        <>
          {!item && (
            <div className="mr-auto">
              <Chave ligada={continuar} aoMudar={setContinuar} rotulo="Salvar e Adicionar Novo" />
            </div>
          )}
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="submit" form="formulario-detalhe" icone={<Save className="h-4 w-4" />}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="formulario-detalhe" noValidate onSubmit={(e) => { e.preventDefault(); salvar(); }} className="space-y-4">
        {salvos > 0 && !erro && <p className="rounded-md bg-pago-fundo px-3 py-2 text-sm text-pago-texto">{salvos === 1 ? "1 item adicionado." : `${salvos} itens adicionados.`}</p>}
        <AlternadorTipo valor={i.tipo} aoMudar={(t) => mudar({ tipo: t, categoriaId: "" })} />
        <CampoTexto rotulo="Descrição" obrigatorio autoFocus maxLength={120} valor={i.descricao} aoMudar={(v) => mudar({ descricao: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoValor rotulo="Valor" obrigatorio valor={i.valor} aoMudar={(v) => mudar({ valor: v })} />
          <CampoCategoria valor={i.categoriaId} aoMudar={(v) => mudar({ categoriaId: v })} categorias={opcoes.categorias} natureza={i.tipo} />
        </div>
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Parcelar
// ---------------------------------------------------------------------------

function BlocoParcelar({ p, mudar, fechar, aoVer, quantidadeGerada, conferidas }: {
  p: DadosParcelar;
  mudar: (p: Partial<DadosParcelar>) => void;
  fechar: () => void;
  aoVer: () => void;
  quantidadeGerada: number;
  conferidas: boolean;
}) {
  return (
    <fieldset className="rounded-lg border border-amarelo-borda bg-creme p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <legend className="flex items-center gap-2 text-sm font-semibold text-verde">
          <Layers className="h-4 w-4" /> Parcelar
        </legend>
        <div className="flex items-center gap-3">
          <Chave ligada={p.dividirValor} aoMudar={(v) => mudar({ dividirValor: v })} rotulo="Dividir o valor entre as parcelas" />
          <button type="button" onClick={fechar} aria-label="Fechar Parcelar" className="rounded p-1 text-gray-500 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-4">
        <CampoSelecao rotulo="Periodicidade" valor={p.periodicidade} aoMudar={(v) => mudar({ periodicidade: v })} opcoes={PERIODICIDADES} />
        <CampoTexto rotulo="Parcelas" obrigatorio type="number" min={2} max={360} valor={p.quantidade} aoMudar={(v) => mudar({ quantidade: v })} />
        <CampoTexto
          rotulo="Iniciar na Parcela"
          type="number"
          min={1}
          valor={p.iniciarNaParcela}
          aoMudar={(v) => mudar({ iniciarNaParcela: v })}
          ajuda="Para uma compra já em andamento: ex. 4 para lançar da 4ª parcela em diante."
        />
        <Botao type="button" variante="secundario" icone={<FileText className="h-4 w-4" />} onClick={aoVer}>
          Ver Parcelas
        </Botao>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        {p.dividirValor ? "A primeira parcela será ajustada em caso de divisão não exata. " : "Cada parcela terá o valor informado. "}
        {quantidadeGerada > 0 && `Serão criados ${quantidadeGerada} lançamentos de uma vez.`}
        {conferidas && " Parcelas conferidas."}
      </p>
    </fieldset>
  );
}

function ModalParcelas({ inicial, incluir, descricaoBase, quantidade, aoFechar, aoConfirmar }: {
  inicial: ParcelaFormulario[];
  incluir: boolean;
  descricaoBase: string;
  quantidade: number;
  aoFechar: () => void;
  aoConfirmar: (p: ParcelaFormulario[], incluir: boolean) => void;
}) {
  const [parcelas, setParcelas] = useState(inicial);
  const [incluirDescricao, setIncluir] = useState(incluir);
  const [erro, setErro] = useState("");
  const total = parcelas.reduce((s, p) => s + (lerValorEmCentavos(p.valor) ?? 0), 0);
  const mudar = (n: number, campo: keyof ParcelaFormulario, valor: string) => {
    setParcelas((ps) => ps.map((p) => (p.numero === n ? { ...p, [campo]: valor } : p)));
    setErro("");
  };
  const trocarIncluir = (v: boolean) => {
    setIncluir(v);
    setParcelas((ps) => ps.map((p) => ({ ...p, descricao: v ? `${descricaoBase} ${p.numero}/${quantidade}` : descricaoBase })));
  };
  const confirmar = () => {
    for (const p of parcelas) {
      if (!p.descricao.trim()) return setErro(`Preencha a **Descrição** da parcela ${p.numero}.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data)) return setErro(`Preencha o **Vencimento** da parcela ${p.numero}.`);
      const c = lerValorEmCentavos(p.valor);
      if (c === null || c <= 0) return setErro(`Informe um **Valor** maior que zero na parcela ${p.numero}.`);
    }
    aoConfirmar(parcelas, incluirDescricao);
  };
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo="Visualizando Parcelas"
      resumo={`${parcelas.length} parcelas · Total ${formatarCentavos(total)}`}
      rodape={
        <>
          <div className="mr-auto">
            <Chave ligada={incluirDescricao} aoMudar={trocarIncluir} rotulo="Incluir a Parcela na descrição" />
          </div>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="button" onClick={confirmar}>
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="max-h-[55vh] overflow-y-auto rounded-md border border-borda">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="w-40 px-3 py-2 text-left">Vencimento</th>
              <th className="w-36 px-3 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => (
              <tr key={p.numero} className="border-t border-borda">
                <td className="px-2 py-1">
                  <input aria-label={`Descrição da parcela ${p.numero}`} value={p.descricao} maxLength={120} onChange={(e) => mudar(p.numero, "descricao", e.target.value)} className="h-8 w-full rounded border border-borda px-2" />
                </td>
                <td className="px-2 py-1">
                  <input aria-label={`Vencimento da parcela ${p.numero}`} type="date" value={p.data} onChange={(e) => mudar(p.numero, "data", e.target.value)} className="h-8 w-full rounded border border-borda px-2" />
                </td>
                <td className="px-2 py-1">
                  <input
                    aria-label={`Valor da parcela ${p.numero}`}
                    inputMode="decimal"
                    value={p.valor}
                    onChange={(e) => mudar(p.numero, "valor", e.target.value.replace(/[^\d.,]/g, ""))}
                    className="h-8 w-full rounded border border-borda px-2 text-right tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-borda bg-subcabecalho font-semibold">
            <tr>
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatarCentavos(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-3">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Observação e anexos
// ---------------------------------------------------------------------------

function ModalObservacao({ valor, aoFechar, aoSalvar }: { valor: string; aoFechar: () => void; aoSalvar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Adicionando Observação"
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="button" onClick={() => aoSalvar(texto.trim())} icone={<Save className="h-4 w-4" />}>
            Salvar
          </Botao>
        </>
      }
    >
      <label className="block text-sm">
        <span className="sr-only">Observação</span>
        <textarea
          autoFocus
          rows={8}
          maxLength={MAX_OBSERVACAO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full rounded-md border border-borda px-3 py-2 text-sm outline-none focus:border-verde focus:ring-2 focus:ring-verde/15"
        />
      </label>
      <p className="mt-1 text-right text-xs text-gray-500">
        {texto.length} de {MAX_OBSERVACAO} caracteres
      </p>
    </Modal>
  );
}

const tamanho = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

function ModalAnexos({ arquivos, setArquivos, anexos, aoExcluirAnexo, aoFechar }: {
  arquivos: File[];
  setArquivos: (f: File[]) => void;
  anexos: AnexoInfo[];
  aoExcluirAnexo: (a: AnexoInfo) => Promise<string>;
  aoFechar: () => void;
}) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const escolher = (lista: FileList | null) => {
    if (!lista) return;
    const novos: File[] = [];
    for (const f of Array.from(lista)) {
      if (!tipoAnexoPermitido(f.type)) return setErro(`O arquivo **${f.name}** não é imagem nem PDF.`);
      if (f.size > TAMANHO_MAXIMO_ANEXO) return setErro(`O arquivo **${f.name}** passa de 4 MB.`);
      novos.push(f);
    }
    setErro("");
    setArquivos([...arquivos, ...novos]);
  };
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Anexando Arquivo"
      resumo="Só imagem ou PDF, até 4 MB cada."
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="button" onClick={aoFechar}>
            Concluído
          </Botao>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-borda px-4 py-8 text-center text-sm text-gray-600 hover:border-verde hover:bg-verde-claro/40">
        <Paperclip className="h-6 w-6 text-verde" />
        <strong className="text-gray-800">Selecionar Arquivo</strong>
        Clique para selecionar uma Imagem ou PDF
        <input type="file" multiple accept={ACEITAR_ANEXO} className="sr-only" onChange={(e) => { escolher(e.target.files); e.target.value = ""; }} />
      </label>
      {(anexos.length > 0 || arquivos.length > 0) && (
        <ul className="mt-4 divide-y divide-borda rounded-md border border-borda text-sm">
          {anexos.map((a) => (
            <li key={`a${a.id}`} className="flex items-center gap-2 px-3 py-2">
              <Paperclip className="h-4 w-4 text-gray-400" />
              <a href={`/api/anexos/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-verde hover:underline">
                {a.nomeArquivo}
              </a>
              <span className="text-xs text-gray-400">{tamanho(a.tamanhoBytes)}</span>
              <button
                type="button"
                disabled={ocupado === a.id}
                aria-label={`Excluir ${a.nomeArquivo}`}
                onClick={async () => {
                  if (!confirm(`Excluir o anexo ${a.nomeArquivo}?`)) return;
                  setOcupado(a.id);
                  setErro(await aoExcluirAnexo(a));
                  setOcupado(null);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-negativo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {arquivos.map((f, i) => (
            <li key={`f${i}`} className="flex items-center gap-2 px-3 py-2">
              <Paperclip className="h-4 w-4 text-gray-400" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{tamanho(f.size)} · vai ao salvar</span>
              <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-negativo">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cadastros rápidos (sem sair do lançamento)
// ---------------------------------------------------------------------------

function ModalNovaTag({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (id: number, rotulo: string) => void }) {
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const salvar = () =>
    iniciar(async () => {
      const r = await salvarTag(null, { descricao });
      if (!r.ok) return setErro(r.erro);
      aoCriar(r.id!, descricao.trim());
    });
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Nova Tag"
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="submit" form="formulario-tag" carregando={salvando} icone={<Save className="h-4 w-4" />}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="formulario-tag" noValidate onSubmit={(e) => { e.preventDefault(); salvar(); }} className="space-y-4">
        <CampoTexto rotulo="Descrição" obrigatorio autoFocus maxLength={60} valor={descricao} aoMudar={(v) => { setDescricao(v); setErro(""); }} />
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </form>
    </Modal>
  );
}

function ModalNovoContato({ tipo, aoFechar, aoCriar }: { tipo: "receita" | "despesa"; aoFechar: () => void; aoCriar: (id: number, rotulo: string) => void }) {
  const [nome, setNome] = useState("");
  const [pessoa, setPessoa] = useState<"fisica" | "juridica">("fisica");
  const [eCliente, setCliente] = useState(tipo === "receita");
  const [eFornecedor, setFornecedor] = useState(tipo === "despesa");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const salvar = () =>
    iniciar(async () => {
      const r = await salvarContato(null, {
        pessoa, nome, eCliente, eFornecedor, razaoSocial: "", documento: "", email, telefone, telefoneWhatsapp: false, sexo: "nao_informado",
        nascimento: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", observacoes: "",
      });
      if (!r.ok) return setErro(r.erro);
      aoCriar(r.id!, nome.trim());
    });
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Novo Cliente e Fornecedor"
      resumo="Os demais dados podem ser completados depois em Cadastros."
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao type="submit" form="formulario-contato" carregando={salvando} icone={<Save className="h-4 w-4" />}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id="formulario-contato" noValidate onSubmit={(e) => { e.preventDefault(); salvar(); }} className="space-y-4">
        <CampoSelecao
          rotulo="Pessoa"
          valor={pessoa}
          aoMudar={(v) => setPessoa(v as "fisica" | "juridica")}
          opcoes={[{ valor: "fisica", rotulo: "Pessoa Física" }, { valor: "juridica", rotulo: "Pessoa Jurídica" }]}
        />
        <CampoTexto rotulo={pessoa === "juridica" ? "Nome Fantasia" : "Nome"} obrigatorio autoFocus maxLength={120} valor={nome} aoMudar={(v) => { setNome(v); setErro(""); }} />
        <div className="flex flex-wrap gap-6">
          <Chave ligada={eCliente} aoMudar={setCliente} rotulo="Cliente" />
          <Chave ligada={eFornecedor} aoMudar={setFornecedor} rotulo="Fornecedor" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto rotulo="Telefone" valor={telefone} aoMudar={setTelefone} />
          <CampoTexto rotulo="E-mail" type="email" valor={email} aoMudar={setEmail} />
        </div>
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </form>
    </Modal>
  );
}
