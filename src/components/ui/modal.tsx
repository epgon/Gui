"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Janela de cadastro: cabeçalho com título e resumo, conteúdo e rodapé
 * com os botões (Salvar / Voltar / "Salvar e Adicionar Novo").
 */
export function Modal({ aberto, aoFechar, titulo, resumo, rodape, children }: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: React.ReactNode;
  resumo?: React.ReactNode;
  rodape?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => e.target === ref.current && aoFechar()}
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-xl border border-borda bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <header className="flex items-start justify-between gap-4 border-b border-borda px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
          {resumo && <p className="mt-0.5 text-sm text-gray-500">{resumo}</p>}
        </div>
        <button type="button" onClick={aoFechar} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="px-5 py-4">{children}</div>
      {rodape && <footer className="flex flex-wrap justify-end gap-2 border-t border-borda bg-subcabecalho px-5 py-3">{rodape}</footer>}
    </dialog>
  );
}
