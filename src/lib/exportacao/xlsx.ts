import "server-only";
import ExcelJS from "exceljs";
import type { Tabela } from "./tabela";

/** Planilha do Excel com os mesmos dados: valores como número (dá para somar) e datas como data. */
export async function gerarXlsx(t: Tabela): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Gui";
  livro.created = new Date();
  const aba = livro.addWorksheet(t.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"), {
    views: [{ state: "frozen", ySplit: t.filtros.length + 3 }],
  });

  aba.addRow([t.titulo]).font = { bold: true, size: 14, color: { argb: "FF135D3B" } };
  for (const f of t.filtros) aba.addRow([f]).font = { italic: true, color: { argb: "FF4B5563" } };
  aba.addRow([]);
  const cabecalho = aba.addRow(t.colunas.map((c) => c.titulo));
  cabecalho.font = { bold: true };
  cabecalho.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  for (const l of t.linhas) {
    const valores = l.celulas.map((c, i) => {
      const tipo = t.colunas[i]?.tipo;
      if (c === null) return null;
      if (tipo === "dinheiro" && typeof c === "number") return c / 100;
      if (tipo === "data" && typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c)) return new Date(c + "T12:00:00Z");
      if (i === 0 && l.recuo) return "    ".repeat(l.recuo) + String(c);
      return c;
    });
    const linha = aba.addRow(valores);
    if (l.estilo) linha.font = { bold: true };
    if (l.estilo === "total") linha.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } }));
  }
  for (const a of t.avisos ?? []) {
    aba.addRow([]);
    aba.addRow([a]).font = { italic: true, color: { argb: "FF713F12" } };
  }

  t.colunas.forEach((c, i) => {
    const col = aba.getColumn(i + 1);
    if (c.tipo === "dinheiro") col.numFmt = "#,##0.00;[Red]-#,##0.00";
    if (c.tipo === "data") col.numFmt = "dd/mm/yyyy";
    col.width = c.tipo === "dinheiro" ? 15 : c.tipo === "data" ? 12 : Math.min(60, Math.max(12, (c.largura ?? 1) * 14));
  });

  return Buffer.from(await livro.xlsx.writeBuffer());
}
