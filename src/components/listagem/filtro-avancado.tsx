"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  codificarFiltros,
  CONDICOES_POR_TIPO,
  descreverFiltro,
  lerFiltrosAvancados,
  MAXIMO_CONDICOES,
  ROTULO_CONDICAO,
  SEM_VALOR,
  type CampoAvancado,
  type Condicao,
  type FiltroAvancado as Filtro,
} from "@/lib/listagem/avancado";

const estilo = "h-9 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none focus:border-verde disabled:bg-gray-50 disabled:text-gray-400";

/**
 * Aba "Avançado" do painel de filtros: Origem (em Lançamentos), Campo, Condição e Valor.
 * Dá para juntar até 5 condições; todas precisam valer. Vai para a URL no campo escondido "av".
 */
export function FiltroAvancado({ campos, valor }: { campos: CampoAvancado[]; valor: string }) {
  const [lista, setLista] = useState<Filtro[]>(() => lerFiltrosAvancados(valor, campos));
  const origens = useMemo(() => [...new Set(campos.map((c) => c.origem).filter((o): o is string => !!o))], [campos]);
  const [origem, setOrigem] = useState("");
  const [campo, setCampo] = useState("");
  const [condicao, setCondicao] = useState<Condicao | "">("");
  const [texto, setTexto] = useState("");

  const disponiveis = origens.length ? campos.filter((c) => c.origem === origem) : campos;
  const def = campos.find((c) => c.chave === campo);
  const precisaValor = condicao !== "" && !SEM_VALOR.includes(condicao);
  const pendente: Filtro | null = def && condicao && (!precisaValor || texto.trim()) ? { campo: def.chave, condicao, valor: precisaValor ? texto.trim() : "" } : null;
  // O que ainda está na cascata (sem clicar em "Adicionar") também vai ao clicar em Filtrar.
  const final = pendente && lista.length < MAXIMO_CONDICOES ? [...lista, pendente] : lista;

  function adicionar() {
    if (!pendente || lista.length >= MAXIMO_CONDICOES) return;
    setLista((l) => [...l, pendente]);
    setCampo("");
    setCondicao("");
    setTexto("");
  }

  return (
    <div className="space-y-3 text-sm">
      {final.length > 0 && <input type="hidden" name="av" value={codificarFiltros(final)} />}
      {lista.length > 0 && (
        <ul className="space-y-1.5">
          {lista.map((f, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md border border-verde/30 bg-verde-claro px-2 py-1.5 text-xs text-verde">
              <span className="min-w-0 flex-1">{descreverFiltro(f, campos)}</span>
              <button type="button" onClick={() => setLista((l) => l.filter((_, j) => j !== i))} className="rounded p-0.5 hover:bg-white" aria-label="Tirar esta condição">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {origens.length > 0 && (
        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">Origem</span>
          <select
            className={estilo}
            value={origem}
            onChange={(e) => {
              setOrigem(e.target.value);
              setCampo("");
              setCondicao("");
              setTexto("");
            }}
          >
            <option value="">Selecione</option>
            {origens.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block font-medium text-gray-700">Campo</span>
        <select
          className={estilo}
          value={campo}
          disabled={origens.length > 0 && !origem}
          onChange={(e) => {
            const novo = campos.find((c) => c.chave === e.target.value);
            setCampo(e.target.value);
            setCondicao(novo ? CONDICOES_POR_TIPO[novo.tipo][0] : "");
            setTexto(novo?.tipo === "booleano" ? "sim" : novo?.tipo === "lista" ? (novo.opcoes?.[0]?.valor ?? "") : "");
          }}
        >
          <option value="">Selecione</option>
          {disponiveis.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block font-medium text-gray-700">Condição</span>
        <select className={estilo} value={condicao} disabled={!def} onChange={(e) => setCondicao(e.target.value as Condicao)}>
          {!def && <option value="">Selecione</option>}
          {def &&
            CONDICOES_POR_TIPO[def.tipo].map((c) => (
              <option key={c} value={c}>
                {ROTULO_CONDICAO[c]}
              </option>
            ))}
        </select>
      </label>
      {(!def || precisaValor) && (
        <label className="block">
          <span className="mb-1 block font-medium text-gray-700">Valor</span>
          {def?.tipo === "lista" ? (
            <select className={estilo} value={texto} onChange={(e) => setTexto(e.target.value)}>
              {def.opcoes?.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          ) : def?.tipo === "booleano" ? (
            <select className={estilo} value={texto} onChange={(e) => setTexto(e.target.value)}>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          ) : (
            <input
              className={estilo}
              disabled={!def}
              type={def?.tipo === "data" ? "date" : "text"}
              inputMode={def?.tipo === "dinheiro" || def?.tipo === "numero" ? "decimal" : undefined}
              placeholder={def?.tipo === "dinheiro" ? "0,00" : undefined}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          )}
        </label>
      )}
      <button
        type="button"
        onClick={adicionar}
        disabled={!pendente || lista.length >= MAXIMO_CONDICOES}
        className="inline-flex items-center gap-1 text-xs font-semibold text-verde hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar outra condição
      </button>
      <p className="text-xs text-gray-500">Todas as condições precisam valer. Textos são comparados sem diferenciar maiúsculas e acentos.</p>
    </div>
  );
}
