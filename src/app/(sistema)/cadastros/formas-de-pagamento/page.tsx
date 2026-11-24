import { asc, count, desc, sql } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { filtrosFormas } from "@/lib/cadastros/condicoes";
import { POR_PAGINA, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { TelaFormas } from "./tela";

export const metadata = { title: "Formas de Pagamento" };
const CAMINHO = "/cadastros/formas-de-pagamento";

export default async function PaginaFormas({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const { f, onde } = filtrosFormas(await searchParams);
  const { formaPagamento: forma } = schema;
  const db = getDb();
  const [linhas, [{ total }]] = await Promise.all([
    db
      .select({ id: forma.id, descricao: forma.descricao, sigla: forma.sigla, ativo: forma.ativo, padraoSistema: forma.padraoSistema })
      .from(forma)
      .where(onde)
      .orderBy(desc(forma.ativo), asc(sql`lower(${forma.descricao})`))
      .limit(POR_PAGINA)
      .offset((f.pagina - 1) * POR_PAGINA),
    db.select({ total: count() }).from(forma).where(onde),
  ]);

  return (
    <MolduraLista
      titulo="Formas de Pagamento"
      filtros={
        <PainelFiltros caminho={CAMINHO}>
          <FiltroTexto nome="busca" rotulo="Forma ou Sigla" valor={f.busca} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaFormas linhas={linhas} total={total} filtros={f} caminho={CAMINHO} />
    </MolduraLista>
  );
}
