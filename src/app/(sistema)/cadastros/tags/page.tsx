import { and, asc, count, desc, sql } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { condicaoSituacao, contemTexto, lerFiltrosComuns, POR_PAGINA, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { TelaTags } from "./tela";

export const metadata = { title: "Tags" };
const CAMINHO = "/cadastros/tags";

export default async function PaginaTags({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const f = lerFiltrosComuns(await searchParams);
  const { tag } = schema;
  const onde = and(f.busca ? contemTexto(tag.descricao, f.busca) : undefined, condicaoSituacao(tag.ativo, f.situacao));
  const db = getDb();
  const [linhas, [{ total }]] = await Promise.all([
    db
      .select({ id: tag.id, descricao: tag.descricao, ativo: tag.ativo, padraoSistema: tag.padraoSistema })
      .from(tag)
      .where(onde)
      .orderBy(desc(tag.ativo), asc(sql`lower(${tag.descricao})`))
      .limit(POR_PAGINA)
      .offset((f.pagina - 1) * POR_PAGINA),
    db.select({ total: count() }).from(tag).where(onde),
  ]);

  return (
    <MolduraLista
      titulo="Tags"
      filtros={
        <PainelFiltros caminho={CAMINHO}>
          <FiltroTexto nome="busca" rotulo="Tag" valor={f.busca} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaTags linhas={linhas} total={total} filtros={f} caminho={CAMINHO} />
    </MolduraLista>
  );
}
