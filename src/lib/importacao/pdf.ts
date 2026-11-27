import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { ErroArquivo } from "./ofx";

type ItemTexto = { str: string; x: number; y: number };

/**
 * Tira o texto do PDF linha por linha, com as colunas separadas por tabulação
 * (o leitor da fatura usa isso para achar data, descrição, país e valor).
 * PDF escaneado (só imagem) não tem texto: avisamos em vez de devolver vazio.
 */
export async function extrairTextoPdf(bytes: Uint8Array): Promise<string> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch {
    throw new ErroArquivo("Não foi possível abrir este PDF. Ele pode estar protegido por senha ou corrompido. Baixe a fatura de novo no site ou aplicativo do banco.");
  }
  const paginas: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const conteudo = await pagina.getTextContent();
    const itens: ItemTexto[] = [];
    for (const item of conteudo.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      itens.push({ str: item.str.replace(/\s+/g, " ").trim(), x: item.transform[4], y: item.transform[5] });
    }
    paginas.push(montarLinhas(itens));
  }
  const texto = paginas.join("\n");
  if (!texto.trim()) {
    // Confirma com o leitor simples antes de dizer que é imagem.
    const { text } = await extractText(pdf, { mergePages: true });
    if (!text.trim()) throw new ErroArquivo("Este PDF não tem texto (parece uma imagem escaneada), então não dá para ler os lançamentos. Baixe a fatura direto do site ou aplicativo do banco.");
  }
  return texto;
}

/** Junta os pedaços de texto que estão na mesma altura (de cima para baixo, da esquerda para a direita). */
function montarLinhas(itens: ItemTexto[]): string {
  const linhas: { y: number; itens: ItemTexto[] }[] = [];
  for (const item of itens) {
    const mesma = linhas.find((l) => Math.abs(l.y - item.y) <= 2);
    if (mesma) mesma.itens.push(item);
    else linhas.push({ y: item.y, itens: [item] });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) =>
      l.itens
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join("\t"),
    )
    .join("\n");
}
