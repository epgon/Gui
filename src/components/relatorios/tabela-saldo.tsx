import type { SaldoDetalhado } from "@/lib/relatorios/regras";
import { ValorRelatorio } from "./comuns";

/** Tabela do Saldo Detalhado: primeira coluna conforme o relatório, depois Receitas, Despesas e Resultado. */
export function TabelaSaldo({ saldo, coluna, aviso }: { saldo: SaldoDetalhado; coluna: string; aviso?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-white shadow-cartao">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">{coluna}</th>
              <th className="px-4 py-2.5 text-right font-semibold text-receita">Receitas</th>
              <th className="px-4 py-2.5 text-right font-semibold text-despesa">Despesas</th>
              <th className="px-4 py-2.5 text-right font-semibold">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {saldo.linhas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  Nenhum lançamento no período com esses filtros.
                </td>
              </tr>
            ) : (
              saldo.linhas.map((l) => (
                <tr key={l.chave} className="border-b border-borda/70 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      {l.cor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.cor }} />}
                      {l.rotulo}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ValorRelatorio centavos={l.receitas} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ValorRelatorio centavos={l.despesas} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ValorRelatorio centavos={l.resultado} className="font-semibold" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {saldo.total && (
            <tfoot>
              <tr className="border-t border-amarelo-borda bg-amarelo font-semibold">
                <td className="px-4 py-2.5 text-amarelo-texto">Total do Período</td>
                <td className="px-4 py-2.5 text-right">
                  <ValorRelatorio centavos={saldo.total.receitas} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ValorRelatorio centavos={saldo.total.despesas} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ValorRelatorio centavos={saldo.total.resultado} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {aviso && <p className="border-t border-amarelo-borda bg-amarelo px-4 py-2 text-sm text-amarelo-texto">{aviso}</p>}
    </div>
  );
}
