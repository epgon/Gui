import { auth } from "@/auth";
import { hojeIso } from "@/lib/datas";
import { LISTAS } from "@/lib/exportacao/listas";
import { gerarPdf } from "@/lib/exportacao/pdf";
import { FORMATOS, gerarCsv, type Formato, type Tabela } from "@/lib/exportacao/tabela";
import { gerarXlsx } from "@/lib/exportacao/xlsx";
import { lerAgrupamento, lerPeriodicidade } from "@/lib/relatorios/regras";
import { tabelaFluxoDeCaixa, tabelaSaldoDetalhado } from "@/lib/relatorios/relatorios";

export const runtime = "nodejs";

const TIPOS: Record<Formato, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

/**
 * Impressão Padrão (PDF) e exportação (Excel e CSV) de uma lista ou relatório,
 * com os mesmos filtros da tela (vêm no endereço). Ex.: /api/exportar/lancamentos?formato=pdf&mes=2026-11
 */
export async function GET(req: Request, { params }: { params: Promise<{ tela: string }> }) {
  const sessao = await auth();
  if (!sessao?.user) return Response.json({ erro: "Sessão expirada. Entre de novo no sistema." }, { status: 401 });
  const { tela } = await params;
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const formato = (FORMATOS as readonly string[]).includes(sp.formato) ? (sp.formato as Formato) : "pdf";
  const hoje = hojeIso();

  let tabela: Tabela;
  try {
    if (tela === "fluxo-de-caixa") {
      tabela = await tabelaFluxoDeCaixa(sp, lerPeriodicidade(sp) ?? "mensal", hoje);
    } else if (tela === "saldo-detalhado") {
      tabela = await tabelaSaldoDetalhado(sp, lerAgrupamento(sp) ?? "categoria", hoje);
    } else if (LISTAS[tela]) {
      tabela = await LISTAS[tela](sp, hoje);
    } else {
      return Response.json({ erro: "Esta tela não tem impressão." }, { status: 404 });
    }
  } catch (e) {
    console.error("Erro ao montar a impressão", tela, e);
    return Response.json({ erro: "Não foi possível gerar agora. Tente de novo em instantes." }, { status: 500 });
  }

  const usuario = sessao.user.name || "Você";
  const corpo =
    formato === "pdf"
      ? await gerarPdf(tabela, { emitidoPor: usuario, marca: `Gui · ${usuario}` })
      : formato === "xlsx"
        ? await gerarXlsx(tabela)
        : Buffer.from(gerarCsv(tabela), "utf-8");

  const arquivo = `${tabela.arquivo}.${formato}`;
  // PDF abre no navegador ("Visualizar"), a não ser que peçam o download; Excel e CSV sempre baixam.
  const disposicao = formato === "pdf" && sp.download !== "1" ? "inline" : "attachment";
  return new Response(new Uint8Array(corpo), {
    headers: {
      "Content-Type": TIPOS[formato],
      "Content-Disposition": `${disposicao}; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
