"use client";

import { Copy, CornerDownRight, Eye, FolderTree, Lock, Pencil, Plus, Power, ReceiptText, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { AsteriscoPadrao } from "@/components/cadastros/asterisco";
import { BarraLista } from "@/components/cadastros/barra-lista";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { DetalhandoCategoria } from "@/components/categorias/detalhando-categoria";
import { LancamentosDaCategoria } from "@/components/categorias/lancamentos-categoria";
import { MenuLinha, type ItemMenuLinha } from "@/components/cadastros/menu-linha";
import { ModalCadastro, useFormularioCadastro } from "@/components/cadastros/modal-cadastro";
import { useSituacao } from "@/components/cadastros/use-situacao";
import { CampoSelecao, CampoTexto, Rotulo, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Tabela } from "@/components/ui/tabela";
import { useSistema } from "@/components/layout/provedor-sistema";
import { Botao } from "@/components/ui/botao";
import { OrganizarCategorias } from "./organizar";
import { CampoAuxiliarFormulario } from "@/components/listagem/campo-auxiliar";
import { comComuns, MarcaNovo } from "@/components/listagem/colunas-comuns";
import { useRotuloAuxiliar } from "@/components/listagem/configurar-listagem";
import { colunasVisiveis, type PreferenciaListagem } from "@/lib/listagem/telas";
import { type CategoriaNaArvore, NIVEL_MAXIMO, rotuloCategoria } from "@/lib/categorias";
import { cn } from "@/lib/cn";
import type { Situacao } from "@/lib/cadastros/filtros";
import { alterarSituacaoCategoria, excluirCategoria, salvarCategoria, type DadosCategoria } from "./acoes";

type Linha = CategoriaNaArvore & { altura: number; motivoNaoExcluir: string | null } & { campoAuxiliar: string | null; criadoEm: Date; atualizadoEm: Date };
type Aba = { id: number | null; nome: string; cor: string | null; total: number };

/** Cores sugeridas para as categorias principais. */
const PALETA = ["#16A34A", "#DC2626", "#7C3AED", "#0891B2", "#DB2777", "#F59E0B", "#4F46E5", "#0D9488", "#92400E", "#65A30D", "#1D6CE0", "#64748B", "#EA580C", "#9333EA", "#0F766E", "#BE123C"];
const VAZIO: DadosCategoria = { nome: "", categoriaPaiId: "", cor: "#64748B", natureza: "despesa", campoAuxiliar: "" };

function Bolinha({ cor }: { cor: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden />;
}

export function TelaCategorias({ preferencia, linhas, arvore, abas, aba, filtros, caminho }: {
  linhas: Linha[];
  preferencia: PreferenciaListagem;
  arvore: Linha[];
  abas: Aba[];
  aba: number | null;
  filtros: { busca: string; situacao: Situacao };
  caminho: string;
}) {
  const rotuloAux = useRotuloAuxiliar("categorias");
  // Parâmetros Gerais > Categorias: Exibir Cores e Exibir Numeração.
  const { exibirCores, exibirNumeracao } = useSistema().parametros;
  const [organizando, setOrganizando] = useState(false);
  const form = useFormularioCadastro(VAZIO);
  const situacao = useSituacao(alterarSituacaoCategoria);
  const [detalhar, setDetalhar] = useState<number | null>(null);
  const [verLancamentos, setVerLancamentos] = useState<number | null>(null);
  /** Categoria de origem quando a janela está em "Clonando Categoria". */
  const [clonando, setClonando] = useState<Linha | null>(null);
  const [excluindo, setExcluindo] = useState<Linha | null>(null);
  const [ocupadoExcluir, iniciarExclusao] = useTransition();
  const confirmarExclusao = (l: Linha) =>
    iniciarExclusao(async () => {
      situacao.setAviso("");
      try {
        const r = await excluirCategoria(l.id);
        if (!r.ok) situacao.setAviso(r.erro);
      } catch {
        situacao.setAviso("Não foi possível excluir a categoria agora. Tente de novo.");
      } finally {
        setExcluindo(null);
      }
    });
  const parametros = { aba: aba ? String(aba) : "", busca: filtros.busca, situacao: filtros.situacao === "todos" ? "" : filtros.situacao };
  const linkAba = (id: number | null) => {
    const sp = new URLSearchParams(Object.entries({ ...parametros, aba: id ? String(id) : "" }).filter(([, v]) => v));
    return sp.size ? `${caminho}?${sp}` : caminho;
  };

  const pai = arvore.find((c) => String(c.id) === form.dados.categoriaPaiId);
  const editando = arvore.find((c) => c.id === form.editandoId);
  const proximoNumero = (() => {
    if (editando && String(editando.categoriaPaiId ?? "") === form.dados.categoriaPaiId) return editando.numero;
    const irmas = arvore.filter((c) => !c.especial && String(c.categoriaPaiId ?? "") === form.dados.categoriaPaiId);
    return `${pai?.numero ?? ""}${irmas.length + 1}.`;
  })();

  // Pode ser pai: não especial, até o nível 2, e sem passar de 3 níveis com as filhas de quem está sendo editada.
  const proibidas = new Set<number>();
  if (editando) {
    proibidas.add(editando.id);
    for (const c of arvore) if (c.ancestrais.includes(editando.id)) proibidas.add(c.id);
  }
  const opcoesPai = [
    { valor: "", rotulo: "Nenhuma (categoria principal)" },
    ...arvore
      .filter((c) => !c.especial && !proibidas.has(c.id) && c.nivel + 1 + (editando?.altura ?? 0) <= NIVEL_MAXIMO)
      .filter((c) => c.ativo || String(c.id) === form.dados.categoriaPaiId)
      .map((c) => ({ valor: String(c.id), rotulo: `${"   ".repeat(c.nivel - 1)}${rotuloCategoria(c)}` })),
  ];

  const abrirNovo = (paiId?: number) => {
    const pai = paiId ?? aba;
    // Para uma categoria principal nova, sugere uma cor que ainda não está em uso.
    const usadas = new Set(arvore.filter((c) => c.nivel === 1).map((c) => c.corEfetiva.toUpperCase()));
    const cor = PALETA.find((c) => !usadas.has(c)) ?? VAZIO.cor;
    setClonando(null);
    form.abrirNovo(pai ? { categoriaPaiId: String(pai), cor } : { cor });
  };
  const editar = (l: Linha) => {
    setClonando(null);
    form.abrirEdicao(l.id, { nome: l.nome, categoriaPaiId: l.categoriaPaiId ? String(l.categoriaPaiId) : "", cor: l.cor ?? l.corEfetiva, natureza: l.natureza, campoAuxiliar: l.campoAuxiliar ?? "" });
  };
  /**
   * Clonar: abre uma categoria nova já preenchida com os dados desta, no mesmo nível.
   * Clonar uma principal cria outra principal (mesmo tipo e cor); clonar uma filha cria uma irmã.
   */
  const clonar = (l: Linha) => {
    setClonando(l);
    form.abrirNovo({
      nome: l.nome,
      categoriaPaiId: l.categoriaPaiId ? String(l.categoriaPaiId) : "",
      cor: l.cor ?? l.corEfetiva,
      natureza: l.natureza,
      campoAuxiliar: l.campoAuxiliar ?? "",
    });
  };
  const situacaoVisivel = preferencia.colunas.includes("situacao");
  const itensMenu = (l: Linha): ItemMenuLinha[] => {
    const lancamentos = { rotulo: "Lançamentos", icone: <ReceiptText className="h-4 w-4" />, aoClicar: () => setVerLancamentos(l.id) };
    // As especiais (Acerto de Saldo, Cartão de Crédito e Transferência) são do sistema: só dá para ver os lançamentos.
    if (l.especial) return [lancamentos];
    const podeTerFilho = l.nivel < NIVEL_MAXIMO && l.ativo;
    const paiInativo = l.categoriaPaiId !== null && !arvore.find((c) => c.id === l.categoriaPaiId)?.ativo;
    return [
      { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => editar(l) },
      {
        rotulo: "Clonar",
        icone: <Copy className="h-4 w-4" />,
        aoClicar: () => clonar(l),
        desabilitado: paiInativo,
        dica: paiInativo ? "A categoria pai está inativa. Ative-a para clonar." : undefined,
      },
      {
        rotulo: "Adicionar Filho",
        icone: <Plus className="h-4 w-4" />,
        aoClicar: () => abrirNovo(l.id),
        separar: true,
        desabilitado: !podeTerFilho,
        dica: podeTerFilho ? undefined : l.ativo ? `As categorias vão até ${NIVEL_MAXIMO} níveis.` : "Ative a categoria antes de adicionar filhos.",
      },
      { rotulo: "Detalhar", icone: <Eye className="h-4 w-4" />, aoClicar: () => setDetalhar(l.id) },
      lancamentos,
      // Sem a coluna Situação na tela, o Ativar/Inativar fica no menu.
      ...(situacaoVisivel
        ? []
        : [{ rotulo: (l.ativo ? "Inativar" : "Ativar") + (l.quantidadeFilhas ? " (com as filhas)" : ""), icone: <Power className="h-4 w-4" />, aoClicar: () => situacao.alternar(l.id, l.ativo) }]),
      {
        rotulo: "Excluir",
        icone: <Trash2 className="h-4 w-4" />,
        aoClicar: () => setExcluindo(l),
        separar: true,
        perigo: true,
        desabilitado: !!l.motivoNaoExcluir,
        dica: l.motivoNaoExcluir ?? undefined,
      },
    ];
  };

  const corResumo = pai ? pai.corEfetiva : form.dados.cor;
  const naturezaEfetiva = pai ? (arvore.find((c) => c.id === pai.raizId)?.natureza ?? form.dados.natureza) : form.dados.natureza;

  return (
    <>
      <nav className="flex flex-wrap gap-1" aria-label="Categorias principais">
        {abas.map((a) => (
          <Link
            key={a.id ?? "todas"}
            href={linkAba(a.id)}
            aria-current={aba === a.id ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm",
              aba === a.id ? "border-verde bg-verde font-semibold text-white" : "border-borda bg-white text-gray-700 hover:border-verde hover:text-verde",
            )}
          >
            {a.cor && exibirCores && aba !== a.id && <Bolinha cor={a.cor} />}
            {a.nome}
            <span className={cn("text-xs italic", aba === a.id ? "text-white/80" : "text-gray-500")}>{a.total}</span>
          </Link>
        ))}
      </nav>
      <BarraLista
        tela="categorias"
        preferencia={preferencia}
        aoAdicionar={() => abrirNovo()}
        caminho={caminho}
        busca={filtros.busca}
        parametros={parametros}
        rotuloBusca="Buscar categoria"
        extra={
          <Botao variante="secundario" icone={<FolderTree className="h-4 w-4" />} onClick={() => setOrganizando(true)}>
            Organizar
          </Botao>
        }
      />
      {organizando && <OrganizarCategorias arvore={arvore} aoFechar={() => setOrganizando(false)} />}
      <FaixaErro>{situacao.aviso && <TextoComDestaque texto={situacao.aviso} />}</FaixaErro>
      <Tabela
        linhas={linhas}
        chaveLinha={(l) => l.id}
        vazio="Nenhuma categoria encontrada com esses filtros."
        compacta={preferencia.compactar}
        destacarPares={preferencia.destacarPares}
        colunas={colunasVisiveis("categorias", comComuns<Linha>([
          { chave: "cor", titulo: <span className="sr-only">Cor</span>, render: (l) => <Bolinha cor={l.corEfetiva} /> },
          {
            chave: "numero",
            titulo: "Numeração",
            render: (l) => <span className="font-mono text-xs text-gray-600 tabular-nums">{l.numero || "—"}</span>,
          },
          {
            chave: "categoria",
            titulo: "Categoria",
            render: (l) => (
              <span
                className={cn("flex items-center gap-1.5", !l.ativo && "text-gray-400", l.nivel === 1 && !l.especial && "font-semibold")}
                style={{ paddingLeft: filtros.busca ? 0 : (l.nivel - 1) * 24 }}
              >
                {l.nivel > 1 && <CornerDownRight className="h-3.5 w-3.5 text-gray-400" />}
                {l.nome}
                <AsteriscoPadrao mostrar={l.padraoSistema} />
                <MarcaNovo registro={l} />
                {l.especial && (
                  <span title="Categoria especial, usada pelo sistema" className="text-gray-400">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            ),
          },
          {
            chave: "tipo",
            titulo: "Tipo",
            render: (l) =>
              l.especial ? (
                <span className="text-gray-400">Especial</span>
              ) : (
                <span className={l.natureza === "receita" ? "text-receita" : "text-despesa"}>{l.natureza === "receita" ? "Receita" : "Despesa"}</span>
              ),
          },
          {
            chave: "situacao",
            titulo: "Situação",
            alinhar: "centro",
            render: (l) => (
              <ChaveSituacao
                ativo={l.ativo}
                ocupado={situacao.ocupadoId === l.id}
                bloqueado={l.especial ? "Categoria especial: usada pelo sistema, fica sempre ativa." : undefined}
                aoMudar={() => situacao.alternar(l.id, l.ativo)}
                rotulo={`a categoria ${l.nome}`}
              />
            ),
          },
          {
            chave: "menu",
            titulo: <span className="sr-only">Opções</span>,
            alinhar: "direita",
            render: (l) => <MenuLinha rotulo={l.nome} itens={itensMenu(l)} />,
          },
        ], rotuloAux), preferencia).filter((c) => (c.chave !== "cor" || exibirCores) && (c.chave !== "numero" || exibirNumeracao))}
      />
      <p className="text-xs text-gray-500">
        {linhas.length} {linhas.length === 1 ? "categoria" : "categorias"}. A numeração é automática: segue a ordem em que as categorias foram criadas dentro de cada nível.
      </p>

      <ModalCadastro
        formulario={form}
        titulo={clonando ? "Clonando Categoria" : form.novo ? (pai ? "Nova Categoria Filha" : "Nova Categoria") : "Editando Categoria"}
        resumo={
          <span className="flex items-center gap-2">
            <Bolinha cor={corResumo} />
            {proximoNumero} {form.dados.nome || "Nome"} · {naturezaEfetiva === "receita" ? "Receita" : "Despesa"}
          </span>
        }
        aoSalvar={() => form.salvar(salvarCategoria, (d) => ({ categoriaPaiId: d.categoriaPaiId, natureza: d.natureza, cor: d.cor }))}
      >
        <CampoSelecao
          rotulo="Categoria Pai"
          ajuda="Deixe em 'Nenhuma' para criar uma categoria principal. Para uma subcategoria (ex.: 2.5. Lanchonete), escolha a categoria de cima."
          valor={form.dados.categoriaPaiId}
          aoMudar={(v) => form.mudar("categoriaPaiId", v)}
          opcoes={opcoesPai}
        />
        <CampoTexto rotulo="Nome" obrigatorio autoFocus maxLength={60} valor={form.dados.nome} aoMudar={(v) => form.mudar("nome", v)} />
        {pai ? (
          <p className="flex items-center gap-2 rounded-md bg-subcabecalho px-3 py-2 text-sm text-gray-600">
            <Bolinha cor={pai.corEfetiva} />
            Fica dentro de <strong>{rotuloCategoria(pai)}</strong> e usa a mesma cor e o mesmo tipo ({naturezaEfetiva === "receita" ? "Receita" : "Despesa"}).
          </p>
        ) : (
          <>
            <div>
              <Rotulo texto="Tipo" ajuda="Receita para dinheiro que entra (salário, aluguel recebido). Despesa para dinheiro que sai." />
              <div className="inline-flex rounded-md border border-borda p-0.5" role="radiogroup" aria-label="Tipo">
                {(["despesa", "receita"] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.dados.natureza === n}
                    onClick={() => form.mudar("natureza", n)}
                    className={cn(
                      "rounded px-3 py-1.5 text-sm font-medium",
                      form.dados.natureza === n ? (n === "receita" ? "bg-receita text-white" : "bg-despesa text-white") : "text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    {n === "receita" ? "Receita" : "Despesa"}
                  </button>
                ))}
              </div>
            </div>
            <div className={exibirCores ? "" : "hidden"}>
              <Rotulo texto="Cor" ajuda="A cor da categoria principal. As subcategorias usam a mesma cor." />
              <div className="flex flex-wrap items-center gap-2">
                {PALETA.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    aria-label={`Cor ${cor}`}
                    aria-pressed={form.dados.cor.toUpperCase() === cor}
                    onClick={() => form.mudar("cor", cor)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition",
                      form.dados.cor.toUpperCase() === cor ? "border-gray-900 scale-110" : "border-white shadow",
                    )}
                    style={{ backgroundColor: cor }}
                  />
                ))}
                <label className="ml-1 flex items-center gap-1 text-xs text-gray-500">
                  Outra:
                  <input type="color" value={form.dados.cor} onChange={(e) => form.mudar("cor", e.target.value.toUpperCase())} className="h-7 w-9 cursor-pointer" />
                </label>
              </div>
            </div>
          </>
        )}
        <CampoAuxiliarFormulario cadastro="categorias" className="mt-4" valor={form.dados.campoAuxiliar ?? ""} aoMudar={(v) => form.mudar("campoAuxiliar", v)} />
      </ModalCadastro>
      <DetalhandoCategoria id={detalhar} aoFechar={() => setDetalhar(null)} />
      <LancamentosDaCategoria id={verLancamentos} aoFechar={() => setVerLancamentos(null)} />
      <Modal
        aberto={!!excluindo}
        aoFechar={() => !ocupadoExcluir && setExcluindo(null)}
        titulo="Excluir Categoria"
        resumo={excluindo ? rotuloCategoria(excluindo) : undefined}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setExcluindo(null)} disabled={ocupadoExcluir}>
              Voltar
            </Botao>
            <Botao variante="perigo" carregando={ocupadoExcluir} icone={<Trash2 className="h-4 w-4" />} onClick={() => excluindo && confirmarExclusao(excluindo)}>
              Excluir
            </Botao>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          A categoria <strong>{excluindo?.nome}</strong> será excluída de vez. Ela não tem lançamentos nem subcategorias. Se ela estiver em algum orçamento, sai dele também. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}
