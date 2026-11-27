"use client";

import { AlarmClock, ChevronDown, EyeOff, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { tratarAlerta } from "@/app/(sistema)/gestao/dividas/consultor/acoes";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { TextoComDestaque } from "@/components/ui/campo";
import { cn } from "@/lib/cn";
import { ROTULO_GRAVIDADE, type Alerta, type Gravidade } from "@/lib/dividas/consultor/regras";

/** Cores de gravidade da especificação: só a paleta do Gui (laranja, amarelo, azul e verde). */
const ESTILO: Record<Gravidade, { borda: string; pilula: string }> = {
  alta: { borda: "border-l-despesa", pilula: "bg-orange-100 text-despesa" },
  atencao: { borda: "border-l-amarelo-borda", pilula: "bg-amarelo text-amarelo-texto" },
  info: { borda: "border-l-receita", pilula: "bg-blue-50 text-receita" },
  boa: { borda: "border-l-pago-texto", pilula: "bg-pago-fundo text-pago-texto" },
};

export function PilulaGravidade({ gravidade }: { gravidade: Gravidade }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold", ESTILO[gravidade].pilula)}>{ROTULO_GRAVIDADE[gravidade]}</span>;
}

/** Cartão de um alerta: título, explicação, "Por quê?" com o cálculo, ação sugerida (só um link) e Dispensar / Lembrar em 7 dias. */
export function CartaoAlerta({ alerta, escondido, aoMudar }: { alerta: Alerta; escondido?: boolean; aoMudar: (acao: "dispensar" | "lembrar" | "restaurar") => void }) {
  const [aberto, setAberto] = useState(false);
  const e = ESTILO[alerta.gravidade];
  return (
    <article className={cn("rounded-xl border border-l-4 border-borda bg-white p-4 shadow-cartao", e.borda, escondido && "opacity-70")}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <PilulaGravidade gravidade={alerta.gravidade} />
            <span className="text-xs text-gray-400">{alerta.regra}</span>
          </p>
          <h3 className="mt-1 text-sm font-semibold text-gray-900">{alerta.titulo}</h3>
        </div>
        <MenuLinha
          rotulo={`o alerta ${alerta.regra}`}
          itens={
            escondido
              ? [{ rotulo: "Mostrar de novo", icone: <RotateCcw className="h-4 w-4" />, aoClicar: () => aoMudar("restaurar") }]
              : [
                  { rotulo: "Dispensar", icone: <EyeOff className="h-4 w-4" />, aoClicar: () => aoMudar("dispensar"), dica: "Esconde este alerta. Dá para trazê-lo de volta." },
                  { rotulo: "Lembrar em 7 dias", icone: <AlarmClock className="h-4 w-4" />, aoClicar: () => aoMudar("lembrar") },
                ]
          }
        />
      </header>
      <p className="mt-1 text-sm text-gray-600">{alerta.texto}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {alerta.acao && (
          <Link href={alerta.acao.href} className="inline-flex h-8 items-center rounded-md border border-verde px-3 text-sm font-semibold text-verde hover:bg-verde-claro">
            {alerta.acao.rotulo}
          </Link>
        )}
        <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-verde">
          Por quê? <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
        </button>
      </div>
      {aberto && (
        <div className="mt-3 rounded-lg bg-subcabecalho px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Como calculei</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
            {alerta.calculo.map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/** Lista de alertas da Visão Geral e do assunto "Alertas" do Consultor, com os dispensados e adiados numa gaveta. */
export function ListaAlertas({ visiveis, escondidos, vazio }: { visiveis: Alerta[]; escondidos: Alerta[]; vazio: string }) {
  const router = useRouter();
  const [mostrarEscondidos, setMostrarEscondidos] = useState(false);
  const [aviso, setAviso] = useState("");
  const [, iniciar] = useTransition();
  const mudar = (id: string) => (acao: "dispensar" | "lembrar" | "restaurar") =>
    iniciar(async () => {
      setAviso("");
      try {
        const r = await tratarAlerta(id, acao);
        if (!r.ok) return setAviso(r.erro);
        router.refresh();
      } catch {
        setAviso("Não foi possível guardar agora. Tente de novo.");
      }
    });
  return (
    <div className="space-y-3">
      <FaixaErro>{aviso && <TextoComDestaque texto={aviso} />}</FaixaErro>
      {visiveis.length === 0 ? <p className="rounded-xl border border-dashed border-borda bg-white py-6 text-center text-sm text-gray-500">{vazio}</p> : visiveis.map((a) => <CartaoAlerta key={a.id} alerta={a} aoMudar={mudar(a.id)} />)}
      {escondidos.length > 0 && (
        <div>
          <button type="button" onClick={() => setMostrarEscondidos((v) => !v)} className="text-sm font-medium text-gray-500 hover:text-verde">
            {mostrarEscondidos ? "Esconder" : "Mostrar"} {escondidos.length} {escondidos.length === 1 ? "alerta dispensado ou adiado" : "alertas dispensados ou adiados"}
          </button>
          {mostrarEscondidos && (
            <div className="mt-2 space-y-3">
              {escondidos.map((a) => (
                <CartaoAlerta key={a.id} alerta={a} escondido aoMudar={mudar(a.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
