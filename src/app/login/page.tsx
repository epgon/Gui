import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoGui } from "@/components/layout/logo-gui";
import { FormularioLogin } from "./formulario";

export const metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  const sessao = await auth();
  if (sessao?.user) redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 items-center bg-verde px-6">
        <LogoGui variante="claro" className="text-[26px]" />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-borda bg-white shadow-cartao md:grid-cols-2">
          <div className="flex flex-col items-center justify-center border-b border-borda bg-white p-8 text-center md:border-r md:border-b-0">
            <Image src="/gui-mascote.jpg" alt="Mascote Gui" width={420} height={229} className="h-auto w-full max-w-sm mix-blend-multiply" priority />
            <p className="mt-2 text-lg font-semibold text-verde">Seu guia financeiro pessoal</p>
            <p className="text-sm text-gray-600">Contas, cartões e orçamentos em um só lugar.</p>
          </div>
          <div className="p-8 md:p-10">
            <LogoGui className="text-4xl" />
            <h1 className="mt-6 text-xl font-semibold text-gray-900">Acesse sua conta</h1>
            <p className="mb-6 text-sm text-gray-500">Entre com seu e-mail e senha.</p>
            <FormularioLogin />
          </div>
        </div>
      </main>
    </div>
  );
}
