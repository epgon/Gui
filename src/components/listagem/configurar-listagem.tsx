"use client";

import { Info, Lock, RotateCcw, Settings2 } from "lucide-react";
import { useState } from "react";
import { restaurarPreferenciaListagem, salvarPreferenciaListagem } from "@/app/(sistema)/listagem-acoes";
import { useSistema } from "@/components/layout/provedor-sistema";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { POR_PAGINA_OPCOES, TELAS_LISTAGEM, type PreferenciaListagem } from "@/lib/listagem/telas";

/** Nome do Campo Auxiliar escolhido em Parâmetros (ex.: "Agência e conta"). */
export function useRotuloAuxiliar(tela: string): string {
  const { parametros } = useSistema();
  const aux = TELAS_LISTAGEM[tela]?.auxiliar;
  return aux ? parametros.camposAuxiliares[aux].rotulo : "Campo Auxiliar";
}

/** Engrenagem acima da tabela: Configurações da Listagem (Colunas, Ordenação e Outros). */
export function ConfigurarListagem({ tela, pref }: { tela: string; pref: PreferenciaListagem }) {
  const def = TELAS_LISTAGEM[tela];
  const { parametros } = useSistema();
  const rotuloAux = useRotuloAuxiliar(tela);
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"colunas" | "ordenacao" | "outros">("colunas");
  const [d, setD] = useState(pref);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  if (!def) return null;
  const auxLigado = def.auxiliar ? parametros.camposAuxiliares[def.auxiliar].ativo : false;
  const rotulo = (chave: string, padrao: string) => (chave === "auxiliar" ? rotuloAux : padrao);
  const colunas = def.colunas.filter((c) => c.chave !== "auxiliar" || auxLigado || d.colunas.includes("auxiliar"));
  const campos = def.campos.filter((c) => c.chave !== "auxiliar" || auxLigado);

  async function executar(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setOcupado(true);
    setErro("");
    try {
      const r = await acao();
      if (r.ok) setAberto(false);
      else setErro(r.erro ?? "Não foi possível salvar.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  type Aba = "colunas" | "ordenacao" | "outros";
  const abas: { chave: Aba; rotulo: string }[] = [
    { chave: "colunas", rotulo: "Colunas" },
    { chave: "ordenacao", rotulo: "Ordenação" },
    { chave: "outros", rotulo: "Outros" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setD(pref);
          setAba("colunas");
          setErro("");
          setAberto(true);
        }}
        title="Configurações da Listagem"
        aria-label="Configurações da Listagem"
        className="inline-flex h-9 items-center rounded-md border border-borda bg-white px-2.5 text-gray-600 hover:bg-gray-50"
      >
        <Settings2 className="h-4 w-4" />
      </button>
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Configurações da Listagem"
        resumo={def.titulo}
        rodape={
          <>
            <Botao variante="fantasma" className="mr-auto" icone={<RotateCcw className="h-4 w-4" />} onClick={() => executar(() => restaurarPreferenciaListagem(tela))} disabled={ocupado}>
              Restaurar Padrão
            </Botao>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Voltar
            </Botao>
            <Botao carregando={ocupado} onClick={() => executar(() => salvarPreferenciaListagem(tela, d))}>
              Salvar
            </Botao>
          </>
        }
      >
        <div className="mb-4 flex gap-1 border-b border-borda" role="tablist">
          {abas.map((a) => (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={aba === a.chave}
              onClick={() => setAba(a.chave)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", aba === a.chave ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800")}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {aba === "colunas" && (
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {colunas.map((c) => (
              <li key={c.chave} className="flex items-center justify-between gap-2 border-b border-borda py-2.5">
                <span className="text-sm text-gray-800">{rotulo(c.chave, c.rotulo)}</span>
                {c.fixa ? (
                  <span className="flex items-center gap-1 text-xs text-gray-400" title="Coluna fixa">
                    <Lock className="h-3.5 w-3.5" /> Fixa
                  </span>
                ) : (
                  <Chave
                    ligada={d.colunas.includes(c.chave)}
                    aoMudar={(v) => setD((x) => ({ ...x, colunas: v ? [...x.colunas, c.chave] : x.colunas.filter((k) => k !== c.chave) }))}
                    rotulo=""
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {aba === "ordenacao" && def.semOrdenacao && <NaoSeAplica o="Ordenação" />}
        {aba === "ordenacao" && !def.semOrdenacao && (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              rotulo="Ordenar por"
              valor={d.ordenacao?.campo ?? ""}
              aoMudar={(v) => setD((x) => ({ ...x, ordenacao: v ? { campo: v, direcao: x.ordenacao?.direcao ?? "asc" } : null }))}
              opcoes={[{ valor: "", rotulo: "Padrão (ativos primeiro, em ordem alfabética)" }, ...campos.map((c) => ({ valor: c.chave, rotulo: rotulo(c.chave, c.rotulo) }))]}
            />
            <CampoSelecao
              rotulo="Direção"
              desabilitado={!d.ordenacao}
              valor={d.ordenacao?.direcao ?? "asc"}
              aoMudar={(v) => setD((x) => ({ ...x, ordenacao: x.ordenacao ? { ...x.ordenacao, direcao: v === "desc" ? "desc" : "asc" } : null }))}
              opcoes={[
                { valor: "asc", rotulo: "Crescente (A a Z, menor primeiro)" },
                { valor: "desc", rotulo: "Decrescente (Z a A, maior primeiro)" },
              ]}
            />
          </div>
        )}

        {aba === "outros" && (
          <div className="space-y-4">
            {/* Lista em árvore (Categorias): ordem própria e sem paginação. */}
            {def.semOrdenacao ? (
              <NaoSeAplica o="Paginação" />
            ) : (
              <CampoSelecao
                className="sm:w-64"
                rotulo="Registros por página"
                valor={String(d.porPagina)}
                aoMudar={(v) => setD((x) => ({ ...x, porPagina: Number(v) }))}
                opcoes={POR_PAGINA_OPCOES.map((n) => ({ valor: String(n), rotulo: `${n} registros` }))}
              />
            )}
            <div className="flex flex-col gap-3">
              <Chave ligada={d.destacarPares} aoMudar={(v) => setD((x) => ({ ...x, destacarPares: v }))} rotulo="Destacar linhas pares (zebrado)" />
              <Chave ligada={d.compactar} aoMudar={(v) => setD((x) => ({ ...x, compactar: v }))} rotulo="Compactar linhas (mais registros na tela)" />
            </div>
          </div>
        )}
        <FaixaErro className="mt-3">{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </Modal>
    </>
  );
}

/** Aviso das abas que não valem para a tela (ex.: Ordenação em Categorias, que segue a árvore). */
function NaoSeAplica({ o }: { o: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-gray-600">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-receita" />
      <span>
        As configurações de <strong>{o}</strong> não se aplicam nesta tela.
      </span>
    </p>
  );
}
