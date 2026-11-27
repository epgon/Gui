import { ChevronDown } from "lucide-react";
import type { CampoAvancado } from "@/lib/listagem/avancado";
import { PainelFiltrosCliente } from "./painel-filtros-cliente";

/**
 * Painel da direita nas listas: "Filtros", com as abas Simples e Avançado (quando a lista tem),
 * o botão Filtrar e o link Limpar.
 */
export function PainelFiltros(props: {
  caminho: string;
  children: React.ReactNode;
  /** Para onde "Limpar" leva (padrão: a tela sem filtros). */
  limpar?: string;
  /** Campos do Filtro Avançado e o valor atual ("av" da URL). */
  avancado?: { campos: CampoAvancado[]; valor: string };
}) {
  return <PainelFiltrosCliente {...props} />;
}

const estilo = "h-8 w-full rounded-md border border-borda bg-white px-2.5 text-[13px] outline-none focus:border-verde";
const rotuloCampo = "mb-1 block text-xs text-gray-500";

/** Campo de texto do painel de filtros (envia pela URL). */
export function FiltroTexto({ nome, rotulo, valor }: { nome: string; rotulo: string; valor: string }) {
  return (
    <label className="block">
      <span className={rotuloCampo}>{rotulo}</span>
      <input name={nome} defaultValue={valor} className={estilo} />
    </label>
  );
}

/** Campo de data do painel de filtros (envia pela URL, ex.: "de" e "ate"). */
export function FiltroData({ nome, rotulo, valor }: { nome: string; rotulo: string; valor: string }) {
  return (
    <label className="block">
      <span className={rotuloCampo}>{rotulo}</span>
      <input type="date" name={nome} defaultValue={valor} className={estilo} />
    </label>
  );
}

/** Lista de opções do painel de filtros. Com `operador`, o rótulo ganha IGUAL / DIFERENTE ao lado. */
export function FiltroSelecao({ nome, rotulo, valor, opcoes, operador }: {
  nome: string;
  rotulo: string;
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  /** Parâmetro da URL do operador (ex.: "categoria_op") e o valor atual ("" = igual, "dif" = diferente). */
  operador?: { nome: string; valor: string };
}) {
  return (
    <div className="block">
      <div className="mb-1 flex items-center gap-2">
        <label htmlFor={`filtro-${nome}`} className="text-xs text-gray-500">
          {rotulo}
        </label>
        {operador && (
          <span className="relative inline-flex items-center text-receita">
            <select
              name={operador.nome}
              defaultValue={operador.valor}
              aria-label={`Operador de ${rotulo}`}
              className="cursor-pointer field-sizing-content appearance-none bg-transparent pr-3.5 text-[10px] font-medium uppercase outline-none"
            >
              <option value="">Igual</option>
              <option value="dif">Diferente</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3" />
          </span>
        )}
      </div>
      <div className="relative">
        <select id={`filtro-${nome}`} name={nome} defaultValue={valor} className={`${estilo} appearance-none pr-7`}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-gray-500" />
      </div>
    </div>
  );
}

export const OPCOES_SITUACAO = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "ativos", rotulo: "Ativas" },
  { valor: "inativos", rotulo: "Inativas" },
];
