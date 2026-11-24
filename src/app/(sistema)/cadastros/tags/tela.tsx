"use client";

import { Pencil, Power, Tag as IconeTag } from "lucide-react";
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
import { CampoAuxiliarFormulario } from "@/components/listagem/campo-auxiliar";
import { comComuns, MarcaNovo } from "@/components/listagem/colunas-comuns";
import { useRotuloAuxiliar } from "@/components/listagem/configurar-listagem";
import { colunasVisiveis, type PreferenciaListagem } from "@/lib/listagem/telas";
import type { Situacao } from "@/lib/cadastros/filtros";
import { alterarSituacaoTag, salvarTag, type DadosTag } from "./acoes";

type LinhaBase = { id: number; descricao: string; ativo: boolean; padraoSistema: boolean };
type Linha = LinhaBase & { campoAuxiliar: string | null; criadoEm: Date; atualizadoEm: Date };
const VAZIO: DadosTag = { descricao: "", campoAuxiliar: "" };

export function TelaTags({ preferencia, linhas, total, filtros, caminho }: {
  linhas: Linha[];
  preferencia: PreferenciaListagem;
  total: number;
  filtros: { busca: string; situacao: Situacao; pagina: number };
  caminho: string;
}) {
  const rotuloAux = useRotuloAuxiliar("tags");
  const form = useFormularioCadastro(VAZIO);
  const situacao = useSituacao(alterarSituacaoTag);
  const parametros = { busca: filtros.busca, situacao: filtros.situacao === "todos" ? "" : filtros.situacao };

  return (
    <>
      <BarraLista tela="tags" preferencia={preferencia} aoAdicionar={() => form.abrirNovo()} caminho={caminho} busca={filtros.busca} parametros={parametros} rotuloBusca="Buscar tag" />
      <FaixaErro>{situacao.aviso && <TextoComDestaque texto={situacao.aviso} />}</FaixaErro>
      <Tabela
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio={filtros.busca ? "Nenhuma tag encontrada com essa busca." : "Nenhuma tag cadastrada. Clique em Adicionar para criar a primeira."}
        compacta={preferencia.compactar}
        destacarPares={preferencia.destacarPares}
        colunas={colunasVisiveis("tags", comComuns<Linha>([
          {
            chave: "tag",
            titulo: "Tag",
            render: (l) => (
              <span className={l.ativo ? "" : "text-gray-400"}>
                <IconeTag className="mr-2 inline h-4 w-4 text-verde" />
                {l.descricao}
                <AsteriscoPadrao mostrar={l.padraoSistema} />
                <MarcaNovo registro={l} />
              </span>
            ),
          },
          {
            chave: "situacao",
            titulo: "Situação",
            alinhar: "centro",
            render: (l) => (
              <ChaveSituacao ativo={l.ativo} ocupado={situacao.ocupadoId === l.id} aoMudar={() => situacao.alternar(l.id, l.ativo)} rotulo={`a tag ${l.descricao}`} />
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
                  { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => form.abrirEdicao(l.id, { descricao: l.descricao, campoAuxiliar: l.campoAuxiliar ?? "" }) },
                  { rotulo: l.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => situacao.alternar(l.id, l.ativo) },
                ]}
              />
            ),
          },
        ], rotuloAux), preferencia)}
      />
      <Paginacao caminho={caminho} parametros={parametros} pagina={filtros.pagina} porPagina={preferencia.porPagina} total={total} />

      <ModalCadastro
        formulario={form}
        titulo={form.novo ? "Nova Tag" : "Editando Tag"}
        resumo={form.dados.descricao || "Descrição"}
        aoSalvar={() => form.salvar(salvarTag)}
      >
        <CampoTexto rotulo="Descrição" obrigatorio autoFocus maxLength={60} valor={form.dados.descricao} aoMudar={(v) => form.mudar("descricao", v)} />
        <CampoAuxiliarFormulario cadastro="tags" className="mt-4" valor={form.dados.campoAuxiliar ?? ""} aoMudar={(v) => form.mudar("campoAuxiliar", v)} />
      </ModalCadastro>
    </>
  );
}
