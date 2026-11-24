"use client";

import { CalendarDays, CreditCard, FileDown, FileUp, PiggyBank, Printer, Repeat, Tag, Users, Wallet } from "lucide-react";
import { useState, useTransition } from "react";
import { alterarRecurso } from "@/app/(sistema)/sistema-acoes";
import { Cartao } from "@/components/ui/cartao";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { TextoComDestaque } from "@/components/ui/campo";
import { RECURSOS, type Recurso, type Recursos } from "@/lib/parametros/tipos";

const ICONES: Record<Recurso, React.ComponentType<{ className?: string }>> = {
  cartoes: CreditCard,
  recorrentes: Repeat,
  agenda: CalendarDays,
  contatos: Users,
  formas_pagamento: Wallet,
  tags: Tag,
  orcamentos: PiggyBank,
  importacao: FileUp,
  exportacao: FileDown,
  impressao: Printer,
};

export function TelaRecursos({ recursos }: { recursos: Recursos }) {
  const [ocupado, iniciar] = useTransition();
  const [mexendo, setMexendo] = useState<Recurso | null>(null);
  const [erro, setErro] = useState("");

  function mudar(chave: Recurso, ligado: boolean) {
    setErro("");
    setMexendo(chave);
    iniciar(async () => {
      const r = await alterarRecurso(chave, ligado).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      if (!r.ok) setErro(r.erro);
      setMexendo(null);
    });
  }

  const coluna = (ligados: boolean) => {
    const itens = RECURSOS.filter((r) => recursos[r.chave] === ligados);
    return (
      <Cartao titulo={ligados ? `Ativados (${itens.length})` : `Desativados (${itens.length})`}>
        {itens.length === 0 && <p className="py-4 text-center text-sm text-gray-500">{ligados ? "Nenhum recurso ativado." : "Nenhum recurso desativado."}</p>}
        <ul className="divide-y divide-borda">
          {itens.map((r) => {
            const Icone = ICONES[r.chave];
            return (
              <li key={r.chave} className="flex items-center gap-3 py-3">
                <span className={ligados ? "flex h-9 w-9 items-center justify-center rounded-full bg-verde-claro text-verde" : "flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400"}>
                  <Icone className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800">{r.rotulo}</p>
                  <p className="text-xs text-gray-500">{r.descricao}</p>
                </div>
                <Chave ligada={ligados} desabilitada={ocupado && mexendo === r.chave} aoMudar={(v) => mudar(r.chave, v)} rotulo={ligados ? "Ativado" : "Desativado"} />
              </li>
            );
          })}
        </ul>
      </Cartao>
    );
  };

  return (
    <div className="space-y-4">
      <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      <div className="grid gap-4 lg:grid-cols-2">
        {coluna(true)}
        {coluna(false)}
      </div>
    </div>
  );
}
