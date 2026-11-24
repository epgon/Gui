"use client";

import { Bell, Check, ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MENU_CONFIGURACOES, menuVisivel, type ItemMenu } from "@/lib/menu";
import type { Notificacao } from "@/lib/notificacoes/tipos";
import { IconeNotificacao, useMarcarLidas } from "./notificacoes";
import { LogoGui } from "./logo-gui";

/** Barra verde do topo: logo, menus e, à direita, notificações, configurações e usuário. */
export function BarraSuperior({ nomeUsuario, emailUsuario, sair, titulo, ocultas, notificacoes }: {
  nomeUsuario: string;
  emailUsuario: string;
  sair: () => Promise<void>;
  /** Parâmetros Gerais > Título (aparece ao lado do logo quando não é "Gui"). */
  titulo: string;
  /** Telas dos recursos desligados. */
  ocultas: string[];
  /** Avisos ainda não lidos. */
  notificacoes: Notificacao[];
}) {
  const caminho = usePathname();
  const menuPrincipal = menuVisivel(ocultas);
  const marcar = useMarcarLidas();
  const ref = useRef<HTMLElement>(null);
  // O menu aberto vale só para a página em que foi aberto: trocar de página fecha.
  const [menu, setMenu] = useState<{ id: string; pagina: string; esquerda: number } | null>(null);
  const aberto = menu?.pagina === caminho ? menu.id : null;

  // Fecha o menu ao clicar fora ou apertar Esc.
  useEffect(() => {
    const fechar = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const alternar = (id: string, botao?: HTMLElement) =>
    setMenu(aberto === id ? null : { id, pagina: caminho, esquerda: botao?.getBoundingClientRect().left ?? 16 });

  return (
    <header ref={ref} className="sticky top-0 z-40 bg-verde text-white shadow-sm">
      <div className="flex h-14 items-center gap-2 px-4">
        <Link href="/" className="mr-4 flex items-center gap-2 rounded px-1" aria-label="Gui: Visão Geral">
          <LogoGui variante="claro" className="text-[26px]" />
        </Link>
        {titulo && titulo !== "Gui" && <span className="mr-2 hidden max-w-40 truncate text-sm font-medium text-white/80 lg:block">{titulo}</span>}

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Menu principal">
          {menuPrincipal.map((grupo) => {
            const ativo = grupo.itens.some((i) => caminho.startsWith(i.href));
            return (
              <div key={grupo.titulo} className="relative">
                <button
                  type="button"
                  onClick={(e) => alternar(grupo.titulo, e.currentTarget)}
                  aria-expanded={aberto === grupo.titulo}
                  className={cn(
                    "flex h-9 items-center gap-1 whitespace-nowrap rounded-md px-3 text-sm font-medium transition hover:bg-white/10",
                    (ativo || aberto === grupo.titulo) && "bg-white/15",
                  )}
                >
                  {grupo.titulo}
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => alternar("notificacoes")}
            className="relative rounded-md p-2 hover:bg-white/10"
            aria-label={notificacoes.length ? `Notificações (${notificacoes.length} não lidas)` : "Notificações"}
            aria-expanded={aberto === "notificacoes"}
          >
            <Bell className="h-5 w-5" />
            {notificacoes.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-verde bg-despesa" />}
          </button>
          <button type="button" onClick={() => alternar("config")} className="rounded-md p-2 hover:bg-white/10" aria-label="Configurações" aria-expanded={aberto === "config"}>
            <Settings className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => alternar("usuario")} className="ml-1 flex items-center gap-2 rounded-md py-1 pr-2 pl-1 hover:bg-white/10" aria-expanded={aberto === "usuario"}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold uppercase">
              {nomeUsuario.slice(0, 1)}
            </span>
            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{nomeUsuario}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>
      </div>

      {menuPrincipal.map((grupo) =>
        aberto === grupo.titulo ? (
          <PainelMenu key={grupo.titulo} titulo={grupo.titulo} itens={grupo.itens} esquerda={menu?.esquerda} />
        ) : null,
      )}
      {aberto === "config" && <PainelMenu titulo="Configurações" itens={MENU_CONFIGURACOES} alinharDireita />}
      {aberto === "notificacoes" && (
        <div className="absolute right-4 top-14 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-borda bg-white text-gray-800 shadow-lg">
          <div className="flex items-center justify-between border-b border-borda px-4 py-3">
            <p className="text-sm font-semibold">Notificações</p>
            {notificacoes.length > 0 && (
              <button type="button" className="text-xs font-semibold text-verde hover:underline disabled:opacity-50" disabled={marcar.ocupado} onClick={() => marcar.executar(notificacoes.map((n) => n.id))}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {notificacoes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma notificação nova.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-borda overflow-y-auto">
              {notificacoes.slice(0, 6).map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <IconeNotificacao tipo={n.tipo} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.titulo}</p>
                    <p className="text-xs text-gray-500">{n.texto}</p>
                    <Link href={n.href} onClick={() => setMenu(null)} className="text-xs font-semibold text-verde hover:underline">
                      {n.rotuloLink}
                    </Link>
                  </div>
                  <button type="button" className="self-start rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-verde" title="Marcar como lida" aria-label={`Marcar "${n.titulo}" como lida`} disabled={marcar.ocupado} onClick={() => marcar.executar([n.id])}>
                    <Check className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href="/notificacoes" onClick={() => setMenu(null)} className="block border-t border-borda px-4 py-2.5 text-center text-sm font-semibold text-verde hover:bg-verde-claro">
            Todas Notificações
          </Link>
        </div>
      )}
      {aberto === "usuario" && (
        <div className="absolute right-4 top-14 w-64 rounded-xl border border-borda bg-white p-2 text-gray-800 shadow-lg">
          <div className="flex items-center gap-3 border-b border-borda px-2 pt-1 pb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-verde text-base font-semibold uppercase text-white">
              {nomeUsuario.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{nomeUsuario}</p>
              <p className="truncate text-xs text-gray-500">{emailUsuario}</p>
            </div>
          </div>
          <Link href="/administracao/meus-dados" className="mt-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-100">
            <UserRound className="h-4 w-4 text-gray-500" /> Meus Dados
          </Link>
          <form action={sair}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-despesa hover:bg-gray-100">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      )}
    </header>
  );
}

function PainelMenu({ titulo, itens, esquerda, alinharDireita }: {
  titulo: string;
  itens: ItemMenu[];
  esquerda?: number;
  alinharDireita?: boolean;
}) {
  // Abre logo abaixo do menu clicado, sem passar da borda direita da tela.
  const posicao = alinharDireita ? undefined : { left: `min(${esquerda ?? 16}px, calc(100vw - min(520px, 100vw - 2rem) - 1rem))` };
  return (
    <div
      style={posicao}
      className={cn(
        "absolute top-14 w-[min(520px,calc(100vw-2rem))] rounded-b-xl border border-t-0 border-borda bg-white p-3 text-gray-800 shadow-lg",
        alinharDireita && "right-4",
      )}
    >
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{titulo}</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {itens.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded-lg px-2 py-2 hover:bg-verde-claro">
              <span className="block text-sm font-semibold text-verde">{item.titulo}</span>
              {item.descricao && <span className="block text-xs text-gray-500">{item.descricao}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
