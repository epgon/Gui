import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { BarraFavoritos } from "@/components/layout/barra-favoritos";
import { BarraSuperior } from "@/components/layout/barra-superior";
import { ProvedorSistema } from "@/components/layout/provedor-sistema";
import { CHAVE_FAVORITOS, lerFavoritosDe } from "@/lib/favoritos";
import { calcularNotificacoes } from "@/lib/notificacoes/servidor";
import { lerConfiguracoes } from "@/lib/parametros/servidor";
import { lerParametrosDe, lerRecursosDe, telasOcultas } from "@/lib/parametros/tipos";

/** Moldura de todas as telas internas. Quem não entrou é levado ao login. */
export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const sessao = await auth();
  if (!sessao?.user) redirect("/login");

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const config = await lerConfiguracoes();
  const parametros = lerParametrosDe(config);
  const recursos = lerRecursosDe(config);
  const favoritos = lerFavoritosDe(config[CHAVE_FAVORITOS]);
  const ocultas = telasOcultas(recursos);
  // Os avisos nunca podem derrubar a tela: se algo falhar, o sino só fica vazio.
  const notificacoes = await calcularNotificacoes().catch((e): Awaited<ReturnType<typeof calcularNotificacoes>> => {
    console.error("Erro ao calcular as notificações", e);
    return { lista: [], lidas: [] };
  });

  return (
    <ProvedorSistema valor={{ parametros, recursos, favoritos }}>
      <div className="flex min-h-full flex-col">
        <BarraSuperior
          nomeUsuario={sessao.user.name ?? "Usuário"}
          emailUsuario={sessao.user.email ?? ""}
          sair={sair}
          titulo={parametros.titulo}
          ocultas={ocultas}
          notificacoes={notificacoes.lista.filter((n) => !notificacoes.lidas.includes(n.id))}
        />
        <div className="flex flex-1">
          <BarraFavoritos favoritos={favoritos.filter((f) => !ocultas.includes(f))} />
          <div className="flex min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </ProvedorSistema>
  );
}
