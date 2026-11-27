import type { ArtigoAjuda } from "../tipos";
import { ARTIGOS_CASOS } from "./casos";
import { ARTIGOS_TELAS } from "./telas";

/** Todos os artigos da Central de Ajuda da Gestão de Dívidas. */
export const ARTIGOS_DIVIDAS: ArtigoAjuda[] = [...ARTIGOS_CASOS, ...ARTIGOS_TELAS];

export { ARTIGOS_CASOS, ARTIGOS_TELAS };
