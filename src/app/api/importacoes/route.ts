import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { lerOfx } from "@/lib/importacao/ofx";
import { decodificar } from "@/lib/importacao/texto";

/** Tamanho máximo do arquivo de extrato. */
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

const AJUDA_XLS =
  "Arquivos do Excel (**.xls** ou **.xlsx**) não são aceitos, porque cada banco formata de um jeito e a leitura automática erra. Abra o arquivo no Excel (ou Google Planilhas) e use **Arquivo > Salvar como > CSV**. Depois envie o CSV aqui.";

/** Passo 1 da importação: recebe o arquivo (OFX, CSV ou TXT) e cria a importação em rascunho. */
export async function POST(req: Request) {
  if (!(await auth())?.user) return Response.json({ erro: "Sessão expirada. Entre de novo no sistema." }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ erro: "Arquivo grande demais ou envio interrompido." }, { status: 400 });
  }
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return Response.json({ erro: "Selecione o **arquivo** do extrato." }, { status: 400 });
  const nome = arquivo.name.slice(0, 200) || "extrato";
  const extensao = /\.([a-z0-9]+)$/i.exec(nome)?.[1]?.toLowerCase() ?? "";
  if (["xls", "xlsx", "xlsm", "ods"].includes(extensao)) return Response.json({ erro: AJUDA_XLS }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO) return Response.json({ erro: `O arquivo **${nome}** passa de 2 MB. Baixe um período menor no banco.` }, { status: 400 });

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  // Planilha do Excel com a extensão trocada: começa com "PK" (xlsx) ou com a assinatura do formato antigo (xls).
  if ((bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) return Response.json({ erro: AJUDA_XLS }, { status: 400 });
  const texto = decodificar(bytes);
  if (texto.includes("\u0000")) return Response.json({ erro: `O arquivo **${nome}** não é um texto (OFX, CSV ou TXT).` }, { status: 400 });

  const ofx = extensao === "ofx" || extensao === "qfx" || /<OFX>/i.test(texto.slice(0, 5000));
  if (!ofx && !["csv", "txt", ""].includes(extensao)) {
    return Response.json({ erro: `O arquivo **${nome}** não é OFX, CSV nem TXT.` }, { status: 400 });
  }
  let infoArquivo = {};
  if (ofx) {
    try {
      const r = lerOfx(texto);
      if (!r.transacoes.length) return Response.json({ erro: "O arquivo OFX não tem nenhuma transação no período. Confira as datas escolhidas no banco." }, { status: 400 });
      infoArquivo = { ...r.info, transacoes: r.transacoes.length };
    } catch (e) {
      return Response.json({ erro: e instanceof Error ? e.message : "Não foi possível ler o arquivo OFX." }, { status: 400 });
    }
  }

  const [nova] = await getDb()
    .insert(schema.importacao)
    .values({ arquivoNome: nome, formato: ofx ? "ofx" : "csv", conteudo: texto, infoArquivo })
    .returning({ id: schema.importacao.id });
  return Response.json({ id: nova.id });
}
