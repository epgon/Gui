import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { carregarCategorias } from "@/lib/listagem/cadastros";
import { camposAvancados, lerPreferencia } from "@/lib/listagem/servidor";
import { TelaCategorias } from "./tela";

export const metadata = { title: "Categorias" };
const CAMINHO = "/cadastros/categorias";
const TELA = "categorias";

export default async function PaginaCategorias({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const [preferencia, campos] = await Promise.all([lerPreferencia(TELA), camposAvancados(TELA)]);
  const { f, aba, raizes, arvore, linhas } = await carregarCategorias(sp);
  const abas = [
    { id: null, nome: "Todas", cor: null, total: arvore.length },
    ...raizes.map((r) => ({ id: r.id, nome: r.nome, cor: r.corEfetiva, total: arvore.filter((c) => c.raizId === r.id && c.id !== r.id).length })),
  ];

  return (
    <MolduraLista
      titulo="Categorias"
      filtros={
        <PainelFiltros caminho={CAMINHO} avancado={{ campos, valor: parametro(sp, "av") }}>
          {aba !== null && <input type="hidden" name="aba" value={aba} />}
          <FiltroTexto nome="busca" rotulo="Categoria ou Numeração" valor={f.busca} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaCategorias linhas={linhas} arvore={arvore} abas={abas} aba={aba} filtros={f} caminho={CAMINHO} preferencia={preferencia} />
    </MolduraLista>
  );
}
