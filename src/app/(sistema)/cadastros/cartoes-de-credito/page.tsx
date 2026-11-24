import { asc } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { getDb, schema } from "@/db";
import { listarBancos } from "@/lib/cadastros/bancos";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { DIAS_MES } from "@/lib/cadastros/opcoes";
import { carregarCartoes } from "@/lib/listagem/cadastros";
import { camposAvancados, lerPreferencia, paginar } from "@/lib/listagem/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { TelaCartoes } from "./tela";

export const metadata = { title: "Cartões de Crédito" };
const CAMINHO = "/cadastros/cartoes-de-credito";
const TELA = "cartoes-de-credito";

export default async function PaginaCartoes({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("cartoes"))) return <RecursoDesativado titulo="Cartões de Crédito" trilha="Cadastros" />;
  const sp = await searchParams;
  // Abrir direto o Detalhando de um cartão (ex.: vindo da Visão Geral): ?detalhar=3 ou ?faturas=3
  const abrir = /^\d+$/.test(parametro(sp, "faturas")) ? { id: Number(parametro(sp, "faturas")), aba: "faturas" as const } : /^\d+$/.test(parametro(sp, "detalhar")) ? { id: Number(parametro(sp, "detalhar")), aba: "resumo" as const } : null;
  const { contaFinanceira } = schema;
  const [preferencia, campos, bancos, contas] = await Promise.all([
    lerPreferencia(TELA),
    camposAvancados(TELA),
    listarBancos(),
    getDb()
      .select({ id: contaFinanceira.id, descricao: contaFinanceira.descricao, ativo: contaFinanceira.ativo })
      .from(contaFinanceira)
      .orderBy(asc(contaFinanceira.ordem), asc(contaFinanceira.descricao)),
  ]);
  const r = await carregarCartoes(sp, preferencia);
  const pagina = paginar(r.linhas, r.f.pagina, preferencia.porPagina);

  const opcoesDia = [{ valor: "", rotulo: "Todos" }, ...DIAS_MES.map((d) => ({ valor: d, rotulo: `Dia ${d}` }))];
  return (
    <MolduraLista
      titulo="Cartões de Crédito"
      filtros={
        <PainelFiltros caminho={CAMINHO} avancado={{ campos, valor: parametro(sp, "av") }}>
          <FiltroTexto nome="busca" rotulo="Cartão de Crédito" valor={r.f.busca} />
          <FiltroSelecao nome="fechamento" rotulo="Dia do Fechamento" valor={r.fechamento} opcoes={opcoesDia} />
          <FiltroSelecao nome="vencimento" rotulo="Dia do Vencimento" valor={r.vencimento} opcoes={opcoesDia} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={r.f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaCartoes
        linhas={pagina.linhas}
        total={pagina.total}
        filtros={{ ...r.f, pagina: pagina.pagina, fechamento: r.fechamento, vencimento: r.vencimento }}
        caminho={CAMINHO}
        bancos={bancos}
        contas={contas}
        abrir={abrir}
        preferencia={preferencia}
      />
    </MolduraLista>
  );
}
