import { BotaoConfigurarListagem } from "@/components/listagem/botao-configurar-listagem";
import { cn } from "@/lib/cn";
import type { PreferenciaListagem } from "@/lib/listagem/telas";

export type Coluna<T> = {
  chave: string;
  titulo: React.ReactNode;
  alinhar?: "esquerda" | "direita" | "centro";
  render: (linha: T) => React.ReactNode;
};

/** Tabela padrão das listas, com linhas pares destacadas. */
export function Tabela<T>({ colunas, linhas, chaveLinha, vazio, compacta, destacarPares = true, configuracao }: {
  colunas: Coluna<T>[];
  linhas: T[];
  chaveLinha: (linha: T) => string | number;
  vazio?: React.ReactNode;
  /** Configurações da Listagem > Outros. */
  compacta?: boolean;
  destacarPares?: boolean;
  /** Põe a engrenagem das Configurações da Listagem no cabeçalho (na coluna "menu" ou numa célula a mais no fim). */
  configuracao?: { tela: string; pref: PreferenciaListagem };
}) {
  const engrenagem = configuracao ? <BotaoConfigurarListagem tela={configuracao.tela} pref={configuracao.pref} /> : null;
  const celulaExtra = !!configuracao && !colunas.some((c) => c.chave === "menu");
  const celula = compacta ? "px-3 py-1" : "px-4 py-2.5";
  const alinhamento = { esquerda: "text-left", direita: "text-right", centro: "text-center" } as const;
  return (
    <div className="relative overflow-x-auto rounded-xl border border-borda bg-white shadow-cartao">
      <table className="w-full text-sm">
        <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} className={cn(celula, "font-semibold", alinhamento[c.alinhar ?? "esquerda"])}>
                {c.chave === "menu" && engrenagem ? engrenagem : c.titulo}
              </th>
            ))}
            {celulaExtra && <th className={cn(celula, "text-right font-semibold")}>{engrenagem}</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={colunas.length + (celulaExtra ? 1 : 0)} className="px-4 py-10 text-center text-gray-500">
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
                {celulaExtra && <td className={celula} />}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
