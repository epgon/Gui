"use client";

import { CircleHelp } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { mascararValor, normalizarValor } from "@/lib/dinheiro";
import { cn } from "@/lib/cn";

const estiloEntrada =
  "h-10 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none transition focus:border-verde focus:ring-2 focus:ring-verde/15 disabled:bg-gray-50 disabled:text-gray-500";

/** Rótulo do campo, com asterisco laranja nos obrigatórios e ícone de ajuda. */
export function Rotulo({ texto, obrigatorio, ajuda, htmlFor }: { texto: string; obrigatorio?: boolean; ajuda?: string; htmlFor?: string }) {
  return (
    <span className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
      <label htmlFor={htmlFor}>
        {texto}
        {obrigatorio && <span className="text-despesa"> *</span>}
      </label>
      {ajuda && (
        <span title={ajuda} className="cursor-help text-gray-400">
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  );
}

type Comum = { rotulo: string; obrigatorio?: boolean; ajuda?: string; className?: string; desabilitado?: boolean };

export function CampoTexto({ rotulo, obrigatorio, ajuda, className, desabilitado, valor, aoMudar, ...props }: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId();
  return (
    <div className={className}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} htmlFor={id} />
      <input id={id} {...props} disabled={desabilitado} value={valor} onChange={(e) => aoMudar(e.target.value)} className={estiloEntrada} />
    </div>
  );
}

export function CampoAreaTexto({ rotulo, obrigatorio, ajuda, className, valor, aoMudar, linhas = 5 }: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
  linhas?: number;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} htmlFor={id} />
      <textarea
        id={id}
        rows={linhas}
        value={valor}
        maxLength={2000}
        onChange={(e) => aoMudar(e.target.value)}
        className={cn(estiloEntrada, "h-auto py-2")}
      />
    </div>
  );
}

export type Opcao = { valor: string; rotulo: string; desabilitada?: boolean };

export function CampoSelecao({ rotulo, obrigatorio, ajuda, className, desabilitado, valor, aoMudar, opcoes }: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: Opcao[];
}) {
  const id = useId();
  return (
    <div className={className}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} htmlFor={id} />
      <select id={id} value={valor} disabled={desabilitado} onChange={(e) => aoMudar(e.target.value)} className={estiloEntrada}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} disabled={o.desabilitada}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Input de dinheiro sem rótulo: mostra 10.000,00 ao digitar e ao sair do campo. */
export function EntradaValor({ valor, aoMudar, aoSair, permitirNegativo, className, ...resto }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur"> & {
  valor: string;
  aoMudar: (v: string) => void;
  aoSair?: () => void;
  permitirNegativo?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  // Valores já salvos chegam crus ("10000"): exibe formatado também fora de foco.
  const exibido = mascararValor(valor, permitirNegativo);
  useLayoutEffect(() => {
    if (cursor.current !== null && ref.current && document.activeElement === ref.current) ref.current.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  });
  return (
    <input
      {...resto}
      ref={ref}
      inputMode="decimal"
      value={exibido}
      placeholder={resto.placeholder ?? "0,00"}
      onChange={(e) => {
        const bruto = e.target.value;
        const pos = e.target.selectionStart ?? bruto.length;
        const digitosAntes = bruto.slice(0, pos).replace(/[^\d,]/g, "").length;
        const novo = mascararValor(bruto, permitirNegativo);
        let n = 0;
        let nova = 0;
        while (nova < novo.length && n < digitosAntes) if (/[\d,]/.test(novo[nova++])) n++;
        cursor.current = nova;
        aoMudar(novo);
      }}
      onBlur={() => {
        const completo = normalizarValor(exibido);
        if (completo !== valor) aoMudar(completo);
        aoSair?.();
      }}
      className={className}
    />
  );
}

/** Campo de dinheiro: formata como 10.000,00; aceita "1.500,00", "1500" ou "-250,5". */
export function CampoValor({ rotulo, obrigatorio, ajuda, className, desabilitado, valor, aoMudar, aoSair, permitirNegativo }: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
  /** Chamado ao sair do campo (blur). */
  aoSair?: () => void;
  permitirNegativo?: boolean;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} htmlFor={id} />
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">R$</span>
        <EntradaValor
          id={id}
          disabled={desabilitado}
          valor={valor}
          aoMudar={aoMudar}
          aoSair={aoSair}
          permitirNegativo={permitirNegativo}
          className={cn(estiloEntrada, "pl-9 text-right tabular-nums")}
        />
      </div>
    </div>
  );
}

/** Mostra "Preencha o campo **Valor**." com o nome do campo em negrito. */
export function TextoComDestaque({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : <span key={i}>{parte}</span>))}
    </>
  );
}
