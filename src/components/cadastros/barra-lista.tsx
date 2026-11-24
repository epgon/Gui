"use client";

import { Plus, Search } from "lucide-react";
import Form from "next/form";
import { BotaoImprimir } from "@/components/exportacao/botao-imprimir";
import { ConfigurarListagem } from "@/components/listagem/configurar-listagem";
import { useComAvancado } from "@/components/listagem/use-avancado";
import { Botao } from "@/components/ui/botao";
import type { PreferenciaListagem } from "@/lib/listagem/telas";

/** Barra acima da tabela: Adicionar e busca rápida (mantém os outros filtros). */
export function BarraLista({ aoAdicionar, caminho, busca, parametros: proprios, extra, rotuloBusca = "Buscar", tela, preferencia, imprimir }: {
  aoAdicionar: () => void;
  caminho: string;
  busca: string;
  parametros: Record<string, string>;
  extra?: React.ReactNode;
  rotuloBusca?: string;
  /** Nome da lista na Impressão Padrão e exportação (mostra o botão Imprimir). */
  tela?: string;
  /** Configurações da Listagem (mostra a engrenagem). */
  preferencia?: PreferenciaListagem;
  /** Troca o botão Imprimir padrão (ex.: com a Impressão Personalizada). */
  imprimir?: React.ReactNode;
}) {
  const parametros = useComAvancado(proprios);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao icone={<Plus className="h-4 w-4" />} onClick={aoAdicionar}>
        Adicionar
      </Botao>
      {extra}
      {tela && (imprimir ?? <BotaoImprimir tela={tela} parametros={parametros} personalizada={!!preferencia} className="ml-auto" />)}
      {tela && preferencia && <ConfigurarListagem tela={tela} pref={preferencia} />}
      <Form action={caminho} className={`${tela ? "" : "ml-auto "}flex w-full items-center sm:w-72`} role="search">
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
