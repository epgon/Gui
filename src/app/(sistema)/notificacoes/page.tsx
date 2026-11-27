import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { calcularNotificacoes } from "@/lib/notificacoes/servidor";
import { TelaNotificacoes } from "./tela";

export const metadata = { title: "Notificações" };

export default async function PaginaNotificacoes() {
  const { lista, lidas } = await calcularNotificacoes();
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Notificações" trilha="Configurações" />
        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-600">Acompanhe o que pede a sua atenção: contas vencidas ou vencendo, faturas, orçamentos ultrapassados e importações paradas.</p>
          <TelaNotificacoes lista={lista.map((n) => ({ ...n, lida: lidas.includes(n.id) }))} />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
