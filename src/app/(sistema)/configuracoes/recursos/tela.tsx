"use client";

import { CalendarDays, CreditCard, FileDown, FileUp, Landmark, PiggyBank, Printer, Repeat, Sparkles, Tag, Users, Wallet } from "lucide-react";
import { useState, useTransition } from "react";
import { alterarRecurso } from "@/app/(sistema)/sistema-acoes";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { AVISO_PRIVACIDADE_IA } from "@/lib/dividas/consultor/ia/textos";
import { TextoComDestaque } from "@/components/ui/campo";
import { RECURSOS, type Recurso, type Recursos } from "@/lib/parametros/tipos";

const ICONES: Record<Recurso, React.ComponentType<{ className?: string }>> = {
  cartoes: CreditCard,
  recorrentes: Repeat,
  agenda: CalendarDays,
  contatos: Users,
  formas_pagamento: Wallet,
  tags: Tag,
  orcamentos: PiggyBank,
  dividas: Landmark,
  consultor_ia: Sparkles,
  importacao: FileUp,
  exportacao: FileDown,
  impressao: Printer,
};

export function TelaRecursos({ recursos }: { recursos: Recursos }) {
  const [ocupado, iniciar] = useTransition();
  const [mexendo, setMexendo] = useState<Recurso | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(false);
  const [ciente, setCiente] = useState(false);

  function mudar(chave: Recurso, ligado: boolean, cienteDoAviso = false) {
    setErro("");
    // O Consultor com IA só liga depois do aviso de privacidade.
    if (chave === "consultor_ia" && ligado && !cienteDoAviso) {
      setCiente(false);
      setAviso(true);
      return;
    }
    setMexendo(chave);
    iniciar(async () => {
      const r = await alterarRecurso(chave, ligado, cienteDoAviso).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      if (!r.ok) setErro(r.erro);
      setMexendo(null);
      setAviso(false);
    });
  }

  const coluna = (ligados: boolean) => {
    const itens = RECURSOS.filter((r) => recursos[r.chave] === ligados);
    return (
      <Cartao titulo={ligados ? `Ativados (${itens.length})` : `Desativados (${itens.length})`}>
        {itens.length === 0 && <p className="py-4 text-center text-sm text-gray-500">{ligados ? "Nenhum recurso ativado." : "Nenhum recurso desativado."}</p>}
        <ul className="divide-y divide-borda">
          {itens.map((r) => {
            const Icone = ICONES[r.chave];
            return (
              <li key={r.chave} className="flex items-center gap-3 py-3">
                <span className={ligados ? "flex h-9 w-9 items-center justify-center rounded-full bg-verde-claro text-verde" : "flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400"}>
                  <Icone className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800">{r.rotulo}</p>
                  <p className="text-xs text-gray-500">{r.descricao}</p>
                </div>
                <Chave ligada={ligados} desabilitada={ocupado && mexendo === r.chave} aoMudar={(v) => mudar(r.chave, v)} rotulo={ligados ? "Ativado" : "Desativado"} />
              </li>
            );
          })}
        </ul>
      </Cartao>
    );
  };

  return (
    <div className="space-y-4">
      <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      <div className="grid gap-4 lg:grid-cols-2">
        {coluna(true)}
        {coluna(false)}
      </div>
      <Modal
        aberto={aviso}
        aoFechar={() => setAviso(false)}
        titulo="Ligar o Consultor com IA"
        resumo="Etapa opcional: o Gui funciona inteiro sem ela."
        rodape={
          <>
            <Botao type="button" variante="secundario" onClick={() => setAviso(false)}>
              Voltar
            </Botao>
            <Botao type="button" disabled={!ciente} carregando={ocupado} onClick={() => mudar("consultor_ia", true, true)}>
              Ligar
            </Botao>
          </>
        }
      >
        <div className="space-y-3 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Aviso de privacidade</p>
          <ul className="list-disc space-y-2 pl-5">
            {AVISO_PRIVACIDADE_IA.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p>Depois de ligar, cadastre a chave da IA (passo a passo no README) e escolha o provedor em Parâmetros &gt; Consultor com IA. Sem chave, nada é enviado.</p>
          <label className="flex items-start gap-2 font-medium text-gray-800">
            <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} className="mt-0.5 h-4 w-4 accent-verde" />
            Li o aviso e quero ligar o Consultor com IA.
          </label>
        </div>
      </Modal>
    </div>
  );
}
