import "server-only";
import { lerConfiguracoes } from "@/lib/parametros/servidor";
import { normalizarImpressoes, type Personalizacao } from "./tabela";

export const chaveImpressoes = (tela: string) => `impressoes.${tela}`;

/** Impressões Personalizadas guardadas para uma lista (até 10). */
export async function lerImpressoesSalvas(tela: string): Promise<Personalizacao[]> {
  return normalizarImpressoes((await lerConfiguracoes())[chaveImpressoes(tela)]);
}
