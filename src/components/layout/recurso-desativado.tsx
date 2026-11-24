import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";

/** Tela de um recurso desligado em Configurações > Recursos. */
export function RecursoDesativado({ titulo, trilha }: { titulo: string; trilha: string }) {
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo={titulo} trilha={trilha} />
        <div className="p-6">
          <Cartao>
            <EstadoVazio
              titulo="Recurso desativado"
              texto={
                <>
                  <strong>{titulo}</strong> está desativado. Para usar de novo, ative em Configurações &gt; Recursos. Nada foi apagado.
                </>
              }
              acao={{ rotulo: "Ir para Recursos", href: "/configuracoes/recursos" }}
            />
          </Cartao>
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
