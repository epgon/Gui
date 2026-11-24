"use client";

import { FileText, LayoutTemplate, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { excluirImpressao, salvarImpressao } from "@/app/(sistema)/impressao-acoes";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, CampoTexto, Rotulo, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { ListaOrdenavel } from "@/components/ui/lista-ordenavel";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { MAXIMO_COLUNAS_PERSONALIZADA, type Personalizacao } from "@/lib/exportacao/tabela";

type ColunaInfo = { titulo: string; extra: boolean; largura: number; direita: boolean };
type Dados = { titulo: string; orientacao: "retrato" | "paisagem"; colunas: ColunaInfo[]; previa: string[][]; salvas: Personalizacao[] };

/**
 * Impressão Personalizada: Nome da Impressão, Orientação, Campos (arraste para ordenar),
 * Ordenação dos Dados e Configurar Layout (largura das colunas na folha).
 */
export function ImpressaoPersonalizada({ tela, endereco, aoGerar, aoFechar }: {
  tela: string;
  /** Endereço que devolve os campos ("formato=colunas"), com os filtros da tela. */
  endereco: string;
  aoGerar: (p: Personalizacao) => void;
  aoFechar: () => void;
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [p, setP] = useState<Personalizacao>({ nome: "Personalizado", orientacao: "retrato", colunas: [], larguras: [], ordenar: null, direcao: "asc" });
  const [guardar, setGuardar] = useState(false);
  const [layout, setLayout] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(endereco, { cache: "no-store" })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok || !corpo) return setErro(corpo?.erro ?? "Não foi possível carregar os campos.");
        const d = corpo as Dados;
        setDados(d);
        const padrao = d.colunas.filter((c) => !c.extra);
        setP((x) => ({ ...x, orientacao: d.orientacao, colunas: padrao.map((c) => c.titulo), larguras: padrao.map((c) => c.largura) }));
      })
      .catch(() => vivo && setErro("Sem conexão com o servidor. Confira a internet e tente de novo."));
    return () => {
      vivo = false;
    };
  }, [endereco]);

  const largura = (titulo: string) => p.larguras[p.colunas.indexOf(titulo)] ?? 1;
  const disponiveis = dados?.colunas.filter((c) => !p.colunas.includes(c.titulo)) ?? [];

  function usar(s: Personalizacao) {
    const existentes = new Set(dados?.colunas.map((c) => c.titulo));
    const colunas = s.colunas.filter((c) => existentes.has(c));
    setP({ ...s, colunas, larguras: colunas.map((c) => s.larguras[s.colunas.indexOf(c)] ?? 1), ordenar: s.ordenar && colunas.includes(s.ordenar) ? s.ordenar : null });
    setGuardar(false);
  }

  async function gerar() {
    setErro("");
    if (!p.colunas.length) return setErro("Escolha pelo menos um campo em **Campos**.");
    if (guardar) {
      setOcupado(true);
      const r = await salvarImpressao(tela, p).catch(() => ({ ok: false as const, erro: "Não foi possível guardar a impressão." }));
      setOcupado(false);
      if (!r.ok) return setErro(r.erro);
    }
    aoGerar(p);
  }

  async function apagar(nome: string) {
    const r = await excluirImpressao(tela, nome).catch(() => ({ ok: false as const, erro: "Não foi possível apagar." }));
    if (!r.ok) return setErro(r.erro);
    setDados((d) => (d ? { ...d, salvas: d.salvas.filter((s) => s.nome !== nome) } : d));
  }

  return (
    <>
      <Modal
        aberto
        largura="larga"
        aoFechar={aoFechar}
        titulo="Impressão Personalizada"
        resumo={dados?.titulo}
        rodape={
          <>
            <Botao variante="secundario" className="mr-auto" icone={<LayoutTemplate className="h-4 w-4" />} disabled={!dados || !p.colunas.length} onClick={() => setLayout(true)}>
              Configurar Layout
            </Botao>
            <Botao variante="secundario" onClick={aoFechar}>
              Voltar
            </Botao>
            <Botao icone={<FileText className="h-4 w-4" />} onClick={gerar} carregando={ocupado} disabled={!dados}>
              Gerar
            </Botao>
          </>
        }
      >
        {!dados && !erro && <p className="py-6 text-center text-sm text-gray-500">Carregando os campos...</p>}
        {dados && (
          <div className="space-y-4">
            {dados.salvas.length > 0 && (
              <div>
                <Rotulo texto="Impressões guardadas" />
                <ul className="flex flex-wrap gap-2">
                  {dados.salvas.map((s) => (
                    <li key={s.nome} className="flex items-center rounded-full border border-borda bg-white text-sm">
                      <button type="button" className="rounded-l-full px-3 py-1 hover:bg-verde-claro" onClick={() => usar(s)}>
                        {s.nome}
                      </button>
                      <button type="button" className="rounded-r-full px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-despesa" onClick={() => apagar(s.nome)} aria-label={`Apagar ${s.nome}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto rotulo="Nome da Impressão" maxLength={60} valor={p.nome} aoMudar={(v) => setP((x) => ({ ...x, nome: v }))} ajuda={'Vira o título da folha ("Personalizado" mantém o nome da lista).'} />
              <CampoSelecao
                rotulo="Orientação"
                valor={p.orientacao}
                aoMudar={(v) => setP((x) => ({ ...x, orientacao: v === "paisagem" ? "paisagem" : "retrato" }))}
                opcoes={[
                  { valor: "retrato", rotulo: "Retrato (em pé)" },
                  { valor: "paisagem", rotulo: "Paisagem (deitada)" },
                ]}
              />
            </div>
            <div>
              <Rotulo texto="Campos" obrigatorio ajuda="Arraste (ou use as setas) para mudar a ordem das colunas." />
              <ListaOrdenavel
                itens={p.colunas}
                chave={(c) => c}
                conteudo={(c) => c}
                aoMudar={(nova) => setP((x) => ({ ...x, colunas: nova, larguras: nova.map((c) => x.larguras[x.colunas.indexOf(c)] ?? 1) }))}
                extra={(c) => (
                  <button
                    type="button"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-despesa"
                    aria-label={`Tirar ${c}`}
                    onClick={() => setP((x) => ({ ...x, colunas: x.colunas.filter((y) => y !== c), larguras: x.larguras.filter((_, i) => x.colunas[i] !== c), ordenar: x.ordenar === c ? null : x.ordenar }))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                vazio="Nenhum campo escolhido."
              />
              {disponiveis.length > 0 && p.colunas.length < MAXIMO_COLUNAS_PERSONALIZADA && (
                <select
                  className="mt-2 h-9 w-full rounded-md border border-borda bg-white px-3 text-sm sm:w-72"
                  value=""
                  aria-label="Adicionar campo"
                  onChange={(e) => {
                    const c = dados.colunas.find((x) => x.titulo === e.target.value);
                    if (c) setP((x) => ({ ...x, colunas: [...x.colunas, c.titulo], larguras: [...x.larguras, c.largura] }));
                  }}
                >
                  <option value="">+ Adicionar campo...</option>
                  {disponiveis.map((c) => (
                    <option key={c.titulo} value={c.titulo}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoSelecao
                rotulo="Ordenação dos Dados"
                valor={p.ordenar ?? ""}
                aoMudar={(v) => setP((x) => ({ ...x, ordenar: v || null }))}
                opcoes={[{ valor: "", rotulo: "A mesma da lista" }, ...p.colunas.map((c) => ({ valor: c, rotulo: c }))]}
              />
              <CampoSelecao
                rotulo="Direção"
                desabilitado={!p.ordenar}
                valor={p.direcao}
                aoMudar={(v) => setP((x) => ({ ...x, direcao: v === "desc" ? "desc" : "asc" }))}
                opcoes={[
                  { valor: "asc", rotulo: "Crescente" },
                  { valor: "desc", rotulo: "Decrescente" },
                ]}
              />
            </div>
            <Chave ligada={guardar} aoMudar={setGuardar} rotulo="Guardar esta impressão para usar de novo (pelo nome)" />
          </div>
        )}
        <FaixaErro className="mt-3">{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </Modal>

      {layout && dados && (
        <ConfigurarLayout
          titulo={p.nome && p.nome !== "Personalizado" ? p.nome : dados.titulo}
          orientacao={p.orientacao}
          colunas={p.colunas.map((t) => ({ titulo: t, largura: largura(t), direita: dados.colunas.find((c) => c.titulo === t)?.direita ?? false }))}
          previa={dados.previa.map((linha) => p.colunas.map((t) => linha[dados.colunas.findIndex((c) => c.titulo === t)] ?? ""))}
          aoMudarOrientacao={(o) => setP((x) => ({ ...x, orientacao: o }))}
          aoConcluir={(larguras) => {
            setP((x) => ({ ...x, larguras }));
            setLayout(false);
          }}
          aoVoltar={() => setLayout(false)}
        />
      )}
    </>
  );
}

/**
 * Configurando Layout: a folha (Retrato ou Paisagem) com o título e as colunas.
 * Arraste as linhas tracejadas entre as colunas para mudar a largura.
 */
function ConfigurarLayout({ titulo, orientacao, colunas, previa, aoMudarOrientacao, aoConcluir, aoVoltar }: {
  titulo: string;
  orientacao: "retrato" | "paisagem";
  colunas: { titulo: string; largura: number; direita: boolean }[];
  previa: string[][];
  aoMudarOrientacao: (o: "retrato" | "paisagem") => void;
  aoConcluir: (larguras: number[]) => void;
  aoVoltar: () => void;
}) {
  const [larguras, setLarguras] = useState(colunas.map((c) => c.largura));
  const folha = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ i: number; x: number; base: number[] } | null>(null);
  const soma = larguras.reduce((s, x) => s + x, 0);

  function iniciar(i: number, e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arraste.current = { i, x: e.clientX, base: [...larguras] };
  }
  function mover(e: React.PointerEvent) {
    const a = arraste.current;
    const el = folha.current;
    if (!a || !el) return;
    const total = a.base.reduce((s, x) => s + x, 0);
    // Quanto do total a linha andou: tira de uma coluna e põe na do lado (a soma não muda).
    const delta = ((e.clientX - a.x) / el.clientWidth) * total;
    const minimo = 0.3;
    const esq = Math.max(minimo, Math.min(a.base[a.i] + a.base[a.i + 1] - minimo, a.base[a.i] + delta));
    const nova = [...a.base];
    nova[a.i + 1] = a.base[a.i] + a.base[a.i + 1] - esq;
    nova[a.i] = esq;
    setLarguras(nova.map((x) => Math.round(x * 100) / 100));
  }

  return (
    <Modal
      aberto
      largura="larga"
      aoFechar={aoVoltar}
      titulo="Configurando Layout"
      resumo="Arraste as linhas tracejadas entre as colunas para mudar a largura."
      rodape={
        <>
          <Botao variante="fantasma" className="mr-auto" onClick={() => setLarguras(colunas.map(() => 1))}>
            Larguras iguais
          </Botao>
          <Botao variante="secundario" onClick={aoVoltar}>
            Voltar
          </Botao>
          <Botao onClick={() => aoConcluir(larguras)}>Concluir</Botao>
        </>
      }
    >
      <div className="mb-3 flex gap-1 text-sm" role="radiogroup" aria-label="Orientação">
        {(["retrato", "paisagem"] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={orientacao === o}
            onClick={() => aoMudarOrientacao(o)}
            className={cn("rounded-md border px-3 py-1.5", orientacao === o ? "border-verde bg-verde-claro font-semibold text-verde" : "border-borda text-gray-600 hover:bg-gray-50")}
          >
            {o === "retrato" ? "Retrato" : "Paisagem"}
          </button>
        ))}
      </div>
      <div className="flex justify-center overflow-auto rounded-md bg-gray-100 p-4">
        <div
          ref={folha}
          onPointerMove={mover}
          onPointerUp={() => (arraste.current = null)}
          className={cn("relative bg-white p-4 shadow-md", orientacao === "paisagem" ? "aspect-[297/210] w-full max-w-[760px]" : "aspect-[210/297] w-full max-w-[520px]")}
        >
          <p className="mb-2 border-b-2 border-verde pb-1 text-sm font-bold text-verde">{titulo}</p>
          <div className="relative">
            <div className="flex border-b border-gray-300 bg-gray-50 text-[10px] font-semibold uppercase text-gray-600">
              {colunas.map((c, i) => (
                <div key={c.titulo} className={cn("truncate px-1 py-1", c.direita && "text-right")} style={{ width: `${(larguras[i] / soma) * 100}%` }}>
                  {c.titulo}
                </div>
              ))}
            </div>
            {previa.map((linha, li) => (
              <div key={li} className="flex border-b border-gray-100 text-[10px] text-gray-700">
                {linha.map((cel, i) => (
                  <div key={i} className={cn("truncate px-1 py-0.5", colunas[i]?.direita && "text-right")} style={{ width: `${(larguras[i] / soma) * 100}%` }}>
                    {cel}
                  </div>
                ))}
              </div>
            ))}
            {previa.length === 0 && <p className="py-3 text-center text-[10px] text-gray-400">A lista está vazia com esses filtros.</p>}
            {/* Linhas guia tracejadas entre as colunas: dá para arrastar. */}
            {colunas.slice(0, -1).map((c, i) => {
              const pos = (larguras.slice(0, i + 1).reduce((s, x) => s + x, 0) / soma) * 100;
              return (
                <div
                  key={c.titulo}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Largura entre ${c.titulo} e ${colunas[i + 1].titulo}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                    const passo = (e.key === "ArrowRight" ? 0.1 : -0.1) * soma;
                    setLarguras((l) => {
                      const esq = Math.max(0.3, Math.min(l[i] + l[i + 1] - 0.3, l[i] + passo));
                      const nova = [...l];
                      nova[i + 1] = Math.round((l[i] + l[i + 1] - esq) * 100) / 100;
                      nova[i] = Math.round(esq * 100) / 100;
                      return nova;
                    });
                  }}
                  onPointerDown={(e) => iniciar(i, e)}
                  className="absolute top-0 bottom-0 -ml-1.5 w-3 cursor-col-resize touch-none focus:outline-none"
                  style={{ left: `${pos}%` }}
                >
                  <div className="mx-auto h-full w-0 border-l border-dashed border-verde/70" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
