"use client";

import { Plus, Search } from "lucide-react";
import Form from "next/form";
import { Botao } from "@/components/ui/botao";

/** Barra acima da tabela: Adicionar e busca rápida (mantém os outros filtros). */
export function BarraLista({ aoAdicionar, caminho, busca, parametros, extra, rotuloBusca = "Buscar" }: {
  aoAdicionar: () => void;
  caminho: string;
  busca: string;
  parametros: Record<string, string>;
  extra?: React.ReactNode;
  rotuloBusca?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao icone={<Plus className="h-4 w-4" />} onClick={aoAdicionar}>
        Adicionar
      </Botao>
      {extra}
      <Form action={caminho} className="ml-auto flex w-full items-center sm:w-72" role="search">
        {Object.entries(parametros)
          .filter(([chave, valor]) => chave !== "busca" && chave !== "pagina" && valor)
          .map(([chave, valor]) => (
            <input key={chave} type="hidden" name={chave} value={valor} />
          ))}
        <label className="flex h-9 w-full items-center gap-2 rounded-md border border-borda bg-white px-3 text-sm focus-within:border-verde">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            name="busca"
            defaultValue={busca}
            key={busca}
            placeholder={rotuloBusca}
            aria-label={rotuloBusca}
            className="w-full bg-transparent outline-none placeholder:text-gray-400"
          />
        </label>
      </Form>
    </div>
  );
}
