"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripVertical, Minus, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useSistema } from "@/components/layout/provedor-sistema";
import { Botao } from "@/components/ui/botao";
import { TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { montarArvore, type CategoriaNaArvore } from "@/lib/categorias";
import { moverNo, moverPorSeta, type No, type Posicao } from "@/lib/categorias-organizar";
import { cn } from "@/lib/cn";
import { organizarCategorias } from "./acoes";

/** Modal "Organizando Categorias": clique e arraste para mudar o nível e a ordem. */
export function OrganizarCategorias({ arvore, aoFechar }: { arvore: CategoriaNaArvore[]; aoFechar: () => void }) {
  const { exibirCores, exibirNumeracao } = useSistema().parametros;
  const normais = useMemo(() => arvore.filter((c) => !c.especial), [arvore]);
  const iniciais = useMemo<No[]>(() => normais.map((c) => ({ id: c.id, paiId: c.categoriaPaiId, ordem: c.ordem })), [normais]);
  const [nos, setNos] = useState<No[]>(iniciais);
  const [recolhidas, setRecolhidas] = useState<Set<number>>(() => new Set(normais.filter((c) => c.nivel === 1).map((c) => c.id)));
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<{ id: number; posicao: Posicao } | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Árvore na ordem nova, com numeração, nível e cor recalculados.
  const visual = useMemo(() => {
    const porId = new Map(normais.map((c) => [c.id, c]));
    return montarArvore(nos.map((n) => ({ ...porId.get(n.id)!, categoriaPaiId: n.paiId, ordem: n.ordem, cor: n.paiId === null ? (porId.get(n.id)!.cor ?? porId.get(n.id)!.corEfetiva) : null })));
  }, [nos, normais]);
  const mudou = nos.some((n) => {
    const i = iniciais.find((x) => x.id === n.id)!;
    return i.paiId !== n.paiId || i.ordem !== n.ordem;
  });
  const visiveis = visual.filter((c) => !c.ancestrais.some((a) => recolhidas.has(a)));

  function aplicar(r: No[] | string) {
    if (typeof r === "string") setErro(r);
    else {
      setErro("");
      setNos(r);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const r = await organizarCategorias(nos);
      if (r.ok) aoFechar();
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível salvar agora. Confira a internet e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const seta = "rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30";
  return (
    <Modal
      aberto
      largura="larga"
      aoFechar={aoFechar}
      titulo="Organizando Categorias"
      resumo="Clique e arraste para organizar o nível e a ordem."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} carregando={salvando} disabled={!mudou} icone={<Save className="h-4 w-4" />}>
            Salvar Alterações
          </Botao>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="font-semibold text-verde hover:underline" onClick={() => setRecolhidas(new Set())}>
          Expandir Tudo
        </button>
        <button type="button" className="font-semibold text-verde hover:underline" onClick={() => setRecolhidas(new Set(visual.filter((c) => c.quantidadeFilhas > 0).map((c) => c.id)))}>
          Recolher Tudo
        </button>
        <span className="text-xs text-gray-500">Solte em cima de uma categoria para colocar dentro dela; na borda de cima ou de baixo, para ficar antes ou depois. As setas fazem o mesmo.</span>
      </div>
      <FaixaErro className="mb-3">{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      <ul className="max-h-[60vh] overflow-y-auto rounded-md border border-borda" aria-label="Categorias">
        {visiveis.map((c) => {
          const recolhida = recolhidas.has(c.id);
          const ehAlvo = alvo?.id === c.id && arrastando !== null && arrastando !== c.id;
          return (
            <li
              key={c.id}
              draggable
              onDragStart={(e) => {
                setArrastando(c.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(c.id));
              }}
              onDragEnd={() => {
                setArrastando(null);
                setAlvo(null);
              }}
              onDragOver={(e) => {
                if (arrastando === null || arrastando === c.id) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const y = (e.clientY - r.top) / r.height;
                const posicao: Posicao = y < 0.25 ? "antes" : y > 0.75 ? "depois" : "dentro";
                if (alvo?.id !== c.id || alvo.posicao !== posicao) setAlvo({ id: c.id, posicao });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastando !== null && alvo) {
                  aplicar(moverNo(nos, arrastando, alvo.id, alvo.posicao));
                  if (alvo.posicao === "dentro") setRecolhidas((s) => new Set([...s].filter((x) => x !== alvo.id)));
                }
                setArrastando(null);
                setAlvo(null);
              }}
              className={cn(
                "flex items-center gap-1.5 border-b border-borda py-1.5 pr-2 text-sm last:border-b-0",
                arrastando === c.id && "opacity-40",
                ehAlvo && alvo?.posicao === "dentro" && "bg-verde-claro",
                ehAlvo && alvo?.posicao === "antes" && "border-t-2 border-t-verde",
                ehAlvo && alvo?.posicao === "depois" && "border-b-2 border-b-verde",
                !c.ativo && "text-gray-400",
              )}
              style={{ paddingLeft: `${(c.nivel - 1) * 24 + 8}px` }}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-400" aria-hidden />
              {c.quantidadeFilhas > 0 ? (
                <button
                  type="button"
                  className="rounded border border-borda p-0.5 text-gray-500 hover:bg-gray-100"
                  onClick={() => setRecolhidas((s) => (s.has(c.id) ? new Set([...s].filter((x) => x !== c.id)) : new Set([...s, c.id])))}
                  aria-label={recolhida ? `Abrir ${c.nome}` : `Recolher ${c.nome}`}
                >
                  {recolhida ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </button>
              ) : (
                <span className="w-[18px]" />
              )}
              {exibirCores && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.corEfetiva }} aria-hidden />}
              {exibirNumeracao && <span className="w-12 shrink-0 tabular-nums text-gray-500">{c.numero}</span>}
              <span className="min-w-0 flex-1 truncate">{c.nome}</span>
              <button type="button" className={seta} onClick={() => aplicar(moverPorSeta(nos, c.id, "subir"))} aria-label={`Subir ${c.nome}`} title="Subir">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={seta} onClick={() => aplicar(moverPorSeta(nos, c.id, "descer"))} aria-label={`Descer ${c.nome}`} title="Descer">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={seta} disabled={c.nivel === 1} onClick={() => aplicar(moverPorSeta(nos, c.id, "recuar"))} aria-label={`Recuar ${c.nome} um nível`} title="Recuar um nível">
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={seta} onClick={() => aplicar(moverPorSeta(nos, c.id, "avancar"))} aria-label={`Colocar ${c.nome} dentro da categoria de cima`} title="Colocar dentro da categoria de cima">
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-gray-500">
        Ao mudar de categoria principal, a categoria passa a ser do tipo (receita ou despesa) e da cor da nova principal. Acerto de Saldo, Cartão de Crédito e Transferência são do sistema e não entram aqui.
      </p>
    </Modal>
  );
}
