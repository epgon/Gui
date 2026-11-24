import { FiltroSelecao, FiltroTexto, OPCOES_SITUACAO, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { alturaAbaixo, montarArvore } from "@/lib/categorias";
import { lerFiltrosComuns, parametro, semAcento, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { TelaCategorias } from "./tela";

export const metadata = { title: "Categorias" };
const CAMINHO = "/cadastros/categorias";

export default async function PaginaCategorias({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const f = lerFiltrosComuns(sp);
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

  const raizes = arvore.filter((c) => c.nivel === 1 && !c.especial);
  const abaId = Number(parametro(sp, "aba"));
  const aba = raizes.some((r) => r.id === abaId) ? abaId : null;
  const abas = [
    { id: null, nome: "Todas", cor: null, total: arvore.length },
    ...raizes.map((r) => ({ id: r.id, nome: r.nome, cor: r.corEfetiva, total: arvore.filter((c) => c.raizId === r.id && c.id !== r.id).length })),
  ];

  const termo = semAcento(f.busca).toLowerCase();
  const linhas = arvore.filter(
    (c) =>
      (aba === null || (c.raizId === aba && !c.especial)) &&
      (!termo || semAcento(c.nome).toLowerCase().includes(termo) || c.numero.startsWith(termo)) &&
      (f.situacao === "todos" || c.ativo === (f.situacao === "ativos")),
  );

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
