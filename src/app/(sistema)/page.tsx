import { count, eq, ne } from "drizzle-orm";
import { CheckCircle2, Circle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { Cartao } from "@/components/ui/cartao";
import { getDb, schema } from "@/db";
import { cn } from "@/lib/cn";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { hojeIso } from "@/lib/datas";
import { carregarPainel } from "@/lib/visao-geral/servidor";
import { CabecalhoVisaoGeral, TelaVisaoGeral } from "@/components/visao-geral/tela";

export const metadata = { title: "Visão Geral" };

type Passo = { texto: string; href: string; feito: boolean; emBreve?: string };

/** Confere no banco quais primeiros passos já foram dados. */
async function primeirosPassos(): Promise<Passo[]> {
  const db = getDb();
  const { contaFinanceira, cartaoCredito, auditoria, lancamento, recorrencia } = schema;
  const [[contas], [cartoes], [categorias], [lancamentos], [recorrentes]] = await Promise.all([
    db.select({ total: count() }).from(contaFinanceira),
    db.select({ total: count() }).from(cartaoCredito),
    // "Definir as categorias" = ter criado, editado ou inativado alguma.
    db.select({ total: count() }).from(auditoria).where(eq(auditoria.entidade, "Categoria")),
    db.select({ total: count() }).from(lancamento).where(ne(lancamento.tipo, "saldo_inicial")),
    db.select({ total: count() }).from(recorrencia),
  ]);
  return [
    { texto: "Entrar no sistema", href: "/", feito: true },
    { texto: "Adicione uma Conta Financeira", href: "/cadastros/contas-financeiras", feito: contas.total > 0 },
    { texto: "Defina suas Categorias", href: "/cadastros/categorias", feito: categorias.total > 0 },
    { texto: "Cadastre seu Cartão de Crédito", href: "/cadastros/cartoes-de-credito", feito: cartoes.total > 0 },
    { texto: "Registre um Lançamento", href: "/financeiro/lancamentos", feito: lancamentos.total > 0 },
    { texto: "Crie um Lançamento Recorrente", href: "/financeiro/recorrentes", feito: recorrentes.total > 0 },
  ];
}

function saudacao() {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function avisoDoDia(vencendo: { valorCentavos: number }[]) {
  const pagar = vencendo.filter((l) => l.valorCentavos < 0).length;
  const receber = vencendo.length - pagar;
  if (!pagar && !receber) return { texto: "Não há nada a pagar no dia de hoje.", alerta: false };
  const partes = [
    pagar ? `${pagar} ${pagar === 1 ? "conta vence" : "contas vencem"} hoje` : "",
    receber ? `${receber} ${receber === 1 ? "recebimento previsto" : "recebimentos previstos"} para hoje` : "",
  ].filter(Boolean);
  return { texto: partes.join(" e ") + ".", alerta: pagar > 0 };
}

export default async function VisaoGeral() {
  const sessao = await auth();
  const nome = sessao?.user?.name?.split(" ")[0] ?? "";
  const hoje = hojeIso();
  const dataExtenso = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date());
  // "Realizar automaticamente" dos lançamentos e recorrentes que venceram até hoje.
  await realizarAutomaticos(hoje).catch(() => 0);
  const [passos, painel] = await Promise.all([primeirosPassos(), carregarPainel(hoje)]);
  const feitos = passos.filter((p) => p.feito).length;

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Visão Geral" />
        <div className="space-y-4 p-6">
          <CabecalhoVisaoGeral saudacao={`${saudacao()}${nome ? `, ${nome}` : ""}!`} data={dataExtenso} aviso={avisoDoDia(painel.prazos.vencendo.linhas)} />

          {feitos < passos.length && (
            <Cartao>
              <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_1fr]">
                <Image src="/gui-mascote.jpg" alt="Mascote Gui" width={300} height={164} className="h-auto w-44 mix-blend-multiply" priority />
                <div>
                  <h3 className="text-lg font-semibold text-verde">Olá! Eu sou o Gui.</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Vou ajudar você a organizar suas finanças. Comece pelos cadastros: suas contas com o saldo de hoje,
                    seus cartões e as categorias do seu jeito. Depois, registre o dia a dia em Financeiro &gt; Lançamentos.
                  </p>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={passos.length}
                      aria-valuenow={feitos}
                      aria-label="Primeiros passos"
                    >
                      <div className="h-full rounded-full bg-verde-vivo" style={{ width: `${(feitos / passos.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-500">
                      {feitos} de {passos.length}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {passos.map((p) => (
                      <li key={p.texto}>
                        <Link
                          href={p.href}
                          className={cn(
                            "flex items-center gap-2 text-sm",
                            p.feito ? "text-pago-texto" : p.emBreve ? "text-gray-400" : "text-gray-700 hover:text-verde",
                          )}
                        >
                          {p.feito ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-gray-300" />}
                          <span>{p.texto}</span>
                          {p.emBreve && <span className="text-xs">({p.emBreve})</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Cartao>
          )}

          <TelaVisaoGeral painel={painel} hoje={hoje} />
        </div>
      </main>
      <PainelAjuda artigos={["Como navegar pela interface", "Visão Geral: o que cada cartão mostra", "Configurações iniciais e primeiro lançamento"]} />
    </>
  );
}
