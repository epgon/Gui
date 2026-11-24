import { CheckCircle2, Circle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { Cartao } from "@/components/ui/cartao";

export const metadata = { title: "Visão Geral" };

const PRIMEIROS_PASSOS = [
  { texto: "Adicione uma Conta Financeira", href: "/cadastros/contas-financeiras" },
  { texto: "Defina suas Categorias", href: "/cadastros/categorias" },
  { texto: "Cadastre seu Cartão de Crédito", href: "/cadastros/cartoes-de-credito" },
  { texto: "Registre um Lançamento", href: "/financeiro/lancamentos" },
  { texto: "Crie um Lançamento Recorrente", href: "/financeiro/recorrentes" },
];

function saudacao() {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function VisaoGeral() {
  const sessao = await auth();
  const nome = sessao?.user?.name?.split(" ")[0] ?? "";
  const hoje = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Visão Geral" />
        <div className="space-y-5 p-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {saudacao()}, {nome}!
            </h2>
            <p className="text-sm text-gray-500 first-letter:uppercase">{hoje}</p>
          </div>

          <Cartao>
            <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_1fr]">
              <Image src="/gui-mascote.jpg" alt="Mascote Gui" width={300} height={164} className="h-auto w-52 mix-blend-multiply" priority />
              <div>
                <h3 className="text-lg font-semibold text-verde">Olá! Eu sou o Gui.</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Vou ajudar você a organizar suas finanças. O sistema está sendo construído por etapas: os menus já
                  estão no lugar e cada tela vai ganhando vida nas próximas fases.
                </p>
              </div>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-sm text-pago-texto">
                  <CheckCircle2 className="h-4 w-4" /> Entrar no sistema
                </li>
                {PRIMEIROS_PASSOS.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} className="flex items-center gap-2 text-sm text-gray-700 hover:text-verde">
                      <Circle className="h-4 w-4 text-gray-300" /> {p.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Cartao>
        </div>
      </main>
      <PainelAjuda artigos={["Como navegar pela interface", "Configurações iniciais e primeiro lançamento", "Cadastrar e organizar categorias"]} />
    </>
  );
}
