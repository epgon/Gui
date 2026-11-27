"use client";

import { ArrowLeft, BookOpen, CircleHelp, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LeitorArtigo } from "@/components/ajuda/leitor-artigo";
import { Modal } from "@/components/ui/modal";
import { artigosDaTela, buscarArtigos } from "@/lib/ajuda/busca";
import { ARTIGOS_DIVIDAS } from "@/lib/ajuda/dividas";
import { ASSUNTOS_AJUDA, type ArtigoAjuda, type TelaAjuda } from "@/lib/ajuda/tipos";

const SEM_RESULTADO = "Nenhum artigo encontrado. Tente outra palavra, como cartão, empréstimo ou acordo.";

function ItemArtigo({ artigo, aoAbrir }: { artigo: ArtigoAjuda; aoAbrir: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => aoAbrir(artigo.id)} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-verde-claro">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-verde" aria-hidden="true" />
        <span>
          <span className="block text-sm font-medium text-gray-900">{artigo.titulo}</span>
          <span className="block text-xs text-gray-500">{artigo.resumo}</span>
        </span>
      </button>
    </li>
  );
}

function CorpoJanela({ tela, artigoInicial, aoFechar }: { tela: TelaAjuda; artigoInicial?: string; aoFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(artigoInicial && ARTIGOS_DIVIDAS.some((a) => a.id === artigoInicial) ? artigoInicial : null);
  const area = useRef<HTMLDivElement>(null);
  const artigo = aberto ? ARTIGOS_DIVIDAS.find((a) => a.id === aberto) : undefined;
  const termo = busca.trim();
  const resultados = useMemo(() => (termo ? buscarArtigos(ARTIGOS_DIVIDAS, termo) : []), [termo]);
  const daTela = useMemo(() => artigosDaTela(ARTIGOS_DIVIDAS, tela), [tela]);

  const abrir = (id: string) => {
    setAberto(id);
    area.current?.scrollTo({ top: 0 });
  };

  return (
    <Modal aberto aoFechar={aoFechar} largura="larga" titulo="Central de Ajuda" resumo="Gestão de Dívidas">
      <div className="space-y-4">
        <label className="flex h-9 items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm text-gray-700 focus-within:border-verde">
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(null);
            }}
            placeholder="Buscar artigos (ex.: cartão atrasado, financiamento)"
            aria-label="Buscar artigos"
            className="w-full bg-transparent outline-none placeholder:text-gray-400"
          />
        </label>
        <div ref={area} className="max-h-[70vh] overflow-y-auto pr-1">
          {artigo ? (
            <div className="space-y-4">
              <button type="button" onClick={() => setAberto(null)} className="inline-flex items-center gap-1 text-sm font-medium text-verde hover:underline">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar à lista
              </button>
              <LeitorArtigo artigo={artigo} todos={ARTIGOS_DIVIDAS} aoAbrir={abrir} />
            </div>
          ) : termo ? (
            resultados.length ? (
              <ul className="space-y-1" aria-label="Resultados da busca">
                {resultados.map((a) => (
                  <ItemArtigo key={a.id} artigo={a} aoAbrir={abrir} />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-borda py-8 text-center text-sm text-gray-500">{SEM_RESULTADO}</p>
            )
          ) : (
            <div className="space-y-5">
              {daTela.length > 0 && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Nesta tela</h3>
                  <ul className="space-y-1">
                    {daTela.map((a) => (
                      <ItemArtigo key={a.id} artigo={a} aoAbrir={abrir} />
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Todos os artigos</h3>
                <div className="space-y-3">
                  {ASSUNTOS_AJUDA.map((s) => {
                    const lista = ARTIGOS_DIVIDAS.filter((a) => a.assunto === s.valor);
                    if (!lista.length) return null;
                    return (
                      <div key={s.valor}>
                        <h4 className="px-2 text-sm font-semibold text-gray-800">{s.rotulo}</h4>
                        <ul className="space-y-1">
                          {lista.map((a) => (
                            <ItemArtigo key={a.id} artigo={a} aoAbrir={abrir} />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Janela "Central de Ajuda" da Gestão de Dívidas: busca, artigos da tela e todos os artigos por assunto. */
export function JanelaAjuda({ tela, artigoInicial, aberto, aoFechar }: { tela: TelaAjuda; artigoInicial?: string; aberto: boolean; aoFechar: () => void }) {
  // Só existe enquanto está aberta: cada abertura começa do zero (sem busca, no artigo pedido).
  if (!aberto) return null;
  return <CorpoJanela tela={tela} artigoInicial={artigoInicial} aoFechar={aoFechar} />;
}

/** Botão pequeno "Ajuda", ao lado das abas. Aceita ?ajuda=<id> no endereço para abrir direto num artigo. */
export function BotaoAjuda({ tela }: { tela: TelaAjuda }) {
  const [aberto, setAberto] = useState(false);
  const [artigo, setArtigo] = useState<string | undefined>(undefined);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ajuda");
    if (id && ARTIGOS_DIVIDAS.some((a) => a.id === id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setArtigo(id);
      setAberto(true);
    }
  }, []);

  return (
    <>
      <button type="button" onClick={() => { setArtigo(undefined); setAberto(true); }} className="-mb-px ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-verde hover:text-verde-escuro hover:underline">
        <CircleHelp className="h-4 w-4" aria-hidden="true" /> Ajuda
      </button>
      <JanelaAjuda tela={tela} artigoInicial={artigo} aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
  );
}

/** Painel da direita das telas de dívidas: busca que funciona e atalhos para os artigos da tela. */
export function PainelAjudaDividas({ tela, trilha = [] }: { tela: TelaAjuda; trilha?: string[] }) {
  const [busca, setBusca] = useState("");
  const [janela, setJanela] = useState<{ artigo?: string } | null>(null);
  const termo = busca.trim();
  const lista = useMemo(() => (termo ? buscarArtigos(ARTIGOS_DIVIDAS, termo) : artigosDaTela(ARTIGOS_DIVIDAS, tela)).slice(0, 8), [termo, tela]);
  return (
    <>
      <aside className="hidden w-72 shrink-0 border-l border-borda-painel bg-painel xl:block" aria-label="Central de Ajuda">
        <div className="sticky top-14 space-y-4 p-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Central de Ajuda</h2>
            <p className="text-xs text-gray-500">Como podemos ajudá-lo?</p>
          </div>
          {trilha.length > 0 && (
            <nav aria-label="Onde você está" className="text-xs text-gray-500">
              {["Início", ...trilha].join(" > ")}
            </nav>
          )}
          <label className="flex h-9 items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm text-gray-700 focus-within:border-verde">
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar artigos" aria-label="Buscar artigos" className="w-full bg-transparent outline-none placeholder:text-gray-400" />
          </label>
          {lista.length > 0 ? (
            <ul className="space-y-1">
              {lista.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setJanela({ artigo: a.id })} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-white hover:text-verde">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-verde" aria-hidden="true" />
                    {a.titulo}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">{SEM_RESULTADO}</p>
          )}
          <button type="button" onClick={() => setJanela({})} className="text-sm font-semibold text-verde hover:underline">
            Ver todos os artigos
          </button>
        </div>
      </aside>
      <JanelaAjuda tela={tela} artigoInicial={janela?.artigo} aberto={janela !== null} aoFechar={() => setJanela(null)} />
    </>
  );
}
