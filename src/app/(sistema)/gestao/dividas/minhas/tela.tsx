"use client";

import { Banknote, Calculator, Copy, Eye, Gauge, HandCoins, Handshake, NotebookPen, Pencil, Scale, Wallet, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BarraLista } from "@/components/cadastros/barra-lista";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { useFormularioCadastro } from "@/components/cadastros/modal-cadastro";
import { Paginacao } from "@/components/cadastros/paginacao";
import { AssistenteRenegociacao, type InicioRenegociacao } from "@/components/dividas/assistente-renegociacao";
import { AbasDividas, BarraProgresso, NotaSaldo, PilulaSituacao } from "@/components/dividas/comuns";
import { colunasComuns } from "@/components/listagem/colunas-comuns";
import { ContasEmAberto } from "@/components/dividas/contas-em-aberto";
import { DetalhandoDivida, type AcaoDivida } from "@/components/dividas/detalhando-divida";
import { dadosDaDivida, dadosVaziosDivida, ModalDivida, type PadroesDivida } from "@/components/dividas/formulario-divida";
import { JanelaAmortizar, JanelaCancelar, JanelaEncargo, JanelaPagarDivida, JanelaQuitar, JanelaSaldo } from "@/components/dividas/janelas-divida";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { TextoComDestaque } from "@/components/ui/campo";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { Tabela, type Coluna } from "@/components/ui/tabela";
import { formatarData } from "@/lib/datas";
import { estaAtiva, rotuloTipoDivida } from "@/lib/dividas/regras";
import type { ContaEmAberto, FiltrosDividas, LinhaDivida, LinhaObrigacao } from "@/lib/dividas/tipos";
import type { Opcoes } from "@/lib/lancamentos/tipos";
import { realizarLancamentos } from "@/app/(sistema)/financeiro/lancamentos/acoes";
import { ModalPagar } from "@/app/(sistema)/financeiro/lancamentos/linhas";
import { colunasVisiveis, type PreferenciaListagem } from "@/lib/listagem/telas";
import { proximaParcela } from "../acoes";
import { desfazerRenegociacao } from "../negociacoes/acoes";

type Janela = { acao: AcaoDivida | "cancelar"; divida: LinhaDivida };
type Parcela = { id: number; descricao: string; valorCentavos: number; vencimento: string; dividaId: number };

export function TelaMinhasDividas({ linhas, total, filtros, caminho, opcoes, hoje, totalDevido, todas, contasEmAberto, recorrentes, padroes, multaPadrao, limiteTaxaAltaPct, moraPadrao, abrirNova, abrirDetalhe, acaoInicial, porPagina, preferencia }: {
  linhas: LinhaDivida[];
  total: number;
  filtros: FiltrosDividas;
  caminho: string;
  opcoes: Opcoes;
  hoje: string;
  totalDevido: number;
  todas: LinhaDivida[];
  contasEmAberto: ContaEmAberto[];
  recorrentes: ContaEmAberto[];
  padroes: PadroesDivida;
  multaPadrao: number;
  limiteTaxaAltaPct: number;
  moraPadrao: number;
  abrirNova: boolean;
  abrirDetalhe: number | null;
  /** Vindo de um botão do Consultor Gui ou de um alerta: abre a janela normal da ação (que só grava no Confirmar dela). */
  acaoInicial: string | null;
  porPagina: number;
  preferencia: PreferenciaListagem;
}) {
  const router = useRouter();
  const vazio = dadosVaziosDivida(padroes, hoje);
  const form = useFormularioCadastro(vazio);
  const [detalhando, setDetalhando] = useState<number | null>(acaoInicial ? null : abrirDetalhe);
  const [versao, setVersao] = useState(0);
  const [janela, setJanela] = useState<Janela | null>(null);
  const [parcela, setParcela] = useState<Parcela | null>(null);
  const [aviso, setAviso] = useState("");
  const [assistente, setAssistente] = useState<InicioRenegociacao | null>(null);
  const [erroPagar, setErroPagar] = useState("");
  const [ocupado, iniciar] = useTransition();
  const aberto = useRef(false);
  const parametros = { busca: filtros.busca, credor: filtros.credor, tipo: filtros.tipo, situacao: filtros.situacao, conta: filtros.conta };

  // Vindo de "Cadastrar dívida" da Visão Geral: já abre a janela de cadastro.
  const abrirNovoForm = form.abrirNovo;
  useEffect(() => {
    if (abrirNova && !aberto.current) {
      aberto.current = true;
      abrirNovoForm();
    }
  }, [abrirNova, abrirNovoForm]);

  const acaoAberta = useRef(false);

  const mudou = () => {
    setVersao((v) => v + 1);
    router.refresh();
  };
  const fecharJanela = () => {
    setJanela(null);
    mudou();
  };

  const ativa = (d: LinhaDivida) => estaAtiva(d.situacao);
  const comuns = colunasComuns<LinhaDivida>("").filter((c) => c.chave !== "auxiliar");

  const pagarProxima = (d: LinhaDivida) =>
    iniciar(async () => {
      setAviso("");
      try {
        const p = await proximaParcela(d.id);
        if (!p) return setAviso(`A dívida **${d.descricao}** não tem parcela em aberto.`);
        setParcela({ ...p, dividaId: d.id });
      } catch {
        setAviso("Não foi possível abrir a parcela agora. Tente de novo.");
      }
    });

  const pagarParcela = (o: LinhaObrigacao, dividaId: number) => setParcela({ id: o.id, descricao: o.descricao, valorCentavos: o.valorCentavos, vencimento: o.vencimento, dividaId });

  const confirmarParcela = (p: Parcela, data: string, valor: { valorPago: string; gerarRestante: boolean; vencimentoRestante: string } | null) =>
    iniciar(async () => {
      setErroPagar("");
      try {
        // O mesmo caminho de pagamento de Lançamentos: pagar pela dívida ou por lá dá o mesmo resultado.
        const r = await realizarLancamentos([p.id], data, [], valor);
        if (!r.ok) return setErroPagar(r.erro);
        setParcela(null);
        mudou();
      } catch {
        setErroPagar("Não foi possível pagar agora. Tente de novo.");
      }
    });

  const desfazer = (d: LinhaDivida) => {
    if (!confirm(`Desfazer a renegociação? As parcelas originais voltam para Lançamentos e o acordo ${d.descricao} é apagado.`)) return;
    iniciar(async () => {
      setAviso("");
      try {
        const r = await desfazerRenegociacao(d.id);
        if (!r.ok) return setAviso(r.erro);
        setDetalhando(null);
        mudou();
      } catch {
        setAviso("Não foi possível desfazer agora. Tente de novo.");
      }
    });
  };

  const abrirAcao = (acao: AcaoDivida | "cancelar", d: LinhaDivida) => {
    if (acao === "renegociar") return setAssistente({ dividaIds: [d.id] });
    if (acao === "desfazer") return desfazer(d);
    if (acao === "pagar" && d.forma === "parcelas_fixas") return pagarProxima(d);
    setJanela({ acao, divida: d });
  };

  useEffect(() => {
    if (!acaoInicial || abrirDetalhe === null || acaoAberta.current) return;
    acaoAberta.current = true;
    const d = todas.find((x) => x.id === abrirDetalhe);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d && estaAtiva(d.situacao)) abrirAcao(acaoInicial as AcaoDivida, d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editar = (d: LinhaDivida) => form.abrirEdicao(d.id, dadosDaDivida(d, hoje, padroes));
  const clonar = (d: LinhaDivida) => form.abrirNovo({ ...dadosDaDivida(d, hoje, padroes), descricao: `${d.descricao} (cópia)` });
  const dividaAberta = detalhando !== null ? todas.find((d) => d.id === detalhando) : undefined;

  return (
    <>
      <AbasDividas ativa="/gestao/dividas/minhas" />
      <BarraLista tela="dividas" preferencia={preferencia} aoAdicionar={() => form.abrirNovo()} caminho={caminho} busca={filtros.busca} parametros={parametros} rotuloBusca="Buscar dívida ou credor" />
      <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>
      <ProvedorOcultar>
        <Tabela
          linhas={linhas}
          compacta={preferencia.compactar}
          destacarPares={preferencia.destacarPares}
          chaveLinha={(d) => d.id}
          vazio={filtros.busca || filtros.credor || filtros.tipo || filtros.situacao || filtros.conta ? "Nenhuma dívida encontrada com esses filtros." : "Nenhuma dívida cadastrada. Clique em Adicionar para cadastrar a primeira, ou veja as contas em aberto no Gui logo abaixo."}
          colunas={colunasVisiveis<Coluna<LinhaDivida>>("dividas", [
            {
              chave: "divida",
              titulo: "Dívida",
              render: (d) => (
                <span className={d.situacao === "cancelada" || d.situacao === "renegociada" ? "opacity-60" : ""}>
                  <button type="button" onClick={() => setDetalhando(d.id)} className="text-left font-medium text-gray-900 hover:text-verde hover:underline" title="Detalhar dívida">
                    {d.descricao}
                  </button>
                  <span className="block text-xs text-gray-500">{d.credor}</span>
                </span>
              ),
            },
            { chave: "tipo", titulo: "Tipo", render: (d) => <span className="text-gray-700">{rotuloTipoDivida(d.tipo).replace(" (rotativo ou parcelamento de fatura)", "")}</span> },
            { chave: "situacao", titulo: "Situação", alinhar: "centro", render: (d) => <PilulaSituacao situacao={d.situacao} diasAtraso={d.diasAtraso} /> },
            { chave: "proximo", titulo: "Próximo Vencimento", render: (d) => (d.proximoVencimento && ativa(d) ? formatarData(d.proximoVencimento) : <span className="text-gray-300">—</span>) },
            { chave: "parcelas", titulo: "Parcelas", alinhar: "centro", render: (d) => (d.forma === "parcelas_fixas" ? `${d.parcelasPagas}/${d.parcelasTotal}` : <span className="text-gray-300" title="Sem parcelas definidas">—</span>) },
            { chave: "taxa", titulo: "Taxa (% a.m.)", alinhar: "direita", render: (d) => (d.taxaMensal !== null ? `${String(d.taxaMensal).replace(".", ",")}%` : <span className="text-gray-300">—</span>) },
            {
              chave: "saldo",
              titulo: "Saldo Devedor",
              alinhar: "direita",
              render: (d) => (
                <span>
                  <ValorOcultavel centavos={d.situacao === "quitada" || d.situacao === "cancelada" || d.situacao === "renegociada" ? 0 : -d.saldo.exibido} />
                  {ativa(d) && <NotaSaldo saldo={d.saldo} />}
                </span>
              ),
            },
            { chave: "progresso", titulo: "Progresso", render: (d) => <span className="block w-24" title={`${d.progresso}% pago`}><BarraProgresso percentual={d.situacao === "quitada" ? 100 : d.progresso} /></span> },
            ...comuns,
            {
              chave: "menu",
              titulo: <span className="sr-only">Opções</span>,
              alinhar: "direita",
              render: (d) => (
                <MenuLinha
                  rotulo={d.descricao}
                  itens={[
                    { rotulo: "Detalhar", icone: <Eye className="h-4 w-4" />, aoClicar: () => setDetalhando(d.id) },
                    ...(ativa(d)
                      ? [
                          d.forma === "parcelas_fixas"
                            ? { rotulo: "Pagar próxima parcela", icone: <Wallet className="h-4 w-4" />, aoClicar: () => abrirAcao("pagar", d) }
                            : { rotulo: "Pagar", icone: <Wallet className="h-4 w-4" />, aoClicar: () => abrirAcao("pagar", d) },
                          ...(d.forma === "parcelas_fixas" ? [{ rotulo: "Amortizar", icone: <Banknote className="h-4 w-4" />, aoClicar: () => abrirAcao("amortizar", d) }] : []),
                          { rotulo: "Quitar", icone: <Scale className="h-4 w-4" />, aoClicar: () => abrirAcao("quitar", d) },
                          { rotulo: "Atualizar saldo", icone: <Gauge className="h-4 w-4" />, aoClicar: () => abrirAcao("saldo", d) },
                          { rotulo: "Lançar encargo", icone: <NotebookPen className="h-4 w-4" />, aoClicar: () => abrirAcao("encargo", d) },
                          { rotulo: "Renegociar", icone: <Handshake className="h-4 w-4" />, aoClicar: () => abrirAcao("renegociar", d) },
                          { rotulo: "Simular", icone: <Calculator className="h-4 w-4" />, aoClicar: () => router.push(`/gestao/dividas/simulador?modo=quitar&divida=${d.id}`) },
                        ]
                      : []),
                    { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(d) },
                    { rotulo: "Clonar", icone: <Copy className="h-4 w-4" />, aoClicar: () => clonar(d) },
                    ...(d.situacao !== "cancelada" && d.situacao !== "renegociada" ? [{ rotulo: "Cancelar dívida", icone: <XCircle className="h-4 w-4" />, aoClicar: () => abrirAcao("cancelar", d) }] : []),
                  ]}
                />
              ),
            },
          ], preferencia)}
        />
        <div className="flex items-center justify-between rounded-lg bg-creme px-4 py-2 text-sm font-semibold text-gray-700">
          <span className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-verde" /> Total devido
          </span>
          <ValorOcultavel centavos={-totalDevido || 0} />
        </div>
      </ProvedorOcultar>
      <Paginacao caminho={caminho} parametros={parametros} pagina={filtros.pagina} porPagina={porPagina} total={total} />

      <ContasEmAberto contas={contasEmAberto} recorrentes={recorrentes} dividas={todas} contatos={opcoes.contatos} hoje={hoje} />

      <ModalDivida formulario={form} opcoes={opcoes} multaPadrao={multaPadrao} moraPadrao={moraPadrao} limiteTaxaAltaPct={limiteTaxaAltaPct} />

      {detalhando !== null && (
        <DetalhandoDivida
          key={detalhando}
          dividaId={detalhando}
          versao={versao}
          aoFechar={() => setDetalhando(null)}
          aoAcao={(a) => dividaAberta && abrirAcao(a, dividaAberta)}
          aoPagarParcela={(o) => pagarParcela(o, detalhando)}
          aoAbrirDivida={setDetalhando}
        />
      )}

      {assistente && (
        <AssistenteRenegociacao
          dividas={todas}
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
            setDetalhando(acordoId);
            mudou();
          }}
        />
      )}

      {janela?.acao === "pagar" && <JanelaPagarDivida divida={janela.divida} destinos={opcoes.destinos} hoje={hoje} aoFechar={fecharJanela} />}
      {janela?.acao === "amortizar" && <JanelaAmortizar divida={janela.divida} destinos={opcoes.destinos} hoje={hoje} aoFechar={fecharJanela} />}
      {janela?.acao === "quitar" && <JanelaQuitar divida={janela.divida} destinos={opcoes.destinos} hoje={hoje} aoFechar={fecharJanela} />}
      {janela?.acao === "saldo" && <JanelaSaldo divida={janela.divida} hoje={hoje} aoFechar={fecharJanela} />}
      {janela?.acao === "encargo" && <JanelaEncargo divida={janela.divida} destinos={opcoes.destinos} hoje={hoje} aoFechar={fecharJanela} />}
      {janela?.acao === "cancelar" && <JanelaCancelar divida={janela.divida} aoFechar={fecharJanela} />}

      {parcela && (
        <ModalPagar
          titulo={`${parcela.descricao} · vence em ${formatarData(parcela.vencimento)}${parcela.vencimento < hoje ? ` · venceu, pode ter multa e juros (informe o valor pago)` : ""}`}
          hoje={hoje}
          ocupado={ocupado}
          erro={erroPagar}
          unico={{ valorCentavos: parcela.valorCentavos, vencimento: parcela.vencimento, receita: false }}
          aoFechar={() => {
            setParcela(null);
            setErroPagar("");
          }}
          aoConfirmar={(e) => confirmarParcela(parcela, e.data, e.valor)}
        />
      )}
    </>
  );
}
