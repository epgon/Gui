import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";

/** Abre um anexo no navegador. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())?.user) return new Response("Entre no sistema para ver este anexo.", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Anexo não encontrado.", { status: 404 });
  const [a] = await getDb().select().from(schema.anexo).where(eq(schema.anexo.id, id));
  if (!a) return new Response("Anexo não encontrado.", { status: 404 });
  return new Response(new Uint8Array(a.conteudo), {
    headers: {
      "Content-Type": a.tipoMime,
      "Content-Length": String(a.tamanhoBytes),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nomeArquivo)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
