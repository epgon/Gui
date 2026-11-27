"use client";

import { CircleHelp, Funnel, Headset, Pin, PinOff, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CentralAjudaPainel } from "@/components/ajuda/central-ajuda-painel";
import { cn } from "@/lib/cn";

type Aba = "filtros" | "ajuda";

const CHAVE_FIXADO = "gui:painel-fixado";

/** Botão de ícone da barra do painel, com a dica escura que aparece acima ao passar o mouse. */
function BotaoBarra({ icone: Icone, rotulo, dica, ativo, desativado, aoClicar, alinhar = "right", alternavel = true, semFundo }: {
  icone: LucideIcon;
  rotulo: string;
  dica: string;
  ativo?: boolean;
  desativado?: boolean;
  aoClicar?: () => void;
  alinhar?: "left" | "right" | "lado";
  /** Botões que ligam e desligam (aria-pressed). */
  alternavel?: boolean;
  /** Marca o estado ligado só pela cor do ícone, sem o quadrado de destaque (o alfinete). */
  semFundo?: boolean;
}) {
  return (
    <span className="group relative">
      <button
        type="button"
        aria-label={rotulo}
        aria-pressed={alternavel ? !!ativo : undefined}
        disabled={desativado}
        onClick={aoClicar}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-verde",
          desativado
            ? "cursor-not-allowed text-gray-300"
            : ativo && !semFundo
              ? "bg-verde-claro text-verde ring-1 ring-verde/20"
              : ativo
                ? "text-verde hover:bg-white"
                : "text-gray-500 hover:bg-white hover:text-verde",
        )}
      >
        <Icone className="h-5 w-5" aria-hidden="true" />
      </button>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100",
          alinhar === "lado" ? "right-full top-1/2 mr-2 -translate-y-1/2" : alinhar === "right" ? "bottom-full right-0 mb-2" : "bottom-full left-0 mb-2",
        )}
      >
        {dica}
      </span>
    </span>
  );
}

/**
 * Painel da direita das telas: uma barra de ícones no rodapé troca o conteúdo entre "Filtros" e
 * "Central de Ajuda". O alfinete fixa o painel; solto, ele vira uma faixa estreita e abre por cima da tela.
 */
export function PainelLateral({ filtros, inicial }: { filtros?: React.ReactNode; inicial?: Aba }) {
  const [aba, setAba] = useState<Aba>(inicial ?? (filtros ? "filtros" : "ajuda"));
  const [fixado, setFixado] = useState(true);
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLElement>(null);

  // Lê, depois da hidratação, o que só o navegador sabe: se o painel está fixado e se o endereço pede um artigo.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE_FIXADO) === "0") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFixado(false);
      }
    } catch {
      // Sem armazenamento: fica fixado.
    }
    if (new URLSearchParams(window.location.search).has("ajuda")) setAba("ajuda");
  }, []);

  // Solto, o painel aberto fecha com Esc ou clicando fora dele.
  const sobreposto = !fixado && aberto;
  useEffect(() => {
    if (!sobreposto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [sobreposto]);

  const alternarFixado = () => {
    const novo = !fixado;
    setFixado(novo);
    setAberto(false);
    try {
      window.localStorage.setItem(CHAVE_FIXADO, novo ? "1" : "0");
    } catch {
      // Sem armazenamento: vale só enquanto a tela estiver aberta.
    }
  };

  const escolher = (a: Aba) => {
    if (fixado) return setAba(a);
    if (aberto && aba === a) return setAberto(false);
    setAba(a);
    setAberto(true);
  };

  const faixa = !fixado && !aberto;

  return (
    <aside ref={raiz} className={cn("hidden shrink-0 border-l border-borda-painel bg-painel xl:flex", !fixado && "w-12")} aria-label="Painel lateral">
      {/* O corpo é desenhado uma vez só; mudam apenas as classes entre fixado, faixa e aberto por cima. */}
      <div
        className={cn(
          "flex flex-col bg-painel",
          sobreposto ? "fixed right-0 bottom-0 top-14 z-30 w-80 border-l border-borda-painel shadow-xl" : "sticky top-14 h-[calc(100vh-3.5rem)]",
          fixado && "w-80",
          faixa && "w-12",
        )}
      >
        <div className={cn("flex-1 overflow-y-auto p-4", faixa && "hidden")}>
          {filtros && <div className={cn(aba !== "filtros" && "hidden")}>{filtros}</div>}
          <div className={cn(aba !== "ajuda" && "hidden")}>
            <CentralAjudaPainel />
          </div>
        </div>
        <div className={cn("flex border-borda-painel", faixa ? "flex-1 flex-col items-center gap-1 py-2" : "items-center border-t px-3 py-2")}>
          <BotaoBarra
            icone={fixado ? Pin : PinOff}
            rotulo={fixado ? "Desafixar painel" : "Fixar painel"}
            dica={fixado ? "Desafixar painel" : "Fixar painel"}
            ativo={fixado}
            semFundo
            aoClicar={alternarFixado}
            alinhar={faixa ? "lado" : "left"}
          />
          <div className={cn("flex gap-1", faixa ? "mt-auto flex-col" : "ml-auto")}>
            <BotaoBarra
              icone={Funnel}
              rotulo="Filtros"
              dica={filtros ? "Filtros" : "Esta tela não tem filtros"}
              ativo={aba === "filtros" && !faixa}
              desativado={!filtros}
              alinhar={faixa ? "lado" : "right"}
              aoClicar={() => escolher("filtros")}
            />
            <BotaoBarra icone={CircleHelp} rotulo="Central de Ajuda" dica="Central de Ajuda" alinhar={faixa ? "lado" : "right"} ativo={aba === "ajuda" && !faixa} aoClicar={() => escolher("ajuda")} />
            <BotaoBarra icone={Headset} rotulo="Atendimento (em breve)" dica="Atendimento (em breve)" desativado alternavel={false} alinhar={faixa ? "lado" : "right"} />
          </div>
        </div>
      </div>
    </aside>
  );
}
