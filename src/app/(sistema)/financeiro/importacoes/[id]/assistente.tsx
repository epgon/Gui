"use client";

import { ArrowLeft, ArrowRight, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, TextoComDestaque } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { aplicarConfiguracao, lerCsv } from "@/lib/importacao/csv";
import type { DetalheImportacao } from "@/lib/importacao/consultas";
import { CAMPOS_CSV, type ConfiguracaoCsv, type DadosDestino } from "@/lib/importacao/tipos";
import type { Opcoes } from "@/lib/lancamentos/tipos";
import { CampoDestino } from "../../lancamentos/campos";
import { definirDestino, excluirImportacao, salvarVinculos, voltarEtapa } from "../acoes";
import { Etapas } from "../etapas";
import { Revisao } from "./revisao";

/** Assistente de importação: mostra a etapa em que o rascunho parou. */
export function Assistente({ imp, opcoes }: { imp: DetalheImportacao; opcoes: Opcoes }) {
  const csv = imp.formato === "csv";
  const passo = imp.etapa === "destino" ? 2 : imp.etapa === "vinculo" ? 3 : csv ? 4 : 3;
  return (
    <>
      {imp.situacao === "rascunho" && <Etapas atual={passo} csv={csv} />}
      {imp.situacao !== "rascunho" || imp.etapa === "revisao" ? (
        <Revisao imp={imp} opcoes={opcoes} />
      ) : imp.etapa === "vinculo" ? (
        <EtapaVinculo imp={imp} />
      ) : (
        <EtapaDestino imp={imp} opcoes={opcoes} />
      )}
    </>
  );
}

/** Executa uma ação do servidor mostrando o erro na faixa amarela. */
export function useAcao() {
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const rodar = <T,>(acao: () => Promise<{ ok: boolean; erro?: string } & T>, depois?: (r: T) => void) =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await acao();
        if (!r.ok) setErro(r.erro ?? "Não foi possível concluir agora.");
        else depois?.(r);
      } catch {
        setErro("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });
  return { erro, setErro, ocupado, rodar };
}

/** Botões de rodapé comuns: Excluir rascunho e Cancelar (sai e guarda o rascunho). */
function RodapeRascunho({ imp, children }: { imp: DetalheImportacao; children: React.ReactNode }) {
  const router = useRouter();
  const { erro, ocupado, rodar } = useAcao();
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
      <Botao variante="fantasma" className="text-negativo" icone={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmar(true)}>
        Excluir
      </Botao>
      <span className="ml-auto" />
      <Link href="/financeiro/importacoes" className="inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100" title="Sai da importação. Ela fica como rascunho para você continuar depois.">
        Cancelar
      </Link>
      {children}
      <Modal
        aberto={confirmar}
        aoFechar={() => setConfirmar(false)}
        titulo="Excluir importação"
        resumo={imp.arquivoNome}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setConfirmar(false)}>
              Voltar
            </Botao>
            <Botao variante="perigo" carregando={ocupado} onClick={() => rodar(() => excluirImportacao(imp.id), () => router.push("/financeiro/importacoes"))}>
              Excluir
            </Botao>
          </>
        }
      >
        <FaixaErro className="mb-3">{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <p className="text-sm text-gray-700">O arquivo enviado será descartado. Nada do que ele trouxe fica nos lançamentos.</p>
      </Modal>
    </div>
  );
}

const TOLERANCIAS = [
  { valor: "0", rotulo: "Exata (mesmo dia)" },
  { valor: "1", rotulo: "1 dia antes ou depois" },
  { valor: "2", rotulo: "2 dias antes ou depois" },
  { valor: "3", rotulo: "3 dias antes ou depois" },
  { valor: "5", rotulo: "5 dias antes ou depois" },
  { valor: "7", rotulo: "7 dias antes ou depois" },
  { valor: "15", rotulo: "15 dias antes ou depois" },
];

/** Informações que vieram no arquivo OFX ou na fatura em PDF (banco, conta, período, saldo). */
function InfoArquivo({ imp }: { imp: DetalheImportacao }) {
  const i = imp.infoArquivo as { banco?: string; agencia?: string; conta?: string; cartao?: boolean; inicio?: string; fim?: string; saldoCentavos?: number | null; saldoData?: string; transacoes?: number };
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-subcabecalho px-4 py-3 text-sm">
      <span className="flex items-center gap-2 font-semibold text-gray-800">
        <FileText className="h-4 w-4 text-verde" /> {imp.arquivoNome}
      </span>
      {imp.formato === "ofx" ? (
        <>
          {i.banco && <span>Banco: {i.banco}</span>}
          {(i.agencia || i.conta) && <span>{i.cartao ? "Cartão" : "Conta"}: {[i.agencia, i.conta].filter(Boolean).join(" / ")}</span>}
          {i.inicio && i.fim && (
            <span>
              Período: {formatarData(i.inicio)} a {formatarData(i.fim)}
            </span>
          )}
          {!!i.transacoes && <span>{i.transacoes} transações</span>}
          {typeof i.saldoCentavos === "number" && (
            <span>
              Saldo no banco{i.saldoData ? ` em ${formatarData(i.saldoData)}` : ""}: <Valor centavos={i.saldoCentavos} />
            </span>
          )}
        </>
      ) : imp.formato === "pdf" ? (
        <InfoFaturaPdf info={imp.infoArquivo as InfoFatura} />
      ) : (
        <span>Arquivo CSV: na próxima etapa você diz o que é cada coluna.</span>
      )}
    </div>
  );
}

type InfoFatura = { banco?: string; conta?: string | null; fim?: string; vencimento?: string | null; totalCentavos?: number | null; transacoes?: number; ignorados?: number; confere?: boolean };

/** Fatura do cartão em PDF: banco, cartão, fechamento, vencimento e total, e se os lançamentos batem com o total. */
function InfoFaturaPdf({ info: i }: { info: InfoFatura }) {
  return (
    <>
      {i.banco && <span>Banco: {i.banco}</span>}
      {i.conta && <span>Cartão: {i.conta}</span>}
      {i.fim && <span>Fechada em {formatarData(i.fim)}</span>}
      {i.vencimento && <span>Vencimento: {formatarData(i.vencimento)}</span>}
      {typeof i.totalCentavos === "number" && (
        <span>
          Total da fatura: <Valor centavos={i.totalCentavos} />
        </span>
      )}
      {!!i.transacoes && <span>{i.transacoes} lançamentos</span>}
      {!!i.ignorados && <span className="w-full text-xs text-gray-500">O saldo da fatura anterior e o pagamento da fatura não entram: o pagamento é feito pela própria fatura no Gui.</span>}
      {i.confere === false && (
        <span className="w-full text-xs font-semibold text-amarelo-texto">Atenção: a soma dos lançamentos lidos não bateu com o total da fatura. Confira na revisão se falta alguma linha.</span>
      )}
    </>
  );
}

function EtapaDestino({ imp, opcoes }: { imp: DetalheImportacao; opcoes: Opcoes }) {
  const router = useRouter();
  const { erro, ocupado, rodar } = useAcao();
  const info = imp.infoArquivo as { cartao?: boolean };
  const ativos = opcoes.destinos.filter((d) => d.ativo && (info.cartao ? d.grupo === "Cartões" : d.grupo === "Contas"));
  const [d, setD] = useState<DadosDestino>({
    destino: imp.destino || (ativos.length === 1 ? ativos[0].valor : ""),
    toleranciaDias: String(imp.toleranciaDias),
    qualquerConta: imp.qualquerConta,
    contatoPessoa: imp.contatoPessoa,
    contatoCliente: imp.contatoCliente,
    contatoFornecedor: imp.contatoFornecedor,
  });
  const mudar = <K extends keyof DadosDestino>(k: K, v: DadosDestino[K]) => setD((x) => ({ ...x, [k]: v }));
  const eCartao = d.destino.startsWith("cartao:");

  return (
    <Cartao titulo="Destino e checagem">
      <div className="space-y-5">
        <InfoArquivo imp={imp} />
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        {opcoes.destinos.length === 0 && (
          <FaixaErro>
            Cadastre primeiro uma{" "}
            <Link href="/cadastros/contas-financeiras" className="font-semibold underline">
              Conta Financeira
            </Link>
            .
          </FaixaErro>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoDestino rotulo="Conta ou Cartão que recebe os lançamentos" valor={d.destino} aoMudar={(v) => mudar("destino", v)} destinos={opcoes.destinos} />
          {eCartao && (
            <p className="self-end text-sm text-gray-600">
              No cartão, cada linha vira uma compra na fatura certa (pelo dia de fechamento). O pagamento da fatura continua sendo feito pela fatura.
            </p>
          )}
        </div>
        <fieldset className="rounded-lg border border-borda p-4">
          <legend className="px-1 text-sm font-semibold text-gray-800">Checar (conciliação)</legend>
          <p className="mb-3 text-sm text-gray-600">
            O Gui procura lançamentos que você já registrou com o <strong>mesmo valor</strong> e data parecida, para não lançar duas vezes. Eles aparecem como <strong>Encontrado</strong>.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao rotulo="Tolerância da data" valor={d.toleranciaDias} aoMudar={(v) => mudar("toleranciaDias", v)} opcoes={TOLERANCIAS} ajuda="Quantos dias de diferença aceitar entre o extrato e o lançamento do sistema." />
            {!eCartao && (
              <CampoSelecao
                rotulo="Conta Financeira"
                valor={d.qualquerConta ? "qualquer" : "esta"}
                aoMudar={(v) => mudar("qualquerConta", v === "qualquer")}
                opcoes={[
                  { valor: "esta", rotulo: "Só nesta conta" },
                  { valor: "qualquer", rotulo: "Em qualquer conta" },
                ]}
                ajuda="Em qualquer conta: se você lançou na conta errada, o lançamento encontrado passa para esta conta ao conciliar."
              />
            )}
          </div>
        </fieldset>
        {imp.formato === "csv" && (
          <fieldset className="rounded-lg border border-borda p-4">
            <legend className="px-1 text-sm font-semibold text-gray-800">Clientes e Fornecedores novos</legend>
            <p className="mb-3 text-sm text-gray-600">Se o arquivo tiver uma coluna de cliente ou fornecedor, os que ainda não existem são cadastrados assim:</p>
            <div className="flex flex-wrap items-center gap-6">
              <CampoSelecao
                rotulo="Pessoa"
                className="w-48"
                valor={d.contatoPessoa}
                aoMudar={(v) => mudar("contatoPessoa", v === "fisica" ? "fisica" : "juridica")}
                opcoes={[
                  { valor: "juridica", rotulo: "Jurídica (empresa)" },
                  { valor: "fisica", rotulo: "Física" },
                ]}
              />
              <Chave ligada={d.contatoCliente} aoMudar={(v) => mudar("contatoCliente", v)} rotulo="Cliente" />
              <Chave ligada={d.contatoFornecedor} aoMudar={(v) => mudar("contatoFornecedor", v)} rotulo="Fornecedor" />
            </div>
          </fieldset>
        )}
        <RodapeRascunho imp={imp}>
          <Botao carregando={ocupado} icone={<ArrowRight className="h-4 w-4" />} onClick={() => rodar(() => definirDestino(imp.id, d), () => router.refresh())}>
            Continuar
          </Botao>
        </RodapeRascunho>
      </div>
    </Cartao>
  );
}

const SEPARADORES = [
  { valor: ";", rotulo: "Ponto e vírgula ( ; )" },
  { valor: ",", rotulo: "Vírgula ( , )" },
  { valor: "\t", rotulo: "Tabulação" },
];

function EtapaVinculo({ imp }: { imp: DetalheImportacao }) {
  const router = useRouter();
  const { erro, ocupado, rodar } = useAcao();
  const [cfg, setCfg] = useState<ConfiguracaoCsv>(imp.vinculo!.configuracao);
  const mudar = <K extends keyof ConfiguracaoCsv>(k: K, v: ConfiguracaoCsv[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const mudarColuna = (k: keyof ConfiguracaoCsv["colunas"], v: string) => setCfg((c) => ({ ...c, colunas: { ...c.colunas, [k]: v === "" ? null : Number(v) } }));

  // Prévia feita aqui mesmo, com as primeiras linhas do arquivo.
  const tabela = useMemo(() => lerCsv(imp.conteudoCsv, cfg.separador).slice(0, 11), [imp.conteudoCsv, cfg.separador]);
  const cabecalho = cfg.temCabecalho ? (tabela[0] ?? []) : [];
  const dados = (cfg.temCabecalho ? tabela.slice(1) : tabela).slice(0, 10);
  const largura = Math.max(0, ...tabela.map((l) => l.length));
  const colunas = Array.from({ length: largura }, (_, j) => ({ valor: String(j), rotulo: cabecalho[j] ? `${cabecalho[j]} (coluna ${j + 1})` : `Coluna ${j + 1}${dados[0]?.[j] ? `: ${dados[0][j].slice(0, 24)}` : ""}` }));
  const lidas = useMemo(() => aplicarConfiguracao(imp.conteudoCsv, cfg), [imp.conteudoCsv, cfg]);
  const usadas = new Set(Object.values(cfg.colunas).filter((x): x is number => x !== null));

  return (
    <Cartao titulo="Vínculo das colunas">
      <div className="space-y-5">
        <InfoArquivo imp={imp} />
        {imp.vinculo!.memorizado && <p className="rounded-md bg-verde-claro px-3 py-2 text-sm text-verde">Usando os vínculos memorizados da última importação desta conta. Confira e continue.</p>}
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoSelecao rotulo="Separador das colunas" valor={cfg.separador} aoMudar={(v) => mudar("separador", v as ConfiguracaoCsv["separador"])} opcoes={SEPARADORES} />
          <CampoSelecao
            rotulo="Separador dos centavos"
            valor={cfg.decimal}
            aoMudar={(v) => mudar("decimal", v === "ponto" ? "ponto" : "virgula")}
            opcoes={[
              { valor: "virgula", rotulo: "Vírgula (1.234,56)" },
              { valor: "ponto", rotulo: "Ponto (1,234.56)" },
            ]}
          />
          <CampoSelecao
            rotulo="Formato da data"
            valor={cfg.formatoData}
            aoMudar={(v) => mudar("formatoData", v as ConfiguracaoCsv["formatoData"])}
            opcoes={[
              { valor: "dd/mm/aaaa", rotulo: "Dia/Mês/Ano (24/11/2026)" },
              { valor: "mm/dd/aaaa", rotulo: "Mês/Dia/Ano (11/24/2026)" },
              { valor: "aaaa-mm-dd", rotulo: "Ano-Mês-Dia (2026-11-24)" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <Chave ligada={cfg.temCabecalho} aoMudar={(v) => mudar("temCabecalho", v)} rotulo="A primeira linha é o cabeçalho (nomes das colunas)" />
          <Chave ligada={cfg.inverterSinal} aoMudar={(v) => mudar("inverterSinal", v)} rotulo="Valores positivos são despesas (comum em fatura de cartão)" />
        </div>

        <fieldset className="rounded-lg border border-borda p-4">
          <legend className="px-1 text-sm font-semibold text-gray-800">O que é cada coluna</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {CAMPOS_CSV.map((c) => (
              <CampoSelecao
                key={c.chave}
                rotulo={c.rotulo}
                obrigatorio={c.obrigatorio || (c.chave === "valor" && cfg.colunas.valorDebito === null && cfg.colunas.valorCredito === null)}
                ajuda={c.ajuda}
                valor={cfg.colunas[c.chave] === null ? "" : String(cfg.colunas[c.chave])}
                aoMudar={(v) => mudarColuna(c.chave, v)}
                opcoes={[{ valor: "", rotulo: "Não usar" }, ...colunas]}
              />
            ))}
          </div>
        </fieldset>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Prévia das 10 primeiras linhas do arquivo</h3>
          <div className="overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-xs">
              {cabecalho.length > 0 && (
                <thead className="bg-subcabecalho text-gray-600">
                  <tr>
                    {Array.from({ length: largura }, (_, j) => (
                      <th key={j} className={cn("px-2 py-1.5 text-left font-semibold", usadas.has(j) && "bg-verde-claro text-verde")}>
                        {cabecalho[j]}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {dados.map((l, i) => (
                  <tr key={i} className="border-t border-borda">
                    {Array.from({ length: largura }, (_, j) => (
                      <td key={j} className={cn("max-w-56 truncate px-2 py-1.5", usadas.has(j) && "bg-verde-claro/50")}>
                        {l[j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Como o Gui vai ler ({lidas.transacoes.length} lidas nas primeiras linhas{lidas.puladas ? `, ${lidas.puladas} sem data ou valor serão puladas` : ""})</h3>
          <div className="overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-sm">
              <thead className="bg-subcabecalho text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-1.5 text-left">Data</th>
                  <th className="px-3 py-1.5 text-left">Descrição</th>
                  <th className="px-3 py-1.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lidas.transacoes.slice(0, 5).map((t) => (
                  <tr key={t.numeroLinha} className="border-t border-borda">
                    <td className="px-3 py-1.5">{formatarData(t.data)}</td>
                    <td className="px-3 py-1.5">{t.descricao}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Valor centavos={t.tipo === "despesa" ? -t.valorCentavos : t.valorCentavos} />
                    </td>
                  </tr>
                ))}
                {lidas.transacoes.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                      Nenhuma linha lida ainda. Escolha as colunas de Data, Descrição e Valor e confira os formatos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <RodapeRascunho imp={imp}>
          <Botao variante="secundario" disabled={ocupado} icone={<ArrowLeft className="h-4 w-4" />} onClick={() => rodar(() => voltarEtapa(imp.id, "destino"), () => router.refresh())}>
            Voltar
          </Botao>
          <Botao carregando={ocupado} icone={<ArrowRight className="h-4 w-4" />} onClick={() => rodar(() => salvarVinculos(imp.id, cfg), () => router.refresh())}>
            Continuar
          </Botao>
        </RodapeRascunho>
      </div>
    </Cartao>
  );
}
