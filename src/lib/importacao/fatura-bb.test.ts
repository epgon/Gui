import { describe, expect, it } from "vitest";
import { dataNoAno, eFaturaBb, lerFaturaBb } from "./fatura-bb";

// Texto como sai de pdf.ts (colunas separadas por tabulação), com dados fictícios.
const FATURA = [
  "Olá, Fulano, esta é sua fatura de\tOUROCARD FACIL VISA\tFinal 1234",
  "Vencimento\tResumo da fatura",
  "dezembro\tSaldo fatura anterior\tR$ 1.000,00",
  "05/12/2026\tPagamentos/Créditos\tR$ -1.000,00",
  "Total\tR$ 1.149,00",
  "Pague com Pix\twww.bb.com.br",
  "Datas fatura",
  "Fatura fechada em\t25/11/2026",
  "Fechamento da próxima fatura\t22/12/2026",
  "Lançamentos nesta fatura",
  "Fulano de Tal (Cartão 1234)",
  "Data\tDescrição\tPaís\tValor",
  "SALDO FATURA ANTERIOR\tBR\tR$ 1.000,00",
  "Pagamentos/Créditos",
  "05/11\tPGTO. CASH AG.\t2258 000225800 200\tBR\tR$ -1.000,00",
  "20/11\tESTORNO LOJA X\tBR\tR$ -50,00",
  "Restaurantes",
  "26/10\tBAR DO ZE\tATIBAIA\tBR\tR$ 25,00",
  "26/10\tBAR DO ZE\tATIBAIA\tBR\tR$ 25,00",
  "Página 2/4",
  "Serviços",
  "14/11\tGITHUB, INC.\tGITHUB.COM\tCA\tR$ 58,78",
  "***\t10,00 DOLAR AMERICANO",
  "Cotação do Dólar de 14/11: R$ 5,8779",
  "16/11\tIOF - COMPRA NO EXTERIOR\tR$ 2,05",
  "Outros lançamentos",
  "25/11\tENCARGOS FINANC ROTATIVO\tR$ 258,77",
  "Compras parceladas",
  "10/09\tAMAZON* PARC 03/12 OSASCO\tBR\tR$ 141,25",
  "30/09\tLOJA Y\tPARC 03/03 SAO PAULO\tBR\tR$ 30,00",
  "02/11\tSHOPEE PARC 01/12 Jundiai\tBR\tR$ 658,15",
  "Total da Fatura\tR$ 1.149,00",
  "Página 3/4",
  "Fale conosco",
].join("\n");

describe("fatura do cartão do Banco do Brasil (PDF)", () => {
  it("reconhece o layout do BB", () => {
    expect(eFaturaBb(FATURA)).toBe(true);
    expect(eFaturaBb("Extrato qualquer\nTotal da Fatura R$ 10,00")).toBe(false);
    expect(() => lerFaturaBb("outro banco")).toThrow(/Banco do Brasil/);
  });

  it("descobre o ano pela data de fechamento", () => {
    expect(dataNoAno("26/10", "2026-11-25")).toBe("2026-10-26");
    expect(dataNoAno("20/12", "2027-01-22")).toBe("2026-12-20");
    expect(dataNoAno("25/11", "2026-11-25")).toBe("2026-11-25");
    expect(dataNoAno("31/02", "2026-11-25")).toBeNull();
  });

  it("lê os lançamentos e pula o saldo anterior e o pagamento da fatura", () => {
    const { transacoes, info, puladas } = lerFaturaBb(FATURA);
    expect(puladas).toBe(0);
    expect(info).toMatchObject({ banco: "Banco do Brasil", conta: "Final 1234", fim: "2026-11-25", vencimento: "2026-12-05", totalCentavos: 114900, ignorados: 2, confere: true });
    expect(transacoes.map((t) => t.descricao)).not.toContain("PGTO. CASH AG. 2258 000225800 200");
    expect(transacoes).toHaveLength(9);

    const estorno = transacoes.find((t) => t.descricao === "ESTORNO LOJA X")!;
    expect(estorno).toMatchObject({ tipo: "receita", valorCentavos: 5000, data: "2026-11-20" });

    const github = transacoes.find((t) => t.descricao.startsWith("GITHUB"))!;
    expect(github).toMatchObject({ descricao: "GITHUB, INC. GITHUB.COM", tipo: "despesa", valorCentavos: 5878 });
    expect(github.bruto["País"]).toBe("CA");
    expect(transacoes.find((t) => t.descricao.startsWith("IOF"))).toMatchObject({ valorCentavos: 205, data: "2026-11-16" });
  });

  it("separa compras iguais no mesmo dia (não são duplicadas)", () => {
    const bar = lerFaturaBb(FATURA).transacoes.filter((t) => t.descricao === "BAR DO ZE ATIBAIA");
    expect(bar).toHaveLength(2);
    expect(new Set(bar.map((t) => t.fitid)).size).toBe(2);
    // A mesma fatura enviada de novo gera as mesmas chaves (aí sim é duplicada).
    expect(lerFaturaBb(FATURA).transacoes.map((t) => t.fitid)).toEqual(lerFaturaBb(FATURA).transacoes.map((t) => t.fitid));
  });

  it("leva a parcela para o mês dela, como o sistema grava as compras parceladas", () => {
    const t = lerFaturaBb(FATURA).transacoes;
    const amazon = t.find((x) => x.descricao.startsWith("AMAZON"))!;
    expect(amazon.data).toBe("2026-11-10");
    expect(amazon.bruto["Data da compra"]).toBe("10/09/2026");
    // 30/09 + 2 meses passaria do fechamento: fica no dia anterior ao fechamento.
    expect(t.find((x) => x.descricao.startsWith("LOJA Y"))!.data).toBe("2026-11-24");
    // Primeira parcela fica com a data da compra.
    expect(t.find((x) => x.descricao.startsWith("SHOPEE"))!.data).toBe("2026-11-02");
  });

  it("avisa quando a soma não bate com o total", () => {
    const { info } = lerFaturaBb(FATURA.replace("Total da Fatura\tR$ 1.149,00", "Total da Fatura\tR$ 1.150,00"));
    expect(info.confere).toBe(false);
  });
});
