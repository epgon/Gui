import { asc } from "drizzle-orm";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { getDb, schema } from "@/db";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { hojeIso } from "@/lib/datas";
import { PROVEDORES } from "@/lib/dividas/consultor/ia/provedores";
import { lerChaveIA, lerUsoDoDia } from "@/lib/dividas/consultor/ia/servidor";
import { lerParametros, recursoAtivo } from "@/lib/parametros/servidor";
import { SECOES, type Secao } from "./secoes";
import { TelaParametros } from "./tela";

export const metadata = { title: "Parâmetros" };

export default async function PaginaParametros({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const pedida = parametro(sp, "secao");
  const secao = (SECOES.some((s) => s.chave === pedida) ? pedida : "gerais") as Secao;
  const { feriado, contaFinanceira: conta, cartaoCredito: cartao } = schema;
  const db = getDb();
  const [parametros, feriados, contas, cartoes] = await Promise.all([
    lerParametros(),
    db.select({ id: feriado.id, nome: feriado.nome, dia: feriado.dia, mes: feriado.mes, ano: feriado.ano, recorrente: feriado.recorrente, ativo: feriado.ativo }).from(feriado).orderBy(asc(feriado.mes), asc(feriado.dia), asc(feriado.ano)),
    db.select({ id: conta.id, descricao: conta.descricao, ativo: conta.ativo }).from(conta).orderBy(asc(conta.ordem), asc(conta.descricao)),
    db.select({ id: cartao.id, descricao: cartao.descricao, ativo: cartao.ativo }).from(cartao).orderBy(asc(cartao.ordem), asc(cartao.descricao)),
  ]);

  const ia = {
    chaveCadastrada: lerChaveIA() !== null,
    usadasHoje: secao === "ia" ? await lerUsoDoDia(hojeIso()) : 0,
    ligado: await recursoAtivo("consultor_ia"),
    provedores: PROVEDORES.map((x) => ({ id: x.id, rotulo: x.rotulo, modeloPadrao: x.modeloPadrao, precisaChave: x.precisaChave })),
  };

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Parâmetros" trilha="Configurações" />
        <div className="p-6">
          <TelaParametros secao={secao} parametros={parametros} feriados={feriados} contas={contas} cartoes={cartoes} anoAtual={Number(hojeIso().slice(0, 4))} ia={ia} />
        </div>
      </main>
      <PainelAjuda trilha={["Configurações", "Parâmetros"]} artigos={["Cada seção tem o seu botão Salvar Alterações.", "Feriados são usados no \"Apenas dia útil\" dos recorrentes."]} />
    </>
  );
}
