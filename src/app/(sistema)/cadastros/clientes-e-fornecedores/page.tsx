import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { FiltroSelecao, FiltroTexto, PainelFiltros } from "@/components/cadastros/painel-filtros";
import { MolduraLista } from "@/components/cadastros/moldura-lista";
import { getDb, schema } from "@/db";
import { condicaoSituacao, contemTexto, lerFiltrosComuns, parametro, POR_PAGINA, type ParametrosBusca } from "@/lib/cadastros/filtros";
import { UFS } from "@/lib/cadastros/opcoes";
import { TelaContatos } from "./tela";

export const metadata = { title: "Clientes e Fornecedores" };
const CAMINHO = "/cadastros/clientes-e-fornecedores";

export default async function PaginaContatos({ searchParams }: { searchParams: Promise<ParametrosBusca> }) {
  const sp = await searchParams;
  const f = lerFiltrosComuns(sp);
  const papel = ["clientes", "fornecedores"].includes(parametro(sp, "papel")) ? parametro(sp, "papel") : "";
  const pessoa = ["fisica", "juridica"].includes(parametro(sp, "pessoa")) ? (parametro(sp, "pessoa") as "fisica" | "juridica") : "";
  const cidade = parametro(sp, "cidade").slice(0, 100);
  const uf = (UFS as readonly string[]).includes(parametro(sp, "uf")) ? parametro(sp, "uf") : "";
  const { contato: c } = schema;
  const onde = and(
    f.busca
      ? sql`(${contemTexto(c.nome, f.busca)} or ${contemTexto(c.razaoSocial, f.busca)} or ${contemTexto(c.documento, f.busca)} or ${contemTexto(c.email, f.busca)})`
      : undefined,
    papel === "clientes" ? eq(c.eCliente, true) : papel === "fornecedores" ? eq(c.eFornecedor, true) : undefined,
    pessoa ? eq(c.pessoa, pessoa) : undefined,
    cidade ? contemTexto(c.cidade, cidade) : undefined,
    uf ? eq(c.uf, uf) : undefined,
    condicaoSituacao(c.ativo, f.situacao),
  );
  const db = getDb();
  const [linhas, [{ total }]] = await Promise.all([
    db
      .select()
      .from(c)
      .where(onde)
      .orderBy(desc(c.ativo), asc(sql`lower(${c.nome})`))
      .limit(POR_PAGINA)
      .offset((f.pagina - 1) * POR_PAGINA),
    db.select({ total: count() }).from(c).where(onde),
  ]);

  return (
    <MolduraLista
      titulo="Clientes e Fornecedores"
      filtros={
        <PainelFiltros caminho={CAMINHO}>
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
        linhas={linhas}
        total={total}
        filtros={{ ...f, papel, pessoa, cidade, uf }}
        caminho={CAMINHO}
      />
    </MolduraLista>
  );
}
