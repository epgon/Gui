import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { PainelAjuda } from "@/components/layout/painel-ajuda";
import { getDb, schema } from "@/db";
import { lerTempoSessao } from "@/lib/usuario";
import { TelaMeusDados } from "./tela";

export const metadata = { title: "Meus Dados" };

export default async function PaginaMeusDados() {
  const sessao = await auth();
  const id = Number(sessao?.user?.id);
  if (!Number.isInteger(id) || id <= 0) redirect("/login");
  const [[u], tempoSessao] = await Promise.all([
    getDb().select().from(schema.usuario).where(eq(schema.usuario.id, id)).limit(1),
    lerTempoSessao(),
  ]);
  if (!u) redirect("/login");

  return (
    <>
      <main className="min-w-0 flex-1">
        <CabecalhoPagina titulo="Meus Dados" trilha="Administração" />
        <div className="p-6">
          <TelaMeusDados
            perfil={{
              nome: u.nome,
              apelido: u.apelido ?? "",
              email: u.email,
              telefone: u.telefone ?? "",
              nascimento: u.nascimento ?? "",
              sexo: u.sexo,
              cep: u.cep ?? "",
              logradouro: u.logradouro ?? "",
              numero: u.numero ?? "",
              complemento: u.complemento ?? "",
              bairro: u.bairro ?? "",
              cidade: u.cidade ?? "",
              uf: u.uf ?? "",
            }}
            tempoSessao={tempoSessao}
            desde={u.criadoEm.toISOString().slice(0, 10)}
          />
        </div>
      </main>
      <PainelAjuda artigos={["Meus Dados: perfil e endereço", "Trocar a senha de acesso", "Tempo da sessão"]} />
    </>
  );
}
