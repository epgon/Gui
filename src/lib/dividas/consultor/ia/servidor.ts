import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hojeIso } from "@/lib/datas";
import { lerParametros, recursoAtivo } from "@/lib/parametros/servidor";
import { acharProvedor } from "./provedores";
import type { DependenciasIA } from "./servico";
import type { ProvedorIA } from "./tipos";

const { consultorUsoIa } = schema;

/** A chave fica só na variável de ambiente (Vercel). Nunca no banco, no código ou no GitHub, e nunca é enviada para a tela. */
export function lerChaveIA(): string | null {
  const v = process.env.GUI_IA_CHAVE?.trim();
  return v ? v : null;
}

export type ConfigIA = {
  /** O recurso Consultor com IA está ligado. */
  ligado: boolean;
  provedor: ProvedorIA | null;
  provedorId: string;
  modelo: string;
  limiteDiario: number;
  usadasHoje: number;
  chaveCadastrada: boolean;
  /** Ligado, com provedor e (se precisar) chave: as perguntas livres vão para a IA. */
  pronto: boolean;
};

export async function lerUsoDoDia(dia: string): Promise<number> {
  const [l] = await getDb().select({ chamadas: consultorUsoIa.chamadas }).from(consultorUsoIa).where(eq(consultorUsoIa.dia, dia));
  return l?.chamadas ?? 0;
}

export async function lerConfigIA(hoje: string = hojeIso()): Promise<ConfigIA> {
  const [ligado, p] = await Promise.all([recursoAtivo("consultor_ia"), lerParametros()]);
  const provedor = acharProvedor(p.ia.provedor);
  const chaveCadastrada = lerChaveIA() !== null;
  return {
    ligado,
    provedor,
    provedorId: p.ia.provedor,
    modelo: p.ia.modelo,
    limiteDiario: p.ia.limiteDiario,
    usadasHoje: ligado ? await lerUsoDoDia(hoje) : 0,
    chaveCadastrada,
    pronto: ligado && provedor !== null && (!provedor.precisaChave || chaveCadastrada),
  };
}

/**
 * Reserva uma chamada do dia em uma única instrução (atômica): só incrementa se ainda estiver abaixo do limite.
 * Duas perguntas ao mesmo tempo não conseguem passar do limite.
 */
export async function reservarChamadaIA(dia: string, limite: number): Promise<boolean> {
  const r = await getDb()
    .insert(consultorUsoIa)
    .values({ dia, chamadas: 1 })
    .onConflictDoUpdate({ target: consultorUsoIa.dia, set: { chamadas: sql`${consultorUsoIa.chamadas} + 1` }, setWhere: lt(consultorUsoIa.chamadas, limite) })
    .returning({ chamadas: consultorUsoIa.chamadas });
  return r.length > 0;
}

export async function registrarFalhaIA(dia: string): Promise<void> {
  await getDb().update(consultorUsoIa).set({ falhas: sql`${consultorUsoIa.falhas} + 1` }).where(eq(consultorUsoIa.dia, dia)).catch(() => undefined);
}

/** As dependências reais do serviço de IA (provedor, chave, modelo e limite diário). */
export function dependenciasIA(cfg: ConfigIA, hoje: string): DependenciasIA {
  return {
    ativo: cfg.ligado,
    provedor: cfg.provedor,
    chave: lerChaveIA(),
    modelo: cfg.modelo,
    reservar: () => reservarChamadaIA(hoje, cfg.limiteDiario),
  };
}
