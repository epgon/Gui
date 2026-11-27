"use client";

import { EllipsisVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ItemComum = {
  rotulo: string;
  icone?: React.ReactNode;
  aoClicar: () => void;
  desabilitado?: boolean;
  /** Por que está desabilitado (aparece embaixo do item). */ dica?: string;
};
/** Linha divisória entre grupos de itens. */
export type SeparadorMenu = { separador: true };
export type ItemMenuLinha = ItemComum | SeparadorMenu;

/** Menu de três pontos de cada linha da lista (Editar, Inativar...). */
export function MenuLinha({
  itens,
  rotulo,
}: {
  itens: ItemMenuLinha[];
  rotulo: string;
}) {
  const [posicao, setPosicao] = useState<{ top: number; right: number } | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!posicao) return;
    const fechar = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node))
        return;
      setPosicao(null);
    };
    const rolar = () => setPosicao(null);
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", fechar);
    window.addEventListener("scroll", rolar, true);
    window.addEventListener("resize", rolar);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", fechar);
      window.removeEventListener("scroll", rolar, true);
      window.removeEventListener("resize", rolar);
    };
  }, [posicao]);

  return (
    <div ref={ref} className="inline-block">
      <button
        type="button"
        aria-label={`Opções de ${rotulo}`}
        aria-expanded={!!posicao}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPosicao(
            posicao
              ? null
              : { top: r.bottom + 4, right: window.innerWidth - r.right },
          );
        }}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <EllipsisVertical className="h-4 w-4" />
      </button>
      {posicao && (
        <ul
          role="menu"
          style={{ top: posicao.top, right: posicao.right }}
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-borda bg-white py-1 text-left text-[13px] shadow-lg"
        >
          {itens.map((item, i) =>
            "separador" in item ? (
              <li
                key={`sep${i}`}
                role="separator"
                className="my-1 border-t border-borda"
              />
            ) : (
              <li key={item.rotulo} title={item.dica}>
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.desabilitado}
                  onClick={() => {
                    setPosicao(null);
                    item.aoClicar();
                  }}
                  className="flex w-full items-center gap-3 whitespace-nowrap px-4 py-2 text-left text-gray-700 hover:bg-verde-claro disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  {item.icone && <span className="text-verde">{item.icone}</span>}
                  {item.dica ? (
                    <span className="flex flex-col text-left">
                      {item.rotulo}
                      <span className="max-w-56 text-xs text-gray-500">
                        {item.dica}
                      </span>
                    </span>
                  ) : (
                    item.rotulo
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
