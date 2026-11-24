import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { alturaAbaixo, montarArvore } from "@/lib/categorias";
import { filtrarCategorias } from "@/lib/cadastros/condicoes";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { TelaCategorias } from "./tela";

export const metadata = { title: "Categorias" };
const CAMINHO = "/cadastros/categorias";

export default async function PaginaCategorias({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const { categoria } = schema;
  const todas = await getDb()
    .select({
      id: categoria.id,
      nome: categoria.nome,
      categoriaPaiId: categoria.categoriaPaiId,
      ordem: categoria.ordem,
      cor: categoria.cor,
      natureza: categoria.natureza,
      especial: categoria.especial,
      ativo: categoria.ativo,
      padraoSistema: categoria.padraoSistema,
    })
    .from(categoria);
  const arvore = montarArvore(todas).map((c) => ({ ...c, altura: alturaAbaixo(todas, c.id) }));

  const { f, aba, raizes, linhas } = filtrarCategorias(arvore, sp);
  const abas = [
    { id: null, nome: "Todas", cor: null, total: arvore.length },
    ...raizes.map((r) => ({ id: r.id, nome: r.nome, cor: r.corEfetiva, total: arvore.filter((c) => c.raizId === r.id && c.id !== r.id).length })),
  ];

  return (
    <MolduraLista
      titulo="Categorias"
      filtros={
        <PainelFiltros caminho={CAMINHO}>
          {aba !== null && <input type="hidden" name="aba" value={aba} />}
          <FiltroTexto nome="busca" rotulo="Categoria ou Numeração" valor={f.busca} />
          <FiltroSelecao nome="situacao" rotulo="Situação" valor={f.situacao} opcoes={OPCOES_SITUACAO} />
        </PainelFiltros>
      }
    >
      <TelaCategorias linhas={linhas} arvore={arvore} abas={abas} aba={aba} filtros={f} caminho={CAMINHO} />
    </MolduraLista>
  );
}
