"use client";

import { BookOpen, Lightbulb, TriangleAlert } from "lucide-react";
import { TextoComDestaque } from "@/components/ui/campo";
import type { ArtigoAjuda, BlocoAjuda } from "@/lib/ajuda/tipos";

function Bloco({ bloco }: { bloco: BlocoAjuda }) {
  switch (bloco.tipo) {
    case "p":
      return (
        <p className="text-sm leading-relaxed text-gray-700">
          <TextoComDestaque texto={bloco.texto} />
        </p>
      );
    case "titulo":
      return (
        <h3 className="pt-2 text-sm font-semibold text-gray-900">
          <TextoComDestaque texto={bloco.texto} />
        </h3>
      );
    case "passos":
      return (
        <ol className="space-y-2.5">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-gray-700">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-verde text-xs font-semibold text-white" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <TextoComDestaque texto={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "lista":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-700 marker:text-verde">
          {bloco.itens.map((item, i) => (
            <li key={i}>
              <TextoComDestaque texto={item} />
            </li>
          ))}
        </ul>
      );
    case "dica":
      return (
        <div className="flex items-start gap-2 rounded-md bg-verde-claro px-3 py-2.5 text-sm leading-relaxed text-gray-800">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-verde" aria-hidden="true" />
          <p>
            <strong>Dica: </strong>
            <TextoComDestaque texto={bloco.texto} />
          </p>
        </div>
      );
    case "atencao":
      return (
        <div className="flex items-start gap-2 rounded-md border border-amarelo-borda bg-amarelo px-3 py-2.5 text-sm leading-relaxed text-amarelo-texto">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Atenção: </strong>
            <TextoComDestaque texto={bloco.texto} />
          </p>
        </div>
      );
    case "exemplo":
      return (
        <div className="overflow-hidden rounded-lg border border-borda">
          <p className="bg-subcabecalho px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{bloco.titulo}</p>
          <table className="w-full text-sm">
            <tbody>
              {bloco.linhas.map(([campo, valor], i) => (
                <tr key={i} className="border-t border-borda align-top">
                  <th scope="row" className="w-2/5 px-3 py-1.5 text-left font-semibold text-gray-800">
                    <TextoComDestaque texto={campo} />
                  </th>
                  <td className="px-3 py-1.5 text-gray-700">
                    <TextoComDestaque texto={valor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** Mostra um artigo da Central de Ajuda: título, resumo, blocos e "Veja também". */
export function LeitorArtigo({ artigo, todos, aoAbrir }: { artigo: ArtigoAjuda; todos: ArtigoAjuda[]; aoAbrir: (id: string) => void }) {
  const relacionados = (artigo.relacionados ?? []).map((id) => todos.find((a) => a.id === id)).filter((a): a is ArtigoAjuda => !!a);
  return (
    <article className="space-y-3">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">{artigo.titulo}</h2>
        <p className="mt-1 text-sm text-gray-500">{artigo.resumo}</p>
      </header>
      {artigo.blocos.map((b, i) => (
        <Bloco key={i} bloco={b} />
      ))}
      {relacionados.length > 0 && (
        <nav aria-label="Veja também" className="border-t border-borda pt-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Veja também</h3>
          <ul className="space-y-1">
            {relacionados.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => aoAbrir(r.id)} className="flex items-start gap-2 rounded-md px-2 py-1 text-left text-sm text-verde hover:bg-verde-claro hover:underline">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {r.titulo}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
