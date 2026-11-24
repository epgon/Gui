import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { BarraFavoritos } from "@/components/layout/barra-favoritos";
import { BarraSuperior } from "@/components/layout/barra-superior";

/** Moldura de todas as telas internas. Quem não entrou é levado ao login. */
export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const sessao = await auth();
  if (!sessao?.user) redirect("/login");

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-full flex-col">
      <BarraSuperior nomeUsuario={sessao.user.name ?? "Usuário"} emailUsuario={sessao.user.email ?? ""} sair={sair} />
      <div className="flex flex-1">
        <BarraFavoritos />
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
