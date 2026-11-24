import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { verificarCredenciais } from "@/lib/usuario";

/** Tempo sem atividade até sair sozinho (padrão do Contas Online: 20 minutos). */
export const TEMPO_SESSAO_MINUTOS = 20;

const formularioLogin = z.object({
  email: z.string().trim().email(),
  senha: z.string().min(1),
});

class CredenciaisInvalidas extends CredentialsSignin {
  code = "credenciais_invalidas";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: TEMPO_SESSAO_MINUTOS * 60,
    updateAge: 60,
  },
  pages: { signIn: "/login" },
  // A Vercel já informa o endereço do site; isto permite rodar também no computador.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credenciais) {
        const dados = formularioLogin.safeParse(credenciais);
        if (!dados.success) throw new CredenciaisInvalidas();
        const usuario = await verificarCredenciais(dados.data.email, dados.data.senha);
        if (!usuario) throw new CredenciaisInvalidas();
        return { id: usuario.id, name: usuario.nome, email: usuario.email };
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
