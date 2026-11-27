"use client";

import { CornerDownRight, Plus, ReceiptText, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { lancamentosDaCategoria, type LancamentosCategoria } from "@/app/(sistema)/cadastros/categorias/detalhe-acoes";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { formatarData } from "@/lib/datas";

type Situacao = "todos" | "realizados" | "nao-realizados";
const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas as situações" },
  { valor: "realizados", rotulo: "Realizados" },
  { valor: "nao-realizados", rotulo: "Não realizados" },
];

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Janela "Lançamentos da Categoria": cabeçalho com a numeração e "Filha de ...",
 * busca, filtro de situação e a lista dos lançamentos até hoje (incluindo os das filhas).
 */
export function LancamentosDaCategoria({ id, aoFechar }: { id: number | null; aoFechar: () => void }) {
  const [dados, setDados] = useState<{ id: number; conteudo: LancamentosCategoria | null } | null>(null);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todos");

  useEffect(() => {
    if (id === null) return;
    let ativo = true;
    lancamentosDaCategoria(id).then((conteudo) => {
      if (!ativo) return;
      setDados({ id, conteudo });
      setBusca("");
      setSituacao("todos");
    });
    return () => {
      ativo = false;
    };
  }, [id]);

  const atual = dados && dados.id === id ? dados.conteudo : undefined;
  const carregando = id !== null && atual === undefined;
  const termo = semAcento(busca.trim());
  const itens = (atual?.itens ?? []).filter(
    (i) =>
      (situacao === "todos" || (situacao === "realizados") === i.pago) &&
      (!termo || semAcento(`${i.descricao} ${i.contaOuCartao}`).includes(termo)),
  );

  return (
    <Modal
      aberto={id !== null}
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        <span className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-verde" />
          Lançamentos da Categoria
        </span>
      }
      resumo={
        atual ? (
          <span className="mt-1 flex items-center gap-2">
            {atual.pai && <CornerDownRight className="h-4 w-4 text-gray-400" />}
            <span
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: atual.cor }}
              aria-hidden
            >
              {atual.numero || atual.nome.slice(0, 1)}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-gray-800">{atual.nome}</span>
              <span className="text-xs text-gray-500">
                {atual.pai ? `Filha de ${atual.pai}` : "Categoria principal"}
                {atual.quantidadeFilhas > 0 && " · inclui as filhas"}
              </span>
            </span>
          </span>
        ) : undefined
      }
      rodape={
        <>
          {atual && (
            <Link
              href={`/financeiro/lancamentos?categoria=${atual.id}`}
              className="mr-auto inline-flex h-9 items-center px-2 text-sm font-semibold text-verde hover:underline"
            >
              Ver em Lançamentos
            </Link>
          )}
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
        </>
      }
    >
      {carregando && <p className="py-10 text-center text-sm text-gray-500">Carregando...</p>}
      {id !== null && atual === null && <p className="py-10 text-center text-sm text-gray-500">Esta categoria não existe mais.</p>}
      {atual && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/financeiro/lancamentos"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-verde px-3 text-sm font-semibold text-white hover:bg-verde-escuro"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Link>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Pesquisar lançamento</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar"
                className="h-9 w-full rounded-md border border-borda bg-white pl-3 pr-9 text-sm focus:border-verde focus:outline-none"
              />
              <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            </label>
          </div>
          <div className="overflow-hidden rounded-lg border border-borda">
            <div className="flex items-center justify-between gap-2 border-b border-borda bg-subcabecalho px-3 py-2">
              <select
                aria-label="Situação"
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as Situacao)}
                className="rounded border-0 bg-transparent py-1 text-xs font-medium text-gray-600 focus:outline-none"
              >
                {SITUACOES.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
              <span className="text-sm font-semibold text-verde">Até hoje</span>
              <span className="text-xs text-gray-500">
                {itens.length} {itens.length === 1 ? "lançamento" : "lançamentos"}
              </span>
            </div>
            {itens.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-12 text-center">
                <SearchX className="mb-1 h-8 w-8 text-verde" />
                <p className="text-sm font-medium text-despesa">Nenhum Lançamento</p>
                <p className="text-xs text-gray-500">{termo || situacao !== "todos" ? "Nada encontrado com esses filtros." : "Não existem registros até o momento."}</p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {itens.map((u) => (
                      <tr key={u.id} className="border-b border-borda/70 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatarData(u.data)}</td>
                        <td className="py-2 pr-3">
                          {u.descricao}
                          <span className="block text-xs text-gray-500">{u.contaOuCartao}</span>
                        </td>
                        <td className="py-2 pr-3 text-xs">{u.pago ? <span className="text-pago-texto">Realizado</span> : <span className="text-gray-500">Não realizado</span>}</td>
                        <td className="px-3 py-2 text-right">
                          <Valor centavos={u.valorCentavos} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {atual.limitado && <p className="text-xs text-gray-500">Mostrando os 300 mais recentes. Use &quot;Ver em Lançamentos&quot; para ver todos.</p>}
        </div>
      )}
    </Modal>
  );
}
