"use client";

import { CheckCircle2, Download, Eye, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

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
export function BotaoImprimir({ tela, parametros, exportar = true, className }: { tela: string; parametros: Record<string, string>; exportar?: boolean; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; nome: string } | null>(null);
  const [erro, setErro] = useState("");
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

  async function imprimir() {
    setAberto(false);
    setErro("");
    setGerando(true);
    try {
      const resposta = await fetch(enderecoExportacao(tela, parametros, "pdf"), { cache: "no-store" });
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
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        disabled={gerando}
        title="Imprimir ou exportar"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-borda bg-white px-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {gerando ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-verde border-t-transparent" /> : <Printer className="h-4 w-4 text-verde" />}
        <span className="hidden sm:inline">{gerando ? "Gerando..." : "Imprimir"}</span>
      </button>
      {aberto && (
        <ul role="menu" className="absolute right-0 z-40 mt-1 min-w-52 overflow-hidden rounded-lg border border-borda bg-white py-1 text-sm shadow-lg">
          <li>
            <button type="button" role="menuitem" className={item} onClick={imprimir}>
              <FileText className="h-4 w-4 text-verde" /> Impressão Padrão (PDF)
            </button>
          </li>
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
