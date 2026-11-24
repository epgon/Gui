/**
 * Monta o arquivo .env para rodar o Gui no seu computador.
 * Uso: npm run configurar
 * Nenhuma senha passa pelo chat: tudo é digitado aqui, no terminal.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { perguntar } from "./perguntar";

async function main() {
  if (existsSync(".env")) {
    const resp = await perguntar("Já existe um arquivo .env. Substituir? (s/N) ");
    if (resp.toLowerCase() !== "s") {
      console.log("Nada foi alterado.");
      return;
    }
  }

  console.log("Cole a connection string do Neon (Dashboard > Connect). Ela não aparece na tela.");
  const url = await perguntar("DATABASE_URL: ", { esconder: true });
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("Endereço inválido: deve começar com postgresql://");

  const linhas = [
    "# Gerado por npm run configurar. Não envie este arquivo para ninguém.",
    `DATABASE_URL=${url}`,
    `AUTH_SECRET=${randomBytes(32).toString("base64")}`,
    "",
  ];
  writeFileSync(".env", linhas.join("\n"), { mode: 0o600 });
  console.log("Arquivo .env criado. Próximos passos: npm run db:migrar e npm run criar-usuario");
}

main().catch((erro) => {
  console.error("Erro:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
