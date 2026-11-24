import { Filter } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

/** Painel da direita nas listas: "Filtros", com o botão Filtrar e o link Limpar. */
export function PainelFiltros({ caminho, children }: { caminho: string; children: React.ReactNode }) {
  return (
    <aside className="hidden w-72 shrink-0 border-l border-borda-painel bg-painel xl:block" aria-label="Filtros">
      <Form action={caminho} className="sticky top-14 space-y-4 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Filter className="h-4 w-4 text-verde" /> Filtros
        </h2>
        <div className="space-y-3">{children}</div>
        <div className="flex items-center gap-2">
          <button type="submit" className="h-9 flex-1 rounded-md bg-verde px-4 text-sm font-semibold text-white hover:bg-verde-escuro">
            Filtrar
          </button>
          <Link href={caminho} className="h-9 rounded-md px-3 text-sm leading-9 text-gray-600 hover:bg-gray-100">
            Limpar
          </Link>
        </div>
      </Form>
    </aside>
  );
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
