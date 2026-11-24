"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type EstadoLogin = { erro?: string; tipo?: "credenciais" | "sistema"; email?: string };

export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const email = String(dados.get("email") ?? "").trim();
  const senha = String(dados.get("senha") ?? "");
  if (!email) return { erro: "Preencha o campo E-mail.", tipo: "credenciais" };
  if (!senha) return { erro: "Preencha o campo Senha.", tipo: "credenciais", email };

  try {
    await signIn("credentials", { email, senha, redirectTo: "/" });
    return {};
  } catch (erro) {
    if (erro instanceof AuthError) {
      if (erro.type === "CredentialsSignin") {
        return { erro: "E-mail ou senha incorretos.", tipo: "credenciais", email };
      }
      console.error("[Gui] Erro no login:", erro.cause ?? erro);
      return { erro: "Não foi possível verificar o acesso agora.", tipo: "sistema", email };
    }
    throw erro; // o redirecionamento após o login também passa por aqui
  }
}
