/** Perguntas no terminal, com opção de esconder o que é digitado (senhas). */
import readline from "node:readline";
import { Writable } from "node:stream";

export async function perguntar(texto: string, opcoes: { esconder?: boolean } = {}) {
  let mudo = false;
  const saida = new Writable({
    write(chunk, _enc, cb) {
      if (!mudo) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: saida, terminal: true });
  return new Promise<string>((resolve) => {
    rl.question(texto, (resposta) => {
      rl.close();
      if (opcoes.esconder) process.stdout.write("\n");
      resolve(resposta.trim());
    });
    if (opcoes.esconder) mudo = true;
  });
}
