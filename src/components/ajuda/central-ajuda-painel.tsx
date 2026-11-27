"use client";

import { ArrowUpRight, ChevronRight, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { JanelaAjuda, SEM_RESULTADO } from "@/components/ajuda/central-ajuda";
import { artigosDaTela, buscarArtigos } from "@/lib/ajuda/busca";
import { ARTIGOS_DIVIDAS } from "@/lib/ajuda/dividas";
import { ASSUNTOS_AJUDA, type ArtigoAjuda, type TelaAjuda } from "@/lib/ajuda/tipos";

function BotaoArtigo({ titulo, aoClicar }: { titulo: string; aoClicar?: () => void }) {
  if (!aoClicar) {
    return (
      <span className="flex items-start gap-1.5 py-1 text-sm text-gray-500">
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        {titulo}
      </span>
    );
  }
  return (
    <button type="button" onClick={aoClicar} className="group flex w-full items-start gap-1.5 py-1 text-left text-sm text-verde">
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-verde" aria-hidden="true" />
      <span className="group-hover:underline">{titulo}</span>
    </button>
  );
}

/**
 * Conteúdo da "Central de Ajuda" no painel lateral: título, busca, trilha de onde você está
 * e a lista de artigos (os da tela primeiro, depois os outros assuntos).
 */
export function CentralAjudaPainel({ trilha, tela, artigos = [] }: {
  trilha: string[];
  tela: TelaAjuda | null;
  /** Títulos de artigos ainda não escritos (telas fora de Gestão de Dívidas). */
  artigos?: string[];
}) {
  const [busca, setBusca] = useState("");
  const [janela, setJanela] = useState<{ artigo?: string } | null>(null);
  const termo = busca.trim();
  const resultados = useMemo(() => (termo ? buscarArtigos(ARTIGOS_DIVIDAS, termo) : []), [termo]);
  const daTela = useMemo(() => (tela ? artigosDaTela(ARTIGOS_DIVIDAS, tela) : []), [tela]);
  const grupos = useMemo(() => {
    const idsDaTela = new Set(daTela.map((a) => a.id));
    return ASSUNTOS_AJUDA.map((s) => ({ ...s, lista: ARTIGOS_DIVIDAS.filter((a) => a.assunto === s.valor && !idsDaTela.has(a.id)) })).filter((g) => g.lista.length > 0);
  }, [daTela]);

  const abrir = (a: ArtigoAjuda) => <BotaoArtigo key={a.id} titulo={a.titulo} aoClicar={() => setJanela({ artigo: a.id })} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg text-gray-800">Central de Ajuda</h2>
        <p className="text-base text-verde">Como podemos ajudá-lo?</p>
      </div>
      <label className="flex h-9 items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm text-gray-700 focus-within:border-verde">
        <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite ou navegue" aria-label="Buscar artigos" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
      </label>
      <nav aria-label="Onde você está" className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-gray-500">
        {["Início", ...trilha].map((t) => (
          <Fragment key={t}>
            <span className="font-semibold text-gray-700">{t}</span>
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
          </Fragment>
        ))}
        <span>Artigos</span>
      </nav>
      <div className="rounded-lg border border-borda bg-white p-3 shadow-cartao">
        {termo ? (
          resultados.length ? (
            <div aria-label="Resultados da busca">{resultados.map(abrir)}</div>
          ) : (
            <p className="py-2 text-sm text-gray-500">{SEM_RESULTADO}</p>
          )
        ) : (
          <>
            {tela ? (
              <div>{daTela.map(abrir)}</div>
            ) : (
              <div>
                {artigos.map((a) => (
                  <BotaoArtigo key={a} titulo={a} />
                ))}
                <p className={artigos.length ? "mt-2 text-xs text-gray-500" : "text-sm text-gray-500"}>
                  Os artigos desta tela ainda estão sendo escritos. Use a busca para ver os artigos já disponíveis.
                </p>
              </div>
            )}
            {grupos.map((g) => (
              <section key={g.valor}>
                <h3 className="mt-3 text-xs font-medium text-gray-500">{g.sobre}</h3>
                <div className="pl-4">{g.lista.map(abrir)}</div>
              </section>
            ))}
          </>
        )}
      </div>
      <JanelaAjuda tela={tela ?? "visao"} artigoInicial={janela?.artigo} aberto={janela !== null} aoFechar={() => setJanela(null)} />
    </div>
  );
}
