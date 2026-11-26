import { FiltroSelecao, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { TIPOS_DIVIDA } from "@/lib/dividas/regras";
import { carregarMinhasDividas } from "@/lib/dividas/listagem";
import { carregarContasEmAberto, categoriasDeDividas } from "@/lib/dividas/servidor";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { camposAvancados, paginar } from "@/lib/listagem/servidor";
import { lerParametros, recursoAtivo } from "@/lib/parametros/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaMinhasDividas } from "./tela";

export const metadata = { title: "Minhas Dívidas" };
const CAMINHO = "/gestao/dividas/minhas";

export default async function PaginaMinhasDividas({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("dividas"))) return <RecursoDesativado titulo="Gestão de Dívidas" trilha="Gestão" />;
  const sp = await searchParams;
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const [dados, abertas, opcoes, categorias, parametros, campos] = await Promise.all([carregarMinhasDividas(sp, hoje), carregarContasEmAberto(hoje), carregarOpcoes(), categoriasDeDividas(), lerParametros(), camposAvancados("dividas")]);
  const f = dados.f;
  const pagina = paginar(dados.linhas, f.pagina, dados.preferencia.porPagina);
  const contas = opcoes.destinos.filter((d) => d.grupo === "Contas" && d.ativo);
  const contaPadrao = contas[0]?.valor.replace("conta:", "") ?? "";
  const abrirDetalhe = /^\d+$/.test(parametro(sp, "detalhar")) ? Number(parametro(sp, "detalhar")) : null;

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Gestão de Dívidas" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaMinhasDividas
            linhas={pagina.linhas}
            total={pagina.total}
            filtros={{ ...f, pagina: pagina.pagina }}
            caminho={CAMINHO}
            opcoes={opcoes}
            hoje={hoje}
            totalDevido={dados.totalDevidoLista}
            todas={dados.todas}
            contasEmAberto={abertas.contas}
            recorrentes={abertas.recorrentes}
            padroes={{ contaId: contaPadrao, categoriaId: categorias.parcelas ? String(categorias.parcelas) : "" }}
            multaPadrao={parametros.dividas.multaPadraoPct}
            moraPadrao={parametros.dividas.moraMensalPct}
            abrirNova={parametro(sp, "nova") === "1"}
            abrirDetalhe={abrirDetalhe}
            porPagina={dados.preferencia.porPagina}
            preferencia={dados.preferencia}
          />
        </div>
      </main>
      <PainelFiltros caminho={CAMINHO} avancado={{ campos, valor: parametro(sp, "av") }}>
        <FiltroSelecao nome="credor" rotulo="Credor" valor={f.credor} opcoes={[{ valor: "", rotulo: "Todos" }, ...dados.credores.map((c) => ({ valor: String(c.id), rotulo: c.nome }))]} />
        <FiltroSelecao nome="tipo" rotulo="Tipo" valor={f.tipo} opcoes={[{ valor: "", rotulo: "Todos" }, ...TIPOS_DIVIDA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))]} />
        <FiltroSelecao
          nome="situacao"
          rotulo="Situação"
          valor={f.situacao}
          opcoes={[
            { valor: "", rotulo: "Todas" },
            { valor: "em_dia", rotulo: "Em dia" },
            { valor: "em_atraso", rotulo: "Em atraso" },
            { valor: "em_negociacao", rotulo: "Em negociação" },
            { valor: "quitada", rotulo: "Quitada" },
            { valor: "renegociada", rotulo: "Renegociada" },
            { valor: "cancelada", rotulo: "Cancelada" },
          ]}
        />
        <FiltroSelecao nome="conta" rotulo="Conta" valor={f.conta} opcoes={[{ valor: "", rotulo: "Todas" }, ...contas.map((c) => ({ valor: c.valor.replace("conta:", ""), rotulo: c.rotulo }))]} />
      </PainelFiltros>
    </>
  );
}
