"use client";

import { Pencil, Power } from "lucide-react";
import { AsteriscoPadrao } from "@/components/cadastros/asterisco";
import { BarraLista } from "@/components/cadastros/barra-lista";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { ModalCadastro, useFormularioCadastro } from "@/components/cadastros/modal-cadastro";
import { Paginacao } from "@/components/cadastros/paginacao";
import { useSituacao } from "@/components/cadastros/use-situacao";
import { CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Tabela } from "@/components/ui/tabela";
import { POR_PAGINA, type Situacao } from "@/lib/cadastros/filtros";
import { alterarSituacaoForma, salvarForma, type DadosForma } from "./acoes";

type Linha = { id: number; descricao: string; sigla: string | null; ativo: boolean; padraoSistema: boolean };
const VAZIO: DadosForma = { descricao: "", sigla: "" };

export function TelaFormas({ linhas, total, filtros, caminho }: {
  linhas: Linha[];
  total: number;
  filtros: { busca: string; situacao: Situacao; pagina: number };
  caminho: string;
}) {
  const form = useFormularioCadastro(VAZIO);
  const situacao = useSituacao(alterarSituacaoForma);
  const parametros = { busca: filtros.busca, situacao: filtros.situacao === "todos" ? "" : filtros.situacao };

  return (
    <>
      <BarraLista aoAdicionar={() => form.abrirNovo()} caminho={caminho} busca={filtros.busca} parametros={parametros} rotuloBusca="Buscar forma de pagamento" />
      <FaixaErro>{situacao.aviso && <TextoComDestaque texto={situacao.aviso} />}</FaixaErro>
      <Tabela
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio={filtros.busca ? "Nenhuma forma de pagamento encontrada com essa busca." : "Nenhuma forma de pagamento cadastrada."}
        colunas={[
          {
            chave: "forma",
            titulo: "Forma de Pagamento",
            render: (l) => (
              <span className={l.ativo ? "" : "text-gray-400"}>
                {l.descricao}
                <AsteriscoPadrao mostrar={l.padraoSistema} />
              </span>
            ),
          },
          {
            chave: "sigla",
            titulo: "Sigla",
            render: (l) => <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-700">{l.sigla ?? "- - -"}</span>,
          },
          {
            chave: "situacao",
            titulo: "Situação",
            alinhar: "centro",
            render: (l) => (
              <ChaveSituacao ativo={l.ativo} ocupado={situacao.ocupadoId === l.id} aoMudar={() => situacao.alternar(l.id, l.ativo)} rotulo={l.descricao} />
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
                  { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => form.abrirEdicao(l.id, { descricao: l.descricao, sigla: l.sigla ?? "" }) },
                  { rotulo: l.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => situacao.alternar(l.id, l.ativo) },
                ]}
              />
            ),
          },
        ]}
      />
      <Paginacao caminho={caminho} parametros={parametros} pagina={filtros.pagina} porPagina={POR_PAGINA} total={total} />

      <ModalCadastro
        formulario={form}
        titulo={form.novo ? "Nova Forma de Pagamento" : "Editando Forma de Pagamento"}
        resumo={[form.dados.descricao || "Descrição", form.dados.sigla.toUpperCase() || "Sigla"].join(" · ")}
        aoSalvar={() => form.salvar(salvarForma)}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <CampoTexto rotulo="Descrição" obrigatorio autoFocus maxLength={60} valor={form.dados.descricao} aoMudar={(v) => form.mudar("descricao", v)} />
          <CampoTexto
            rotulo="Sigla"
            obrigatorio
            maxLength={5}
            ajuda="Sigla utilizada para identificar uma forma de pagamento, de uma maneira resumida na tela de lançamentos."
            valor={form.dados.sigla}
            aoMudar={(v) => form.mudar("sigla", v.toUpperCase())}
          />
        </div>
      </ModalCadastro>
    </>
  );
}
