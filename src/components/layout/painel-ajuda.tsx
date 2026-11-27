import { PainelLateral } from "@/components/layout/painel-lateral";

/** Painel da direita só com a "Central de Ajuda" (telas sem filtros). Os artigos são títulos ainda sem texto. */
export function PainelAjuda({ artigos = [], trilha }: { artigos?: string[]; trilha?: string[] }) {
  return <PainelLateral inicial="ajuda" artigos={artigos} trilha={trilha} />;
}
