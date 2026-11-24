/**
 * Leitor de OFX (extrato bancário). Aceita o formato antigo (SGML, sem fechar as tags,
 * comum nos bancos brasileiros) e o novo (XML). Sem bibliotecas: só o que precisamos.
 */
import { dataValida } from "@/lib/datas";
import { lerNumero } from "./texto";
import type { TransacaoArquivo } from "./tipos";

export type InfoOfx = {
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  cartao: boolean;
  inicio: string | null;
  fim: string | null;
  saldoCentavos: number | null;
  saldoData: string | null;
};

export class ErroArquivo extends Error {}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function limpar(valor: string): string {
  return valor
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Valor de uma tag dentro de um trecho: "<MEMO>Compra" (SGML) ou "<MEMO>Compra</MEMO>" (XML). */
function tag(trecho: string, nome: string): string | null {
  const m = new RegExp(`<${nome}>([^<\\r\\n]*)`, "i").exec(trecho);
  if (!m) return null;
  const v = limpar(m[1]);
  return v || null;
}

/** "20261124", "20261124120000[-3:BRT]" -> "2026-11-24" */
export function lerDataOfx(texto: string | null): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(texto ?? "");
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return dataValida(iso) ? iso : null;
}

export function lerOfx(texto: string): { transacoes: TransacaoArquivo[]; info: InfoOfx; puladas: number } {
  if (!/<OFX>/i.test(texto) || !/<STMTTRN>/i.test(texto)) {
    if (/<OFX>/i.test(texto)) return { transacoes: [], info: lerInfo(texto), puladas: 0 };
    throw new ErroArquivo("Este arquivo não parece ser um OFX válido. Baixe de novo o extrato no site ou aplicativo do banco, no formato **OFX** (às vezes chamado de Money).");
  }
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const transacoes: TransacaoArquivo[] = [];
  let puladas = 0;
  blocos.forEach((bloco, i) => {
    const data = lerDataOfx(tag(bloco, "DTPOSTED")) ?? lerDataOfx(tag(bloco, "DTUSER"));
    const valor = lerNumero(tag(bloco, "TRNAMT") ?? "", "auto");
    if (!data || valor === null || valor === 0) {
      puladas += 1;
      return;
    }
    const memo = tag(bloco, "MEMO");
    const nome = tag(bloco, "NAME") ?? tag(bloco, "PAYEE");
    // Alguns bancos repetem o nome no memo; outros só preenchem um dos dois.
    const descricao = [nome, memo].filter((x, j, a): x is string => !!x && a.findIndex((y) => y?.toLowerCase() === x.toLowerCase()) === j).join(" - ") || tag(bloco, "TRNTYPE") || "Sem descrição";
    const fitid = tag(bloco, "FITID");
    const documento = tag(bloco, "CHECKNUM") ?? tag(bloco, "REFNUM");
    const bruto: Record<string, string> = {};
    for (const m of bloco.matchAll(/<([A-Z0-9.]+)>([^<\r\n]*)/gi)) if (limpar(m[2])) bruto[m[1].toUpperCase()] = limpar(m[2]);
    transacoes.push({
      numeroLinha: i + 1,
      data,
      valorCentavos: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
      descricao: descricao.slice(0, 200),
      documento: documento && documento !== "0" ? documento.slice(0, 60) : null,
      fitid: fitid ? fitid.slice(0, 200) : null,
      contato: null,
      categoria: null,
      bruto,
    });
  });
  return { transacoes, info: lerInfo(texto), puladas };
}

function lerInfo(texto: string): InfoOfx {
  const saldo = texto.split(/<LEDGERBAL>/i)[1] ?? "";
  const valorSaldo = saldo ? lerNumero(tag(saldo, "BALAMT") ?? "", "auto") : null;
  return {
    banco: tag(texto, "ORG") ?? tag(texto, "BANKID"),
    agencia: tag(texto, "BRANCHID"),
    conta: tag(texto, "ACCTID"),
    cartao: /<CCSTMTRS>|<CREDITCARDMSGSRSV1>/i.test(texto),
    inicio: lerDataOfx(tag(texto, "DTSTART")),
    fim: lerDataOfx(tag(texto, "DTEND")),
    saldoCentavos: valorSaldo,
    saldoData: saldo ? lerDataOfx(tag(saldo, "DTASOF")) : null,
  };
}
