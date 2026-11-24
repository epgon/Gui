import { FiltroSelecao, FiltroTexto, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { UFS } from "@/lib/cadastros/opcoes";
import { TelaContatos } from "./tela";
import { RecursoDesativado } from "@/components/layout/recurso-desativado";
import { parametro, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { carregarContatos } from "@/lib/listagem/cadastros";
import { camposAvancados, lerPreferencia, paginar } from "@/lib/listagem/servidor";
import { recursoAtivo } from "@/lib/parametros/servidor";

export const metadata = { title: "Clientes e Fornecedores" };
const CAMINHO = "/cadastros/clientes-e-fornecedores";
const TELA = "clientes-e-fornecedores";

export default async function PaginaContatos({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  if (!(await recursoAtivo("contatos"))) return <RecursoDesativado titulo="Clientes e Fornecedores" trilha="Cadastros" />;
  const sp = await searchParams;
  const [preferencia, campos] = await Promise.all([lerPreferencia(TELA), camposAvancados(TELA)]);
  const r = await carregarContatos(sp, preferencia);
  const { f, papel, pessoa, cidade, uf } = r;
  const pagina = paginar(r.linhas, f.pagina, preferencia.porPagina);

  return (
    <MolduraLista
      titulo="Clientes e Fornecedores"
      filtros={
        <PainelFiltros caminho={CAMINHO} avancado={{ campos, valor: parametro(sp, "av") }}>
          <FiltroTexto nome="busca" rotulo="Nome, Documento ou E-mail" valor={f.busca} />
          <FiltroSelecao
            nome="papel"
            rotulo="Mostrar"
            valor={papel}
            opcoes={[
              { valor: "", rotulo: "Clientes e Fornecedores" },
              { valor: "clientes", rotulo: "Só Clientes" },
              { valor: "fornecedores", rotulo: "Só Fornecedores" },
            ]}
          />
          <FiltroSelecao
            nome="pessoa"
            rotulo="Pessoa"
            valor={pessoa}
            opcoes={[
              { valor: "", rotulo: "Física e Jurídica" },
              { valor: "fisica", rotulo: "Física" },
              { valor: "juridica", rotulo: "Jurídica" },
            ]}
          />
          <FiltroTexto nome="cidade" rotulo="Cidade" valor={cidade} />
          <FiltroSelecao nome="uf" rotulo="Estado" valor={uf} opcoes={[{ valor: "", rotulo: "Todos" }, ...UFS.map((u) => ({ valor: u, rotulo: u }))]} />
          <FiltroSelecao
            nome="situacao"
            rotulo="Situação"
            valor={f.situacao}
            opcoes={[
              { valor: "todos", rotulo: "Todos" },
              { valor: "ativos", rotulo: "Ativos" },
              { valor: "inativos", rotulo: "Inativos" },
            ]}
          />
        </PainelFiltros>
      }
    >
      <TelaContatos
        linhas={pagina.linhas}
        total={pagina.total}
        filtros={{ ...f, pagina: pagina.pagina, papel, pessoa, cidade, uf }}
        caminho={CAMINHO}
        preferencia={preferencia}
      />
    </MolduraLista>
  );
}
