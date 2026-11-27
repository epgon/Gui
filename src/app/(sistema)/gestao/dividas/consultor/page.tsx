import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjudaDividas } from "@/components/ajuda/central-ajuda";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { lerConfigIA } from "@/lib/dividas/consultor/ia/servidor";
import { carregarPainelDividas, listarAssuntos, listarMensagens } from "@/lib/dividas/consultor/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";
import { realizarAutomaticos } from "@/lib/recorrentes/servidor";
import { TelaConsultor } from "./tela";

export const metadata = { title: "Consultor Gui" };

export default async function PaginaConsultor({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("dividas"))) return <RecursoDesativado titulo="Gestão de Dívidas" trilha="Gestão" />;
  const sp = await searchParams;
  const hoje = hojeIso();
  await realizarAutomaticos(hoje);
  const [painel, assuntos, cfg] = await Promise.all([carregarPainelDividas(hoje), listarAssuntos(), lerConfigIA(hoje)]);
  const pedido = parametro(sp, "assunto");
  const escolhido = /^\d+$/.test(pedido) ? assuntos.find((a) => a.id === Number(pedido)) : undefined;
  const mensagens = escolhido ? await listarMensagens(escolhido.id) : [];
  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Gestão de Dívidas" trilha="Gestão" />
        <div className="space-y-4 p-6">
          <TelaConsultor assuntos={assuntos} escolhido={escolhido?.id ?? null} mensagens={mensagens} alertas={{ visiveis: painel.visiveis, escondidos: painel.escondidos }} mostrarArquivados={parametro(sp, "arquivados") === "1"} ia={{ ligado: cfg.ligado, pronto: cfg.pronto, chaveCadastrada: cfg.chaveCadastrada, provedor: cfg.provedor?.rotulo ?? cfg.provedorId, usadasHoje: cfg.usadasHoje, limiteDiario: cfg.limiteDiario }} />
        </div>
      </main>
      <PainelAjudaDividas tela="consultor" trilha={["Gestão", "Gestão de Dívidas", "Consultor Gui"]} />
    </>
  );
}
