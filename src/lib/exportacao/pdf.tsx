import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { textoCelula, type Tabela } from "./tabela";

const COR = {
  verde: "#135d3b",
  receita: "#1d6ce0",
  negativo: "#dc2626",
  cinza: "#6b7280",
  cinzaClaro: "#9ca3af",
  borda: "#e2e8f0",
  faixa: "#f1f3f5",
  amarelo: "#fef9c3",
  amareloBorda: "#f5d565",
};

const estilos = StyleSheet.create({
  pagina: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 28, fontSize: 8.5, fontFamily: "Helvetica", color: "#1f2937" },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: COR.verde, paddingBottom: 6, marginBottom: 8 },
  marca: { fontSize: 9, color: COR.verde, fontFamily: "Helvetica-Bold" },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#111827" },
  filtros: { backgroundColor: COR.faixa, padding: 6, marginBottom: 8, borderRadius: 3 },
  filtrosTitulo: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#374151", marginBottom: 2 },
  filtroLinha: { fontSize: 8, color: "#374151" },
  cabecalho: { flexDirection: "row", backgroundColor: "#e5e7eb", borderBottomWidth: 1, borderBottomColor: "#d1d5db" },
  celulaCabecalho: { paddingVertical: 4, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", fontSize: 7.5, textTransform: "uppercase", color: "#374151" },
  linha: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COR.borda },
  linhaTotal: { flexDirection: "row", backgroundColor: COR.amarelo, borderTopWidth: 1, borderTopColor: COR.amareloBorda, borderBottomWidth: 1, borderBottomColor: COR.amareloBorda },
  celula: { paddingVertical: 3, paddingHorizontal: 4 },
  aviso: { marginTop: 8, fontSize: 8, color: "#713f12", backgroundColor: COR.amarelo, padding: 5, borderRadius: 3 },
  rodape: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: COR.cinza, borderTopWidth: 0.5, borderTopColor: COR.borda, paddingTop: 4 },
});

/** Impressão de uma Tabela: título, faixa "Filtros Utilizados", tabela e rodapé com a emissão. */
function Documento({ t, emitidoPor, emitidoEm, marca }: { t: Tabela; emitidoPor: string; emitidoEm: string; marca: string }) {
  const larguras = t.colunas.map((c) => c.largura ?? 1);
  const soma = larguras.reduce((s, x) => s + x, 0);
  const largura = (i: number) => `${((larguras[i] / soma) * 100).toFixed(2)}%`;
  const direita = (i: number) => t.colunas[i].tipo === "dinheiro" || t.colunas[i].tipo === "numero";
  const registros = t.registros === undefined ? t.linhas.filter((l) => !l.estilo).length : t.registros;

  return (
    <Document title={t.titulo} author={emitidoPor} creator="Gui" producer="Gui">
      <Page size="A4" orientation={t.orientacao === "paisagem" ? "landscape" : "portrait"} style={estilos.pagina} wrap>
        <View style={estilos.topo} fixed>
          <Text style={estilos.titulo}>{t.titulo}</Text>
          <Text style={estilos.marca}>{marca}</Text>
        </View>
        {t.filtros.length > 0 && (
          <View style={estilos.filtros}>
            <Text style={estilos.filtrosTitulo}>Filtros Utilizados</Text>
            {t.filtros.map((f) => (
              <Text key={f} style={estilos.filtroLinha}>
                {f}
              </Text>
            ))}
          </View>
        )}
        <View style={estilos.cabecalho} fixed>
          {t.colunas.map((c, i) => (
            <Text key={i} style={[estilos.celulaCabecalho, { width: largura(i), textAlign: direita(i) ? "right" : "left" }]}>
              {c.titulo}
            </Text>
          ))}
        </View>
        {t.linhas.length === 0 && <Text style={[estilos.celula, { color: COR.cinza, paddingVertical: 10 }]}>Nenhum registro com esses filtros.</Text>}
        {t.linhas.map((l, li) => (
          <View key={li} style={l.estilo === "total" ? estilos.linhaTotal : estilos.linha} wrap={false}>
            {l.celulas.map((c, i) => {
              const tipo = t.colunas[i]?.tipo ?? "texto";
              const numero = typeof c === "number" && tipo === "dinheiro";
              const cor = numero ? (c === 0 ? COR.cinzaClaro : (c as number) < 0 ? COR.negativo : COR.receita) : undefined;
              return (
                <View key={i} style={[estilos.celula, { width: largura(i), flexDirection: "row", alignItems: "center", justifyContent: direita(i) ? "flex-end" : "flex-start" }]}>
                  {i === 0 && l.cor && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: l.cor, marginRight: 3, marginLeft: (l.recuo ?? 0) * 8 }} />}
                  <Text
                    style={{
                      color: cor,
                      fontFamily: l.estilo ? "Helvetica-Bold" : "Helvetica",
                      paddingLeft: i === 0 && !l.cor ? (l.recuo ?? 0) * 8 : 0,
                    }}
                  >
                    {textoCelula(c, tipo)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
        {(t.avisos ?? []).map((a) => (
          <Text key={a} style={estilos.aviso}>
            {a}
          </Text>
        ))}
        <View style={estilos.rodape} fixed>
          <Text>
            Emitido em {emitidoEm} por {emitidoPor}
            {registros !== null && ` · ${registros} ${registros === 1 ? "registro" : "registros"}`}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function gerarPdf(t: Tabela, o: { emitidoPor: string; marca: string }): Promise<Buffer> {
  const emitidoEm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date());
  return renderToBuffer(<Documento t={t} emitidoPor={o.emitidoPor} emitidoEm={emitidoEm} marca={o.marca} />);
}
