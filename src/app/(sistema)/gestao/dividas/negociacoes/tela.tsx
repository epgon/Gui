"use client";

import { Eye, Handshake, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BarraLista } from "@/components/cadastros/barra-lista";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Paginacao } from "@/components/cadastros/paginacao";
import { AssistenteRenegociacao, type InicioRenegociacao } from "@/components/dividas/assistente-renegociacao";
import { AbasDividas, PilulaNegociacao } from "@/components/dividas/comuns";
import { dadosDaNegociacao, dadosVaziosNegociacao, DetalhandoNegociacao, ModalNegociacao, ModalProposta } from "@/components/dividas/janelas-negociacao";
import { TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { Tabela } from "@/components/ui/tabela";
import { formatarData } from "@/lib/datas";
import { negociacaoAberta, rotuloCanal } from "@/lib/dividas/negociacao";
import type { FiltrosNegociacoes, LinhaDivida, LinhaNegociacao, PropostaLinha } from "@/lib/dividas/tipos";
import type { Opcoes } from "@/lib/lancamentos/tipos";
import { desistirNegociacao, excluirNegociacao, recusarNegociacao } from "./acoes";

type Edicao = { id: number | null; dados: ReturnType<typeof dadosVaziosNegociacao> };

export function TelaNegociacoes({ linhas, total, filtros, caminho, dividas, opcoes, hoje, padroes, abrirNova, abrirDetalhe, porPagina }: {
  linhas: LinhaNegociacao[];
  total: number;
  filtros: FiltrosNegociacoes;
  caminho: string;
  dividas: LinhaDivida[];
  opcoes: Opcoes;
  hoje: string;
  padroes: { contaId: string; categoriaId: string };
  abrirNova: boolean;
  abrirDetalhe: number | null;
  porPagina: number;
}) {
  const router = useRouter();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [detalhando, setDetalhando] = useState<number | null>(abrirDetalhe);
  const [versao, setVersao] = useState(0);
  const [proposta, setProposta] = useState<{ negociacao: LinhaNegociacao; proposta: PropostaLinha | null } | null>(null);
  const [assistente, setAssistente] = useState<InicioRenegociacao | null>(null);
  const [aviso, setAviso] = useState("");
  const [, iniciar] = useTransition();
  const aberto = useRef(false);
  const parametros = { busca: filtros.busca, credor: filtros.credor, situacao: filtros.situacao, de: filtros.de, ate: filtros.ate };

  const novaNegociacao = () => setEdicao({ id: null, dados: dadosVaziosNegociacao(hoje) });
  useEffect(() => {
    if (abrirNova && !aberto.current) {
      aberto.current = true;
      setEdicao({ id: null, dados: dadosVaziosNegociacao(hoje) });
    }
  }, [abrirNova, hoje]);

  const mudou = () => {
    setVersao((v) => v + 1);
    router.refresh();
  };

  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>) =>
    iniciar(async () => {
      setAviso("");
      try {
        const r = await acao();
        if (!r.ok) return setAviso(r.erro ?? "Não foi possível concluir agora.");
        mudou();
      } catch {
        setAviso("Não foi possível concluir agora. Tente de novo.");
      }
    });

  const aceitar = (n: LinhaNegociacao, p: PropostaLinha) => {
    setDetalhando(null);
    setAssistente({ dividaIds: n.dividas.map((d) => d.id), negociacao: n, proposta: p });
  };

  const aceitarDaLinha = (n: LinhaNegociacao) => {
    const abertas = n.propostas.filter((p) => p.situacao === "aberta");
    if (abertas.length === 1) return aceitar(n, abertas[0]);
    if (abertas.length === 0) return setAviso("Registre uma proposta antes de aceitar. Use **Nova proposta**.");
    setDetalhando(n.id);
  };

  return (
    <>
      <AbasDividas ativa="/gestao/dividas/negociacoes" />
      <BarraLista aoAdicionar={novaNegociacao} caminho={caminho} busca={filtros.busca} parametros={parametros} rotuloBusca="Buscar credor, dívida ou protocolo" />
      <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>
      <ProvedorOcultar>
        <Tabela
          linhas={linhas}
          chaveLinha={(n) => n.id}
          vazio={filtros.busca || filtros.credor || filtros.situacao || filtros.de || filtros.ate ? "Nenhuma negociação encontrada com esses filtros." : "Nenhuma negociação ainda. Clique em Adicionar para registrar a conversa com um credor, comparar propostas e renegociar."}
          colunas={[
            {
              chave: "credor",
              titulo: "Credor",
              render: (n) => (
                <span>
                  <button type="button" onClick={() => setDetalhando(n.id)} className="text-left font-medium text-gray-900 hover:text-verde hover:underline" title="Detalhar negociação">
                    {n.credor}
                  </button>
                  <span className="block text-xs text-gray-500">{n.dividas.map((d) => d.descricao).join(", ") || "Sem dívidas"}</span>
                </span>
              ),
            },
            { chave: "situacao", titulo: "Situação", alinhar: "centro", render: (n) => <PilulaNegociacao situacao={n.situacao} /> },
            { chave: "canal", titulo: "Canal", render: (n) => <span className="text-gray-700">{rotuloCanal(n.canal)}{n.protocolo ? <span className="block text-xs text-gray-500">{n.protocolo}</span> : null}</span> },
            { chave: "inicio", titulo: "Início", render: (n) => formatarData(n.dataInicio) },
            {
              chave: "prazo",
              titulo: "Prazo de Resposta",
              render: (n) => (n.prazoResposta ? <span className={negociacaoAberta(n.situacao) && n.prazoResposta < hoje ? "font-semibold text-despesa" : ""}>{formatarData(n.prazoResposta)}</span> : <span className="text-gray-300">—</span>),
            },
            { chave: "saldo", titulo: "Saldo das Dívidas", alinhar: "direita", render: (n) => <ValorOcultavel centavos={-n.saldoCentavos || 0} /> },
            {
              chave: "melhor",
              titulo: "Melhor Proposta",
              alinhar: "direita",
              render: (n) => {
                const melhor = n.propostas.find((p) => p.id === n.melhorPropostaId);
                const quantas = n.propostas.filter((p) => p.situacao === "aberta").length;
                return melhor ? (
                  <span>
                    <ValorOcultavel centavos={-melhor.totalCentavos} />
                    <span className="block text-xs text-gray-500">{melhor.modalidade === "a_vista" ? "à vista" : `${melhor.parcelas}×`}{quantas > 1 ? ` · ${quantas} propostas` : ""}</span>
                  </span>
                ) : (
                  <span className="text-gray-300" title="Nenhuma proposta em aberto">—</span>
                );
              },
            },
            {
              chave: "menu",
              titulo: <span className="sr-only">Opções</span>,
              alinhar: "direita",
              render: (n) => {
                const aberta = negociacaoAberta(n.situacao);
                return (
                  <MenuLinha
                    rotulo={n.credor}
                    itens={[
                      { rotulo: "Detalhar", icone: <Eye className="h-4 w-4" />, aoClicar: () => setDetalhando(n.id) },
                      ...(aberta
                        ? [
                            { rotulo: "Nova proposta", icone: <Plus className="h-4 w-4" />, aoClicar: () => setProposta({ negociacao: n, proposta: null }) },
                            { rotulo: "Aceitar proposta", icone: <Handshake className="h-4 w-4" />, aoClicar: () => aceitarDaLinha(n) },
                            { rotulo: "Recusar", icone: <XCircle className="h-4 w-4" />, aoClicar: () => confirm(`Recusar a negociação com ${n.credor}? As propostas em aberto também ficam recusadas.`) && rodar(() => recusarNegociacao(n.id)) },
                            { rotulo: "Desistir", icone: <XCircle className="h-4 w-4" />, aoClicar: () => confirm(`Desistir da negociação com ${n.credor}?`) && rodar(() => desistirNegociacao(n.id)) },
                          ]
                        : []),
                      ...(n.situacao !== "aceita" ? [{ rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => setEdicao({ id: n.id, dados: dadosDaNegociacao(n) }) }] : []),
                      ...(n.situacao !== "aceita" ? [{ rotulo: "Excluir", icone: <Trash2 className="h-4 w-4" />, aoClicar: () => confirm(`Excluir a negociação com ${n.credor} e as ${n.propostas.length} propostas dela? As dívidas não mudam.`) && rodar(() => excluirNegociacao(n.id)) }] : []),
                    ]}
                  />
                );
              },
            },
          ]}
        />
      </ProvedorOcultar>
      <Paginacao caminho={caminho} parametros={parametros} pagina={filtros.pagina} porPagina={porPagina} total={total} />

      {edicao && (
        <ModalNegociacao
          key={edicao.id ?? "nova"}
          id={edicao.id}
          inicial={edicao.dados}
          dividas={dividas}
          hoje={hoje}
          aoFechar={() => {
            setEdicao(null);
            mudou();
          }}
        />
      )}

      {detalhando !== null && (
        <DetalhandoNegociacao
          key={detalhando}
          negociacaoId={detalhando}
          versao={versao}
          hoje={hoje}
          aoFechar={() => setDetalhando(null)}
          aoNovaProposta={(n) => setProposta({ negociacao: n, proposta: null })}
          aoEditarProposta={(n, p) => setProposta({ negociacao: n, proposta: p })}
          aoAceitar={aceitar}
          aoMudou={mudou}
          aoAbrirDivida={(id) => router.push(`/gestao/dividas/minhas?detalhar=${id}`)}
        />
      )}

      {proposta && (
        <ModalProposta
          key={proposta.proposta?.id ?? "nova"}
          negociacao={proposta.negociacao}
          proposta={proposta.proposta}
          hoje={hoje}
          aoFechar={() => {
            setProposta(null);
            mudou();
          }}
        />
      )}

      {assistente && (
        <AssistenteRenegociacao
          dividas={dividas}
          opcoes={opcoes}
          hoje={hoje}
          inicio={assistente}
          padroes={padroes}
          aoFechar={() => {
            setAssistente(null);
            mudou();
          }}
          aoConcluir={(acordoId) => {
            setAssistente(null);
            router.push(`/gestao/dividas/minhas?detalhar=${acordoId}`);
          }}
        />
      )}
    </>
  );
}
