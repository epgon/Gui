import { BotaoFavorito } from "./botao-favorito";

/** Faixa branca abaixo da barra verde, com o título da tela e a estrela dos Favoritos. */
export function CabecalhoPagina({ titulo, trilha, acoes }: { titulo: string; trilha?: string; acoes?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-borda bg-subcabecalho px-6 py-3">
      <div>
        {trilha && <p className="text-xs text-gray-500">{trilha}</p>}
        <div className="flex items-center gap-1.5">
          <h1 className="text-lg font-semibold text-gray-900">{titulo}</h1>
          <BotaoFavorito />
        </div>
      </div>
      {acoes}
    </div>
  );
}
