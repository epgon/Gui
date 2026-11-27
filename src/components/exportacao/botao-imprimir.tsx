"use client";

import { CheckCircle2, Download, Eye, FileSpreadsheet, FileText, LayoutTemplate, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSistema } from "@/components/layout/provedor-sistema";
import { useComAvancado } from "@/components/listagem/use-avancado";
import { Botao } from "@/components/ui/botao";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { parametrosPersonalizacao, type Personalizacao } from "@/lib/exportacao/tabela";
import { ImpressaoPersonalizada } from "./impressao-personalizada";

/** Endereço da impressão/exportação de uma tela, com os filtros que estão na tela. */
export function enderecoExportacao(tela: string, parametros: Record<string, string>, formato: "pdf" | "xlsx" | "csv", download = false) {
  const sp = new URLSearchParams(Object.entries(parametros).filter(([, v]) => v));
  sp.set("formato", formato);
  if (download) sp.set("download", "1");
  return `/api/exportar/${tela}?${sp.toString()}`;
}

/**
 * Botão "Imprimir" das listas e relatórios: Impressão Padrão (PDF, com Visualizar ou Download)
 * e exportação para Excel e CSV. Tudo respeita os filtros que estão na tela.
 */
export function BotaoImprimir({ tela, parametros: proprios, exportar: exportarPedido = true, personalizada = false, somente, className }: {
  tela: string;
  parametros: Record<string, string>;
  exportar?: boolean;
  /** Mostra a "Impressão Personalizada" (listas de Cadastros). */
  personalizada?: boolean;
  /** Botão quadrado só com o ícone: "imprimir" gera a Impressão Padrão direto; "exportar" abre o menu do Excel e CSV. */
  somente?: "imprimir" | "exportar";
  className?: string;
}) {
  const { recursos } = useSistema();
  // O Filtro Avançado (na URL) também vale na impressão e na exportação.
  const parametros = useComAvancado(proprios);
  const imprimirLigado = recursos.impressao;
  const exportar = exportarPedido && recursos.exportacao;
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; nome: string } | null>(null);
  const [erro, setErro] = useState("");
  const [personalizando, setPersonalizando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", fechar);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", fechar);
    };
  }, [aberto]);

  // Libera o arquivo da memória um tempo depois de a janela fechar (a aba "Visualizar" já terá carregado).
  useEffect(() => () => {
    if (pdf) setTimeout(() => URL.revokeObjectURL(pdf.url), 60_000);
  }, [pdf]);

  async function imprimir(p?: Personalizacao) {
    setAberto(false);
    setPersonalizando(false);
    setErro("");
    setGerando(true);
    try {
      const resposta = await fetch(enderecoExportacao(tela, p ? { ...parametros, ...parametrosPersonalizacao(p) } : parametros, "pdf"), { cache: "no-store" });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.erro ?? "Não foi possível gerar a impressão. Tente de novo.");
        return;
      }
      const nome = /filename="([^"]+)"/.exec(resposta.headers.get("Content-Disposition") ?? "")?.[1] ?? `${tela}.pdf`;
      setPdf({ url: URL.createObjectURL(await resposta.blob()), nome });
    } catch {
      setErro("Sem conexão com o servidor. Confira a internet e tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-verde-claro";
  // Configurações > Recursos: sem Impressão e sem Exportação, o botão some.
  if (!imprimirLigado && !exportar) return null;
  if (somente === "imprimir" && !imprimirLigado) return null;
  if (somente === "exportar" && !exportar) return null;
  const soIcone = !!somente;
  const Icone = somente === "exportar" ? Download : Printer;
  const dica = somente === "exportar" ? "Exportar" : somente === "imprimir" ? "Imprimir" : "Imprimir ou exportar";
  return (
    <div ref={ref} className={cn("group/dica relative", className)}>
      <button
        type="button"
        onClick={() => (somente === "imprimir" ? imprimir() : setAberto((a) => !a))}
        aria-expanded={somente === "imprimir" ? undefined : aberto}
        aria-haspopup={somente === "imprimir" ? undefined : "menu"}
        aria-label={soIcone ? dica : undefined}
        disabled={gerando}
        title={soIcone ? undefined : dica}
        className={cn(
          "inline-flex h-9 items-center rounded-md border border-borda bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60",
          soIcone ? "w-9 justify-center" : "gap-1.5 px-2.5",
        )}
      >
        {gerando ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-verde border-t-transparent" /> : <Icone className="h-4 w-4 text-verde" />}
        {!soIcone && <span className="hidden sm:inline">{gerando ? "Gerando..." : "Imprimir"}</span>}
      </button>
      {soIcone && (
        <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover/dica:opacity-100">
          {dica}
        </span>
      )}
      {aberto && somente !== "imprimir" && (
        <ul role="menu" className="absolute right-0 z-40 mt-1 min-w-52 overflow-hidden rounded-lg border border-borda bg-white py-1 text-sm shadow-lg">
          {imprimirLigado && !somente && (
            <li>
              <button type="button" role="menuitem" className={item} onClick={() => imprimir()}>
                <FileText className="h-4 w-4 text-verde" /> Impressão Padrão (PDF)
              </button>
            </li>
          )}
          {imprimirLigado && personalizada && !somente && (
            <li>
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setAberto(false);
                  setErro("");
                  setPersonalizando(true);
                }}
              >
                <LayoutTemplate className="h-4 w-4 text-verde" /> Impressão Personalizada
              </button>
            </li>
          )}
          {exportar && (
            <>
              <li>
                <a role="menuitem" className={item} href={enderecoExportacao(tela, parametros, "xlsx")} onClick={() => setAberto(false)}>
                  <FileSpreadsheet className="h-4 w-4 text-verde" /> Exportar para Excel
                </a>
              </li>
              <li>
                <a role="menuitem" className={item} href={enderecoExportacao(tela, parametros, "csv")} onClick={() => setAberto(false)}>
                  <FileSpreadsheet className="h-4 w-4 text-gray-500" /> Exportar para CSV
                </a>
              </li>
            </>
          )}
        </ul>
      )}
      {erro && (
        <div className="absolute right-0 z-30 mt-1 w-72">
          <FaixaErro>{erro}</FaixaErro>
        </div>
      )}

      {personalizando && (
        <ImpressaoPersonalizada
          tela={tela}
          endereco={enderecoExportacao(tela, parametros, "pdf").replace("formato=pdf", "formato=colunas")}
          aoGerar={(p) => imprimir(p)}
          aoFechar={() => setPersonalizando(false)}
        />
      )}
      <Modal
        aberto={!!pdf}
        aoFechar={() => setPdf(null)}
        titulo="Impressão Gerada"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setPdf(null)}>
              Voltar
            </Botao>
            <a
              href={pdf?.url}
              download={pdf?.nome}
              onClick={() => setTimeout(() => setPdf(null), 300)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-borda bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Download
            </a>
            <a
              href={pdf?.url}
              target="_blank"
              rel="noopener"
              onClick={() => setTimeout(() => setPdf(null), 300)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-verde px-4 text-sm font-semibold text-white hover:bg-verde-escuro"
            >
              <Eye className="h-4 w-4" /> Visualizar
            </a>
          </>
        }
      >
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 className="h-10 w-10 shrink-0 text-verde-vivo" />
          <p className="text-sm text-gray-700">Deseja visualizar ou realizar o download?</p>
        </div>
      </Modal>
    </div>
  );
}
