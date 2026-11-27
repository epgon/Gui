import { FiltroData, FiltroSelecao, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { SITUACOES_NEGOCIACAO } from "@/lib/dividas/negociacao";
import { carregarNegociacoes, lerFiltrosNegociacoes } from "@/lib/dividas/negociacoes";
import { carregarSituacaoFinanceira } from "@/lib/dividas/simulador-servidor";
import { carregarTodasDividas, categoriasDeDividas } from "@/lib/dividas/servidor";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { paginar } from "@/lib/listagem/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaNegociacoes } from "./tela";

export const metadata = { title: "Negociações" };
const CAMINHO = "/gestao/dividas/negociacoes";
const POR_PAGINA = 20;

export default async function PaginaNegociacoes({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("dividas"))) return <RecursoDesativado titulo="Gestão de Dívidas" trilha="Gestão" />;
  const sp = await searchParams;
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const f = lerFiltrosNegociacoes(sp);
  const dividas = await carregarTodasDividas(hoje);
  const [dados, opcoes, categorias, financeiro] = await Promise.all([carregarNegociacoes(f, dividas), carregarOpcoes(), categoriasDeDividas(), carregarSituacaoFinanceira(hoje)]);
  const pagina = paginar(dados.linhas, f.pagina, POR_PAGINA);
  const contas = opcoes.destinos.filter((d) => d.grupo === "Contas" && d.ativo);
  const abrirDetalhe = /^\d+$/.test(parametro(sp, "detalhar")) ? Number(parametro(sp, "detalhar")) : null;

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Gestão de Dívidas" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaNegociacoes
            linhas={pagina.linhas}
            total={pagina.total}
            filtros={{ ...f, pagina: pagina.pagina }}
            caminho={CAMINHO}
            dividas={dividas}
            opcoes={opcoes}
            hoje={hoje}
            padroes={{ contaId: contas[0]?.valor.replace("conta:", "") ?? "", categoriaId: categorias.parcelas ? String(categorias.parcelas) : "" }}
            sobraCalculadaCentavos={financeiro.situacao.sobraMensalCentavos}
            abrirNova={parametro(sp, "nova") === "1"}
            dividaInicial={/^\d+$/.test(parametro(sp, "divida")) ? Number(parametro(sp, "divida")) : null}
            abrirDetalhe={abrirDetalhe}
            porPagina={POR_PAGINA}
          />
        </div>
      </main>
      <PainelFiltros caminho={CAMINHO}>
        <FiltroSelecao nome="credor" rotulo="Credor" valor={f.credor} opcoes={[{ valor: "", rotulo: "Todos" }, ...dados.credores.map((c) => ({ valor: String(c.id), rotulo: c.nome }))]} />
        <FiltroSelecao nome="situacao" rotulo="Situação" valor={f.situacao} opcoes={[{ valor: "", rotulo: "Todas" }, ...SITUACOES_NEGOCIACAO.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))]} />
        <FiltroData nome="de" rotulo="Iniciada de" valor={f.de} />
        <FiltroData nome="ate" rotulo="Iniciada até" valor={f.ate} />
      </PainelFiltros>
    </>
  );
}
