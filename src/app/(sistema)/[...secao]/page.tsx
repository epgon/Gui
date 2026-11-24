import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { encontrarItem } from "@/lib/menu";

type Props = { params: Promise<{ secao: string[] }> };

/** Telas que ainda não foram construídas: mostram em qual fase chegam. */
export default async function EmConstrucao({ params }: Props) {
  const { secao } = await params;
  const item = encontrarItem("/" + secao.join("/"));
  if (!item) notFound();

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo={item.titulo} trilha={item.grupo} />
        <div className="p-6">
          <Cartao>
            <EstadoVazio
              titulo="Em construção"
              texto={
                <>
                  {item.descricao} Esta tela chega na <strong>Fase {item.fase}</strong> do plano.
                </>
              }
              acao={{ rotulo: "Voltar à Visão Geral", href: "/" }}
            />
          </Cartao>
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}

export async function generateMetadata({ params }: Props) {
  const { secao } = await params;
  return { title: encontrarItem("/" + secao.join("/"))?.titulo ?? "Página não encontrada" };
}
