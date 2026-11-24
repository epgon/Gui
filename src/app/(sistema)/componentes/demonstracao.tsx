"use client";

import { Plus, Save } from "lucide-react";
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Tabela } from "@/components/ui/tabela";
import { Valor } from "@/components/ui/valor";

const EXEMPLO = [
  { id: 1, descricao: "Salário", categoria: "1.2. Salário", centavos: 520000, pago: true },
  { id: 2, descricao: "Aluguel", categoria: "3.1. Aluguel", centavos: -180000, pago: true },
  { id: 3, descricao: "Supermercado", categoria: "2.2. Supermercado", centavos: -43537, pago: false },
];

export function Demonstracao() {
  const [modal, setModal] = useState(false);
  const [pago, setPago] = useState(true);
  const [erro, setErro] = useState("");

  return (
    <div className="space-y-5">
      <Cartao titulo="Botões">
        <div className="flex flex-wrap gap-2">
          <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>Adicionar</Botao>
          <Botao variante="secundario">Voltar</Botao>
          <Botao variante="novo" icone={<Plus className="h-4 w-4" />}>Novo Detalhe</Botao>
          <Botao variante="perigo">Excluir</Botao>
          <Botao carregando>Salvando</Botao>
        </div>
      </Cartao>

      <Cartao titulo="Tabela, valores e faixas de saldo">
        <div className="space-y-2">
          <div className="flex justify-between rounded-md bg-creme px-4 py-2 text-sm font-medium">
            <span>Saldo Anterior</span>
            <Valor centavos={100000} />
          </div>
          <Tabela
            linhas={EXEMPLO}
            chaveLinha={(l) => l.id}
            colunas={[
              { chave: "d", titulo: "Descrição", render: (l) => l.descricao },
              { chave: "c", titulo: "Categoria", render: (l) => l.categoria },
              {
                chave: "s",
                titulo: "Situação",
                render: (l) =>
                  l.pago ? (
                    <span className="rounded-full bg-pago-fundo px-2 py-0.5 text-xs font-semibold text-pago-texto">Pago</span>
                  ) : (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-despesa">A Vencer</span>
                  ),
              },
              { chave: "v", titulo: "Valor", alinhar: "direita", render: (l) => <Valor centavos={l.centavos} /> },
            ]}
          />
          <div className="flex justify-between rounded-md bg-creme px-4 py-2 text-sm font-medium">
            <span>Saldo Atual</span>
            <Valor centavos={396463} className="text-lg" />
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Chave e faixa de erro">
        <div className="space-y-3">
          <Chave ligada={pago} aoMudar={setPago} rotulo="Pago" />
          <FaixaErro>
            Preencha o campo <strong>Valor</strong>.
          </FaixaErro>
        </div>
      </Cartao>

      <Modal
        aberto={modal}
        aoFechar={() => { setModal(false); setErro(""); }}
        titulo="Nova Conta Financeira"
        resumo="Descrição · Tipo"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setModal(false)}>Voltar</Botao>
            <Botao icone={<Save className="h-4 w-4" />} onClick={() => setErro("Preencha o campo Descrição.")}>Salvar</Botao>
          </>
        }
      >
        <div className="space-y-3">
          <FaixaErro>{erro}</FaixaErro>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Descrição <span className="text-despesa">*</span></span>
            <input className="h-10 w-full rounded-md border border-borda px-3 outline-none focus:border-verde" />
          </label>
          <p className="text-xs text-gray-500">Exemplo de janela de cadastro. Os cadastros de verdade chegam na Fase 1.</p>
        </div>
      </Modal>
    </div>
  );
}
