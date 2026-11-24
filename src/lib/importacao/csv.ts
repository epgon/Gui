/**
 * Leitor de CSV (e TXT separado por ponto e vírgula, vírgula ou tabulação).
 * Os vínculos das colunas são escolhidos na tela e memorizados por conta.
 */
import { dataValida } from "@/lib/datas";
import { lerNumero, normalizar } from "./texto";
import type { ConfiguracaoCsv, TransacaoArquivo } from "./tipos";

/** Qual separador aparece de forma mais consistente nas primeiras linhas (fora das aspas). */
export function detectarSeparador(texto: string): ConfiguracaoCsv["separador"] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  let melhor: ConfiguracaoCsv["separador"] = ";";
  let pontos = -1;
  for (const sep of [";", ",", "\t"] as const) {
    const contagens = linhas.map((l) => dividirLinha(l, sep).length);
    const comColunas = contagens.filter((c) => c > 1);
    if (!comColunas.length) continue;
    // Mais linhas com o mesmo número de colunas vence.
    const moda = [...new Set(comColunas)].map((c) => [c, comColunas.filter((x) => x === c).length]).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const p = moda[1] * 100 + moda[0];
    if (p > pontos) {
      pontos = p;
      melhor = sep;
    }
  }
  return melhor;
}

function dividirLinha(linha: string, sep: string): string[] {
  return lerCsv(linha, sep)[0] ?? [];
}

/** Divide o texto em linhas e colunas, respeitando aspas ("a;b" é uma coluna só). Linhas vazias saem. */
export function lerCsv(texto: string, sep: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"' && campo.trim() === "") {
      aspas = true;
      campo = "";
    } else if (c === sep) {
      linha.push(campo.trim());
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo.trim());
      if (linha.some((x) => x !== "")) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo.trim());
  if (linha.some((x) => x !== "")) linhas.push(linha);
  return linhas;
}

/** "24/11/2026", "24/11/26", "2026-11-24", "24-11-2026", "11/24/2026" -> "2026-11-24" */
export function lerDataCsv(texto: string, formato: ConfiguracaoCsv["formatoData"]): string | null {
  const t = (texto ?? "").trim().slice(0, 19);
  let ano: string, mes: string, dia: string;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  const br = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?!\d)/.exec(t);
  if (iso) [, ano, mes, dia] = iso;
  else if (br && formato !== "aaaa-mm-dd") {
    [, dia, mes, ano] = br;
    if (formato === "mm/dd/aaaa") [dia, mes] = [mes, dia];
    if (ano.length === 2) ano = `20${ano}`;
  } else return null;
  const data = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  return dataValida(data) ? data : null;
}

const NOMES: Record<keyof ConfiguracaoCsv["colunas"], string[]> = {
  data: ["data", "date", "data lancamento", "data do lancamento", "data movimento", "dt lancamento", "data transacao", "vencimento", "data de vencimento"],
  descricao: ["descricao", "historico", "lancamento", "description", "title", "titulo", "estabelecimento", "detalhes", "memo"],
  valor: ["valor", "amount", "valor (r$)", "valor r$", "quantia", "montante", "valor do lancamento"],
  valorDebito: ["debito", "saida", "saidas", "valor debito", "debitos"],
  valorCredito: ["credito", "entrada", "entradas", "valor credito", "creditos"],
  tipo: ["tipo", "d/c", "c/d", "natureza", "tipo de lancamento", "tipo transacao"],
  documento: ["documento", "doc", "n documento", "numero documento", "nr documento", "id", "identificador"],
  contato: ["cliente", "fornecedor", "cliente/fornecedor", "favorecido", "pagador", "beneficiario", "contato"],
  categoria: ["categoria", "category"],
};

/** Sugere os vínculos e o formato olhando o cabeçalho e as primeiras linhas. */
export function sugerirConfiguracao(texto: string, cartao = false): ConfiguracaoCsv {
  const separador = detectarSeparador(texto);
  const linhas = lerCsv(texto, separador).slice(0, 30);
  const cabecalho = linhas[0] ?? [];
  const nomes = cabecalho.map(normalizar);
  const temCabecalho = cabecalho.length > 0 && cabecalho.every((c) => lerNumero(c) === null && !lerDataCsv(c, "dd/mm/aaaa")) && cabecalho.some((c) => /[a-z]/i.test(c));
  const colunas: ConfiguracaoCsv["colunas"] = { data: null, descricao: null, valor: null, valorDebito: null, valorCredito: null, tipo: null, documento: null, contato: null, categoria: null };
  const usadas = new Set<number>();
  if (temCabecalho) {
    for (const campo of Object.keys(NOMES) as (keyof typeof NOMES)[]) {
      const i = nomes.findIndex((n, j) => !usadas.has(j) && NOMES[campo].includes(n));
      if (i >= 0) {
        colunas[campo] = i;
        usadas.add(i);
      }
    }
  }
  const dados = temCabecalho ? linhas.slice(1) : linhas;
  const largura = Math.max(0, ...dados.map((l) => l.length));
  const coluna = (j: number) => dados.map((l) => l[j] ?? "").filter((v) => v !== "");
  // Sem cabeçalho (ou nomes desconhecidos): procura pelo conteúdo.
  if (colunas.data === null) {
    for (let j = 0; j < largura; j++) if (!usadas.has(j) && coluna(j).length && coluna(j).every((v) => lerDataCsv(v, "dd/mm/aaaa"))) { colunas.data = j; usadas.add(j); break; }
  }
  if (colunas.valor === null && colunas.valorDebito === null) {
    for (let j = largura - 1; j >= 0; j--) if (!usadas.has(j) && coluna(j).length && coluna(j).every((v) => lerNumero(v) !== null)) { colunas.valor = j; usadas.add(j); break; }
  }
  if (colunas.descricao === null) {
    let maior = -1;
    for (let j = 0; j < largura; j++) {
      if (usadas.has(j)) continue;
      const media = coluna(j).reduce((s, v) => s + (lerNumero(v) === null ? v.length : 0), 0) / Math.max(1, coluna(j).length);
      if (media > maior) { maior = media; colunas.descricao = j; }
    }
  }
  // Formato da data: se algum dia passa de 12 na segunda posição, é mês/dia.
  const datas = colunas.data !== null ? coluna(colunas.data) : [];
  let formatoData: ConfiguracaoCsv["formatoData"] = "dd/mm/aaaa";
  if (datas.some((d) => /^\d{4}-/.test(d))) formatoData = "aaaa-mm-dd";
  else if (datas.some((d) => Number(/^\d{1,2}[-/.](\d{1,2})/.exec(d)?.[1]) > 12)) formatoData = "mm/dd/aaaa";
  // Decimal: olha os valores.
  const valores = [colunas.valor, colunas.valorDebito, colunas.valorCredito].flatMap((j) => (j === null ? [] : coluna(j)));
  const decimal: ConfiguracaoCsv["decimal"] = valores.some((v) => /,\d{1,2}$/.test(v.trim())) || (separador !== "," && !valores.some((v) => /\.\d{1,2}$/.test(v.trim()))) ? "virgula" : "ponto";
  return { separador, decimal, formatoData, temCabecalho, inverterSinal: cartao, colunas };
}

const DEBITO = /^(d|deb|debito|saida|s|despesa|-|dr|debit|pagamento|compra)$/;
const CREDITO = /^(c|cred|credito|entrada|e|receita|\+|cr|credit|deposito)$/;

/** Aplica os vínculos: devolve as transações, quantas linhas foram puladas e o primeiro motivo. */
export function aplicarConfiguracao(texto: string, cfg: ConfiguracaoCsv): { transacoes: TransacaoArquivo[]; puladas: number; cabecalho: string[] } {
  const todas = lerCsv(texto, cfg.separador);
  const cabecalho = cfg.temCabecalho ? (todas[0] ?? []) : [];
  const dados = cfg.temCabecalho ? todas.slice(1) : todas;
  const c = cfg.colunas;
  const transacoes: TransacaoArquivo[] = [];
  let puladas = 0;
  const pegar = (l: string[], j: number | null) => (j === null ? "" : (l[j] ?? "").trim());
  dados.forEach((l, i) => {
    const numeroLinha = i + 1 + (cfg.temCabecalho ? 1 : 0);
    const data = lerDataCsv(pegar(l, c.data), cfg.formatoData);
    let valor: number | null = null;
    if (c.valor !== null) valor = lerNumero(pegar(l, c.valor), cfg.decimal);
    if ((valor === null || valor === 0) && (c.valorDebito !== null || c.valorCredito !== null)) {
      const deb = lerNumero(pegar(l, c.valorDebito), cfg.decimal);
      const cred = lerNumero(pegar(l, c.valorCredito), cfg.decimal);
      if (deb) valor = -Math.abs(deb);
      else if (cred) valor = Math.abs(cred);
    }
    const descricao = pegar(l, c.descricao).replace(/\s+/g, " ");
    if (!data || valor === null || valor === 0) {
      puladas += 1;
      return;
    }
    if (cfg.inverterSinal) valor = -valor;
    let tipo: "receita" | "despesa" = valor < 0 ? "despesa" : "receita";
    const textoTipo = normalizar(pegar(l, c.tipo));
    if (textoTipo) {
      if (DEBITO.test(textoTipo) || textoTipo.startsWith("deb") || textoTipo.startsWith("said")) tipo = "despesa";
      else if (CREDITO.test(textoTipo) || textoTipo.startsWith("cred") || textoTipo.startsWith("entr")) tipo = "receita";
    }
    const bruto: Record<string, string> = {};
    l.forEach((v, j) => {
      bruto[cabecalho[j] || `Coluna ${j + 1}`] = v;
    });
    transacoes.push({
      numeroLinha,
      data,
      valorCentavos: Math.abs(valor),
      tipo,
      descricao: (descricao || "Sem descrição").slice(0, 200),
      documento: pegar(l, c.documento).slice(0, 60) || null,
      fitid: null,
      contato: pegar(l, c.contato).slice(0, 120) || null,
      categoria: pegar(l, c.categoria).slice(0, 120) || null,
      bruto,
    });
  });
  return { transacoes, puladas, cabecalho };
}

/** Confere se os campos obrigatórios foram vinculados. Devolve a mensagem da faixa amarela ou null. */
export function conferirConfiguracao(cfg: ConfiguracaoCsv): string | null {
  const c = cfg.colunas;
  if (c.data === null) return "Vincule o campo **Data** a uma coluna do arquivo.";
  if (c.descricao === null) return "Vincule o campo **Descrição** a uma coluna do arquivo.";
  if (c.valor === null && c.valorDebito === null && c.valorCredito === null) return "Vincule o campo **Valor** (ou as colunas de saída e entrada) a uma coluna do arquivo.";
  return null;
}
