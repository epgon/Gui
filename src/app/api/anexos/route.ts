import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { TAMANHO_MAXIMO_ANEXO, tipoAnexoPermitido } from "@/lib/lancamentos/anexos";

/** Envia um anexo (imagem ou PDF) para um lançamento. Guardado no próprio banco. */
export async function POST(req: Request) {
  if (!(await auth())?.user) return Response.json({ erro: "Sessão expirada. Entre de novo no sistema." }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ erro: "Arquivo grande demais ou envio interrompido." }, { status: 400 });
  }
  const lancamentoId = Number(form.get("lancamentoId"));
  const arquivo = form.get("arquivo");
  if (!Number.isInteger(lancamentoId) || lancamentoId <= 0 || !(arquivo instanceof File)) {
    return Response.json({ erro: "Envio inválido." }, { status: 400 });
  }
  if (!tipoAnexoPermitido(arquivo.type)) return Response.json({ erro: `O arquivo **${arquivo.name}** não é imagem nem PDF.` }, { status: 400 });
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) return Response.json({ erro: `O arquivo **${arquivo.name}** passa de 4 MB.` }, { status: 400 });

  const db = getDb();
  const [existe] = await db.select({ id: schema.lancamento.id }).from(schema.lancamento).where(eq(schema.lancamento.id, lancamentoId));
  if (!existe) return Response.json({ erro: "Lançamento não encontrado." }, { status: 404 });
  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  const nomeArquivo = arquivo.name.slice(0, 200) || "arquivo";
  const novo = await db.transaction(async (tx) => {
    const [linha] = await tx
      .insert(schema.anexo)
      .values({ lancamentoId, nomeArquivo, tipoMime: arquivo.type, tamanhoBytes: arquivo.size, conteudo })
      .returning({ id: schema.anexo.id });
    await registrarAuditoria(tx, { tela: "Lançamentos", entidade: "Anexo", entidadeId: linha.id, acao: "cadastrou", descricao: `o anexo ${nomeArquivo}`, dados: { lancamentoId, nomeArquivo, tamanhoBytes: arquivo.size } });
    return linha;
  });
  return Response.json({ id: novo.id });
}
