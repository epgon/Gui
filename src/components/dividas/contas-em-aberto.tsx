"use client";

import { ExternalLink, HandCoins, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { JanelaAjuda } from "@/components/ajuda/central-ajuda";
import { acompanharComoDivida } from "@/app/(sistema)/gestao/dividas/acoes";
import { CampoComNovo } from "@/app/(sistema)/financeiro/lancamentos/campos";
import { ModalNovoContato } from "@/app/(sistema)/financeiro/lancamentos/formulario";
import { ModalPagar } from "@/app/(sistema)/financeiro/lancamentos/linhas";
import { realizarLancamentos } from "@/app/(sistema)/financeiro/lancamentos/acoes";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { JanelaFatura } from "@/components/cartoes/janela-fatura";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { ProvedorOcultar, ValorOcultavel } from "@/components/ui/ocultar-valores";
import { Tabela } from "@/components/ui/tabela";
import { formatarData } from "@/lib/datas";
import { estaAtiva, TIPOS_DIVIDA } from "@/lib/dividas/regras";
import type { ContaEmAberto, LinhaDivida } from "@/lib/dividas/tipos";
import type { OpcaoSimples } from "@/lib/lancamentos/tipos";

const ROTULO_ORIGEM = { fatura: "Fatura de cartão", lancamento: "Lançamento vencido", recorrente: "Recorrente" } as const;

/**
 * "Contas em aberto no Gui": faturas fechadas, despesas vencidas e (opcional) recorrentes que ainda não são dívida.
 * Pagar usa as mesmas janelas dos módulos de origem; Acompanhar como dívida só liga, sem cadastrar nada em dobro.
 */
export function ContasEmAberto({ contas, recorrentes, dividas, contatos, hoje }: {
  contas: ContaEmAberto[];
  recorrentes: ContaEmAberto[];
  dividas: LinhaDivida[];
  contatos: OpcaoSimples[];
  hoje: string;
}) {
  const router = useRouter();
  const [mostrarRecorrentes, setMostrarRecorrentes] = useState(false);
  const [pagando, setPagando] = useState<ContaEmAberto | null>(null);
  const [fatura, setFatura] = useState<number | null>(null);
  const [acompanhando, setAcompanhando] = useState<ContaEmAberto | null>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const linhas = mostrarRecorrentes ? [...contas, ...recorrentes] : contas;
  const total = contas.reduce((s, c) => s + c.valorCentavos, 0);

  const pagar = (c: ContaEmAberto) => (c.origem === "fatura" ? setFatura(c.id) : setPagando(c));
  const confirmarPagamento = (c: ContaEmAberto, data: string, valor: { valorPago: string; gerarRestante: boolean; vencimentoRestante: string } | null) =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await realizarLancamentos([c.id], data, [], valor);
        if (!r.ok) return setErro(r.erro);
        setPagando(null);
        router.refresh();
      } catch {
        setErro("Não foi possível pagar agora. Tente de novo.");
      }
    });

  return (
    <section id="contas-em-aberto" className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Contas em aberto no Gui</h2>
        <p className="text-sm text-gray-500">O que já está no sistema e ainda não é dívida: faturas fechadas e despesas vencidas e não pagas. Nada é cadastrado em dobro: acompanhar só liga a conta a uma dívida.</p>
        <button type="button" onClick={() => setAjudaAberta(true)} className="mt-1 text-sm font-semibold text-verde hover:underline">
          Como decidir entre Pagar e Acompanhar como dívida
        </button>
      </div>
      <ProvedorOcultar>
        <Tabela
          linhas={linhas}
          chaveLinha={(c) => c.chave}
          vazio="Nenhuma conta em aberto. Faturas fechadas e despesas vencidas e não pagas aparecem aqui."
          colunas={[
            {
              chave: "origem",
              titulo: "Conta",
              render: (c) => (
                <span>
                  <span className="font-medium text-gray-900">{c.descricao}</span>
                  <span className="block text-xs text-gray-500">{ROTULO_ORIGEM[c.origem]}</span>
                </span>
              ),
            },
            { chave: "vencimento", titulo: "Vencimento", render: (c) => (c.vencimento ? <span className={c.atrasoDias > 0 ? "text-despesa" : ""}>{formatarData(c.vencimento)}{c.atrasoDias > 0 && <span className="block text-xs">há {c.atrasoDias} {c.atrasoDias === 1 ? "dia" : "dias"}</span>}</span> : <span className="text-gray-400">todo mês</span>) },
            { chave: "valor", titulo: "Valor", alinhar: "direita", render: (c) => <ValorOcultavel centavos={-c.valorCentavos || 0} /> },
            {
              chave: "menu",
              titulo: <span className="sr-only">Opções</span>,
              alinhar: "direita",
              render: (c) => (
                <MenuLinha
                  rotulo={c.descricao}
                  itens={[
                    ...(c.origem !== "recorrente" ? [{ rotulo: "Pagar", icone: <Wallet className="h-4 w-4" />, aoClicar: () => pagar(c) }] : []),
                    { rotulo: "Acompanhar como dívida", icone: <HandCoins className="h-4 w-4" />, aoClicar: () => setAcompanhando(c) },
                    { rotulo: "Abrir no módulo de origem", icone: <ExternalLink className="h-4 w-4" />, aoClicar: () => router.push(c.href) },
                  ]}
                />
              ),
            },
          ]}
        />
        {contas.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-creme px-4 py-2 text-sm font-semibold text-gray-700">
            <span>Total em aberto</span>
            <ValorOcultavel centavos={-total || 0} />
          </div>
        )}
      </ProvedorOcultar>
      <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      {recorrentes.length > 0 && <Chave ligada={mostrarRecorrentes} aoMudar={setMostrarRecorrentes} rotulo="Mostrar recorrentes de despesa (consignado, pensão... para acompanhar como dívida)" />}

      <JanelaAjuda tela="minhas" artigoInicial="conta-vencida-vira-divida" aberto={ajudaAberta} aoFechar={() => setAjudaAberta(false)} />
      {pagando && (
        <ModalPagar
          titulo={`${pagando.descricao} · venceu em ${formatarData(pagando.vencimento)}`}
          hoje={hoje}
          ocupado={ocupado}
          erro={erro}
          unico={{ valorCentavos: pagando.valorCentavos, vencimento: pagando.vencimento ?? hoje, receita: false }}
          aoFechar={() => setPagando(null)}
          aoConfirmar={(e) => confirmarPagamento(pagando, e.data, e.valor)}
        />
      )}
      {fatura !== null && <JanelaFatura faturaId={fatura} aoFechar={() => setFatura(null)} aoMudar={() => router.refresh()} />}
      {acompanhando && <ModalAcompanhar conta={acompanhando} dividas={dividas} contatos={contatos} aoFechar={() => setAcompanhando(null)} />}
    </section>
  );
}

/** Escolhe uma dívida (ou cria uma) para acompanhar a conta. */
function ModalAcompanhar({ conta, dividas, contatos, aoFechar }: { conta: ContaEmAberto; dividas: LinhaDivida[]; contatos: OpcaoSimples[]; aoFechar: () => void }) {
  const router = useRouter();
  const abertas = dividas.filter((d) => estaAtiva(d.situacao));
  const [escolha, setEscolha] = useState(abertas[0] ? String(abertas[0].id) : "nova");
  const [descricao, setDescricao] = useState(conta.descricao);
  const [credor, setCredor] = useState("");
  const [tipo, setTipo] = useState(conta.origem === "fatura" ? "cartao" : conta.origem === "recorrente" ? "consignado" : "conta_atrasada");
  const [novoCredor, setNovoCredor] = useState(false);
  const [novos, setNovos] = useState<OpcaoSimples[]>([]);
  const lista = useMemo(() => [...contatos, ...novos], [contatos, novos]);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();

  const confirmar = () =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await acompanharComoDivida(
          { tipo: conta.origem === "recorrente" ? "recorrencia" : conta.origem, id: conta.id },
          escolha === "nova" ? { dividaId: null, nova: { descricao, contatoId: credor, tipo } } : { dividaId: Number(escolha), nova: null },
        );
        if (!r.ok) return setErro(r.erro);
        aoFechar();
        router.refresh();
      } catch {
        setErro("Não foi possível concluir agora. Tente de novo.");
      }
    });

  return (
    <>
      <Modal
        aberto
        aoFechar={aoFechar}
        titulo="Acompanhar como dívida"
        resumo={conta.rotuloOrigem}
        rodape={
          <>
            <Botao variante="secundario" type="button" onClick={aoFechar} disabled={ocupado}>Voltar</Botao>
            <Botao type="button" carregando={ocupado} onClick={confirmar}>Acompanhar</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">O registro original não muda: valor, data, categoria e conta continuam os mesmos. Você pode desligar quando quiser, no Detalhando Dívida &gt; Vínculos.</p>
          <CampoSelecao
            rotulo="Dívida"
            valor={escolha}
            aoMudar={setEscolha}
            opcoes={[...abertas.map((d) => ({ valor: String(d.id), rotulo: `${d.descricao} (${d.credor})` })), { valor: "nova", rotulo: "Nova dívida" }]}
          />
          {escolha === "nova" && (
            <div className="space-y-4 rounded-lg bg-creme p-4">
              <CampoTexto rotulo="Descrição da Dívida" obrigatorio maxLength={120} valor={descricao} aoMudar={setDescricao} />
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoComNovo rotulo="Credor" obrigatorio vazio="Selecione" valor={credor} aoMudar={setCredor} opcoes={lista} aoCriar={() => setNovoCredor(true)} rotuloNovo="Novo Cliente ou Fornecedor" />
                <CampoSelecao rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={TIPOS_DIVIDA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))} />
              </div>
              <p className="text-xs text-gray-600">Sem parcelas definidas: o saldo é o das contas ligadas. Depois você pode informar o saldo do credor em Atualizar saldo.</p>
            </div>
          )}
          <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        </div>
      </Modal>
      {novoCredor && (
        <ModalNovoContato
          tipo="despesa"
          aoFechar={() => setNovoCredor(false)}
          aoCriar={(id, rotulo) => {
            setNovos((x) => [...x, { id, rotulo, ativo: true }]);
            setCredor(String(id));
            setNovoCredor(false);
          }}
        />
      )}
    </>
  );
}
