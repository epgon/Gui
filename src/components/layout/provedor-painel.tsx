"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PainelConfiguracao } from "@/components/listagem/painel-configuracao";
import type { PreferenciaListagem } from "@/lib/listagem/telas";

export type ConfiguracaoAberta = { tela: string; pref: PreferenciaListagem };

type Painel = {
  /** Configurações da Listagem abertas no painel da direita (null = painel normal). */
  configuracao: ConfiguracaoAberta | null;
  abrirConfiguracao: (tela: string, pref: PreferenciaListagem) => void;
  fecharConfiguracao: () => void;
  /** Pede ao painel da direita que mostre os Filtros (botão de funil da barra de ferramentas). */
  abrirFiltros: () => void;
  /** Quantas vezes os Filtros foram pedidos (o painel reage a cada mudança). */
  pedidosDeFiltros: number;
  /** Os painéis laterais da tela avisam que estão montados (sem eles, a configuração vira gaveta em qualquer largura). */
  registrarPainel: () => () => void;
  /** Tela larga o bastante para o painel fixo da direita (xl). */
  larga: boolean;
};

const Contexto = createContext<Painel | null>(null);

const CONSULTA_LARGA = "(min-width: 1280px)";
const assinarLargura = (aviso: () => void) => {
  const m = window.matchMedia(CONSULTA_LARGA);
  m.addEventListener("change", aviso);
  return () => m.removeEventListener("change", aviso);
};

/**
 * Estado do painel da direita compartilhado entre as telas: as Configurações da Listagem
 * (aberta pela engrenagem do cabeçalho da tabela) e o pedido para mostrar os Filtros.
 */
export function ProvedorPainel({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const [configuracao, setConfiguracao] = useState<ConfiguracaoAberta | null>(null);
  const [pedidosDeFiltros, setPedidos] = useState(0);
  const [paineis, setPaineis] = useState(0);
  const larga = useSyncExternalStore(
    assinarLargura,
    () => window.matchMedia(CONSULTA_LARGA).matches,
    () => true,
  );

  // Ao trocar de tela, a configuração da anterior fecha.
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho);
  if (caminho !== caminhoAnterior) {
    setCaminhoAnterior(caminho);
    setConfiguracao(null);
  }

  const abrirConfiguracao = useCallback((tela: string, pref: PreferenciaListagem) => setConfiguracao({ tela, pref }), []);
  const fecharConfiguracao = useCallback(() => setConfiguracao(null), []);
  const abrirFiltros = useCallback(() => setPedidos((n) => n + 1), []);
  const registrarPainel = useCallback(() => {
    setPaineis((n) => n + 1);
    return () => setPaineis((n) => n - 1);
  }, []);

  useEffect(() => {
    if (!configuracao || larga) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfiguracao(null);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [configuracao, larga]);

  const valor = useMemo<Painel>(
    () => ({ configuracao, abrirConfiguracao, fecharConfiguracao, abrirFiltros, pedidosDeFiltros, registrarPainel, larga }),
    [configuracao, abrirConfiguracao, fecharConfiguracao, abrirFiltros, pedidosDeFiltros, registrarPainel, larga],
  );
  // Gaveta fixa: abaixo de xl (o painel da direita some) ou em telas sem painel lateral.
  const gaveta = !!configuracao && (!larga || paineis === 0);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {gaveta && (
        <aside aria-label="Configurações da Listagem" className="fixed right-0 bottom-0 top-14 z-40 w-80 max-w-full overflow-y-auto border-l border-borda-painel bg-painel p-4 shadow-xl">
          <PainelConfiguracao key={configuracao.tela} tela={configuracao.tela} pref={configuracao.pref} aoFechar={fecharConfiguracao} />
        </aside>
      )}
    </Contexto.Provider>
  );
}

export function usePainel(): Painel {
  const c = useContext(Contexto);
  if (!c) throw new Error("usePainel precisa estar dentro do ProvedorPainel.");
  return c;
}
