"use client";

import { Search, Settings, Wallet } from "lucide-react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconeBanco } from "@/components/cadastros/icone-banco";
import { BotaoImprimir } from "@/components/exportacao/botao-imprimir";
import { Chave } from "@/components/ui/chave";
import type { OpcaoDestino } from "@/lib/lancamentos/tipos";
import { DATAS_CONSIDERADAS, SITUACOES_RELATORIO, type Granularidade } from "@/lib/relatorios/regras";

const campo = "h-9 rounded-md border border-borda bg-white px-2 text-sm outline-none focus:border-verde";

/**
 * Barra comum aos relatórios: tipo (troca sem voltar), intervalo "de ... a ..." com a lupa,
 * Imprimir, engrenagem "Incluir as categorias" e os filtros rápidos (Conta ou Cartão, Situação e Considerar: Data).
 */
export function BarraRelatorio({ caminho, tela, nomeTipo, tipos, tipoAtual, granularidade, parametros, destinos }: {
  caminho: string;
  /** Nome usado na impressão (/api/exportar/...). */
  tela: string;
  /** Nome do parâmetro do tipo na URL ("periodo" ou "relatorio"). */
  nomeTipo: string;
  tipos: { valor: string; rotulo: string }[];
  tipoAtual: string;
  granularidade: Granularidade;
  /** Todos os parâmetros da URL atual (filtros). */
  parametros: Record<string, string>;
  destinos: OpcaoDestino[];
}) {
  const router = useRouter();
  const [engrenagem, setEngrenagem] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const todos = { ...parametros, [nomeTipo]: tipoAtual };
  const link = (mudancas: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries({ ...todos, ...mudancas }).filter(([, v]) => v));
    return `${caminho}?${sp.toString()}`;
  };
  const ir = (mudancas: Record<string, string>) => router.push(link(mudancas));

  useEffect(() => {
    if (!engrenagem) return;
    const fechar = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setEngrenagem(false);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", fechar);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", fechar);
    };
  }, [engrenagem]);

  const tipoInput = granularidade === "dia" ? "date" : granularidade === "mes" ? "month" : "number";
  const extrasInput = granularidade === "ano" ? { min: 1900, max: 2200, step: 1, className: `${campo} w-24` } : { className: campo };
  const destinoAtual = destinos.find((d) => d.valor === parametros.destino);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tipoAtual}
          // Trocar o tipo volta o intervalo ao padrão dele (o formato das datas muda).
          onChange={(e) => ir({ [nomeTipo]: e.target.value, de: "", ate: "" })}
          aria-label="Tipo do relatório"
          className={`${campo} font-semibold`}
        >
          {tipos.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
        <Form action={caminho} className="flex flex-wrap items-center gap-2" key={`${parametros.de}|${parametros.ate}|${tipoAtual}`}>
          {Object.entries(todos)
            .filter(([k, v]) => k !== "de" && k !== "ate" && v)
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <span className="text-sm text-gray-600">de</span>
          <input name="de" type={tipoInput} defaultValue={parametros.de} aria-label="Início do período" required {...extrasInput} />
          <span className="text-sm text-gray-600">a</span>
          <input name="ate" type={tipoInput} defaultValue={parametros.ate} aria-label="Fim do período" required {...extrasInput} />
          <button type="submit" aria-label="Buscar" title="Buscar" className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-verde text-white hover:bg-verde-escuro">
            <Search className="h-4 w-4" />
          </button>
        </Form>
        <div className="ml-auto flex items-center gap-2">
          <BotaoImprimir tela={tela} parametros={todos} />
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setEngrenagem((x) => !x)}
              aria-expanded={engrenagem}
              aria-label="Configurações do relatório"
              title="Configurações do relatório"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-borda bg-white text-gray-600 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
            </button>
            {engrenagem && (
              <div className="absolute right-0 z-40 mt-1 w-64 space-y-3 rounded-lg border border-borda bg-white p-3 text-sm shadow-lg">
                <p className="font-semibold text-gray-800">Incluir as categorias</p>
                <Chave ligada={parametros.acerto === "1"} aoMudar={(v) => ir({ acerto: v ? "1" : "" })} rotulo="Acerto de Saldo" />
                <Chave ligada={parametros.transferencia === "1"} aoMudar={(v) => ir({ transferencia: v ? "1" : "" })} rotulo="Transferência" />
                <p className="text-xs text-gray-500">Desligadas, o Saldo Inicial, os acertos e as transferências entre contas não entram nos totais.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-white px-4 py-3 shadow-cartao">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Conta ou Cartão</span>
          {destinoAtual ? <IconeBanco codigo={destinoAtual.bancoCodigo} nome={destinoAtual.bancoNome ?? "Outro"} className="h-7 w-7 text-[10px]" /> : <Wallet className="h-5 w-5 text-gray-400" />}
          <select value={parametros.destino ?? ""} onChange={(e) => ir({ destino: e.target.value })} className={campo}>
            <option value="">Todas as contas e cartões</option>
            {(["Contas", "Cartões"] as const).map((g) => {
              const itens = destinos.filter((d) => d.grupo === g && (d.ativo || d.valor === parametros.destino));
              return itens.length ? (
                <optgroup key={g} label={g === "Contas" ? "Contas Financeiras" : "Cartões de Crédito"}>
                  {itens.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.rotulo}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
        <select value={parametros.situacao ?? ""} onChange={(e) => ir({ situacao: e.target.value })} aria-label="Situação" className={campo}>
          {SITUACOES_RELATORIO.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Considerar:
          <select value={parametros.considerar || "vencimento"} onChange={(e) => ir({ considerar: e.target.value === "vencimento" ? "" : e.target.value })} className={campo}>
            {DATAS_CONSIDERADAS.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
