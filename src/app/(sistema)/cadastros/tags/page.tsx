import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { carregarTags } from "@/lib/listagem/cadastros";
import { camposAvancados, lerPreferencia, paginar } from "@/lib/listagem/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { TelaTags } from "./tela";

export const metadata = { title: "Tags" };
const CAMINHO = "/cadastros/tags";
const TELA = "tags";

export default async function PaginaTags({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("tags"))) return <RecursoDesativado titulo="Tags" trilha="Cadastros" />;
  const sp = await searchParams;
  const [preferencia, campos] = await Promise.all([lerPreferencia(TELA), camposAvancados(TELA)]);
  const r = await carregarTags(sp, preferencia);
  const pagina = paginar(r.linhas, r.f.pagina, preferencia.porPagina);

  return (
    <MolduraLista
      titulo="Tags"
      filtros={
        <PainelFiltros caminho={CAMINHO} avancado={{ campos, valor: parametro(sp, "av") }}>
          <FiltroTexto nome="busca" rotulo="Tag" valor={r.f.busca} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={r.f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaTags linhas={pagina.linhas} total={pagina.total} filtros={{ ...r.f, pagina: pagina.pagina }} caminho={CAMINHO} preferencia={preferencia} />
    </MolduraLista>
  );
}
