"use client";

import { CircleHelp } from "lucide-react";
import { useId } from "react";
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

/** Campo de dinheiro: aceita "1.500,00", "1500" ou "-250,5". */
export function CampoValor({ rotulo, obrigatorio, ajuda, className, desabilitado, valor, aoMudar, permitirNegativo }: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
  permitirNegativo?: boolean;
}) {
  const id = useId();
  const filtrar = (texto: string) => texto.replace(permitirNegativo ? /[^\d.,-]/g : /[^\d.,]/g, "");
  return (
    <div className={className}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} htmlFor={id} />
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">R$</span>
        <input
          id={id}
          inputMode="decimal"
          disabled={desabilitado}
          value={valor}
          placeholder="0,00"
          onChange={(e) => aoMudar(filtrar(e.target.value))}
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
