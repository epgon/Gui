import { alias } from "drizzle-orm/pg-core";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { listarBancos } from "@/lib/cadastros/bancos";
import { filtrosCartoes } from "@/lib/cadastros/condicoes";
import { parametro, POR_PAGINA, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { DIAS_MES } from "@/lib/cadastros/opcoes";
import { limiteDoCartao } from "@/lib/cartoes/regras";
import { usoDosLimites } from "@/lib/cartoes/servidor";
import { TelaCartoes } from "./tela";

export const metadata = { title: "Cartões de Crédito" };
const CAMINHO = "/cadastros/cartoes-de-credito";

export default async function PaginaCartoes({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  // Abrir direto o Detalhando de um cartão (ex.: vindo da Visão Geral): ?detalhar=3 ou ?faturas=3
  const abrir = /^\d+$/.test(parametro(sp, "faturas")) ? { id: Number(parametro(sp, "faturas")), aba: "faturas" as const } : /^\d+$/.test(parametro(sp, "detalhar")) ? { id: Number(parametro(sp, "detalhar")), aba: "resumo" as const } : null;
  const { f, fechamento, vencimento, onde } = filtrosCartoes(sp);
  const { cartaoCredito: cartao, banco, contaFinanceira } = schema;
  const contaPg = alias(contaFinanceira, "conta_pagamento");
  const db = getDb();
  const [linhasDb, [{ total }], bancos, contas, usos] = await Promise.all([
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
    usoDosLimites(),
  ]);
  const linhas = linhasDb.map((c) => ({ ...c, limite: limiteDoCartao(c, usos.get(c.id) ?? 0) }));

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
      <TelaCartoes linhas={linhas} total={total} filtros={{ ...f, fechamento, vencimento }} caminho={CAMINHO} bancos={bancos} contas={contas} abrir={abrir} />
    </MolduraLista>
  );
}
