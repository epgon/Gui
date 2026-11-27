import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import type { ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { carregarOpcoes } from "@/lib/lancamentos/consultas";
import { carregarEscolhidas, carregarOrcamento, lerFiltrosOrcamento } from "@/lib/orcamentos/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { carregarArvore } from "@/lib/relatorios/servidor";
import { PrimeiroAcesso, TelaOrcamento, type Raiz } from "./tela";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { recursoAtivo } from "@/lib/parametros/servidor";

export const metadata = { title: "Orçamentos" };


export default async function PaginaOrcamentos({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("orcamentos"))) return <RecursoDesativado titulo="Orçamentos" trilha="Gestão" />;
  const hoje = hojeIso();
  const sp = await searchParams;
  const [arvore, escolhidas] = await Promise.all([carregarArvore(), carregarEscolhidas()]);
  // Só categorias de nível 1 podem entrar; as filhas aparecem sozinhas.
  const raizes: Raiz[] = [...arvore.values()]
    .filter((c) => c.nivel === 1 && !c.especial && (c.ativo || escolhidas.includes(c.id)))
    .map((c) => ({ id: c.id, numero: c.numero, nome: c.nome, cor: c.corEfetiva, natureza: c.natureza }));

  if (!escolhidas.length) {
    return (
      <>
        <main className="min-w-0 flex-1">
          <CabecalhoPagina titulo="Orçamentos" trilha="Gestão" />
          <div className="p-6">
            <PrimeiroAcesso raizes={raizes} />
          </div>
        </main>
        <PainelAjuda />
      </>
    );
  }

  await realizarAutomaticos(hoje);
  const filtros = lerFiltrosOrcamento(sp, hoje);
  const [dados, opcoes] = await Promise.all([carregarOrcamento(filtros, hoje), carregarOpcoes()]);

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Orçamentos" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaOrcamento orcamento={dados.orcamento} mes={dados.mes} filtros={filtros} destinos={opcoes.destinos} raizes={raizes} escolhidas={dados.escolhidas} hoje={hoje} />
        </div>
      </main>
      <PainelAjuda />
    </>
  );
}
