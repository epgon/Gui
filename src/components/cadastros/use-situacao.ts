"use client";

import { useState, useTransition } from "react";
import type { Resultado } from "@/lib/cadastros/resultado";

/** Ativar/inativar pelo check da lista, mostrando o erro na faixa amarela da página. */
export function useSituacao(acao: (id: number, ativo: boolean) => Promise<Resultado>) {
  const [aviso, setAviso] = useState("");
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);
  const [, iniciar] = useTransition();

  const alternar = (id: number, ativoAgora: boolean) => {
    setAviso("");
    setOcupadoId(id);
    iniciar(async () => {
      try {
        const r = await acao(id, !ativoAgora);
        if (!r.ok) setAviso(r.erro);
      } catch {
        setAviso("Não foi possível alterar a situação agora. Tente de novo.");
      } finally {
        setOcupadoId(null);
      }
    });
  };

  return { alternar, ocupadoId, aviso, setAviso };
}
