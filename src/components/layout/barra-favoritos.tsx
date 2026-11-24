import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileUp,
  FolderTree,
  Home,
  Landmark,
  ListChecks,
  PiggyBank,
  Repeat,
  ScrollText,
  Settings,
  Star,
  Tag,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { encontrarItem } from "@/lib/menu";

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  "/financeiro/lancamentos": ListChecks,
  "/financeiro/agenda": CalendarDays,
  "/financeiro/recorrentes": Repeat,
  "/financeiro/importacoes": FileUp,
  "/gestao/orcamentos": PiggyBank,
  "/relatorios/fluxo-de-caixa": BarChart3,
  "/relatorios/saldo-detalhado": BarChart3,
  "/cadastros/contas-financeiras": Landmark,
  "/cadastros/cartoes-de-credito": CreditCard,
  "/cadastros/categorias": FolderTree,
  "/cadastros/clientes-e-fornecedores": Users,
  "/cadastros/formas-de-pagamento": Wallet,
  "/cadastros/tags": Tag,
  "/administracao/meus-dados": UserRound,
  "/administracao/auditoria": ScrollText,
};

/** Barra estreita da esquerda: Visão Geral e as telas marcadas com a estrela. */
export function BarraFavoritos({ favoritos }: { favoritos: string[] }) {
  return (
    <aside className="hidden w-11 shrink-0 flex-col items-center gap-1 border-r border-borda bg-white py-3 md:flex" aria-label="Favoritos">
      <Link href="/" className="rounded-md p-2 text-gray-500 hover:bg-verde-claro hover:text-verde" title="Visão Geral">
        <Home className="h-4.5 w-4.5" />
      </Link>
      <span className="my-1 h-px w-6 bg-borda" />
      {favoritos.length === 0 && (
        <span className="rounded-md p-2 text-gray-300" title="Favoritos: clique na estrela ao lado do título de uma tela para ela aparecer aqui.">
          <Star className="h-4.5 w-4.5" />
        </span>
      )}
      {favoritos.map((href) => {
        const item = encontrarItem(href);
        if (!item) return null;
        const Icone = ICONES[href] ?? Settings;
        return (
          <Link key={href} href={href} className="rounded-md p-2 text-gray-500 hover:bg-verde-claro hover:text-verde" title={item.titulo}>
            <Icone className="h-4.5 w-4.5" />
          </Link>
        );
      })}
    </aside>
  );
}
