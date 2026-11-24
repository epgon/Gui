import { BookOpen } from "lucide-react";
import Link from "next/link";
import { FiltroSelecao, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { formatarCentavos } from "@/lib/dinheiro";
import { cn } from "@/lib/cn";
import type { Opcoes } from "@/lib/lancamentos/tipos";

/** Primeira etapa dos relatórios: cartões para escolher o tipo. */
export function EscolhaRelatorio({ titulo, caminho, nome, opcoes, icones }: {
  titulo: string;
  caminho: string;
  nome: string;
  opcoes: { valor: string; rotulo: string; texto: string }[];
  icones: Record<string, React.ReactNode>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-gray-800">{titulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {opcoes.map((o) => (
          <Link
            key={o.valor}
            href={`${caminho}?${nome}=${o.valor}`}
            className="group flex items-start gap-3 rounded-xl border border-borda bg-white p-4 shadow-cartao transition hover:border-verde hover:bg-verde-claro"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-verde-claro text-verde group-hover:bg-white">{icones[o.valor]}</span>
            <span>
              <span className="block font-semibold text-gray-900">{o.rotulo}</span>
              <span className="block text-sm text-gray-500">{o.texto}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Painel de filtros da direita (igual nos dois relatórios). */
export function PainelFiltrosRelatorio({ caminho, mantidos, opcoes, valores }: {
  caminho: string;
  mantidos: Record<string, string>;
  opcoes: Opcoes;
  valores: { categoria: string; forma: string; contato: string; tag: string };
}) {
  const todas = { valor: "", rotulo: "Todas" };
  return (
    <PainelFiltros caminho={caminho} limpar={`${caminho}?${new URLSearchParams(Object.entries(mantidos).filter(([k, v]) => v && k !== "categoria" && k !== "forma" && k !== "contato" && k !== "tag")).toString()}`}>
      {Object.entries(mantidos)
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <FiltroSelecao
        nome="categoria"
        rotulo="Categorias"
        valor={valores.categoria}
        opcoes={[todas, ...opcoes.categorias.map((c) => ({ valor: String(c.id), rotulo: "  ".repeat(c.nivel - 1) + c.rotulo }))]}
      />
      <FiltroSelecao nome="forma" rotulo="Formas de Pagamento" valor={valores.forma} opcoes={[todas, ...opcoes.formas.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
      <FiltroSelecao nome="contato" rotulo="Clientes e Fornecedores" valor={valores.contato} opcoes={[{ valor: "", rotulo: "Todos" }, ...opcoes.contatos.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
      <FiltroSelecao nome="tag" rotulo="Tags" valor={valores.tag} opcoes={[todas, ...opcoes.tags.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
      <p className="text-xs text-gray-500">A categoria escolhida inclui as filhas dela.</p>
    </PainelFiltros>
  );
}

/** Valor do relatório: azul positivo, vermelho negativo, cinza zerado; centavos menores. */
export function ValorRelatorio({ centavos, className }: { centavos: number; className?: string }) {
  const [inteiro, decimal] = formatarCentavos(centavos).split(",");
  return (
    <span className={cn("tabular-nums", centavos === 0 ? "text-gray-400" : centavos < 0 ? "text-negativo" : "text-receita", className)}>
      {inteiro}
      <span className="text-[0.75em]">,{decimal}</span>
    </span>
  );
}

/** Artigos de ajuda da coluna direita (quando o painel de filtros não aparece). */
export function DicasRelatorio({ itens }: { itens: string[] }) {
  return (
    <ul className="space-y-1 rounded-xl border border-borda bg-white p-4 text-sm text-gray-600 shadow-cartao">
      {itens.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-verde" />
          {t}
        </li>
      ))}
    </ul>
  );
}
