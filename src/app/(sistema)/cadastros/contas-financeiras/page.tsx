import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { listarBancos } from "@/lib/cadastros/bancos";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { TIPOS_CONTA } from "@/lib/cadastros/opcoes";
import { hojeIso } from "@/lib/datas";
import { carregarContas } from "@/lib/listagem/cadastros";
import { camposAvancados, lerPreferencia, paginar } from "@/lib/listagem/servidor";
import { TelaContas } from "./tela";

export const metadata = { title: "Contas Financeiras" };
const CAMINHO = "/cadastros/contas-financeiras";
const TELA = "contas-financeiras";

export default async function PaginaContas({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const [preferencia, campos, bancos] = await Promise.all([lerPreferencia(TELA), camposAvancados(TELA), listarBancos()]);
  const r = await carregarContas(sp, preferencia);
  const pagina = paginar(r.linhas, r.f.pagina, preferencia.porPagina, preferencia.semPaginacao);

  return (
    <MolduraLista
      titulo="Contas Financeiras"
      filtros={
        <PainelFiltros caminho={CAMINHO} avancado={{ campos, valor: parametro(sp, "av") }}>
          <FiltroTexto nome="busca" rotulo="Conta Financeira" valor={r.f.busca} />
          <FiltroSelecao nome="tipo" rotulo="Tipo" valor={r.tipo} opcoes={[{ valor: "", rotulo: "Todos" }, ...TIPOS_CONTA]} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={r.f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaContas
        linhas={pagina.linhas}
        total={pagina.total}
        filtros={{ ...r.f, pagina: pagina.pagina, tipo: r.tipo }}
        caminho={CAMINHO}
        bancos={bancos}
        hoje={hojeIso()}
        preferencia={preferencia}
      />
    </MolduraLista>
  );
}
