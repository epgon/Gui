"use client";

import { AlertTriangle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";

/**
 * Aviso antes de confirmar (spec 7.6): explica o motivo com números e deixa a pessoa decidir.
 * "Voltar" corrige; "Continuar mesmo assim" segue com o que foi digitado. Nunca bloqueia.
 */
export function AvisoAntesDeConfirmar({ aberto, titulo, motivos, aoVoltar, aoContinuar, rotuloContinuar = "Continuar mesmo assim" }: {
  aberto: boolean;
  titulo: string;
  motivos: string[];
  aoVoltar: () => void;
  aoContinuar: () => void;
  rotuloContinuar?: string;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoVoltar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundario" type="button" onClick={aoVoltar}>Voltar</Botao>
          <Botao type="button" onClick={aoContinuar}>{rotuloContinuar}</Botao>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        {motivos.map((m) => (
          <p key={m} className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>{m}</span>
          </p>
        ))}
        <p className="text-xs text-gray-500">É só um aviso: a decisão é sua.</p>
      </div>
    </Modal>
  );
}
