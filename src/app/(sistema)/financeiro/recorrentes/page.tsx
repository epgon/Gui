import { asc, count, eq } from "drizzle-orm";
import { FiltroSelecao, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getDb, schema } from "@/db";
import { parametro, semAcento, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { descendentes, montarArvore, rotuloCategoria } from "@/lib/categorias";
import { formatarData, hojeIso } from "@/lib/datas";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { rotuloDia, rotuloIntervalo, INTERVALOS } from "@/lib/recorrentes/regras";
import { carregarContexto, carregarRegras, pendentes, realizarAutomaticos, valorETipo } from "@/lib/recorrentes/servidor";
import type { FiltrosRecorrentes, LinhaPlano, LinhaRecorrente } from "@/lib/recorrentes/tipos";
import { TelaRecorrentes } from "./tela";

export const metadata = { title: "Recorrentes" };
const CAMINHO = "/financeiro/recorrentes";

function lerFiltros(sp: ParametrosBusca): FiltrosRecorrentes {
  const aba = parametro(sp, "aba");
  const situacao = parametro(sp, "situacao");
  const intervalo = parametro(sp, "intervalo");
  const destino = parametro(sp, "destino");
  const id = (nome: string) => (/^\d+$/.test(parametro(sp, nome)) ? parametro(sp, nome) : "");
  return {
    aba: (["receitas", "despesas", "transferencias"].includes(aba) ? aba : "todos") as FiltrosRecorrentes["aba"],
    destino: /^(conta|cartao):\d+$/.test(destino) ? destino : "",
    intervalo: INTERVALOS.some((i) => i.valor === intervalo) ? intervalo : "",
    situacao: (["todos", "inativos"].includes(situacao) ? situacao : "ativos") as FiltrosRecorrentes["situacao"],
    busca: parametro(sp, "busca").slice(0, 100),
    detalhar: parametro(sp, "detalhar") === "1",
    categoria: id("categoria"),
    forma: id("forma"),
    contato: id("contato"),
    tag: id("tag"),
    plano: id("plano"),
  };
}

export default async function PaginaRecorrentes({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const sp = await searchParams;
  const f = lerFiltros(sp);
  const editar = Number(parametro(sp, "editar")) || null;
  const db = getDb();
  const { categoria, plano, recorrencia } = schema;

  const [regras, ctx, opcoes, todasCategorias, planosDb, usos] = await Promise.all([
    carregarRegras(db),
    carregarContexto(db, hoje),
    carregarOpcoes(),
    db
      .select({ id: categoria.id, nome: categoria.nome, categoriaPaiId: categoria.categoriaPaiId, ordem: categoria.ordem, cor: categoria.cor, natureza: categoria.natureza, especial: categoria.especial, ativo: categoria.ativo, padraoSistema: categoria.padraoSistema })
      .from(categoria),
    db.select().from(plano).orderBy(asc(plano.nome)),
    db.select({ planoId: recorrencia.planoId, total: count() }).from(recorrencia).where(eq(recorrencia.ativo, true)).groupBy(recorrencia.planoId),
  ]);
  const arvore = new Map(montarArvore(todasCategorias).map((c) => [c.id, c]));
  const destinos = new Map(opcoes.destinos.map((d) => [d.valor, d]));
  const nome = (lista: { id: number; rotulo: string }[], id: number | null) => (id ? (lista.find((x) => x.id === id)?.rotulo ?? null) : null);

  // Próximo vencimento ainda não lançado de cada recorrente ativo.
  const proximo = new Map<number, string>();
  for (const p of pendentes(ctx, ctx.horizonte)) if (!proximo.has(p.regra.id) || p.vencimento < proximo.get(p.regra.id)!) proximo.set(p.regra.id, p.vencimento);

  const categoriasFiltro = f.categoria ? new Set([Number(f.categoria), ...descendentes(todasCategorias, Number(f.categoria))]) : null;
  const busca = semAcento(f.busca).toLowerCase();

  const linhas: LinhaRecorrente[] = regras
    .filter((g) => {
      if (f.situacao === "ativos" && !g.ativo) return false;
      if (f.situacao === "inativos" && g.ativo) return false;
      if (f.aba === "transferencias" && g.formato !== "transferencia") return false;
      if (f.aba === "receitas" && (g.formato === "transferencia" || g.tipo !== "receita")) return false;
      if (f.aba === "despesas" && (g.formato === "transferencia" || g.tipo !== "despesa")) return false;
      if (f.destino) {
        const [qual, id] = f.destino.split(":");
        const n = Number(id);
        if (qual === "cartao" ? g.cartaoId !== n : g.contaId !== n && g.contaDestinoId !== n) return false;
      }
      if (f.intervalo && g.intervalo !== f.intervalo) return false;
      if (busca && !semAcento(g.descricao).toLowerCase().includes(busca)) return false;
      if (categoriasFiltro && !(g.categoriaId && categoriasFiltro.has(g.categoriaId)) && !g.itens.some((i) => categoriasFiltro.has(i.categoriaId))) return false;
      if (f.forma && g.formaPagamentoId !== Number(f.forma)) return false;
      if (f.contato && g.contatoId !== Number(f.contato)) return false;
      if (f.tag && !g.tagIds.includes(Number(f.tag))) return false;
      if (f.plano && g.planoId !== Number(f.plano)) return false;
      return true;
    })
    .map((g) => {
      const { tipo, valorCentavos } = valorETipo(g, ctx.ultimos.get(g.id) ?? []);
      const lugar = destinos.get(g.contaId ? `conta:${g.contaId}` : `cartao:${g.cartaoId}`);
      const cat = g.categoriaId ? arvore.get(g.categoriaId) : undefined;
      return {
        id: g.id,
        formato: g.formato,
        tipo,
        descricao: g.descricao,
        valorCentavos: tipo === "receita" && g.formato !== "transferencia" ? valorCentavos : -valorCentavos,
        mediaUltimos: g.mediaUltimos,
        intervalo: rotuloIntervalo(g.intervalo, g.intervaloDias),
        dia: rotuloDia(g),
        bancoCodigo: lugar?.bancoCodigo ?? null,
        bancoNome: lugar?.bancoNome ?? null,
        contaOuCartao: lugar?.rotulo ?? "",
        contaDestino: g.contaDestinoId ? (destinos.get(`conta:${g.contaDestinoId}`)?.rotulo ?? null) : null,
        categoria: cat ? rotuloCategoria(cat) : null,
        categoriaCor: cat?.corEfetiva ?? null,
        contato: nome(opcoes.contatos, g.contatoId),
        forma: nome(opcoes.formas, g.formaPagamentoId),
        plano: g.planoId ? (planosDb.find((p) => p.id === g.planoId)?.nome ?? null) : null,
        tags: g.tagIds.map((t) => nome(opcoes.tags, t) ?? "").filter(Boolean),
        itens: g.itens.map((i) => {
          const c = arvore.get(i.categoriaId);
          return { id: i.id, tipo: i.tipo, descricao: i.descricao, valorCentavos: i.tipo === "receita" ? i.valorCentavos : -i.valorCentavos, categoria: c ? rotuloCategoria(c) : "", categoriaCor: c?.corEfetiva ?? "#9CA3AF" };
        }),
        realizarAutomaticamente: g.realizarAutomaticamente,
        apenasDiaUtil: g.apenasDiaUtil,
        ativo: g.ativo,
        proximo: g.ativo ? (proximo.get(g.id) ?? null) : null,
        fim: g.repeticoes ? `${g.repeticoes} ${g.repeticoes === 1 ? "vez" : "vezes"}` : g.dataFim ? `até ${formatarData(g.dataFim)}` : "Sem fim",
      };
    })
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || (a.proximo ?? "9999").localeCompare(b.proximo ?? "9999") || a.descricao.localeCompare(b.descricao));

  const planos: LinhaPlano[] = planosDb.map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, tipo: p.tipo, valorCentavos: p.valorCentavos, ativo: p.ativo, usos: usos.find((u) => u.planoId === p.id)?.total ?? 0 }));
  const todas = { valor: "", rotulo: "Todas" };
  const mantidos = { aba: f.aba === "todos" ? "" : f.aba, destino: f.destino, intervalo: f.intervalo, busca: f.busca, detalhar: f.detalhar ? "1" : "" };

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Recorrentes" trilha="Financeiro" />
        <div className="space-y-4 p-6">
          <TelaRecorrentes linhas={linhas} filtros={f} opcoes={opcoes} planos={planos} hoje={hoje} caminho={CAMINHO} editarId={editar} />
        </div>
      </main>
      <PainelFiltros caminho={CAMINHO}>
        {Object.entries(mantidos)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <FiltroSelecao
          nome="situacao"
          rotulo="Situação"
          valor={f.situacao}
          opcoes={[
            { valor: "ativos", rotulo: "Ativos" },
            { valor: "inativos", rotulo: "Inativos" },
            { valor: "todos", rotulo: "Todos" },
          ]}
        />
        <FiltroSelecao
          nome="categoria"
          rotulo="Categorias"
          valor={f.categoria}
          opcoes={[todas, ...opcoes.categorias.map((c) => ({ valor: String(c.id), rotulo: "  ".repeat(c.nivel - 1) + c.rotulo }))]}
        />
        <FiltroSelecao nome="forma" rotulo="Formas de Pagamento" valor={f.forma} opcoes={[todas, ...opcoes.formas.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="contato" rotulo="Clientes e Fornecedores" valor={f.contato} opcoes={[{ valor: "", rotulo: "Todos" }, ...opcoes.contatos.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="tag" rotulo="Tags" valor={f.tag} opcoes={[todas, ...opcoes.tags.map((o) => ({ valor: String(o.id), rotulo: o.rotulo }))]} />
        <FiltroSelecao nome="plano" rotulo="Planos" valor={f.plano} opcoes={[{ valor: "", rotulo: "Todos" }, ...planos.map((p) => ({ valor: String(p.id), rotulo: p.nome }))]} />
      </PainelFiltros>
    </>
  );
}
