import { desc } from "drizzle-orm";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { getDb, schema } from "@/db";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { lerValorEmCentavos } from "@/lib/dinheiro";
import { compararPlano, type MesComparado } from "@/lib/dividas/plano";
import { carregarAnalisePlanoAtivo, lerHistoricoPlanos, lerLinhasDoPlano, type PlanoLinha } from "@/lib/dividas/plano-servidor";
import { estaAtiva } from "@/lib/dividas/regras";
import { mesDe } from "@/lib/dividas/simulador";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaPlano, type AnaliseTela, type RascunhoInicial } from "./tela";

export const metadata = { title: "Plano de Quitação" };

const ESTRATEGIAS = ["bola_de_neve", "avalanche", "risco", "personalizada"];
const lista = (t: string) => t.split(",").map((x) => x.trim()).filter((x) => /^\d{1,9}$/.test(x));
const centavos = (t: string): number | null => (/^\d{1,12}$/.test(t) ? Number(t) : null);

export default async function PaginaPlano({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("dividas"))) return <RecursoDesativado titulo="Gestão de Dívidas" trilha="Gestão" />;
  const sp = await searchParams;
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const db = getDb();
  const [{ analise, completas, situacao }, historico, opcoes, guardadas] = await Promise.all([
    carregarAnalisePlanoAtivo(hoje),
    lerHistoricoPlanos(),
    carregarOpcoes(),
    db.select().from(schema.simulacao).orderBy(desc(schema.simulacao.criadoEm), desc(schema.simulacao.id)).limit(50),
  ]);

  const dividas = completas.filter((c) => estaAtiva(c.linha.situacao) && c.sim).map((c) => ({ linha: c.linha, sim: c.sim! }));
  const atual = mesDe(hoje);
  const pagoNoMes: Record<number, number> = {};
  for (const c of completas) {
    const soma = c.obrigacoes.filter((o) => o.dataPagamento && mesDe(o.dataPagamento) === atual).reduce((s, o) => s + o.valorCentavos, 0);
    if (soma > 0) pagoNoMes[c.linha.id] = soma;
  }

  // O rascunho: vem do Simulador (?novo=1&...), de uma simulação guardada (?simulacao=ID) ou do zero (?novo=1).
  let rascunho: RascunhoInicial | null = null;
  const idsAtivos = new Set(dividas.map((d) => d.linha.id));
  if (parametro(sp, "novo") === "1") {
    const pedidas = lista(parametro(sp, "dividas")).map(Number).filter((id) => idsAtivos.has(id));
    const ordem = lista(parametro(sp, "ordem")).map((id) => `d${id}`);
    rascunho = {
      origem: parametro(sp, "origem") === "simulacao" ? "simulacao" : "zero",
      simulacao: parametro(sp, "sim").slice(0, 80),
      estrategia: ESTRATEGIAS.includes(parametro(sp, "estrategia")) ? parametro(sp, "estrategia") : "avalanche",
      dividaIds: pedidas.length ? pedidas : dividas.map((d) => d.linha.id),
      ordem,
      valorMensalCentavos: parametro(sp, "solo") === "1" ? null : (centavos(parametro(sp, "valor")) ?? undefined),
      reservaCentavos: centavos(parametro(sp, "reserva")) ?? 0,
      extraValorCentavos: centavos(parametro(sp, "extraValor")) ?? 0,
      extraMes: /^\d{4}-\d{2}$/.test(parametro(sp, "extraMes")) ? parametro(sp, "extraMes") : "",
    };
  } else if (/^\d{1,9}$/.test(parametro(sp, "simulacao"))) {
    const g = guardadas.find((x) => x.id === Number(parametro(sp, "simulacao")));
    const p = g?.parametros && typeof g.parametros === "object" ? (g.parametros as Record<string, unknown>) : null;
    if (g && p) {
      const selecionadas = (Array.isArray(p.selecionadas) ? p.selecionadas : []).filter((x): x is string => typeof x === "string" && /^d\d+$/.test(x)).map((x) => Number(x.slice(1))).filter((id) => idsAtivos.has(id));
      const valorTexto = typeof p.valorMensal === "string" ? p.valorMensal : "";
      rascunho = {
        origem: "simulacao",
        simulacao: g.nome,
        estrategia: typeof p.estrategia === "string" && ESTRATEGIAS.includes(p.estrategia) ? p.estrategia : "avalanche",
        dividaIds: selecionadas.length ? selecionadas : dividas.map((d) => d.linha.id),
        ordem: (Array.isArray(p.ordem) ? p.ordem : []).filter((x): x is string => typeof x === "string" && /^d\d+$/.test(x)),
        valorMensalCentavos: p.semExtra === true ? null : valorTexto.trim() ? (lerValorEmCentavos(valorTexto) ?? null) : undefined,
        reservaCentavos: typeof p.reservaUsada === "string" ? (lerValorEmCentavos(p.reservaUsada) ?? 0) : 0,
        extraValorCentavos: typeof p.extraValor === "string" ? (lerValorEmCentavos(p.extraValor) ?? 0) : 0,
        extraMes: typeof p.extraMes === "string" && /^\d{4}-\d{2}$/.test(p.extraMes) ? p.extraMes : "",
      };
    }
  }

  // Uma versão antiga, só para ler (?versao=ID).
  let versao: { plano: PlanoLinha; meses: MesComparado[] } | null = null;
  const pedida = parametro(sp, "versao");
  if (/^\d{1,9}$/.test(pedida)) {
    const plano = historico.planos.find((p) => p.id === Number(pedida));
    if (plano) {
      const pagamentos = completas.flatMap((c) => c.obrigacoes.filter((o) => o.dataPagamento).map((o) => ({ dividaId: c.linha.id, data: o.dataPagamento!, valorCentavos: o.valorCentavos })));
      versao = { plano, meses: compararPlano({ linhas: await lerLinhasDoPlano(plano.id), pagamentos, hoje }) };
    }
  }

  const nomes: Record<number, string> = {};
  for (const c of completas) nomes[c.linha.id] = c.linha.descricao;
  // Só o que a tela usa vai para o navegador (a simulação inteira da previsão tem até 360 meses).
  const analiseTela: AnaliseTela | null = analise ? (({ paraConsultor, previsao, ...resto }) => (void paraConsultor, { ...resto, previsao: previsao ? { quitouTudo: previsao.quitouTudo, mesFinal: previsao.mesFinal, mesesAteQuitar: previsao.mesesAteQuitar, totalJurosCentavos: previsao.totalJurosCentavos } : null }))(analise) : null;
  const contas = opcoes.destinos.filter((d) => d.grupo === "Contas" && d.ativo);

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Gestão de Dívidas" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaPlano
            hoje={hoje}
            inicioYm={atual}
            situacao={situacao}
            dividas={dividas}
            nomes={nomes}
            pagoNoMes={pagoNoMes}
            analise={analiseTela}
            historico={historico}
            guardadas={guardadas.map((g) => ({ id: g.id, nome: g.nome, modo: g.modo, criadoEm: g.criadoEm.toISOString() }))}
            rascunho={rascunho}
            destinos={opcoes.destinos}
            contaPadrao={contas[0]?.valor ?? ""}
            versao={versao}
          />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
