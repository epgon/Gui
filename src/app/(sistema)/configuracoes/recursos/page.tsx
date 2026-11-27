import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { lerRecursos } from "@/lib/parametros/servidor";
import { TelaRecursos } from "./tela";

export const metadata = { title: "Recursos" };

export default async function PaginaRecursos() {
  const recursos = await lerRecursos();
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Recursos" trilha="Configurações" />
        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-600">Ativar e desativar recursos. O que estiver desativado some dos menus; nada é apagado, e ao ativar de novo tudo volta como estava.</p>
          <TelaRecursos recursos={recursos} />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
