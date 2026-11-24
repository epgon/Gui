"use client";

import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Rotulo } from "@/components/ui/campo";
import { cn } from "@/lib/cn";
import type { OpcaoCategoria, OpcaoDestino, OpcaoSimples } from "@/lib/lancamentos/tipos";

const estilo =
  "h-10 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none transition focus:border-verde focus:ring-2 focus:ring-verde/15 disabled:bg-gray-50 disabled:text-gray-500";

/** Conta ou Cartão, em dois grupos. */
export function CampoDestino({ rotulo, valor, aoMudar, destinos, soContas, excluir, obrigatorio = true, ajuda }: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  destinos: OpcaoDestino[];
  soContas?: boolean;
  excluir?: string;
  obrigatorio?: boolean;
  ajuda?: string;
}) {
  const id = useId();
  const visiveis = destinos.filter((d) => (d.ativo || d.valor === valor) && (!soContas || d.grupo === "Contas") && d.valor !== excluir);
  const grupos = (["Contas", "Cartões"] as const).map((g) => ({ g, itens: visiveis.filter((d) => d.grupo === g) })).filter((x) => x.itens.length);
  return (
    <div>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} ajuda={ajuda} htmlFor={id} />
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={estilo}>
        <option value="">Selecione</option>
        {grupos.map(({ g, itens }) => (
          <optgroup key={g} label={g === "Contas" ? "Contas Financeiras" : "Cartões de Crédito"}>
            {itens.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.rotulo}
                {d.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/** Categoria numerada, só da natureza certa (receita ou despesa). */
export function CampoCategoria({ rotulo = "Categoria", valor, aoMudar, categorias, natureza, obrigatorio = true }: {
  rotulo?: string;
  valor: string;
  aoMudar: (v: string) => void;
  categorias: OpcaoCategoria[];
  natureza: "receita" | "despesa";
  obrigatorio?: boolean;
}) {
  const id = useId();
  const escolhida = categorias.find((c) => String(c.id) === valor);
  const lista = categorias.filter((c) => c.natureza === natureza && (c.ativo || String(c.id) === valor));
  return (
    <div>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} htmlFor={id} />
      <div className="relative">
        <span
          className="pointer-events-none absolute top-1/2 left-3 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{ background: escolhida?.cor ?? "#d1d5db" }}
          aria-hidden
        />
        <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={cn(estilo, "pl-8")}>
          <option value="">Selecione</option>
          {lista.map((c) => (
            <option key={c.id} value={c.id}>
              {"   ".repeat(c.nivel - 1)}
              {c.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Lista simples com botão "+" para cadastrar na hora. */
export function CampoComNovo({ rotulo, valor, aoMudar, opcoes, aoCriar, rotuloNovo, vazio = "Não informado", obrigatorio }: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: OpcaoSimples[];
  aoCriar?: () => void;
  rotuloNovo?: string;
  vazio?: string;
  obrigatorio?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} htmlFor={id} />
      <div className="flex gap-1">
        <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={estilo}>
          <option value="">{vazio}</option>
          {opcoes
            .filter((o) => o.ativo || String(o.id) === valor)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
        </select>
        {aoCriar && (
          <button type="button" onClick={aoCriar} title={rotuloNovo} aria-label={rotuloNovo} className="h-10 shrink-0 rounded-md border border-borda px-2.5 text-verde hover:bg-verde-claro">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Tags escolhidas como etiquetas, com lista para adicionar mais. */
export function CampoTags({ valor, aoMudar, tags, aoCriar }: { valor: number[]; aoMudar: (v: number[]) => void; tags: OpcaoSimples[]; aoCriar: () => void }) {
  const id = useId();
  const disponiveis = tags.filter((t) => t.ativo && !valor.includes(t.id));
  return (
    <div>
      <Rotulo texto="Tags" htmlFor={id} />
      <div className="flex gap-1">
        <div className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border border-borda bg-white px-2 py-1">
          {valor.map((tid) => {
            const t = tags.find((x) => x.id === tid);
            return (
              <span key={tid} className="inline-flex items-center gap-1 rounded-full bg-verde-claro px-2 py-0.5 text-xs font-medium text-verde">
                {t?.rotulo ?? "Tag"}
                <button type="button" aria-label={`Tirar a tag ${t?.rotulo ?? ""}`} onClick={() => aoMudar(valor.filter((x) => x !== tid))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <select
            id={id}
            value=""
            onChange={(e) => e.target.value && aoMudar([...valor, Number(e.target.value)])}
            className="h-7 min-w-28 flex-1 bg-transparent text-sm text-gray-500 outline-none"
          >
            <option value="">{disponiveis.length ? "Adicionar tag..." : valor.length ? "" : "Nenhuma tag cadastrada"}</option>
            {disponiveis.map((t) => (
              <option key={t.id} value={t.id}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={aoCriar} title="Nova Tag" aria-label="Nova Tag" className="h-10 shrink-0 rounded-md border border-borda px-2.5 text-verde hover:bg-verde-claro">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Alternador Despesa (laranja) / Receita (azul). */
export function AlternadorTipo({ valor, aoMudar, desabilitado }: { valor: "receita" | "despesa"; aoMudar: (v: "receita" | "despesa") => void; desabilitado?: boolean }) {
  return (
    <div className="inline-flex rounded-md border border-borda bg-white p-0.5" role="radiogroup" aria-label="Tipo">
      {(["despesa", "receita"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={valor === t}
          disabled={desabilitado}
          onClick={() => aoMudar(t)}
          className={cn(
            "h-8 rounded px-4 text-sm font-semibold transition disabled:cursor-not-allowed",
            valor === t ? (t === "despesa" ? "bg-despesa text-white" : "bg-receita text-white") : "text-gray-600 hover:bg-gray-50",
          )}
        >
          {t === "despesa" ? "Despesa" : "Receita"}
        </button>
      ))}
    </div>
  );
}
