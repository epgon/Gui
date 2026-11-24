"use client";

import { Ban, FileText, Pencil, Play, Plus, Power, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AsteriscoPadrao } from "@/components/cadastros/asterisco";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Botao } from "@/components/ui/botao";
import { TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Tabela } from "@/components/ui/tabela";
import { cn } from "@/lib/cn";
import type { ImportacaoLista, RegraLista } from "@/lib/importacao/consultas";
import { CAMPOS_CONDICAO, OPERADORES } from "@/lib/importacao/regras";
import type { DadosRegra } from "@/lib/importacao/tipos";
import type { Opcoes } from "@/lib/lancamentos/tipos";
import { alterarSituacaoRegra, excluirImportacao } from "./acoes";
import { ModalRegra, novaRegra, REGRA_VAZIA } from "./modal-regra";

const dataHora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

const SITUACAO = {
  rascunho: { rotulo: "Rascunho", estilo: "bg-amber-100 text-amber-800" },
  concluida: { rotulo: "Concluída", estilo: "bg-pago-fundo text-pago-texto" },
  cancelada: { rotulo: "Cancelada", estilo: "bg-gray-100 text-gray-500" },
};

/** Texto curto da regra: "Descrição contém supermercado → Categoria". */
export function resumoRegra(r: Pick<RegraLista, "condicoes" | "acao" | "preencher">, opcoes: Opcoes) {
  const condicoes = r.condicoes
    .map((c) => `${CAMPOS_CONDICAO.find((x) => x.valor === c.campo)?.rotulo ?? c.campo} ${(OPERADORES.find((o) => o.valor === c.operador)?.rotulo ?? c.operador).toLowerCase()} "${c.campo === "tipo" ? (c.valor === "receita" ? "Receita" : "Despesa") : c.valor}"`)
    .join(" e ");
  if (r.acao === "ignorar") return { condicoes, acao: "Ignorar registro" };
  const p = r.preencher;
  const partes = [
    p.descricao && `Descrição "${p.descricao}"`,
    p.categoriaId && `Categoria ${opcoes.categorias.find((c) => c.id === p.categoriaId)?.rotulo ?? ""}`,
    p.contatoId && `Contato ${opcoes.contatos.find((c) => c.id === p.contatoId)?.rotulo ?? ""}`,
    p.formaPagamentoId && `Forma ${opcoes.formas.find((c) => c.id === p.formaPagamentoId)?.rotulo ?? ""}`,
    p.tagIds?.length && `Tags ${p.tagIds.map((t) => opcoes.tags.find((x) => x.id === t)?.rotulo).filter(Boolean).join(", ")}`,
  ].filter(Boolean);
  return { condicoes, acao: `Preencher: ${partes.join(", ")}` };
}

export const dadosDaRegra = (r: RegraLista): DadosRegra => ({
  nome: r.nome,
  destino: r.destino,
  condicoes: r.condicoes,
  acao: r.acao,
  descricao: r.preencher.descricao ?? "",
  categoriaId: r.preencher.categoriaId ? String(r.preencher.categoriaId) : "",
  contatoId: r.preencher.contatoId ? String(r.preencher.contatoId) : "",
  formaPagamentoId: r.preencher.formaPagamentoId ? String(r.preencher.formaPagamentoId) : "",
  tagIds: r.preencher.tagIds ?? [],
  ordem: String(r.ordem),
});

export function TelaImportacoes({ aba, importacoes, regras, opcoes }: { aba: "importacoes" | "regras"; importacoes: ImportacaoLista[]; regras: RegraLista[]; opcoes: Opcoes }) {
  const router = useRouter();
  const [aviso, setAviso] = useState("");
  const [ocupado, iniciar] = useTransition();
  const [excluindo, setExcluindo] = useState<ImportacaoLista | null>(null);
  const [regra, setRegra] = useState<{ id: number | null; dados: DadosRegra } | null>(null);

  const executar = (acao: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) =>
    iniciar(async () => {
      setAviso("");
      try {
        const r = await acao();
        if (!r.ok) setAviso(r.erro ?? "Não foi possível concluir agora.");
        else depois?.();
      } catch {
        setAviso("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/financeiro/importacoes/nova" className="inline-flex h-9 items-center gap-2 rounded-md bg-verde px-4 text-sm font-semibold text-white hover:bg-verde-escuro">
          <Plus className="h-4 w-4" /> Nova Importação
        </Link>
        <Botao variante="secundario" icone={<Wand2 className="h-4 w-4" />} onClick={() => setRegra({ id: null, dados: novaRegra() })}>
          Nova Regra
        </Botao>
      </div>

      <div className="flex gap-1 border-b border-borda" role="tablist">
        {(
          [
            ["importacoes", `Importações (${importacoes.length})`, "/financeiro/importacoes"],
            ["regras", `Regras (${regras.length})`, "/financeiro/importacoes?aba=regras"],
          ] as const
        ).map(([valor, rotulo, href]) => (
          <Link key={valor} href={href} role="tab" aria-selected={aba === valor} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", aba === valor ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}>
            {rotulo}
          </Link>
        ))}
      </div>

      <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>

      {aba === "importacoes" ? (
        <Tabela
          linhas={importacoes}
          chaveLinha={(i) => i.id}
          vazio={
            <span>
              Nenhuma importação ainda. Clique em <strong>Nova Importação</strong> e envie o extrato OFX ou CSV do seu banco.
            </span>
          }
          colunas={[
            {
              chave: "arquivo",
              titulo: "Arquivo",
              render: (i) => (
                <Link href={`/financeiro/importacoes/${i.id}`} className="flex items-center gap-2 whitespace-nowrap font-medium text-gray-800 hover:text-verde">
                  <FileText className="h-4 w-4 shrink-0 text-verde" />
                  <span>{i.arquivoNome}</span>
                  <span className="rounded bg-gray-100 px-1.5 text-[10px] font-bold uppercase text-gray-500">{i.formato}</span>
                </Link>
              ),
            },
            {
              chave: "destino",
              titulo: "Conta ou Cartão",
              render: (i) =>
                i.destino ? (
                  <span className="flex items-center gap-2">
                    <IconeBanco codigo={i.bancoCodigo} nome={i.bancoNome ?? "Outro"} className="h-6 w-6 text-[9px]" />
                    {i.destino}
                  </span>
                ) : (
                  <span className="text-gray-400">A escolher</span>
                ),
            },
            { chave: "quando", titulo: "Enviado em", render: (i) => <span className="text-gray-600">{dataHora(i.criadoEm)}</span> },
            {
              chave: "linhas",
              titulo: "Linhas",
              render: (i) => {
                const t = i.totais;
                const total = Object.values(t).reduce((s, n) => s + n, 0);
                if (!total) return <span className="text-gray-400">—</span>;
                return (
                  <span className="text-xs text-gray-600">
                    {total} no arquivo · <span className="text-pago-texto">{(t.adicionado ?? 0) + (t.conciliado ?? 0)} lançadas</span> · {t.ignorado ?? 0} ignoradas
                  </span>
                );
              },
            },
            {
              chave: "situacao",
              titulo: "Situação",
              alinhar: "centro",
              render: (i) => <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", SITUACAO[i.situacao].estilo)}>{SITUACAO[i.situacao].rotulo}</span>,
            },
            {
              chave: "menu",
              titulo: <span className="sr-only">Opções</span>,
              alinhar: "direita",
              render: (i) => (
                <MenuLinha
                  rotulo={i.arquivoNome}
                  itens={[
                    { rotulo: i.situacao === "rascunho" ? "Continuar" : "Ver", icone: <Play className="h-4 w-4" />, aoClicar: () => router.push(`/financeiro/importacoes/${i.id}`) },
                    ...(i.situacao === "rascunho" ? [{ rotulo: "Excluir rascunho", icone: <Trash2 className="h-4 w-4" />, aoClicar: () => setExcluindo(i) }] : []),
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <>
          <p className="text-sm text-gray-600">
            As regras rodam em cada arquivo importado, na ordem da lista: a primeira que atender à linha vale. Elas preenchem a categoria (e outros campos) ou ignoram registros, como o pagamento
            da fatura do cartão.
          </p>
          <Tabela
            linhas={regras}
            chaveLinha={(r) => r.id}
            vazio="Nenhuma regra cadastrada."
            colunas={[
              { chave: "ordem", titulo: "Ordem", alinhar: "centro", render: (r) => <span className="text-gray-500">{r.ordem}</span> },
              {
                chave: "nome",
                titulo: "Regra",
                render: (r) => {
                  const resumo = resumoRegra(r, opcoes);
                  return (
                    <div className={r.ativo ? "" : "text-gray-400"}>
                      <p className="font-medium">
                        {r.acao === "ignorar" ? <Ban className="mr-1.5 inline h-4 w-4 text-gray-400" /> : <Wand2 className="mr-1.5 inline h-4 w-4 text-verde" />}
                        {r.nome}
                        <AsteriscoPadrao mostrar={r.padraoSistema} />
                      </p>
                      <p className="text-xs text-gray-500">
                        Quando {resumo.condicoes} → {resumo.acao}
                      </p>
                    </div>
                  );
                },
              },
              { chave: "destino", titulo: "Vale para", render: (r) => r.destinoNome ?? <span className="text-gray-500">Todas as contas e cartões</span> },
              {
                chave: "situacao",
                titulo: "Situação",
                alinhar: "centro",
                render: (r) => <ChaveSituacao ativo={r.ativo} ocupado={ocupado} aoMudar={() => executar(() => alterarSituacaoRegra(r.id))} rotulo={`a regra ${r.nome}`} />,
              },
              {
                chave: "menu",
                titulo: <span className="sr-only">Opções</span>,
                alinhar: "direita",
                render: (r) => (
                  <MenuLinha
                    rotulo={r.nome}
                    itens={[
                      { rotulo: "Editar", icone: <Pencil className="h-4 w-4" />, aoClicar: () => setRegra({ id: r.id, dados: dadosDaRegra(r) }) },
                      { rotulo: r.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => executar(() => alterarSituacaoRegra(r.id)) },
                    ]}
                  />
                ),
              },
            ]}
          />
        </>
      )}

      <ModalRegra aberto={!!regra} aoFechar={() => setRegra(null)} regraId={regra?.id ?? null} inicial={regra?.dados ?? REGRA_VAZIA} opcoes={opcoes} aoSalvar={() => aba !== "regras" && router.push("/financeiro/importacoes?aba=regras")} />

      <Modal
        aberto={!!excluindo}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir rascunho"
        resumo={excluindo?.arquivoNome}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setExcluindo(null)}>
              Voltar
            </Botao>
            <Botao variante="perigo" carregando={ocupado} icone={<Trash2 className="h-4 w-4" />} onClick={() => excluindo && executar(() => excluirImportacao(excluindo.id), () => setExcluindo(null))}>
              Excluir
            </Botao>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          A importação será excluída. O que ela já tinha <strong>adicionado</strong> será apagado dos lançamentos e o que tinha <strong>conciliado</strong> volta a ficar como estava antes.
        </p>
      </Modal>
    </>
  );
}
