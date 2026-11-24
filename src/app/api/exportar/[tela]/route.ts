import { auth } from "@/auth";
import { hojeIso } from "@/lib/datas";
import { LISTAS } from "@/lib/exportacao/listas";
import { gerarPdf } from "@/lib/exportacao/pdf";
import { FORMATOS, gerarCsv, lerPersonalizacao, personalizar, semExtras, textoCelula, type Formato, type Tabela } from "@/lib/exportacao/tabela";
import { gerarXlsx } from "@/lib/exportacao/xlsx";
import { lerParametros, lerRecursos } from "@/lib/parametros/servidor";
import { lerImpressoesSalvas } from "@/lib/exportacao/impressoes";
import { lerAgrupamento, lerPeriodicidade } from "@/lib/relatorios/regras";
import { tabelaFluxoDeCaixa, tabelaSaldoDetalhado } from "@/lib/relatorios/relatorios";

export const runtime = "nodejs";

/** Listas com Impressão Personalizada (as de Cadastros). */
const PERSONALIZAVEIS = ["contas-financeiras", "cartoes-de-credito", "categorias", "clientes-e-fornecedores", "formas-de-pagamento", "tags"];

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
  // "colunas": a Impressão Personalizada pede os campos disponíveis, uma prévia e as impressões salvas.
  const pedeColunas = sp.formato === "colunas";
  const formato = (FORMATOS as readonly string[]).includes(sp.formato) ? (sp.formato as Formato) : "pdf";
  const hoje = hojeIso();
  const recursos = await lerRecursos();
  if ((formato === "pdf" || pedeColunas) && !recursos.impressao) return Response.json({ erro: "A Impressão está desativada em Configurações > Recursos." }, { status: 403 });
  if (formato !== "pdf" && !pedeColunas && !recursos.exportacao) return Response.json({ erro: "A Exportação está desativada em Configurações > Recursos." }, { status: 403 });

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

  if (pedeColunas) {
    if (!PERSONALIZAVEIS.includes(tela)) return Response.json({ erro: "Esta tela não tem Impressão Personalizada." }, { status: 404 });
    const corpo = tabela.linhas.filter((l) => !l.estilo).slice(0, 8);
    return Response.json(
      {
        titulo: tabela.titulo,
        orientacao: tabela.orientacao,
        colunas: tabela.colunas.map((c) => ({ titulo: c.titulo, extra: !!c.extra, largura: c.largura ?? 1, direita: c.tipo === "dinheiro" || c.tipo === "numero" })),
        previa: corpo.map((l) => l.celulas.map((c, i) => textoCelula(c, tabela.colunas[i]?.tipo))),
        salvas: await lerImpressoesSalvas(tela),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Impressão Personalizada (só PDF); o resto (Padrão, Excel e CSV) usa as colunas normais.
  const personalizacao = formato === "pdf" && PERSONALIZAVEIS.includes(tela) ? lerPersonalizacao(sp, tabela.colunas.map((c) => c.titulo)) : null;
  tabela = personalizacao ? personalizar(tabela, personalizacao) : semExtras(tabela);

  const { titulo } = await lerParametros();
  const usuario = sessao.user.name || "Você";
  const corpo =
    formato === "pdf"
      ? await gerarPdf(tabela, { emitidoPor: usuario, marca: titulo && titulo !== "Gui" ? `Gui · ${titulo}` : `Gui · ${usuario}` })
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
