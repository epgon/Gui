import { alias } from "drizzle-orm/pg-core";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { listarBancos } from "@/lib/cadastros/bancos";
import { condicaoSituacao, contemTexto, lerFiltrosComuns, parametro, POR_PAGINA, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { DIAS_MES } from "@/lib/cadastros/opcoes";
import { TelaCartoes } from "./tela";

export const metadata = { title: "Cartões de Crédito" };
const CAMINHO = "/cadastros/cartoes-de-credito";

export default async function PaginaCartoes({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const f = lerFiltrosComuns(sp);
  const fechamento = DIAS_MES.includes(parametro(sp, "fechamento")) ? parametro(sp, "fechamento") : "";
  const vencimento = DIAS_MES.includes(parametro(sp, "vencimento")) ? parametro(sp, "vencimento") : "";
  const { cartaoCredito: cartao, banco, contaFinanceira } = schema;
  const contaPg = alias(contaFinanceira, "conta_pagamento");
  const onde = and(
    f.busca ? contemTexto(cartao.descricao, f.busca) : undefined,
    fechamento ? eq(cartao.diaFechamento, Number(fechamento)) : undefined,
    vencimento ? eq(cartao.diaVencimento, Number(vencimento)) : undefined,
    condicaoSituacao(cartao.ativo, f.situacao),
  );
  const db = getDb();
  const [linhas, [{ total }], bancos, contas] = await Promise.all([
    db
      .select({
        id: cartao.id,
        descricao: cartao.descricao,
        bancoId: cartao.bancoId,
        bancoNome: banco.nome,
        bancoCodigo: banco.codigo,
        limiteCentavos: cartao.limiteCentavos,
        ilimitado: cartao.ilimitado,
        diaFechamento: cartao.diaFechamento,
        diaVencimento: cartao.diaVencimento,
        contaPagamentoId: cartao.contaPagamentoId,
        contaPagamentoNome: contaPg.descricao,
        ativo: cartao.ativo,
        padraoSistema: cartao.padraoSistema,
      })
      .from(cartao)
      .leftJoin(banco, eq(banco.id, cartao.bancoId))
      .leftJoin(contaPg, eq(contaPg.id, cartao.contaPagamentoId))
      .where(onde)
      .orderBy(desc(cartao.ativo), asc(cartao.ordem), asc(sql`lower(${cartao.descricao})`))
      .limit(POR_PAGINA)
      .offset((f.pagina - 1) * POR_PAGINA),
    db.select({ total: count() }).from(cartao).where(onde),
    listarBancos(),
    db
      .select({ id: contaFinanceira.id, descricao: contaFinanceira.descricao, ativo: contaFinanceira.ativo })
      .from(contaFinanceira)
      .orderBy(asc(contaFinanceira.ordem), asc(contaFinanceira.descricao)),
  ]);

  const opcoesDia = [{ valor: "", rotulo: "Todos" }, ...DIAS_MES.map((d) => ({ valor: d, rotulo: `Dia ${d}` }))];
  return (
    <MolduraLista
      titulo="Cartões de Crédito"
      filtros={
        <PainelFiltros caminho={CAMINHO}>
          <FiltroTexto nome="busca" rotulo="Cartão de Crédito" valor={f.busca} />
          <FiltroSelecao nome="fechamento" rotulo="Dia do Fechamento" valor={fechamento} opcoes={opcoesDia} />
          <FiltroSelecao nome="vencimento" rotulo="Dia do Vencimento" valor={vencimento} opcoes={opcoesDia} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaCartoes linhas={linhas} total={total} filtros={{ ...f, fechamento, vencimento }} caminho={CAMINHO} bancos={bancos} contas={contas} />
    </MolduraLista>
  );
}
