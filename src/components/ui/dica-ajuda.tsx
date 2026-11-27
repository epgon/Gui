"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Ícone "?" com texto de ajuda. Abre ao passar o mouse, ao focar pelo teclado
 * ou ao tocar/clicar; fecha com Esc, ao tocar fora ou ao sair. Usa posição fixa
 * para não ser cortado pela rolagem do modal.
 */
export function DicaAjuda({ texto, className = "" }: { texto: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [fixo, setFixo] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();

  function posicionar() {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const largura = Math.min(288, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left + r.width / 2 - largura / 2, window.innerWidth - largura - 8));
    setPos({ top: r.bottom + 6, left });
  }

  function mostrar() {
    posicionar();
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    setFixo(false);
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!botao.current?.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        fechar();
      }
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla, true);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla, true);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={botao}
        type="button"
        aria-label="Ajuda"
        aria-expanded={aberto}
        aria-describedby={aberto ? id : undefined}
        onMouseEnter={mostrar}
        onMouseLeave={() => !fixo && setAberto(false)}
        onFocus={mostrar}
        onBlur={() => !fixo && setAberto(false)}
        onClick={() => {
          if (aberto && fixo) fechar();
          else {
            mostrar();
            setFixo(true);
          }
        }}
        className="cursor-help rounded-full p-0.5 text-gray-400 outline-none hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-verde/40"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {aberto && (
        <span
          id={id}
          role="tooltip"
          style={{ top: pos.top, left: pos.left, width: Math.min(288, typeof window === "undefined" ? 288 : window.innerWidth - 16) }}
          className="fixed z-50 rounded-md bg-gray-800 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg"
        >
          {texto}
        </span>
      )}
    </span>
  );
}
