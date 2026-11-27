"use client";

import { Settings } from "lucide-react";
import { usePainel } from "@/components/layout/provedor-painel";
import { cn } from "@/lib/cn";
import type { PreferenciaListagem } from "@/lib/listagem/telas";

/**
 * Engrenagem no cabeçalho da tabela (canto da coluna do menu de três pontos): abre as
 * Configurações da Listagem no painel da direita. Fica ativa enquanto a configuração desta lista estiver aberta.
 */
export function BotaoConfigurarListagem({ tela, pref }: { tela: string; pref: PreferenciaListagem }) {
  const { configuracao, abrirConfiguracao, fecharConfiguracao } = usePainel();
  const ativo = configuracao?.tela === tela;
  return (
    <span className="group relative inline-block normal-case" data-ignorar-painel>
      <button
        type="button"
        aria-label="Configurações da Listagem"
        aria-pressed={ativo}
        onClick={() => (ativo ? fecharConfiguracao() : abrirConfiguracao(tela, pref))}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-verde",
          ativo ? "bg-verde-claro text-verde" : "text-gray-400 hover:bg-verde-claro hover:text-verde",
        )}
      >
        <Settings className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {/* Abaixo do botão: a tabela corta (overflow) o que sair pelo topo do cabeçalho. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full right-0 z-50 mt-1 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-normal tracking-normal text-white opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
      >
        Configurações
      </span>
    </span>
  );
}
