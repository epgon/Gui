"use client";

import { Building2, MessageCircle, Pencil, Power, UserRound } from "lucide-react";
import { useState } from "react";
import { AsteriscoPadrao } from "@/components/cadastros/asterisco";
import { BarraLista } from "@/components/cadastros/barra-lista";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { ModalCadastro, useFormularioCadastro } from "@/components/cadastros/modal-cadastro";
import { Paginacao } from "@/components/cadastros/paginacao";
import { useSituacao } from "@/components/cadastros/use-situacao";
import { CampoAreaTexto, CampoSelecao, CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Tabela } from "@/components/ui/tabela";
import { CampoAuxiliarFormulario } from "@/components/listagem/campo-auxiliar";
import { comComuns, MarcaNovo } from "@/components/listagem/colunas-comuns";
import { useRotuloAuxiliar } from "@/components/listagem/configurar-listagem";
import { colunasVisiveis, type PreferenciaListagem } from "@/lib/listagem/telas";
import { cn } from "@/lib/cn";
import { formatarCep, formatarDocumento, formatarTelefone } from "@/lib/cadastros/documentos";
import type { Situacao } from "@/lib/cadastros/filtros";
import { SEXOS, UFS } from "@/lib/cadastros/opcoes";
import { alterarSituacaoContato, salvarContato, type DadosContato } from "./acoes";

type LinhaBase = {
  id: number;
  pessoa: "fisica" | "juridica";
  nome: string;
  razaoSocial: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  telefoneWhatsapp: boolean;
  sexo: string;
  nascimento: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  eCliente: boolean;
  eFornecedor: boolean;
  ativo: boolean;
  padraoSistema: boolean;
};
type Linha = LinhaBase & { campoAuxiliar: string | null; criadoEm: Date; atualizadoEm: Date };

const VAZIO: DadosContato = {
  pessoa: "fisica",
  nome: "",
  eCliente: false,
  eFornecedor: true,
  razaoSocial: "",
  documento: "",
  email: "",
  telefone: "",
  telefoneWhatsapp: false,
  sexo: "nao_informado",
  nascimento: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  observacoes: "",
  campoAuxiliar: "",
};

type Aba = "informacoes" | "endereco" | "observacoes";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "informacoes", rotulo: "Informações" },
  { id: "endereco", rotulo: "Endereço" },
  { id: "observacoes", rotulo: "Observações" },
];

function Papeis({ cliente, fornecedor }: { cliente: boolean; fornecedor: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {cliente && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-receita">Cliente</span>}
      {fornecedor && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-despesa">Fornecedor</span>}
      {!cliente && !fornecedor && <span className="text-gray-400">- - -</span>}
    </span>
  );
}

export function TelaContatos({ preferencia, linhas, total, filtros, caminho }: {
  linhas: Linha[];
  preferencia: PreferenciaListagem;
  total: number;
  filtros: { busca: string; situacao: Situacao; pagina: number; papel: string; pessoa: string; cidade: string; uf: string };
  caminho: string;
}) {
  const rotuloAux = useRotuloAuxiliar("clientes-e-fornecedores");
  const form = useFormularioCadastro(VAZIO);
  const situacao = useSituacao(alterarSituacaoContato);
  const [aba, setAba] = useState<Aba>("informacoes");
  const [maisInfo, setMaisInfo] = useState(false);
  const parametros = {
    busca: filtros.busca,
    papel: filtros.papel,
    pessoa: filtros.pessoa,
    cidade: filtros.cidade,
    uf: filtros.uf,
    situacao: filtros.situacao === "todos" ? "" : filtros.situacao,
  };
  const d = form.dados;
  const juridica = d.pessoa === "juridica";

  const abrirNovo = () => {
    setAba("informacoes");
    setMaisInfo(false);
    form.abrirNovo(filtros.papel === "clientes" ? { eCliente: true, eFornecedor: false } : undefined);
  };
  const editar = (l: Linha) => {
    setAba("informacoes");
    setMaisInfo(Boolean(l.razaoSocial || l.documento || l.email || l.telefone || l.nascimento));
    form.abrirEdicao(l.id, {
      pessoa: l.pessoa,
      nome: l.nome,
      eCliente: l.eCliente,
      eFornecedor: l.eFornecedor,
      razaoSocial: l.razaoSocial ?? "",
      documento: l.documento ?? "",
      email: l.email ?? "",
      telefone: l.telefone ?? "",
      telefoneWhatsapp: l.telefoneWhatsapp,
      sexo: l.sexo,
      nascimento: l.nascimento ?? "",
      cep: l.cep ?? "",
      logradouro: l.logradouro ?? "",
      numero: l.numero ?? "",
      complemento: l.complemento ?? "",
      bairro: l.bairro ?? "",
      cidade: l.cidade ?? "",
      uf: l.uf ?? "",
      observacoes: l.observacoes ?? "",
      campoAuxiliar: l.campoAuxiliar ?? "",
    });
  };
  const salvar = () => {
    // Se o erro for de um campo de outra aba, a mensagem diz qual é.
    form.salvar(salvarContato, (x) => ({ eCliente: x.eCliente, eFornecedor: x.eFornecedor, pessoa: x.pessoa }));
  };

  return (
    <>
      <BarraLista tela="clientes-e-fornecedores" preferencia={preferencia} aoAdicionar={abrirNovo} caminho={caminho} busca={filtros.busca} parametros={parametros} rotuloBusca="Buscar por nome ou documento" />
      <FaixaErro>{situacao.aviso && <TextoComDestaque texto={situacao.aviso} />}</FaixaErro>
      <Tabela
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio={
          Object.values(parametros).some(Boolean)
            ? "Ninguém encontrado com esses filtros."
            : "Nenhum cliente ou fornecedor cadastrado. Clique em Adicionar para cadastrar pessoas e empresas com quem você paga ou recebe."
        }
        compacta={preferencia.compactar}
        destacarPares={preferencia.destacarPares}
        colunas={colunasVisiveis("clientes-e-fornecedores", comComuns<Linha>([
          {
            chave: "nome",
            titulo: "Nome",
            render: (l) => (
              <span className={cn("flex items-center gap-3", !l.ativo && "opacity-50")}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-verde-claro text-verde" title={l.pessoa === "juridica" ? "Pessoa Jurídica" : "Pessoa Física"}>
                  {l.pessoa === "juridica" ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                </span>
                <span>
                  <span className="font-medium text-gray-900">{l.nome}</span>
                  <AsteriscoPadrao mostrar={l.padraoSistema} />
                <MarcaNovo registro={l} />
                  {(l.razaoSocial || l.documento) && (
                    <span className="block text-xs text-gray-500">{[l.razaoSocial, l.documento].filter(Boolean).join(" · ")}</span>
                  )}
                </span>
              </span>
            ),
          },
          {
            chave: "telefone",
            titulo: "Telefone",
            render: (l) =>
              l.telefone ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  {l.telefone}
                  {l.telefoneWhatsapp && <MessageCircle className="h-4 w-4 text-verde-vivo" aria-label="WhatsApp" />}
                </span>
              ) : (
                <span className="text-gray-400">- - -</span>
              ),
          },
          {
            chave: "cidade",
            titulo: "Cidade",
            render: (l) => (l.cidade ? [l.cidade, l.uf].filter(Boolean).join(" / ") : <span className="text-gray-400">- - -</span>),
          },
          { chave: "papel", titulo: "Tipo", render: (l) => <Papeis cliente={l.eCliente} fornecedor={l.eFornecedor} /> },
          {
            chave: "situacao",
            titulo: "Situação",
            alinhar: "centro",
            render: (l) => <ChaveSituacao ativo={l.ativo} ocupado={situacao.ocupadoId === l.id} aoMudar={() => situacao.alternar(l.id, l.ativo)} rotulo={l.nome} />,
          },
          {
            chave: "menu",
            titulo: <span className="sr-only">Opções</span>,
            alinhar: "direita",
            render: (l) => (
              <MenuLinha
                rotulo={l.nome}
                itens={[
                  { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(l) },
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
        largura="larga"
        titulo={form.novo ? "Novo Cliente e Fornecedor" : "Editando Cliente e Fornecedor"}
        resumo={[d.nome || (juridica ? "Nome Fantasia" : "Nome"), juridica ? "Pessoa Jurídica" : "Pessoa Física"].join(" · ")}
        aoSalvar={salvar}
      >
        <div role="tablist" className="-mt-1 flex gap-1 border-b border-borda">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                aba === a.id ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800",
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {aba === "informacoes" && (
          <div className="space-y-4">
            <div className="inline-flex rounded-md border border-borda p-0.5" role="radiogroup" aria-label="Pessoa">
              {(["fisica", "juridica"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={d.pessoa === p}
                  onClick={() => {
                    form.mudar("pessoa", p);
                    form.mudar("documento", "");
                  }}
                  className={cn("rounded px-3 py-1.5 text-sm font-medium", d.pessoa === p ? "bg-verde text-white" : "text-gray-600 hover:bg-gray-50")}
                >
                  {p === "fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
                </button>
              ))}
            </div>
            <CampoTexto
              rotulo={juridica ? "Nome Fantasia" : "Nome"}
              obrigatorio
              autoFocus
              maxLength={120}
              valor={d.nome}
              aoMudar={(v) => form.mudar("nome", v)}
            />
            <div className="flex flex-wrap gap-6">
              <Chave ligada={d.eCliente} aoMudar={(v) => form.mudar("eCliente", v)} rotulo="Cliente (você recebe dele)" />
              <Chave ligada={d.eFornecedor} aoMudar={(v) => form.mudar("eFornecedor", v)} rotulo="Fornecedor (você paga a ele)" />
            </div>
            <button type="button" onClick={() => setMaisInfo(!maisInfo)} className="text-sm font-medium text-verde hover:underline">
              {maisInfo ? "− Menos informações" : "+ Mais informações"}
            </button>
            {maisInfo && (
              <div className="grid gap-4 sm:grid-cols-2">
                {juridica && (
                  <CampoTexto rotulo="Razão Social" className="sm:col-span-2" maxLength={150} valor={d.razaoSocial} aoMudar={(v) => form.mudar("razaoSocial", v)} />
                )}
                <CampoTexto
                  rotulo={juridica ? "CNPJ" : "CPF"}
                  inputMode="numeric"
                  valor={d.documento}
                  aoMudar={(v) => form.mudar("documento", formatarDocumento(v).slice(0, juridica ? 18 : 14))}
                />
                <CampoTexto rotulo="E-mail" type="email" maxLength={150} valor={d.email} aoMudar={(v) => form.mudar("email", v)} />
                <div>
                  <CampoTexto rotulo="Telefone" inputMode="tel" valor={d.telefone} aoMudar={(v) => form.mudar("telefone", formatarTelefone(v))} />
                  <div className="mt-2">
                    <Chave ligada={d.telefoneWhatsapp} aoMudar={(v) => form.mudar("telefoneWhatsapp", v)} rotulo="É WhatsApp" />
                  </div>
                </div>
                {!juridica && (
                  <>
                    <CampoSelecao rotulo="Sexo" valor={d.sexo} aoMudar={(v) => form.mudar("sexo", v)} opcoes={SEXOS.map((s) => ({ ...s }))} />
                    <CampoTexto rotulo="Nascimento" type="date" valor={d.nascimento} aoMudar={(v) => form.mudar("nascimento", v)} />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {aba === "endereco" && (
          <div className="grid gap-4 sm:grid-cols-6">
            <CampoTexto rotulo="CEP" className="sm:col-span-2" inputMode="numeric" valor={d.cep} aoMudar={(v) => form.mudar("cep", formatarCep(v))} />
            <CampoTexto rotulo="Endereço" className="sm:col-span-4" maxLength={150} valor={d.logradouro} aoMudar={(v) => form.mudar("logradouro", v)} />
            <CampoTexto rotulo="Número" className="sm:col-span-2" maxLength={20} valor={d.numero} aoMudar={(v) => form.mudar("numero", v)} />
            <CampoTexto rotulo="Complemento" className="sm:col-span-4" maxLength={100} valor={d.complemento} aoMudar={(v) => form.mudar("complemento", v)} />
            <CampoTexto rotulo="Bairro" className="sm:col-span-2" maxLength={100} valor={d.bairro} aoMudar={(v) => form.mudar("bairro", v)} />
            <CampoTexto rotulo="Cidade" className="sm:col-span-3" maxLength={100} valor={d.cidade} aoMudar={(v) => form.mudar("cidade", v)} />
            <CampoSelecao
              rotulo="Estado"
              className="sm:col-span-1"
              valor={d.uf}
              aoMudar={(v) => form.mudar("uf", v)}
              opcoes={[{ valor: "", rotulo: "--" }, ...UFS.map((u) => ({ valor: u, rotulo: u }))]}
            />
          </div>
        )}

        {aba === "observacoes" && (
          <CampoAreaTexto rotulo="Observações" linhas={8} valor={d.observacoes} aoMudar={(v) => form.mudar("observacoes", v)} />
        )}
        <CampoAuxiliarFormulario cadastro="contatos" className="mt-4" valor={form.dados.campoAuxiliar ?? ""} aoMudar={(v) => form.mudar("campoAuxiliar", v)} />
      </ModalCadastro>
    </>
  );
}
