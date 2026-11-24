import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { listarBancos } from "@/lib/cadastros/bancos";
import { condicaoSituacao, contemTexto, lerFiltrosComuns, parametro, POR_PAGINA, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { TIPOS_CONTA, type TipoConta } from "@/lib/cadastros/opcoes";
import { hojeIso } from "@/lib/datas";
import { saldosDasContas } from "@/lib/lancamentos/consultas";
import { TelaContas } from "./tela";

export const metadata = { title: "Contas Financeiras" };
const CAMINHO = "/cadastros/contas-financeiras";

export default async function PaginaContas({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const f = lerFiltrosComuns(sp);
  const tipoParam = parametro(sp, "tipo");
  const tipo = TIPOS_CONTA.some((t) => t.valor === tipoParam) ? (tipoParam as TipoConta) : "";
  const { contaFinanceira: conta, banco } = schema;
  const onde = and(
    f.busca ? contemTexto(conta.descricao, f.busca) : undefined,
    tipo ? eq(conta.tipo, tipo) : undefined,
    condicaoSituacao(conta.ativo, f.situacao),
  );
  const db = getDb();
  const [linhas, [{ total }], bancos, saldos] = await Promise.all([
    db
      .select({
        id: conta.id,
        descricao: conta.descricao,
        tipo: conta.tipo,
        bancoId: conta.bancoId,
        bancoNome: banco.nome,
        bancoCodigo: banco.codigo,
        considerarNosSaldos: conta.considerarNosSaldos,
        saldoInicialCentavos: conta.saldoInicialCentavos,
        saldoInicialData: conta.saldoInicialData,
        ativo: conta.ativo,
        padraoSistema: conta.padraoSistema,
      })
      .from(conta)
      .leftJoin(banco, eq(banco.id, conta.bancoId))
      .where(onde)
      .orderBy(desc(conta.ativo), asc(conta.ordem), asc(sql`lower(${conta.descricao})`))
      .limit(POR_PAGINA)
      .offset((f.pagina - 1) * POR_PAGINA),
    db.select({ total: count() }).from(conta).where(onde),
    listarBancos(),
    saldosDasContas(),
  ]);

  return (
    <MolduraLista
      titulo="Contas Financeiras"
      filtros={
        <PainelFiltros caminho={CAMINHO}>
          <FiltroTexto nome="busca" rotulo="Conta Financeira" valor={f.busca} />
          <FiltroSelecao nome="tipo" rotulo="Tipo" valor={tipo} opcoes={[{ valor: "", rotulo: "Todos" }, ...TIPOS_CONTA]} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaContas linhas={linhas.map((l) => ({ ...l, saldoAtualCentavos: saldos.get(l.id) ?? 0 }))} total={total} filtros={{ ...f, tipo }} caminho={CAMINHO} bancos={bancos} hoje={hojeIso()} />
    </MolduraLista>
  );
}
