"use client";

import { Lock, Mail, RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { entrar, type EstadoLogin } from "./acoes";

export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado.erro && (
        <FaixaErro>
          {estado.erro}
          {estado.tipo === "sistema" && (
            <button type="submit" className="ml-2 inline-flex items-center gap-1 font-semibold underline">
              <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          )}
        </FaixaErro>
      )}

      <Campo icone={<Mail className="h-4 w-4" />} rotulo="E-mail" nome="email" tipo="email" autoComplete="username" valorInicial={estado.email} />
      <Campo icone={<Lock className="h-4 w-4" />} rotulo="Senha" nome="senha" tipo="password" autoComplete="current-password" />

      <Botao type="submit" carregando={enviando} className="h-11 w-full text-base">
        {enviando ? "Verificando acesso..." : "Entrar"}
      </Botao>
    </form>
  );
}

function Campo({ icone, rotulo, nome, tipo, autoComplete, valorInicial }: {
  icone: React.ReactNode;
  rotulo: string;
  nome: string;
  tipo: string;
  autoComplete: string;
  valorInicial?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {rotulo} <span className="text-despesa">*</span>
      </span>
      <span className="flex h-11 items-center gap-2 rounded-md border border-borda bg-white px-3 text-gray-400 focus-within:border-verde focus-within:ring-2 focus-within:ring-verde/20">
        {icone}
        <input name={nome} type={tipo} defaultValue={valorInicial} autoComplete={autoComplete} required className="h-full w-full bg-transparent text-gray-900 outline-none" />
      </span>
    </label>
  );
}
