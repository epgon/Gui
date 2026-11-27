"use client";

import { ArrowDown, ArrowUp, Lock, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { salvarAparenciaListagens, salvarPreferenciaListagem } from "@/app/(sistema)/listagem-acoes";
import { useSistema } from "@/components/layout/provedor-sistema";
import { Chave } from "@/components/ui/chave";
import { cn } from "@/lib/cn";
import { camposDeOrdenacao, POR_PAGINA_OPCOES, preferenciaPadrao, TELAS_LISTAGEM, type Destaques, type Ordenacao, type PreferenciaListagem } from "@/lib/listagem/telas";
import { useRotuloAuxiliar } from "./use-rotulo-auxiliar";

type Aba = "colunas" | "ordenacao" | "outros";
type Resposta = { ok: boolean; erro?: string };

const ROTULO_DESTAQUES: { chave: keyof Destaques; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Registros de Hoje" },
  { chave: "vencidos", rotulo: "Registros Vencidos" },
  { chave: "situacao", rotulo: "Situação dos Registros" },
];

const subtitulo = "text-sm text-gray-500";

/**
 * Conteúdo do painel "Configurações da Listagem": Colunas, Ordenação e Outros.
 * Cada mudança vale na hora (estado local otimista e gravação no servidor, sem botão Salvar).
 */
export function PainelConfiguracao({ tela, pref, aoFechar }: { tela: string; pref: PreferenciaListagem; aoFechar: () => void }) {
  const def = TELAS_LISTAGEM[tela];
  const { parametros } = useSistema();
  const rotuloAux = useRotuloAuxiliar(tela);
  const [d, setD] = useState(pref);
  const [aba, setAba] = useState<Aba>("colunas");
  const [erro, setErro] = useState("");
  if (!def) return null;

  const auxLigado = def.auxiliar ? parametros.camposAuxiliares[def.auxiliar].ativo : false;
  const rotulo = (chave: string, padrao: string) => (chave === "auxiliar" ? rotuloAux : padrao);
  const colunas = def.colunas.filter((c) => c.chave !== "auxiliar" || auxLigado || d.colunas.includes("auxiliar"));
  const campos = camposDeOrdenacao(def).filter((c) => c.chave !== "auxiliar" || auxLigado);

  /** Mostra a mudança já, grava no servidor e, se não der, volta ao que estava. */
  async function aplicar(novo: PreferenciaListagem, gravar: () => Promise<Resposta>) {
    const anterior = d;
    setD(novo);
    setErro("");
    try {
      const r = await gravar();
      if (!r.ok) {
        setD(anterior);
        setErro(r.erro ?? "Não foi possível salvar.");
      }
    } catch {
      setD(anterior);
      setErro("Sem conexão. Tente de novo.");
    }
  }
  const mudar = (parcial: Partial<PreferenciaListagem>) => {
    const novo = { ...d, ...parcial };
    return aplicar(novo, () => salvarPreferenciaListagem(tela, novo));
  };
  const mudarAparencia = (parcial: Partial<Pick<PreferenciaListagem, "destacarPares" | "compactar">>) => {
    const novo = { ...d, ...parcial };
    return aplicar(novo, () => salvarAparenciaListagens({ destacarPares: novo.destacarPares, compactar: novo.compactar }));
  };

  const abas: { chave: Aba; rotulo: string }[] = [
    { chave: "colunas", rotulo: "Colunas" },
    ...(def.semOrdenacao ? [] : [{ chave: "ordenacao" as const, rotulo: "Ordenação" }]),
    { chave: "outros", rotulo: "Outros" },
  ];
  const padrao = preferenciaPadrao(tela);
  const botaoRestaurar = (aoClicar: () => void) => (
    <button
      type="button"
      onClick={aoClicar}
      className="mt-4 inline-flex h-8 items-center gap-1.5 rounded border border-borda bg-white px-3 text-xs text-gray-700 shadow-sm hover:bg-gray-50"
    >
      <RotateCcw className="h-3 w-3 text-verde" />
      Restaurar Padrão
    </button>
  );

  const ativas = d.ordenacao;
  const livres = campos.filter((c) => !ativas.some((o) => o.campo === c.chave));
  const trocarDirecao = (campo: string) =>
    mudar({ ordenacao: ativas.map((o): Ordenacao => (o.campo === campo ? { campo, direcao: o.direcao === "asc" ? "desc" : "asc" } : o)) });

  return (
    <div className="text-sm text-gray-800">
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 className="text-lg font-normal text-gray-800">Configurações da Listagem</h2>
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded p-1 text-gray-500 hover:bg-white hover:text-gray-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-5 flex gap-4 border-b border-borda-painel" role="tablist">
        {abas.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            aria-selected={aba === a.chave}
            onClick={() => setAba(a.chave)}
            className={cn("-mb-px border-b-2 pb-1.5 text-[13px]", aba === a.chave ? "border-verde font-medium text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900")}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "colunas" && (
        <div>
          <p className={cn(subtitulo, "mb-3")}>Defina quais colunas ficarão visíveis</p>
          <ul className="space-y-0.5">
            {colunas.map((c) => (
              <li key={c.chave} className="py-0.5">
                <Chave
                  tamanho="p"
                  desabilitada={c.fixa}
                  ligada={!!c.fixa || d.colunas.includes(c.chave)}
                  aoMudar={(v) => mudar({ colunas: v ? [...d.colunas, c.chave] : d.colunas.filter((k) => k !== c.chave) })}
                  rotulo={
                    <span className="flex items-center gap-1.5 text-gray-800">
                      {rotulo(c.chave, c.rotulo)}
                      {c.fixa && <Lock className="h-3 w-3 text-despesa" aria-label="Coluna fixa" />}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
          {botaoRestaurar(() => mudar({ colunas: padrao.colunas }))}
        </div>
      )}

      {aba === "ordenacao" && (
        <div>
          <p className={cn(subtitulo, "mb-3")}>Ordenando por</p>
          {ativas.length === 0 ? (
            <p className="mb-1 text-xs text-gray-400">Nenhum campo escolhido: vale a ordem padrão da lista.</p>
          ) : (
            <ul className="mb-1 space-y-0.5">
              {ativas.map((o, i) => {
                const c = campos.find((x) => x.chave === o.campo);
                const crescente = o.direcao === "asc";
                return (
                  <li key={o.campo} className="flex items-center gap-2.5 py-0.5">
                    <Chave tamanho="p" ligada rotulo="" aoMudar={() => mudar({ ordenacao: ativas.filter((x) => x.campo !== o.campo) })} />
                    <span className="-ml-2 w-3 text-xs text-gray-500">{i + 1}</span>
                    <span>{rotulo(o.campo, c?.rotulo ?? o.campo)}</span>
                    <button
                      type="button"
                      onClick={() => trocarDirecao(o.campo)}
                      title={crescente ? "Crescente" : "Decrescente"}
                      aria-label={`${rotulo(o.campo, c?.rotulo ?? o.campo)}: ${crescente ? "crescente" : "decrescente"}. Clique para inverter.`}
                      className="rounded p-0.5 text-receita hover:bg-white"
                    >
                      {crescente ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={cn(subtitulo, "mt-5 mb-3")}>Escolha os campos para ordenação</p>
          <ul className="space-y-0.5">
            {livres.map((c) => (
              <li key={c.chave} className="py-0.5">
                <Chave tamanho="p" ligada={false} rotulo={<span className="text-gray-800">{rotulo(c.chave, c.rotulo)}</span>} aoMudar={() => mudar({ ordenacao: [...ativas, { campo: c.chave, direcao: "asc" }] })} />
              </li>
            ))}
          </ul>
          {botaoRestaurar(() => mudar({ ordenacao: padrao.ordenacao }))}
        </div>
      )}

      {aba === "outros" && (
        <div className="space-y-6">
          <div>
            <p className={cn(subtitulo, "mb-2")}>Registros por Página</p>
            <div className="inline-flex overflow-hidden rounded border border-borda bg-white shadow-sm" role="group" aria-label="Registros por Página">
              {POR_PAGINA_OPCOES.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={d.porPagina === n}
                  onClick={() => mudar({ porPagina: n })}
                  className={cn("h-8 min-w-9 border-r border-borda px-2.5 text-xs last:border-r-0", d.porPagina === n ? "bg-verde-claro font-semibold text-verde" : "text-gray-700 hover:bg-gray-50")}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Chave tamanho="p" ligada={d.semPaginacao} aoMudar={(v) => mudar({ semPaginacao: v })} rotulo="Sem Paginação" />
            </div>
          </div>

          <div>
            <p className={cn(subtitulo, "mb-2")}>Aparência em Todas as Listagens</p>
            <ul className="space-y-0.5">
              <li className="py-0.5">
                <Chave tamanho="p" ligada={d.destacarPares} aoMudar={(v) => mudarAparencia({ destacarPares: v })} rotulo="Destacar Linhas Pares" />
              </li>
              <li className="py-0.5">
                <Chave tamanho="p" ligada={d.compactar} aoMudar={(v) => mudarAparencia({ compactar: v })} rotulo="Compactar Linhas" />
              </li>
            </ul>
          </div>

          {def.destaques && (
            <div>
              <p className={cn(subtitulo, "mb-2")}>Destacar Nesta Listagem</p>
              <ul className="space-y-0.5">
                {ROTULO_DESTAQUES.map((x) => (
                  <li key={x.chave} className="py-0.5">
                    <Chave tamanho="p" ligada={d.destaques[x.chave]} aoMudar={(v) => mudar({ destaques: { ...d.destaques, [x.chave]: v } })} rotulo={x.rotulo} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-4 text-xs text-negativo">
          {erro}
        </p>
      )}
    </div>
  );
}
