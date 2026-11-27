import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { hojeIso } from "@/lib/datas";
import { carregarPainelDividas } from "@/lib/dividas/consultor/servidor";
import { carregarContasEmAberto } from "@/lib/dividas/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaVisaoGeralDividas } from "./tela";

export const metadata = { title: "Gestão de Dívidas" };

const ARTIGOS = [
  "Como cadastrar uma dívida com parcelas fixas ou só com o saldo",
  "Como as parcelas aparecem em Lançamentos, Agenda e Vencidos",
  "Como atualizar o saldo com o que o credor informou",
  "O que são as contas em aberto no Gui",
  "Como o Consultor Gui calcula os alertas (clique em Por quê?)",
];

export default async function PaginaDividas() {
  if (!(await recursoAtivo("dividas"))) return <RecursoDesativado titulo="Gestão de Dívidas" trilha="Gestão" />;
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const [painel, abertas] = await Promise.all([carregarPainelDividas(hoje), carregarContasEmAberto(hoje)]);
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Gestão de Dívidas" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaVisaoGeralDividas
            dados={{
              resumo: painel.resumo,
              linhas: painel.linhas,
              jurosMesCentavos: painel.jurosMesCentavos,
              parcelasMesCentavos: painel.parcelasMesCentavos,
              percentualRenda: painel.percentualRenda,
              nivelRenda: painel.nivelRenda,
              limitesRenda: { atencao: painel.limites.rendaAtencaoPct, alta: painel.limites.rendaAltaPct },
              previsao: painel.previsao,
              evolucao: painel.evolucao,
              porCredor: painel.porCredor,
              porTipo: painel.porTipo,
              visiveis: painel.visiveis,
              escondidos: painel.escondidos,
            }}
            abertas={{ quantidade: abertas.contas.length, valorCentavos: abertas.contas.reduce((s, c) => s + c.valorCentavos, 0) }}
            hoje={hoje}
          />
        </div>
      </main>
      <PainelAjuda trilha={["Gestão", "Gestão de Dívidas"]} artigos={ARTIGOS} />
    </>
  );
}
