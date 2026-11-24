import { cn } from "@/lib/cn";

export type Coluna<T> = {
  chave: string;
  titulo: React.ReactNode;
  alinhar?: "esquerda" | "direita" | "centro";
  render: (linha: T) => React.ReactNode;
};

/** Tabela padrão das listas, com linhas pares destacadas. */
export function Tabela<T>({ colunas, linhas, chaveLinha, vazio, compacta, destacarPares = true }: {
  colunas: Coluna<T>[];
  linhas: T[];
  chaveLinha: (linha: T) => string | number;
  vazio?: React.ReactNode;
  /** Configurações da Listagem > Outros. */
  compacta?: boolean;
  destacarPares?: boolean;
}) {
  const celula = compacta ? "px-3 py-1" : "px-4 py-2.5";
  const alinhamento = { esquerda: "text-left", direita: "text-right", centro: "text-center" } as const;
  return (
    <div className="relative overflow-x-auto rounded-xl border border-borda bg-white shadow-cartao">
      <table className="w-full text-sm">
        <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} className={cn(celula, "font-semibold", alinhamento[c.alinhar ?? "esquerda"])}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={colunas.length} className="px-4 py-10 text-center text-gray-500">
                {vazio ?? "Nenhum registro encontrado."}
              </td>
            </tr>
          ) : (
            linhas.map((linha) => (
              <tr key={chaveLinha(linha)} className={cn("border-b border-borda last:border-0 hover:bg-verde-claro/50", destacarPares && "even:bg-gray-50/70")}>
                {colunas.map((c) => (
                  <td key={c.chave} className={cn(celula, alinhamento[c.alinhar ?? "esquerda"])}>
                    {c.render(linha)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
