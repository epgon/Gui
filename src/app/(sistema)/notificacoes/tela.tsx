"use client";

import { Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { IconeNotificacao, useMarcarLidas } from "@/components/layout/notificacoes";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { cn } from "@/lib/cn";
import type { Notificacao } from "@/lib/notificacoes/tipos";

export function TelaNotificacoes({ lista }: { lista: (Notificacao & { lida: boolean })[] }) {
  const marcar = useMarcarLidas();
  const naoLidas = lista.filter((n) => !n.lida);
  if (!lista.length) {
    return (
      <Cartao>
        <EstadoVazio titulo="Nenhuma Notificação" texto="Está tudo em dia por aqui." />
      </Cartao>
    );
  }
  return (
    <Cartao
      titulo={naoLidas.length ? `${naoLidas.length} não lida${naoLidas.length > 1 ? "s" : ""}` : "Todas lidas"}
      acoes={
        naoLidas.length > 0 && (
          <Botao variante="secundario" icone={<CheckCheck className="h-4 w-4" />} carregando={marcar.ocupado} onClick={() => marcar.executar(naoLidas.map((n) => n.id))}>
            Marcar todas como lidas
          </Botao>
        )
      }
    >
      <ul className="divide-y divide-borda">
        {lista.map((n) => (
          <li key={n.id} className={cn("flex gap-3 py-3", n.lida && "opacity-60")}>
            <IconeNotificacao tipo={n.tipo} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {n.titulo}
                {!n.lida && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-despesa align-middle" aria-label="Não lida" />}
              </p>
              <p className="text-sm text-gray-600">{n.texto}</p>
              <Link href={n.href} className="text-sm font-semibold text-verde hover:underline">
                {n.rotuloLink}
              </Link>
            </div>
            {!n.lida && (
              <button type="button" className="self-start rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-verde" title="Marcar como lida" aria-label={`Marcar "${n.titulo}" como lida`} disabled={marcar.ocupado} onClick={() => marcar.executar([n.id])}>
                <Check className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
