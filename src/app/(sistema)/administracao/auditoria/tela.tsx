"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Paginacao } from "@/components/cadastros/paginacao";
import { ConfigurarListagem } from "@/components/listagem/configurar-listagem";
import { Tabela, type Coluna } from "@/components/ui/tabela";
import { linhasDosDados } from "@/lib/auditoria-dados";
import { cn } from "@/lib/cn";
import { colunasVisiveis, type PreferenciaListagem } from "@/lib/listagem/telas";

type Linha = { id: number; quando: string; tela: string; entidade: string; entidadeId: number | null; acao: string; descricao: string; dados: unknown };

const COR_ACAO: Record<string, string> = {
  cadastrou: "bg-pago-fundo text-pago-texto",
  alterou: "bg-blue-50 text-receita",
  ativou: "bg-pago-fundo text-pago-texto",
  inativou: "bg-gray-100 text-gray-600",
  excluiu: "bg-red-50 text-negativo",
  pagou: "bg-verde-claro text-verde",
  importou: "bg-amarelo text-amarelo-texto",
  renegociou: "bg-amarelo text-amarelo-texto",
  aprovou: "bg-pago-fundo text-pago-texto",
};

const fuso = { timeZone: "America/Sao_Paulo" } as const;
const diaDe = (d: Date) => new Intl.DateTimeFormat("en-CA", { ...fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** "Hoje às 20:32", "Ontem às 09:10" ou "12/11/2026 às 14:00". */
function quandoLegivel(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const hora = new Intl.DateTimeFormat("pt-BR", { ...fuso, hour: "2-digit", minute: "2-digit" }).format(d);
  const dia = diaDe(d);
  if (dia === diaDe(agora)) return `Hoje às ${hora}`;
  if (dia === diaDe(new Date(agora.getTime() - 86_400_000))) return `Ontem às ${hora}`;
  return `${new Intl.DateTimeFormat("pt-BR", { ...fuso, dateStyle: "short" }).format(d)} às ${hora}`;
}

export function TelaAuditoria({ linhas, total, pagina, preferencia, caminho, parametros }: {
  linhas: Linha[];
  total: number;
  pagina: number;
  preferencia: PreferenciaListagem;
  caminho: string;
  parametros: Record<string, string>;
}) {
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const alternar = (id: number) => setAbertas((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const mostrarDados = preferencia.colunas.includes("dados");

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-sm text-amarelo-texto">Os registros ficam disponíveis por 6 meses.</p>
        <ConfigurarListagem tela="auditoria" pref={preferencia} />
      </div>
      <Tabela
        linhas={linhas}
        chaveLinha={(l) => l.id}
        compacta={preferencia.compactar}
        destacarPares={preferencia.destacarPares}
        vazio="Nenhum registro encontrado com esses filtros."
        colunas={colunasVisiveis<Coluna<Linha>>(
          "auditoria",
          [
            {
              chave: "abrir",
              titulo: <span className="sr-only">Abrir</span>,
              render: (l) =>
                mostrarDados && linhasDosDados(l.dados).length > 0 ? (
                  <button type="button" onClick={() => alternar(l.id)} className="rounded border border-borda p-0.5 text-gray-500 hover:bg-gray-100" aria-expanded={abertas.has(l.id)} aria-label="Ver os dados">
                    {abertas.has(l.id) ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                ) : null,
            },
            { chave: "horario", titulo: "Data", render: (l) => <span className="whitespace-nowrap text-gray-600">{quandoLegivel(l.quando)}</span> },
            {
              chave: "descricao",
              titulo: "Registro",
              render: (l) => (
                <span>
                  <span className="font-semibold text-verde">Você</span>{" "}
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", COR_ACAO[l.acao] ?? "bg-gray-100 text-gray-600")}>{l.acao}</span> {l.descricao}
                </span>
              ),
            },
            {
              chave: "dados",
              titulo: "Dados",
              render: (l) => {
                const dados = linhasDosDados(l.dados);
                if (!dados.length) return <span className="text-gray-400">—</span>;
                const visiveis = abertas.has(l.id) ? dados : dados.slice(0, 2);
                return (
                  <dl className="space-y-0.5 text-xs">
                    {visiveis.map((d, i) => (
                      <div key={i} className="flex flex-wrap gap-1">
                        <dt className="text-gray-500">{d.campo}:</dt>
                        <dd className="text-verde-vivo">
                          {d.antes !== undefined && (
                            <>
                              <span className="text-gray-400 line-through">{d.antes}</span> →{" "}
                            </>
                          )}
                          {d.valor}
                        </dd>
                      </div>
                    ))}
                    {!abertas.has(l.id) && dados.length > 2 && (
                      <button type="button" className="text-xs font-semibold text-verde hover:underline" onClick={() => alternar(l.id)}>
                        + {dados.length - 2} campo(s)
                      </button>
                    )}
                  </dl>
                );
              },
            },
            { chave: "tela", titulo: "Tela", render: (l) => l.tela },
            { chave: "acao", titulo: "Ação", render: (l) => l.acao },
            { chave: "codigo", titulo: "Código", alinhar: "direita", render: (l) => <span className="tabular-nums text-gray-500">{l.entidadeId ?? ""}</span> },
          ],
          preferencia,
        )}
      />
      <Paginacao caminho={caminho} parametros={parametros} pagina={pagina} porPagina={preferencia.porPagina} total={total} />
    </>
  );
}
