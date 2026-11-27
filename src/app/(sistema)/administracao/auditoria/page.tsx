import { and, count, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getDb, schema } from "@/db";
import { contemTexto, parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { dataValida } from "@/lib/datas";
import { lerPreferencia } from "@/lib/listagem/servidor";
import { TelaAuditoria } from "./tela";

export const metadata = { title: "Auditoria" };
const CAMINHO = "/administracao/auditoria";
const TELA = "auditoria";
const ACOES = ["cadastrou", "alterou", "ativou", "inativou", "excluiu", "pagou", "importou", "renegociou", "aprovou"] as const;

export default async function PaginaAuditoria({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const { auditoria: a } = schema;
  const db = getDb();
  // Os registros ficam disponíveis por 6 meses: os mais antigos são apagados ao abrir a tela.
  await db.delete(a).where(lt(a.quando, sql`now() - interval '6 months'`));

  const busca = parametro(sp, "busca").slice(0, 100);
  const tela = parametro(sp, "tela").slice(0, 80);
  const acaoPedida = parametro(sp, "acao");
  const acao = (ACOES as readonly string[]).includes(acaoPedida) ? (acaoPedida as (typeof ACOES)[number]) : "";
  const codigo = /^\d{1,9}$/.test(parametro(sp, "codigo")) ? Number(parametro(sp, "codigo")) : null;
  const de = dataValida(parametro(sp, "de")) ? parametro(sp, "de") : "";
  const ate = dataValida(parametro(sp, "ate")) ? parametro(sp, "ate") : "";
  const paginaPedida = Math.max(1, Math.floor(Number(parametro(sp, "pagina")) || 1));

  // Datas no fuso de Brasília: "de 01/11 a 24/11" inclui o dia 24 inteiro.
  const diaSp = sql`(${a.quando} at time zone 'America/Sao_Paulo')::date`;
  const onde = and(
    busca ? contemTexto(a.descricao, busca) : undefined,
    tela ? eq(a.tela, tela) : undefined,
    acao ? eq(a.acao, acao) : undefined,
    codigo !== null ? eq(a.entidadeId, codigo) : undefined,
    de ? gte(diaSp, de) : undefined,
    ate ? lte(diaSp, ate) : undefined,
  );

  const preferencia = await lerPreferencia(TELA);
  const porPagina = preferencia.porPagina;
  const [[{ total }], telas] = await Promise.all([
    db.select({ total: count() }).from(a).where(onde),
    db.selectDistinct({ tela: a.tela }).from(a).orderBy(a.tela),
  ]);
  const pagina = preferencia.semPaginacao ? 1 : Math.min(paginaPedida, Math.max(1, Math.ceil(total / porPagina)));
  const consulta = db.select().from(a).where(onde).orderBy(desc(a.quando), desc(a.id));
  const linhas = await (preferencia.semPaginacao ? consulta : consulta.limit(porPagina).offset((pagina - 1) * porPagina));

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Auditoria" trilha="Administração" />
        <div className="space-y-4 p-6">
          <TelaAuditoria
            linhas={linhas.map((l) => ({ ...l, quando: l.quando.toISOString() }))}
            total={total}
            pagina={pagina}
            preferencia={preferencia}
            caminho={CAMINHO}
            parametros={{ busca, tela, acao, codigo: codigo === null ? "" : String(codigo), de, ate }}
          />
        </div>
      </main>
      <PainelFiltros caminho={CAMINHO}>
        <FiltroTexto nome="busca" rotulo="Registro" valor={busca} />
        <FiltroSelecao nome="tela" rotulo="Tela" valor={tela} opcoes={[{ valor: "", rotulo: "Todas" }, ...telas.map((t) => ({ valor: t.tela, rotulo: t.tela }))]} />
        <FiltroSelecao
          nome="acao"
          rotulo="Ação"
          valor={acao}
          opcoes={[{ valor: "", rotulo: "Todas" }, ...ACOES.map((x) => ({ valor: x, rotulo: x.charAt(0).toUpperCase() + x.slice(1) }))]}
        />
        <FiltroTexto nome="codigo" rotulo="Código" valor={codigo === null ? "" : String(codigo)} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Data de Início</span>
          <input type="date" name="de" defaultValue={de} className="h-9 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none focus:border-verde" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Data de Fim</span>
          <input type="date" name="ate" defaultValue={ate} className="h-9 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none focus:border-verde" />
        </label>
      </PainelFiltros>
    </>
  );
}
