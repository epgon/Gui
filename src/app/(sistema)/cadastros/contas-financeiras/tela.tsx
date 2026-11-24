"use client";

import { Eye, Pencil, Power } from "lucide-react";
import { useMemo, useState } from "react";
import { AsteriscoPadrao } from "@/components/cadastros/asterisco";
import { BarraLista } from "@/components/cadastros/barra-lista";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { DetalhandoConta } from "@/components/contas/detalhando-conta";
import { ModalCadastro, useFormularioCadastro } from "@/components/cadastros/modal-cadastro";
import { Paginacao } from "@/components/cadastros/paginacao";
import { useSituacao } from "@/components/cadastros/use-situacao";
import { CampoSelecao, CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Tabela } from "@/components/ui/tabela";
import { Valor } from "@/components/ui/valor";
import { POR_PAGINA, type Situacao } from "@/lib/cadastros/filtros";
import { type BancoOpcao, rotuloTipoConta, TIPOS_CONTA } from "@/lib/cadastros/opcoes";
import { formatarData } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { alterarSituacaoConta, salvarConta, type DadosConta } from "./acoes";

type Linha = {
  id: number;
  descricao: string;
  tipo: string;
  bancoId: number | null;
  bancoNome: string | null;
  bancoCodigo: string | null;
  considerarNosSaldos: boolean;
  saldoInicialCentavos: number;
  saldoInicialData: string | null;
  saldoAtualCentavos: number;
  ativo: boolean;
  padraoSistema: boolean;
};

export function TelaContas({ linhas, total, filtros, caminho, bancos, hoje }: {
  linhas: Linha[];
  total: number;
  filtros: { busca: string; situacao: Situacao; pagina: number; tipo: string };
  caminho: string;
  bancos: BancoOpcao[];
  hoje: string;
}) {
  const bancoOutro = String(bancos.find((b) => b.codigo === null)?.id ?? bancos[0]?.id ?? "");
  const vazio = useMemo<DadosConta>(
    () => ({ descricao: "", bancoId: bancoOutro, tipo: "outro", considerarNosSaldos: true, saldoInicial: "", saldoInicialData: hoje }),
    [bancoOutro, hoje],
  );
  const form = useFormularioCadastro(vazio);
  const situacao = useSituacao(alterarSituacaoConta);
  const [detalhando, setDetalhando] = useState<number | null>(null);
  const parametros = { busca: filtros.busca, tipo: filtros.tipo, situacao: filtros.situacao === "todos" ? "" : filtros.situacao };
  const bancoEscolhido = bancos.find((b) => String(b.id) === form.dados.bancoId);

  const editar = (l: Linha) =>
    form.abrirEdicao(l.id, {
      descricao: l.descricao,
      bancoId: String(l.bancoId ?? bancoOutro),
      tipo: l.tipo,
      considerarNosSaldos: l.considerarNosSaldos,
      saldoInicial: l.saldoInicialCentavos ? formatarCentavos(l.saldoInicialCentavos) : "",
      saldoInicialData: l.saldoInicialData ?? hoje,
    });

  return (
    <>
      <BarraLista tela="contas-financeiras" aoAdicionar={() => form.abrirNovo()} caminho={caminho} busca={filtros.busca} parametros={parametros} rotuloBusca="Buscar conta" />
      <FaixaErro>{situacao.aviso && <TextoComDestaque texto={situacao.aviso} />}</FaixaErro>
      <Tabela
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio={
          filtros.busca || filtros.tipo
            ? "Nenhuma conta encontrada com esses filtros."
            : "Nenhuma conta cadastrada. Clique em Adicionar e informe o saldo que a conta tem hoje."
        }
        colunas={[
          {
            chave: "conta",
            titulo: "Conta Financeira",
            render: (l) => (
              <span className={`flex items-center gap-3 ${l.ativo ? "" : "opacity-50"}`}>
                <IconeBanco codigo={l.bancoCodigo} nome={l.bancoNome ?? "Outro"} />
                <span>
                  <button type="button" onClick={() => setDetalhando(l.id)} className="font-medium text-gray-900 hover:text-verde hover:underline" title="Detalhar conta">
                    {l.descricao}
                  </button>
                  <AsteriscoPadrao mostrar={l.padraoSistema} />
                  <span className="block text-xs text-gray-500">{l.bancoNome ?? "Outro"}</span>
                </span>
              </span>
            ),
          },
          { chave: "tipo", titulo: "Tipo", render: (l) => rotuloTipoConta(l.tipo) },
          {
            chave: "saldo",
            titulo: "Saldo Inicial",
            alinhar: "direita",
            render: (l) => (
              <span title={l.saldoInicialData ? `Saldo em ${formatarData(l.saldoInicialData)}` : undefined}>
                <Valor centavos={l.saldoInicialCentavos} />
                {l.saldoInicialData && <span className="block text-xs text-gray-400">em {formatarData(l.saldoInicialData)}</span>}
              </span>
            ),
          },
          {
            chave: "saldoAtual",
            titulo: "Saldo Atual",
            alinhar: "direita",
            render: (l) => (
              <span title="Saldo inicial mais tudo o que já foi pago ou recebido até hoje">
                <Valor centavos={l.saldoAtualCentavos} />
              </span>
            ),
          },
          {
            chave: "saldos",
            titulo: "Nos saldos",
            alinhar: "centro",
            render: (l) => (
              <span className={l.considerarNosSaldos ? "text-pago-texto" : "text-gray-400"}>{l.considerarNosSaldos ? "Sim" : "Não"}</span>
            ),
          },
          {
            chave: "situacao",
            titulo: "Situação",
            alinhar: "centro",
            render: (l) => (
              <ChaveSituacao ativo={l.ativo} ocupado={situacao.ocupadoId === l.id} aoMudar={() => situacao.alternar(l.id, l.ativo)} rotulo={`a conta ${l.descricao}`} />
            ),
          },
          {
            chave: "menu",
            titulo: <span className="sr-only">Opções</span>,
            alinhar: "direita",
            render: (l) => (
              <MenuLinha
                rotulo={l.descricao}
                itens={[
                  { rotulo: "Detalhar", icone: <Eye className="h-4 w-4" />, aoClicar: () => setDetalhando(l.id) },
                  { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(l) },
                  { rotulo: l.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => situacao.alternar(l.id, l.ativo) },
                ]}
              />
            ),
          },
        ]}
      />
      <Paginacao caminho={caminho} parametros={parametros} pagina={filtros.pagina} porPagina={POR_PAGINA} total={total} />

      {detalhando !== null && <DetalhandoConta key={detalhando} contaId={detalhando} aoFechar={() => setDetalhando(null)} />}

      <ModalCadastro
        formulario={form}
        titulo={
          <span className="flex items-center gap-3">
            <IconeBanco codigo={bancoEscolhido?.codigo ?? null} nome={bancoEscolhido?.nome ?? "Outro"} />
            {form.novo ? "Nova Conta Financeira" : "Editando Conta Financeira"}
          </span>
        }
        resumo={[form.dados.descricao || "Descrição", rotuloTipoConta(form.dados.tipo)].join(" · ")}
        aoSalvar={() => form.salvar(salvarConta, (d) => ({ bancoId: d.bancoId, tipo: d.tipo }))}
      >
        <CampoTexto
          rotulo="Descrição"
          obrigatorio
          autoFocus
          maxLength={60}
          ajuda="Nome da conta como você a reconhece. Ex.: Nubank, Carteira, Poupança Caixa."
          valor={form.dados.descricao}
          aoMudar={(v) => form.mudar("descricao", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelecao
            rotulo="Banco"
            valor={form.dados.bancoId}
            aoMudar={(v) => form.mudar("bancoId", v)}
            opcoes={bancos.map((b) => ({ valor: String(b.id), rotulo: b.codigo ? `${b.nome} (${b.codigo})` : b.nome }))}
          />
          <CampoSelecao
            rotulo="Tipo"
            valor={form.dados.tipo}
            aoMudar={(v) => form.mudar("tipo", v)}
            opcoes={TIPOS_CONTA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
          />
        </div>
        <div className="rounded-lg bg-creme p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoValor
              rotulo="Saldo Inicial"
              permitirNegativo
              ajuda="Quanto a conta tem hoje, conferido no aplicativo do banco. Se estiver no negativo, use o sinal de menos (ex.: -150,00)."
              valor={form.dados.saldoInicial}
              aoMudar={(v) => form.mudar("saldoInicial", v)}
            />
            <CampoTexto
              rotulo="Data do Saldo Inicial"
              type="date"
              ajuda="O dia em que a conta tinha esse saldo. Os lançamentos contam a partir daí."
              valor={form.dados.saldoInicialData}
              aoMudar={(v) => form.mudar("saldoInicialData", v)}
            />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Este valor aparece em Lançamentos como &quot;Saldo Inicial&quot; (já recebido), e o Saldo Atual da conta parte dele.
          </p>
        </div>
        <Chave
          ligada={form.dados.considerarNosSaldos}
          aoMudar={(v) => form.mudar("considerarNosSaldos", v)}
          rotulo="Considerar esta conta no Saldo Atual da Visão Geral"
        />
      </ModalCadastro>
    </>
  );
}
