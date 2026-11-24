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

const estilo = "h-9 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none focus:border-verde";

/** Campo de texto do painel de filtros (envia pela URL). */
export function FiltroTexto({ nome, rotulo, valor }: { nome: string; rotulo: string; valor: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{rotulo}</span>
      <input name={nome} defaultValue={valor} className={estilo} />
    </label>
  );
}

/** Lista de opções do painel de filtros. */
export function FiltroSelecao({ nome, rotulo, valor, opcoes }: {
  nome: string;
  rotulo: string;
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{rotulo}</span>
      <select name={nome} defaultValue={valor} className={estilo}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

export const OPCOES_SITUACAO = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "ativos", rotulo: "Ativas" },
  { valor: "inativos", rotulo: "Inativas" },
];
