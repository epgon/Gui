"use client";

import { Copy, CreditCard, Eye, FileText, ListOrdered, Pencil, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AsteriscoPadrao } from "@/components/cadastros/asterisco";
import { BarraLista } from "@/components/cadastros/barra-lista";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { ModalCadastro, useFormularioCadastro } from "@/components/cadastros/modal-cadastro";
import { Paginacao } from "@/components/cadastros/paginacao";
import { useSituacao } from "@/components/cadastros/use-situacao";
import { CampoSelecao, CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Tabela } from "@/components/ui/tabela";
import { CampoAuxiliarFormulario } from "@/components/listagem/campo-auxiliar";
import { comComuns, MarcaNovo } from "@/components/listagem/colunas-comuns";
import { useRotuloAuxiliar } from "@/components/listagem/configurar-listagem";
import { colunasVisiveis, type PreferenciaListagem } from "@/lib/listagem/telas";
import { Valor } from "@/components/ui/valor";
import { DetalhandoCartao, type AbaCartao } from "@/components/cartoes/detalhando-cartao";
import type { limiteDoCartao } from "@/lib/cartoes/regras";
import type { Situacao } from "@/lib/cadastros/filtros";
import { type BancoOpcao, DIAS_MES } from "@/lib/cadastros/opcoes";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { alterarSituacaoCartao, salvarCartao, type DadosCartao } from "./acoes";

type LinhaBase = {
  id: number;
  descricao: string;
  bancoId: number | null;
  bancoNome: string | null;
  bancoCodigo: string | null;
  limiteCentavos: number;
  ilimitado: boolean;
  diaFechamento: number;
  diaVencimento: number;
  contaPagamentoId: number | null;
  contaPagamentoNome: string | null;
  ativo: boolean;
  padraoSistema: boolean;
  limite: ReturnType<typeof limiteDoCartao>;
};
type Linha = LinhaBase & { campoAuxiliar: string | null; criadoEm: Date; atualizadoEm: Date };
type ContaOpcao = { id: number; descricao: string; ativo: boolean };

export function TelaCartoes({ preferencia, linhas, total, filtros, caminho, bancos, contas, abrir }: {
  linhas: Linha[];
  preferencia: PreferenciaListagem;
  total: number;
  filtros: { busca: string; situacao: Situacao; pagina: number; fechamento: string; vencimento: string };
  caminho: string;
  bancos: BancoOpcao[];
  contas: ContaOpcao[];
  abrir: { id: number; aba: AbaCartao } | null;
}) {
  const rotuloAux = useRotuloAuxiliar("cartoes-de-credito");
  const router = useRouter();
  const [detalhe, setDetalhe] = useState<{ id: number; aba: AbaCartao } | null>(abrir);
  const bancoOutro = String(bancos.find((b) => b.codigo === null)?.id ?? bancos[0]?.id ?? "");
  const vazio = useMemo<DadosCartao>(
    () => ({ descricao: "", bancoId: bancoOutro, ilimitado: false, limite: "", diaFechamento: "", diaVencimento: "", contaPagamentoId: "", campoAuxiliar: "" }),
    [bancoOutro],
  );
  const form = useFormularioCadastro(vazio);
  const situacao = useSituacao(alterarSituacaoCartao);
  const parametros = {
    busca: filtros.busca,
    fechamento: filtros.fechamento,
    vencimento: filtros.vencimento,
    situacao: filtros.situacao === "todos" ? "" : filtros.situacao,
  };
  const bancoEscolhido = bancos.find((b) => String(b.id) === form.dados.bancoId);
  const limitePreview = form.dados.ilimitado ? null : (lerValorEmCentavos(form.dados.limite || "0") ?? 0);

  const valoresDe = (l: Linha): DadosCartao => ({
    descricao: l.descricao,
    bancoId: String(l.bancoId ?? bancoOutro),
    ilimitado: l.ilimitado,
    limite: l.ilimitado ? "" : formatarCentavos(l.limiteCentavos),
    diaFechamento: String(l.diaFechamento),
    diaVencimento: String(l.diaVencimento),
    contaPagamentoId: l.contaPagamentoId ? String(l.contaPagamentoId) : "",
    campoAuxiliar: l.campoAuxiliar ?? "",
  });
  /** Clonar: abre um cadastro novo com os dados do cartão (só muda o nome). */
  const clonar = (l: Linha) => form.abrirNovo({ ...valoresDe(l), descricao: `${l.descricao} (cópia)`.slice(0, 60) });
  const editar = (l: Linha) => form.abrirEdicao(l.id, valoresDe(l));

  const opcoesDia = [{ valor: "", rotulo: "Selecione" }, ...DIAS_MES.map((d) => ({ valor: d, rotulo: d }))];
  const opcoesConta = [
    { valor: "", rotulo: "Não informado" },
    ...contas
      .filter((c) => c.ativo || String(c.id) === form.dados.contaPagamentoId)
      .map((c) => ({ valor: String(c.id), rotulo: c.ativo ? c.descricao : `${c.descricao} (inativa)` })),
  ];

  return (
    <>
      <BarraLista tela="cartoes-de-credito" preferencia={preferencia} aoAdicionar={() => form.abrirNovo()} caminho={caminho} busca={filtros.busca} parametros={parametros} rotuloBusca="Buscar cartão" />
      <FaixaErro>{situacao.aviso && <TextoComDestaque texto={situacao.aviso} />}</FaixaErro>
      <Tabela
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio={
          filtros.busca || filtros.fechamento || filtros.vencimento
            ? "Nenhum cartão encontrado com esses filtros."
            : "Nenhum cartão cadastrado. Clique em Adicionar para cadastrar o seu."
        }
        compacta={preferencia.compactar}
        destacarPares={preferencia.destacarPares}
        colunas={colunasVisiveis("cartoes-de-credito", comComuns<Linha>([
          {
            chave: "cartao",
            titulo: "Cartão de Crédito",
            render: (l) => (
              <span className={`flex items-center gap-3 ${l.ativo ? "" : "opacity-50"}`}>
                <IconeBanco codigo={l.bancoCodigo} nome={l.bancoNome ?? "Outro"} />
                <span>
                  <span className="font-medium text-gray-900">{l.descricao}</span>
                  <AsteriscoPadrao mostrar={l.padraoSistema} />
                <MarcaNovo registro={l} />
                  <span className="block text-xs text-gray-500">{l.bancoNome ?? "Outro"}</span>
                </span>
              </span>
            ),
          },
          { chave: "fechamento", titulo: "Fechamento", alinhar: "centro", render: (l) => `Dia ${l.diaFechamento}` },
          { chave: "vencimento", titulo: "Vencimento", alinhar: "centro", render: (l) => `Dia ${l.diaVencimento}` },
          {
            chave: "pagamento",
            titulo: "Conta para Pagamento",
            render: (l) => l.contaPagamentoNome ?? <span className="text-gray-400">- - -</span>,
          },
          {
            chave: "uso",
            titulo: "Uso do Limite",
            render: (l) =>
              l.limite.ilimitado ? (
                <span className="text-xs text-gray-500">
                  Usado <Valor centavos={-l.limite.usado} className="text-xs" />
                </span>
              ) : (
                <button type="button" onClick={() => setDetalhe({ id: l.id, aba: "resumo" })} className="block w-40 text-left" title="Detalhar o cartão">
                  <span
                    className="block h-2 overflow-hidden rounded-full bg-gray-100"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={l.limite.percentualUsado}
                    aria-label={`Limite usado de ${l.descricao}`}
                  >
                    <span
                      className={`block h-full rounded-full ${l.limite.percentualUsado >= 90 ? "bg-negativo" : l.limite.percentualUsado >= 70 ? "bg-dourado" : "bg-receita"}`}
                      style={{ width: `${l.limite.percentualUsado}%` }}
                    />
                  </span>
                  <span className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>Disponível</span>
                    <Valor centavos={l.limite.disponivel ?? 0} className="text-xs" />
                  </span>
                </button>
              ),
          },
          {
            chave: "limite",
            titulo: "Limite",
            alinhar: "direita",
            render: (l) => (l.ilimitado ? <span className="font-semibold text-receita">Ilimitado</span> : <Valor centavos={l.limiteCentavos} />),
          },
          {
            chave: "situacao",
            titulo: "Situação",
            alinhar: "centro",
            render: (l) => (
              <ChaveSituacao ativo={l.ativo} ocupado={situacao.ocupadoId === l.id} aoMudar={() => situacao.alternar(l.id, l.ativo)} rotulo={`o cartão ${l.descricao}`} />
            ),
          },
          {
            chave: "faturas",
            titulo: <span className="sr-only">Faturas</span>,
            alinhar: "centro",
            render: (l) => (
              <button type="button" onClick={() => setDetalhe({ id: l.id, aba: "faturas" })} title="Faturas" aria-label={`Faturas de ${l.descricao}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-verde">
                <FileText className="h-4 w-4" />
              </button>
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
                  { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(l) },
                  { rotulo: "Clonar", icone: <Copy className="h-4 w-4" />, aoClicar: () => clonar(l) },
                  { rotulo: "Detalhar", icone: <Eye className="h-4 w-4" />, aoClicar: () => setDetalhe({ id: l.id, aba: "resumo" }) },
                  { rotulo: "Faturas", icone: <CreditCard className="h-4 w-4" />, aoClicar: () => setDetalhe({ id: l.id, aba: "faturas" }) },
                  { rotulo: "Lançamentos", icone: <ListOrdered className="h-4 w-4" />, aoClicar: () => router.push(`/financeiro/lancamentos?destino=cartao:${l.id}`) },
                  { rotulo: l.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => situacao.alternar(l.id, l.ativo) },
                ]}
              />
            ),
          },
        ], rotuloAux), preferencia)}
      />
      <Paginacao caminho={caminho} parametros={parametros} pagina={filtros.pagina} porPagina={preferencia.porPagina} total={total} />
      {detalhe && <DetalhandoCartao key={`${detalhe.id}-${detalhe.aba}`} cartaoId={detalhe.id} abaInicial={detalhe.aba} aoFechar={() => setDetalhe(null)} />}

      <ModalCadastro
        formulario={form}
        titulo={
          <span className="flex items-center gap-3">
            <IconeBanco codigo={bancoEscolhido?.codigo ?? null} nome={bancoEscolhido?.nome ?? "Outro"} />
            {form.novo ? "Novo Cartão de Crédito" : "Editando Cartão de Crédito"}
          </span>
        }
        resumo={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{form.dados.descricao || "Descrição"}</span>·<span>{bancoEscolhido?.nome ?? "Outro"}</span>·
            {limitePreview === null ? <span className="font-semibold text-receita">Ilimitado</span> : <Valor centavos={limitePreview} />}
          </span>
        }
        aoSalvar={() => form.salvar(salvarCartao)}
      >
        <CampoTexto
          rotulo="Descrição"
          obrigatorio
          autoFocus
          maxLength={60}
          ajuda="Nome do cartão como você o reconhece. Ex.: Nubank Roxinho, Itaú Visa."
          valor={form.dados.descricao}
          aoMudar={(v) => form.mudar("descricao", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelecao
            rotulo="Bandeira ou Emissor"
            ajuda="O banco que emitiu o cartão. Serve para mostrar o ícone certo."
            valor={form.dados.bancoId}
            aoMudar={(v) => form.mudar("bancoId", v)}
            opcoes={bancos.map((b) => ({ valor: String(b.id), rotulo: b.nome }))}
          />
          <div>
            <CampoValor
              rotulo="Limite"
              obrigatorio={!form.dados.ilimitado}
              desabilitado={form.dados.ilimitado}
              ajuda="O limite total do cartão, como aparece no aplicativo do banco."
              valor={form.dados.ilimitado ? "" : form.dados.limite}
              aoMudar={(v) => form.mudar("limite", v)}
            />
            <div className="mt-2">
              <Chave ligada={form.dados.ilimitado} aoMudar={(v) => form.mudar("ilimitado", v)} rotulo="Ilimitado" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelecao
            rotulo="Dia do Fechamento"
            obrigatorio
            ajuda="Dia em que a fatura fecha. Compras a partir desse dia entram na fatura do mês seguinte."
            valor={form.dados.diaFechamento}
            aoMudar={(v) => form.mudar("diaFechamento", v)}
            opcoes={opcoesDia}
          />
          <CampoSelecao
            rotulo="Dia do Vencimento"
            obrigatorio
            ajuda="Dia em que a fatura vence (precisa ser paga)."
            valor={form.dados.diaVencimento}
            aoMudar={(v) => form.mudar("diaVencimento", v)}
            opcoes={opcoesDia}
          />
        </div>
        <CampoSelecao
          rotulo="Conta Financeira Padrão para Pagamento"
          ajuda="A conta de onde a fatura costuma ser paga. Pode ficar sem informar."
          valor={form.dados.contaPagamentoId}
          aoMudar={(v) => form.mudar("contaPagamentoId", v)}
          opcoes={opcoesConta}
        />
        <CampoAuxiliarFormulario cadastro="cartoes" className="mt-4" valor={form.dados.campoAuxiliar ?? ""} aoMudar={(v) => form.mudar("campoAuxiliar", v)} />
      </ModalCadastro>
    </>
  );
}
