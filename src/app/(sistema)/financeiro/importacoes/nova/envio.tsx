"use client";

import { FileUp, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { TextoComDestaque } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { cn } from "@/lib/cn";
import { Etapas } from "../etapas";

/** Passo 1: escolher o arquivo do extrato (OFX, CSV, TXT ou PDF da fatura do BB). */
export function EnvioArquivo() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const escolher = (f: File | null | undefined) => {
    setErro("");
    setArquivo(f ?? null);
  };

  const enviar = async () => {
    if (!arquivo) {
      setErro("Selecione o **arquivo** do extrato.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const resposta = await fetch("/api/importacoes", { method: "POST", body: form });
      const json = (await resposta.json().catch(() => ({}))) as { id?: number; erro?: string };
      if (!resposta.ok || !json.id) {
        setErro(json.erro ?? "Não foi possível enviar o arquivo agora. Tente de novo.");
        setEnviando(false);
        return;
      }
      router.push(`/financeiro/importacoes/${json.id}`);
    } catch {
      setErro("Não foi possível enviar o arquivo agora. Confira sua conexão e tente de novo.");
      setEnviando(false);
    }
  };

  return (
    <>
      <Etapas atual={1} csv={false} />
      <Cartao titulo="Enviar o arquivo do extrato">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Baixe o extrato no site ou aplicativo do banco no formato <strong>OFX</strong> (o melhor: os campos são reconhecidos sozinhos) ou <strong>CSV</strong>. Também serve a
            fatura do cartão de crédito. A fatura do cartão do <strong>Banco do Brasil</strong> pode ser enviada direto em <strong>PDF</strong>.
          </p>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              escolher(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
              arrastando ? "border-verde bg-verde-claro" : "border-borda bg-subcabecalho hover:border-verde/50",
            )}
          >
            <FileUp className="h-10 w-10 text-verde" />
            {arquivo ? (
              <span className="text-sm">
                <strong>{arquivo.name}</strong> <span className="text-gray-500">({Math.max(1, Math.round(arquivo.size / 1024))} KB)</span>
              </span>
            ) : (
              <span className="text-sm text-gray-600">
                Arraste o arquivo para cá ou <span className="font-semibold text-verde underline">clique para escolher</span>
              </span>
            )}
            <span className="text-xs text-gray-500">.OFX, .CSV ou .TXT, até 2 MB, ou .PDF da fatura do Banco do Brasil</span>
            <input ref={entrada} type="file" accept=".ofx,.qfx,.csv,.txt,.pdf,.xls,.xlsx" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} aria-label="Arquivo do extrato" />
          </label>
          <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
          <p className="text-xs text-gray-500">
            Planilhas do Excel (.xls ou .xlsx) não são aceitas. Abra no Excel e use <strong>Arquivo &gt; Salvar como &gt; CSV</strong>.
          </p>
          <div className="flex justify-end gap-2 border-t border-borda pt-4">
            <Link href="/financeiro/importacoes" className="inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100">
              Voltar
            </Link>
            <Botao onClick={enviar} carregando={enviando} icone={<Upload className="h-4 w-4" />}>
              Enviar e continuar
            </Botao>
          </div>
        </div>
      </Cartao>
    </>
  );
}
