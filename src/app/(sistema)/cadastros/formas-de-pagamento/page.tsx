import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { carregarFormas } from "@/lib/listagem/cadastros";
import { camposAvancados, lerPreferencia, paginar } from "@/lib/listagem/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { TelaFormas } from "./tela";

export const metadata = { title: "Formas de Pagamento" };
const CAMINHO = "/cadastros/formas-de-pagamento";
const TELA = "formas-de-pagamento";

export default async function PaginaFormas({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("formas_pagamento"))) return <RecursoDesativado titulo="Formas de Pagamento" trilha="Cadastros" />;
  const sp = await searchParams;
  const [preferencia, campos] = await Promise.all([lerPreferencia(TELA), camposAvancados(TELA)]);
  const r = await carregarFormas(sp, preferencia);
  const pagina = paginar(r.linhas, r.f.pagina, preferencia.porPagina);

  return (
    <MolduraLista
      titulo="Formas de Pagamento"
      filtros={
        <PainelFiltros caminho={CAMINHO} avancado={{ campos, valor: parametro(sp, "av") }}>
          <FiltroTexto nome="busca" rotulo="Forma ou Sigla" valor={r.f.busca} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={r.f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaFormas linhas={pagina.linhas} total={pagina.total} filtros={{ ...r.f, pagina: pagina.pagina }} caminho={CAMINHO} preferencia={preferencia} />
    </MolduraLista>
  );
}
