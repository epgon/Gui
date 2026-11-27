/**
 * Leitor da fatura do cartão de crédito do Banco do Brasil (Ourocard) em PDF.
 * Recebe o texto já tirado do PDF (ver pdf.ts: uma linha por linha do PDF, colunas separadas por tabulação).
 *
 * - A fatura só traz dia e mês: o ano sai da data de fechamento (nenhum lançamento é depois dela).
 * - Parcelas ("PARC 03/12") vêm com a data da compra original. Levamos a data para o mês da parcela
 *   (compra + 2 meses na parcela 3), do mesmo jeito que o sistema grava as parcelas de uma compra parcelada.
 *   Assim a parcela cai na fatura certa e encontra o lançamento, se você já cadastrou a compra parcelada.
 * - Saldo da fatura anterior e pagamentos da fatura não entram: o pagamento é feito pela fatura no sistema.
 *   Estornos e outros créditos entram como receita no cartão.
 */
import { dataValida } from "@/lib/datas";
import { somarDias, somarMeses } from "@/lib/lancamentos/regras";
import { ErroArquivo } from "./ofx";
import { lerNumero, normalizar } from "./texto";
import type { TransacaoArquivo } from "./tipos";

export type InfoFaturaPdf = {
  banco: string;
  /** "Final 9430" */
  conta: string | null;
  cartao: true;
  /** Menor data dos lançamentos e data de fechamento. */
  inicio: string | null;
  fim: string;
  vencimento: string | null;
  totalCentavos: number | null;
  /** Saldo anterior e pagamentos da fatura, que não viram lançamento. */
  ignorados: number;
  /** Os lançamentos + saldo anterior batem com o total da fatura. */
  confere: boolean;
};

const ERRO_LAYOUT =
  "Por enquanto o sistema só lê em PDF a **fatura do cartão do Banco do Brasil**. Para outros bancos, baixe o extrato em **OFX** ou **CSV**.";

/** É a fatura do cartão do BB? (para escolher o leitor certo) */
export function eFaturaBb(texto: string): boolean {
  return /ourocard|banco do brasil|bb\.com\.br/i.test(texto) && /lan[çc]amentos nesta fatura/i.test(texto) && /fatura fechada em/i.test(texto);
}

/** "25/11/2026" -> "2026-11-25" */
function dataCompleta(texto: string | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto ?? "");
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return dataValida(iso) ? iso : null;
}

/** "26/10" -> a data mais recente com esse dia e mês que não passa do fechamento. */
export function dataNoAno(diaMes: string, fechamento: string): string | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(diaMes);
  if (!m) return null;
  const ano = Number(fechamento.slice(0, 4));
  for (const a of [ano, ano - 1]) {
    const iso = `${a}-${m[2]}-${m[1]}`;
    if (dataValida(iso) && iso <= fechamento) return iso;
  }
  return null;
}

const ehValor = (c: string) => /^R\$\s*-?[\d.]+,\d{2}$/.test(c);
const ehPais = (c: string) => /^[A-Z]{2}$/.test(c);

export function lerFaturaBb(texto: string): { transacoes: TransacaoArquivo[]; info: InfoFaturaPdf; puladas: number } {
  if (!eFaturaBb(texto)) throw new ErroArquivo(ERRO_LAYOUT);
  const fechamento = dataCompleta(/fatura fechada em\s+(\d{2}\/\d{2}\/\d{4})/i.exec(texto)?.[1]);
  if (!fechamento) throw new ErroArquivo("Não foi possível achar a data de fechamento nesta fatura do Banco do Brasil. Baixe o PDF de novo no aplicativo ou site do banco.");
  const vencimento = dataCompleta(/vencimento[\s\S]{0,200}?(\d{2}\/\d{2}\/\d{4})/i.exec(texto)?.[1]);
  const final = /final\s+(\d{4})/i.exec(texto)?.[1] ?? null;
  const total = lerNumero(/total da fatura\s+(R\$\s*-?[\d.]+,\d{2})/i.exec(texto)?.[1] ?? "", "virgula");

  const inicioLista = texto.search(/lan[çc]amentos nesta fatura/i);
  const fimLista = texto.search(/total da fatura/i);
  const linhas = texto.slice(inicioLista, fimLista > inicioLista ? fimLista : undefined).split(/\r?\n/);

  const transacoes: TransacaoArquivo[] = [];
  const ocorrencias = new Map<string, number>();
  let grupo = "";
  let cartaoDaLinha = final;
  let saldoAnterior = 0;
  let somaArquivo = 0;
  let ignorados = 0;
  let puladas = 0;

  for (const bruta of linhas) {
    const cols = bruta
      .split("\t")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!cols.length) continue;
    const ultima = cols[cols.length - 1];

    if (/^saldo fatura anterior/i.test(cols[0])) {
      saldoAnterior = ehValor(ultima) ? (lerNumero(ultima, "virgula") ?? 0) : 0;
      ignorados += 1;
      continue;
    }
    const titular = /\(cart[ãa]o\s+(\d{4})\)/i.exec(bruta);
    if (titular) {
      cartaoDaLinha = titular[1];
      grupo = "";
      continue;
    }
    if (!/^\d{2}\/\d{2}$/.test(cols[0])) {
      // Título do grupo ("Restaurantes", "Compras parceladas"...). Cotação do dólar e avisos não interessam.
      if (cols.length === 1 && !/R\$|^\*|^p[áa]gina|^cota[çc][ãa]o|^data$/i.test(cols[0]) && cols[0].length <= 40) grupo = cols[0];
      continue;
    }
    if (!ehValor(ultima) || cols.length < 3) {
      puladas += 1;
      continue;
    }
    const valor = lerNumero(ultima, "virgula");
    const meio = cols.slice(1, -1);
    const pais = meio.length > 1 && ehPais(meio[meio.length - 1]) ? meio.pop()! : null;
    const descricao = meio.join(" ").replace(/\s+/g, " ").trim();
    const dataOriginal = dataNoAno(cols[0], fechamento);
    if (valor === null || valor === 0 || !dataOriginal || !descricao) {
      puladas += 1;
      continue;
    }
    somaArquivo += valor;
    if (/^pagamentos/i.test(grupo) && valor < 0 && /pgto|pagamento/i.test(descricao)) {
      ignorados += 1;
      continue;
    }

    const parcela = /\bPARC\s+(\d{1,2})\/(\d{1,2})\b/i.exec(descricao);
    const numeroParcela = parcela ? Number(parcela[1]) : 1;
    let data = numeroParcela > 1 ? somarMeses(dataOriginal, numeroParcela - 1) : dataOriginal;
    // A parcela é desta fatura: não pode ficar depois do fechamento (no dia do fechamento já iria para a próxima).
    if (data !== dataOriginal && data >= fechamento) data = somarDias(fechamento, -1);

    const base = `bbpdf:${cartaoDaLinha ?? ""}:${dataOriginal}:${valor}:${normalizar(descricao)}`;
    const vez = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, vez);

    const bruto: Record<string, string> = { Data: cols[0], Descrição: descricao, Valor: ultima };
    if (pais) bruto["País"] = pais;
    if (grupo) bruto["Grupo na fatura"] = grupo;
    if (cartaoDaLinha) bruto["Cartão"] = `Final ${cartaoDaLinha}`;
    if (data !== dataOriginal) bruto["Data da compra"] = dataOriginal.split("-").reverse().join("/");

    transacoes.push({
      numeroLinha: transacoes.length + 1,
      data,
      valorCentavos: Math.abs(valor),
      // Na fatura, valor positivo é compra (despesa) e negativo é crédito.
      tipo: valor < 0 ? "receita" : "despesa",
      descricao: descricao.slice(0, 200),
      documento: null,
      fitid: `${base}:${vez}`.slice(0, 200),
      contato: null,
      categoria: null,
      bruto,
    });
  }

  const datas = transacoes.map((t) => t.data).sort();
  return {
    transacoes,
    puladas,
    info: {
      banco: "Banco do Brasil",
      conta: final ? `Final ${final}` : null,
      cartao: true,
      inicio: datas[0] ?? null,
      fim: fechamento,
      vencimento,
      totalCentavos: total,
      ignorados,
      confere: total !== null && saldoAnterior + somaArquivo === total,
    },
  };
}
