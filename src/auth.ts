import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { TEMPO_SESSAO_MAXIMO, TEMPO_SESSAO_PADRAO } from "@/lib/preferencias";
import { lerTempoSessao, verificarCredenciais } from "@/lib/usuario";

const formularioLogin = z.object({
  email: z.string().trim().email(),
  senha: z.string().min(1),
});

class CredenciaisInvalidas extends CredentialsSignin {
  code = "credenciais_invalidas";
}

const agoraEmSegundos = () => Math.floor(Date.now() / 1000);

export const { handlers, auth, signIn, signOut, unstable_update: atualizarSessao } = NextAuth({
  session: {
    strategy: "jwt",
    // O cookie dura o tempo máximo; quem decide a saída por falta de uso é o callback "jwt" abaixo,
    // com o "Tempo da Sessão" escolhido em Meus Dados (padrão: 20 minutos).
    maxAge: TEMPO_SESSAO_MAXIMO * 60,
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
    async jwt({ token, user, trigger, session }) {
      const agora = agoraEmSegundos();
      if (user) {
        // Acabou de entrar.
        token.tempoSessao = await lerTempoSessao();
        token.ultimaAtividade = agora;
        return token;
      }
      if (trigger === "update") {
        // Meus Dados mudou o nome, o e-mail ou o tempo da sessão.
        const novo = (session as { user?: { name?: string; email?: string } } | undefined)?.user;
        if (novo?.name) token.name = novo.name;
        if (novo?.email) token.email = novo.email;
        token.tempoSessao = await lerTempoSessao();
      }
      const limite = (typeof token.tempoSessao === "number" ? token.tempoSessao : TEMPO_SESSAO_PADRAO) * 60;
      const ultima = typeof token.ultimaAtividade === "number" ? token.ultimaAtividade : agora;
      if (agora - ultima > limite) return null; // ficou parado tempo demais: sai do sistema
      token.ultimaAtividade = agora;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
