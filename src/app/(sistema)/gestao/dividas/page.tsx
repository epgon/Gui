import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { hojeIso } from "@/lib/datas";
import { carregarContasEmAberto, carregarResumoDividas } from "@/lib/dividas/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaVisaoGeralDividas } from "./tela";

export const metadata = { title: "Gestão de Dívidas" };

const ARTIGOS = [
  "Como cadastrar uma dívida com parcelas fixas ou só com o saldo",
  "Como as parcelas aparecem em Lançamentos, Agenda e Vencidos",
  "Como atualizar o saldo com o que o credor informou",
  "O que são as contas em aberto no Gui",
];

export default async function PaginaDividas() {
  if (!(await recursoAtivo("dividas"))) return <RecursoDesativado titulo="Gestão de Dívidas" trilha="Gestão" />;
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const [{ resumo, linhas }, abertas] = await Promise.all([carregarResumoDividas(hoje), carregarContasEmAberto(hoje)]);
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Gestão de Dívidas" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaVisaoGeralDividas resumo={resumo} linhas={linhas} abertas={{ quantidade: abertas.contas.length, valorCentavos: abertas.contas.reduce((s, c) => s + c.valorCentavos, 0) }} hoje={hoje} />
        </div>
      </main>
      <PainelAjuda trilha={["Gestão", "Gestão de Dívidas"]} artigos={ARTIGOS} />
    </>
  );
}
