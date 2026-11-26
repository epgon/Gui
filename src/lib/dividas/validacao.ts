import "server-only";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import type { Transacao } from "@/lib/auditoria";
import { falha, type Resultado } from "@/lib/cadastros/resultado";
import { dataValida } from "@/lib/datas";
import { lerValorEmCentavos } from "@/lib/dinheiro";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { exigirLogin } from "@/lib/sessao";

/** Validação e gravação em comum das ações de negociação e renegociação (mesmas mensagens e jeito de Dívidas). */

const { contato, contaFinanceira: conta, categoria, formaPagamento, dividaEvento } = schema;
export const MAXIMO_CENTAVOS = 99_999_999_999;

export class ErroFormulario extends Error {}
export const erro = (mensagem: string): never => {
  throw new ErroFormulario(mensagem);
};

export function lerValor(texto: string, campo: string, obrigatorio = true): number | null {
  if (!texto?.trim()) return obrigatorio ? erro(`Preencha o campo **${campo}**.`) : null;
  const centavos = lerValorEmCentavos(texto);
  if (centavos === null || centavos > MAXIMO_CENTAVOS) return erro(`Informe um valor válido no campo **${campo}** (ex.: 1.250,00).`);
  if (centavos <= 0) return erro(`O campo **${campo}** precisa ser maior que zero.`);
  return centavos;
}

/** Valor que pode ficar vazio ou zero (ex.: entrada). */
export function lerValorOuZero(texto: string, campo: string): number {
  if (!texto?.trim()) return 0;
  const centavos = lerValorEmCentavos(texto);
  if (centavos === null || centavos < 0 || centavos > MAXIMO_CENTAVOS) return erro(`Informe um valor válido no campo **${campo}** (ex.: 1.250,00).`);
  return centavos;
}

export function lerData(texto: string, campo: string, obrigatoria = true): string | null {
  if (!texto) return obrigatoria ? erro(`Preencha o campo **${campo}**.`) : null;
  if (!dataValida(texto)) return erro(`Informe uma data válida no campo **${campo}**.`);
  return texto;
}

export function lerTexto(texto: string, campo: string, maximo: number, obrigatorio = false): string | null {
  const limpo = (texto ?? "").trim();
  if (!limpo) return obrigatorio ? erro(`Preencha o campo **${campo}**.`) : null;
  if (limpo.length > maximo) return erro(`O campo **${campo}** aceita no máximo ${maximo} caracteres.`);
  return limpo;
}

export function lerPercentual(texto: string, campo: string, maximo = 100): number | null {
  const limpo = (texto ?? "").trim().replace("%", "").replace(",", ".");
  if (!limpo) return null;
  if (!/^\d+(\.\d{1,4})?$/.test(limpo) || Number(limpo) > maximo) return erro(`Informe uma porcentagem válida no campo **${campo}** (ex.: 2,99).`);
  return Number(limpo);
}

export function lerInteiro(texto: string, campo: string, minimo: number, maximo: number): number {
  const n = Number((texto ?? "").trim() === "" ? minimo : texto);
  if (!Number.isInteger(n) || n < minimo || n > maximo) return erro(`Informe de ${minimo} a ${maximo} no campo **${campo}**.`);
  return n;
}

export const lerId = (texto: string | number | null | undefined) => {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function conferirCredor(tx: Transacao, id: string): Promise<{ id: number; nome: string }> {
  const n = lerId(id);
  if (!n) return erro("Preencha o campo **Credor**.");
  const [c] = await tx.select({ id: contato.id, nome: contato.nome }).from(contato).where(eq(contato.id, n));
  return c ?? erro("Este **Credor** não existe mais.");
}

export async function conferirConta(tx: Transacao, id: string, campo = "Conta de Pagamento"): Promise<number> {
  const n = lerId(id);
  if (!n) return erro(`Preencha o campo **${campo}**.`);
  const [c] = await tx.select({ id: conta.id }).from(conta).where(eq(conta.id, n));
  return c ? n : erro(`Esta **${campo}** não existe mais.`);
}

export async function conferirCategoria(tx: Transacao, id: string): Promise<number> {
  const n = lerId(id);
  if (!n) return erro("Preencha o campo **Categoria**.");
  const [c] = await tx.select({ id: categoria.id, natureza: categoria.natureza }).from(categoria).where(eq(categoria.id, n));
  if (!c) return erro("Esta **Categoria** não existe mais.");
  if (c.natureza !== "despesa") return erro("Escolha uma categoria de **despesa** no campo **Categoria**.");
  return n;
}

export async function conferirForma(tx: Transacao, id: string): Promise<number | null> {
  if (!id) return null;
  const n = lerId(id);
  if (!n) return erro("Esta **Forma de Pagamento** não existe mais.");
  const [f] = await tx.select({ id: formaPagamento.id }).from(formaPagamento).where(eq(formaPagamento.id, n));
  return f ? n : erro("Esta **Forma de Pagamento** não existe mais.");
}

/** Resposta padrão das ações: converte os erros de formulário em faixa amarela. */
export async function executar<T extends Resultado>(corpo: () => Promise<T>): Promise<Resultado> {
  try {
    return await corpo();
  } catch (e) {
    if (e instanceof ErroFormulario) return falha(e.message);
    throw e;
  }
}

export async function exigirRecurso() {
  await exigirLogin();
  if (!(await recursoAtivo("dividas"))) throw new Error("A Gestão de Dívidas está desativada em Configurações > Recursos.");
}

/** Linha do histórico da dívida. */
export async function registrarEvento(tx: Transacao, dividaId: number, e: { data: string; tipo: (typeof dividaEvento.$inferInsert)["tipo"]; descricao: string; valorCentavos?: number | null; lancamentoId?: number | null; dados?: unknown }) {
  await tx.insert(dividaEvento).values({ dividaId, data: e.data, tipo: e.tipo, descricao: e.descricao, valorCentavos: e.valorCentavos ?? null, lancamentoId: e.lancamentoId ?? null, dados: e.dados ?? null });
}
