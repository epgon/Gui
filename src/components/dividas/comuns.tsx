"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { ROTULO_SITUACAO_DIVIDA, type ResumoSaldo, type SituacaoDivida } from "@/lib/dividas/regras";
import { ABAS_DIVIDAS } from "@/lib/menu";

/** Abas do módulo, no estilo das abas de Lançamentos. Cada uma tem endereço próprio. */
export function AbasDividas({ ativa }: { ativa: string }) {
  return (
    <div className="flex gap-1 border-b border-borda" role="tablist">
      {ABAS_DIVIDAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          role="tab"
          aria-selected={ativa === a.href}
          className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", ativa === a.href ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}
        >
          {a.titulo}
        </Link>
      ))}
    </div>
  );
}

const ESTILO_SITUACAO: Record<SituacaoDivida, string> = {
  em_dia: "bg-pago-fundo text-pago-texto",
  em_atraso: "bg-orange-100 text-despesa",
  quitada: "bg-blue-50 text-receita",
  renegociada: "bg-gray-100 text-gray-600",
  cancelada: "bg-gray-100 text-gray-500",
};

/** Pílula da situação da dívida (Em dia, Em atraso, Quitada...). */
export function PilulaSituacao({ situacao, diasAtraso }: { situacao: SituacaoDivida; diasAtraso?: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", ESTILO_SITUACAO[situacao])} title={situacao === "em_atraso" && diasAtraso ? `Parcela mais antiga vencida há ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"}.` : undefined}>
      {ROTULO_SITUACAO_DIVIDA[situacao]}
      {situacao === "em_atraso" && diasAtraso ? ` há ${diasAtraso} d` : ""}
    </span>
  );
}

/** De onde vem o saldo mostrado: "informado em 10/11", "estimado" (com atraso) ou nada (pelas parcelas). */
export function NotaSaldo({ saldo }: { saldo: ResumoSaldo }) {
  if (saldo.origem === "informado" && saldo.informadoEm) {
    return (
      <span className={cn("block text-xs", saldo.informadoAntigo ? "text-amarelo-texto" : "text-gray-400")} title={saldo.informadoAntigo ? "Este saldo foi informado há mais de 60 dias. Vale atualizar com o credor." : "Saldo que o credor informou, menos o que foi pago depois."}>
        informado em {formatarData(saldo.informadoEm)}
        {saldo.informadoAntigo ? " (antigo)" : ""}
      </span>
    );
  }
  if (saldo.origem === "estimado") {
    return (
      <span className="block text-xs text-gray-400" title="Parcelas mais a estimativa de multa e juros de atraso. O valor certo é o que o credor informar.">
        estimado
      </span>
    );
  }
  return null;
}

/** Barra de progresso no estilo dos Orçamentos. */
export function BarraProgresso({ percentual, className }: { percentual: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-100", className)} role="progressbar" aria-valuenow={percentual} aria-valuemin={0} aria-valuemax={100} aria-label="Quanto já foi pago">
      <div className="h-full rounded-full bg-verde-vivo" style={{ width: `${Math.max(percentual > 0 ? 3 : 0, percentual)}%` }} />
    </div>
  );
}
