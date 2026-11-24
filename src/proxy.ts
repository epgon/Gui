/**
 * Roda antes de cada página: renova a sessão enquanto você usa o sistema.
 * Sem uso pelo "Tempo da Sessão" (Meus Dados > Preferências), a sessão acaba e o login é pedido de novo.
 */
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
