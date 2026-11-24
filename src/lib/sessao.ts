import "server-only";
import { auth } from "@/auth";

/**
 * Toda ação que grava no banco chama esta função primeiro: as ações do servidor
 * podem ser chamadas direto pela internet, então o login é conferido de novo.
 */
export async function exigirLogin() {
  const sessao = await auth();
  if (!sessao?.user) throw new Error("Sessão expirada. Entre de novo no sistema.");
  return sessao.user;
}
