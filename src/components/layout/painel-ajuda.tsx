import { PainelLateral } from "@/components/layout/painel-lateral";

/** Painel da direita só com a "Central de Ajuda" (telas sem filtros). */
export function PainelAjuda() {
  return <PainelLateral inicial="ajuda" />;
}
