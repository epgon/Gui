"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { cn } from "@/lib/cn";
import type { FluxoDeCaixa, LinhaValores, NoCategoria } from "@/lib/relatorios/regras";
import { ValorRelatorio } from "./comuns";

const FAIXAS = {
  receitas: { rotulo: "Receitas", fundo: "bg-blue-50", texto: "text-receita" },
  despesas: { rotulo: "Despesas", fundo: "bg-rose-50", texto: "text-despesa" },
  saldo: { rotulo: "Saldo", fundo: "bg-verde-claro", texto: "text-verde" },
} as const;

/**
 * Tabela do Fluxo de Caixa: uma coluna por período, mais Média e Total.
 * Receitas e Despesas abrem (seta) por categoria; cada categoria com filhas abre de novo.
 */
export function TabelaFluxo({ fluxo }: { fluxo: FluxoDeCaixa }) {
  const [abertos, setAbertos] = useState<string[]>([]);
  const alternar = (chave: string) => setAbertos((a) => (a.includes(chave) ? a.filter((x) => x !== chave) : [...a, chave]));

  const celulas = (l: LinhaValores, negrito = false) => (
    <>
      {l.valores.map((v, i) => (
        <td key={i} className="whitespace-nowrap px-3 py-2 text-right">
          <ValorRelatorio centavos={v} className={negrito ? "font-semibold" : undefined} />
        </td>
      ))}
      <td className="whitespace-nowrap border-l border-borda bg-subcabecalho px-3 py-2 text-right">
        <ValorRelatorio centavos={l.media} className={negrito ? "font-semibold" : undefined} />
      </td>
      <td className="sticky right-0 whitespace-nowrap border-l border-borda bg-subcabecalho px-3 py-2 text-right">
        <ValorRelatorio centavos={l.total} className="font-semibold" />
      </td>
    </>
  );

  const linhasCategoria = (nos: NoCategoria[], prefixo: string): React.ReactNode =>
    nos.map((no) => {
      const chave = `${prefixo}/${no.chave}`;
      const aberto = abertos.includes(chave);
      return (
        <Fragment key={chave}>
          <tr className="border-b border-borda/70 hover:bg-gray-50/60">
            <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-normal">
              <span className="flex items-center gap-1.5" style={{ paddingLeft: (no.nivel - 1) * 18 + 8 }}>
                {no.filhos.length ? (
                  <button type="button" onClick={() => alternar(chave)} aria-expanded={aberto} aria-label={`${aberto ? "Fechar" : "Abrir"} ${no.rotulo}`} className="rounded p-0.5 text-gray-500 hover:bg-gray-100">
                    {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <span className="w-[18px]" />
                )}
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: no.cor }} />
                <span className="truncate text-gray-700">{no.rotulo}</span>
              </span>
            </th>
            {celulas(no)}
          </tr>
          {aberto && linhasCategoria(no.filhos, chave)}
        </Fragment>
      );
    });

  const faixa = (qual: "receitas" | "despesas" | "saldo") => {
    const linha = qual === "saldo" ? fluxo.saldo : fluxo[qual];
    const filhos = qual === "saldo" ? [] : fluxo[qual].filhos;
    const aberto = abertos.includes(qual);
    const f = FAIXAS[qual];
    return (
      <Fragment key={qual}>
        <tr className={cn("border-b border-borda", f.fundo)}>
          <th scope="row" className={cn("sticky left-0 z-10 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide", f.fundo, f.texto)}>
            <span className="flex items-center gap-1.5">
              {filhos.length ? (
                <button type="button" onClick={() => alternar(qual)} aria-expanded={aberto} aria-label={`${aberto ? "Fechar" : "Abrir"} ${f.rotulo} por categoria`} className="rounded p-0.5 hover:bg-white/60">
                  {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              {f.rotulo}
            </span>
          </th>
          {celulas(linha, true)}
        </tr>
        {aberto && linhasCategoria(filhos, qual)}
      </Fragment>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-white shadow-cartao">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="sticky left-0 z-10 min-w-56 bg-subcabecalho px-3 py-2.5 text-left font-semibold">
                <button type="button" className="text-[11px] font-semibold normal-case text-verde hover:underline" onClick={() => setAbertos(abertos.length ? [] : ["receitas", "despesas"])}>
                  {abertos.length ? "Fechar tudo" : "Abrir por categoria"}
                </button>
              </th>
              {fluxo.colunas.map((c) => (
                <th key={c.chave} className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                  {c.rotulo}
                </th>
              ))}
              <th className="whitespace-nowrap border-l border-borda px-3 py-2.5 text-right font-semibold">Média</th>
              <th className="sticky right-0 whitespace-nowrap border-l border-borda bg-subcabecalho px-3 py-2.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>{(["receitas", "despesas", "saldo"] as const).map(faixa)}</tbody>
        </table>
      </div>
    </div>
  );
}
