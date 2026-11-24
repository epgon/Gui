import { describe, expect, it } from "vitest";
import { aplicarConfiguracao, detectarSeparador, lerCsv, lerDataCsv, sugerirConfiguracao } from "./csv";
import { lerOfx } from "./ofx";
import { chaveDuplicidade, conciliar, condicaoAtende, regraQueAtende } from "./regras";
import { decodificar, lerNumero, normalizar } from "./texto";
import type { Candidato, RegraAplicavel } from "./tipos";

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261124120000[-3:BRT]<LANGUAGE>POR<FI><ORG>Banco Teste<FID>341</FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0341
<BRANCHID>1234
<ACCTID>56789-0
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261101
<DTEND>20261130
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105120000[-3:BRT]
<TRNAMT>-152.37
<FITID>20261105001
<CHECKNUM>000123
<MEMO>SUPERMERCADO BOM PRECO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261110
<TRNAMT>5000.00
<FITID>20261110002
<MEMO>SALARIO EMPRESA X &amp; CIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261112
<TRNAMT>-2887,34
<FITID>20261112003
<NAME>Pagamento de fatura
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1960.29
<DTASOF>20261130
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

describe("números e textos", () => {
  it("lê valores nos formatos brasileiro e americano", () => {
    expect(lerNumero("1.234,56")).toBe(123456);
    expect(lerNumero("-1.234,56")).toBe(-123456);
    expect(lerNumero("1234.56")).toBe(123456);
    expect(lerNumero("R$ 83,37")).toBe(8337);
    expect(lerNumero("(10,00)")).toBe(-1000);
    expect(lerNumero("10,00-")).toBe(-1000);
    expect(lerNumero("1.500")).toBe(150000);
    expect(lerNumero("12.5")).toBe(1250);
    expect(lerNumero("1.005", "ponto")).toBe(101);
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("")).toBeNull();
  });

  it("decodifica Latin-1 (comum nos bancos) e UTF-8", () => {
    const latin1 = new Uint8Array([0x50, 0x41, 0x4f, 0x20, 0x44, 0x45, 0x20, 0x41, 0xc7, 0xda, 0x43, 0x41, 0x52]); // "PAO DE AÇÚCAR"
    expect(decodificar(latin1)).toBe("PAO DE AÇÚCAR");
    expect(decodificar(new TextEncoder().encode("﻿Descrição"))).toBe("Descrição");
  });

  it("normaliza para comparar", () => {
    expect(normalizar("  Pagamento   de FATURA ")).toBe("pagamento de fatura");
    expect(normalizar("AÇÚCAR")).toBe("acucar");
  });
});

describe("OFX", () => {
  it("lê o formato antigo (SGML) dos bancos brasileiros", () => {
    const { transacoes, info, puladas } = lerOfx(OFX_SGML);
    expect(puladas).toBe(0);
    expect(transacoes).toHaveLength(3);
    expect(transacoes[0]).toMatchObject({ data: "2026-11-05", valorCentavos: 15237, tipo: "despesa", descricao: "SUPERMERCADO BOM PRECO", fitid: "20261105001", documento: "000123" });
    expect(transacoes[1]).toMatchObject({ data: "2026-11-10", valorCentavos: 500000, tipo: "receita", descricao: "SALARIO EMPRESA X & CIA" });
    expect(transacoes[2]).toMatchObject({ valorCentavos: 288734, tipo: "despesa", descricao: "Pagamento de fatura" });
    expect(info).toMatchObject({ banco: "Banco Teste", agencia: "1234", conta: "56789-0", cartao: false, inicio: "2026-11-01", fim: "2026-11-30", saldoCentavos: 196029 });
  });

  it("lê o formato novo (XML, tudo numa linha) e cartão de crédito", () => {
    const xml = `<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261103</DTPOSTED><TRNAMT>-45.90</TRNAMT><FITID>abc-1</FITID><MEMO>Padaria</MEMO></STMTTRN></BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
    const { transacoes, info } = lerOfx(xml);
    expect(transacoes).toEqual([expect.objectContaining({ data: "2026-11-03", valorCentavos: 4590, tipo: "despesa", descricao: "Padaria", fitid: "abc-1" })]);
    expect(info.cartao).toBe(true);
  });

  it("recusa arquivo que não é OFX", () => {
    expect(() => lerOfx("Data;Descrição;Valor")).toThrow(/OFX válido/);
  });
});

describe("CSV", () => {
  it("separa colunas respeitando aspas e detecta o separador", () => {
    expect(lerCsv('a;"b;c";d\r\n\r\n1;2;3', ";")).toEqual([["a", "b;c", "d"], ["1", "2", "3"]]);
    expect(lerCsv('"diz ""oi""",2', ",")).toEqual([['diz "oi"', "2"]]);
    expect(detectarSeparador("Data;Descrição;Valor\n01/11/2026;Padaria;-10,50")).toBe(";");
    expect(detectarSeparador("date,title,amount\n2026-11-01,Padaria,10.50")).toBe(",");
  });

  it("lê datas", () => {
    expect(lerDataCsv("24/11/2026", "dd/mm/aaaa")).toBe("2026-11-24");
    expect(lerDataCsv("5/1/26", "dd/mm/aaaa")).toBe("2026-01-05");
    expect(lerDataCsv("2026-11-24", "dd/mm/aaaa")).toBe("2026-11-24");
    expect(lerDataCsv("11/24/2026", "mm/dd/aaaa")).toBe("2026-11-24");
    expect(lerDataCsv("31/02/2026", "dd/mm/aaaa")).toBeNull();
    expect(lerDataCsv("Saldo", "dd/mm/aaaa")).toBeNull();
  });

  it("sugere os vínculos de um extrato com cabeçalho e lê as transações", () => {
    const texto = "Data;Histórico;Documento;Valor\n01/11/2026;Padaria Pão Quente;123;-10,50\n05/11/2026;PIX recebido;;1.250,00\n;Saldo do dia;;1.239,50";
    const cfg = sugerirConfiguracao(texto);
    expect(cfg).toMatchObject({ separador: ";", decimal: "virgula", temCabecalho: true, formatoData: "dd/mm/aaaa" });
    expect(cfg.colunas).toMatchObject({ data: 0, descricao: 1, documento: 2, valor: 3 });
    const { transacoes, puladas } = aplicarConfiguracao(texto, cfg);
    expect(puladas).toBe(1);
    expect(transacoes).toHaveLength(2);
    expect(transacoes[0]).toMatchObject({ numeroLinha: 2, data: "2026-11-01", valorCentavos: 1050, tipo: "despesa", descricao: "Padaria Pão Quente", documento: "123" });
    expect(transacoes[1]).toMatchObject({ valorCentavos: 125000, tipo: "receita" });
  });

  it("fatura de cartão em CSV: valores positivos são compras", () => {
    const texto = "date,title,amount\n2026-11-03,Mercado,123.45\n2026-11-10,Pagamento recebido,-500.00";
    const cfg = sugerirConfiguracao(texto, true);
    expect(cfg).toMatchObject({ separador: ",", decimal: "ponto", formatoData: "aaaa-mm-dd", inverterSinal: true });
    const { transacoes } = aplicarConfiguracao(texto, cfg);
    expect(transacoes.map((t) => [t.tipo, t.valorCentavos])).toEqual([["despesa", 12345], ["receita", 50000]]);
  });

  it("colunas separadas de saída e entrada, e coluna de tipo D/C", () => {
    const base = { separador: ";" as const, decimal: "virgula" as const, formatoData: "dd/mm/aaaa" as const, temCabecalho: false, inverterSinal: false };
    const vazias = { data: 0, descricao: 1, valor: null, valorDebito: null, valorCredito: null, tipo: null, documento: null, contato: null, categoria: null };
    const separadas = aplicarConfiguracao("01/11/2026;Luz;89,90;\n02/11/2026;Pix;;100,00", { ...base, colunas: { ...vazias, valorDebito: 2, valorCredito: 3 } });
    expect(separadas.transacoes.map((t) => [t.tipo, t.valorCentavos])).toEqual([["despesa", 8990], ["receita", 10000]]);
    const comTipo = aplicarConfiguracao("01/11/2026;Luz;89,90;D\n02/11/2026;Pix;100,00;C", { ...base, colunas: { ...vazias, valor: 2, tipo: 3 } });
    expect(comTipo.transacoes.map((t) => t.tipo)).toEqual(["despesa", "receita"]);
  });
});

describe("regras de importação", () => {
  const linha = { descricao: "PAGAMENTO DE FATURA NUBANK", documento: null, valorCentavos: 288734, tipo: "despesa" as const };
  const regra = (id: number, parcial: Partial<RegraAplicavel>): RegraAplicavel => ({ id, nome: `R${id}`, contaId: null, cartaoId: null, ordem: 0, condicoes: [], acao: "preencher", preencher: {}, ...parcial });

  it("condições de texto ignoram acento e maiúsculas", () => {
    expect(condicaoAtende({ campo: "descricao", operador: "contem", valor: "Pagamento de Fatura" }, linha)).toBe(true);
    expect(condicaoAtende({ campo: "descricao", operador: "comeca", valor: "pagamento" }, linha)).toBe(true);
    expect(condicaoAtende({ campo: "descricao", operador: "termina", valor: "itau" }, linha)).toBe(false);
    expect(condicaoAtende({ campo: "descricao", operador: "nao_contem", valor: "itau" }, linha)).toBe(true);
    expect(condicaoAtende({ campo: "descricao", operador: "igual", valor: "pagamento" }, linha)).toBe(false);
    expect(condicaoAtende({ campo: "descricao", operador: "contem", valor: "" }, linha)).toBe(false);
  });

  it("condições de valor e tipo", () => {
    expect(condicaoAtende({ campo: "valor", operador: "maior", valor: "1.000,00" }, linha)).toBe(true);
    expect(condicaoAtende({ campo: "valor", operador: "igual", valor: "2887,34" }, linha)).toBe(true);
    expect(condicaoAtende({ campo: "valor", operador: "menor", valor: "100" }, linha)).toBe(false);
    expect(condicaoAtende({ campo: "tipo", operador: "igual", valor: "despesa" }, linha)).toBe(true);
    expect(condicaoAtende({ campo: "tipo", operador: "igual", valor: "receita" }, linha)).toBe(false);
  });

  it("vale a primeira regra pela ordem; regra de outra conta não vale", () => {
    const regras = [
      regra(1, { ordem: 2, acao: "ignorar", condicoes: [{ campo: "descricao", operador: "contem", valor: "pagamento de fatura" }] }),
      regra(2, { ordem: 1, contaId: 9, condicoes: [{ campo: "descricao", operador: "contem", valor: "nubank" }] }),
      regra(3, { ordem: 3, condicoes: [{ campo: "descricao", operador: "contem", valor: "nubank" }] }),
    ];
    expect(regraQueAtende(regras, linha, { contaId: 1, cartaoId: null })?.id).toBe(1);
    expect(regraQueAtende(regras, linha, { contaId: 9, cartaoId: null })?.id).toBe(2);
    expect(regraQueAtende(regras, { ...linha, descricao: "Padaria" }, { contaId: 1, cartaoId: null })).toBeNull();
  });

  it("todas as condições precisam valer", () => {
    const r = regra(1, { condicoes: [{ campo: "descricao", operador: "contem", valor: "fatura" }, { campo: "valor", operador: "menor", valor: "100" }] });
    expect(regraQueAtende([r], linha, { contaId: 1, cartaoId: null })).toBeNull();
  });
});

describe("conciliação", () => {
  const c = (chave: string, data: string, valorCentavos: number, parcial: Partial<Candidato> = {}): Candidato => ({ chave, data, valorCentavos, tipo: "despesa", descricao: "Conta de luz", destino: "Banco", realizado: false, previsto: false, ...parcial });
  const l = (chave: number, data: string, valorCentavos: number, tipo: "receita" | "despesa" = "despesa") => ({ chave, data, valorCentavos, tipo });

  it("encontra pelo valor, sentido e data exata", () => {
    const r = conciliar([l(1, "2026-11-10", 8990), l(2, "2026-11-10", 8990, "receita"), l(3, "2026-11-11", 8990)], [c("l:1", "2026-11-10", 8990)], 0);
    expect(r.get(1)).toMatchObject({ status: "encontrado", candidatos: [{ chave: "l:1" }] });
    expect(r.get(2)?.status).toBe("novo");
    expect(r.get(3)?.status).toBe("novo");
  });

  it("tolerância de dias", () => {
    const r = conciliar([l(1, "2026-11-12", 8990)], [c("l:1", "2026-11-10", 8990)], 3);
    expect(r.get(1)?.status).toBe("encontrado");
  });

  it("um lançamento serve para uma linha só", () => {
    const r = conciliar([l(1, "2026-11-10", 500), l(2, "2026-11-10", 500)], [c("l:1", "2026-11-10", 500)], 0);
    expect([r.get(1)?.status, r.get(2)?.status].sort()).toEqual(["encontrado", "novo"]);
  });

  it("dois candidatos diferentes ficam pendentes; um com a data exata vence", () => {
    const pendente = conciliar([l(1, "2026-11-10", 500)], [c("l:1", "2026-11-09", 500), c("l:2", "2026-11-11", 500, { descricao: "Outra" })], 2);
    expect(pendente.get(1)).toMatchObject({ status: "pendente" });
    expect(pendente.get(1)?.candidatos).toHaveLength(2);
    const exato = conciliar([l(1, "2026-11-10", 500)], [c("l:1", "2026-11-09", 500), c("l:2", "2026-11-10", 500)], 2);
    expect(exato.get(1)).toMatchObject({ status: "encontrado", candidatos: [{ chave: "l:2" }] });
  });

  it("candidatos idênticos: fica com o primeiro", () => {
    const r = conciliar([l(1, "2026-11-10", 500), l(2, "2026-11-10", 500)], [c("l:7", "2026-11-10", 500), c("l:3", "2026-11-10", 500)], 0);
    expect(r.get(1)?.candidatos[0].chave).toBe("l:3");
    expect(r.get(2)?.candidatos[0].chave).toBe("l:7");
  });

  it("linha com um só candidato não perde o par para outra com vários", () => {
    const r = conciliar(
      [l(1, "2026-11-10", 500), l(2, "2026-11-12", 500)],
      [c("l:1", "2026-11-11", 500), c("l:2", "2026-11-09", 500, { descricao: "x" })],
      2,
    );
    // A linha 2 só alcança l:1 (dia 11); a linha 1 alcança os dois e fica com l:2.
    expect(r.get(2)?.candidatos[0].chave).toBe("l:1");
    expect(r.get(1)).toMatchObject({ status: "encontrado", candidatos: [{ chave: "l:2" }] });
  });

  it("duplicidade: FITID no OFX; data, valor e descrição no CSV", () => {
    expect(chaveDuplicidade({ fitid: "X1", data: "2026-11-10", valorCentavos: 1, tipo: "despesa", descricao: "a" })).toBe("f:X1");
    expect(chaveDuplicidade({ fitid: null, data: "2026-11-10", valorCentavos: 500, tipo: "despesa", descricao: " Padaria  Pão " })).toBe(
      chaveDuplicidade({ fitid: null, data: "2026-11-10", valorCentavos: 500, tipo: "despesa", descricao: "PADARIA PAO" }),
    );
  });
});
