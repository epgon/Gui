"use client";

import { ArrowLeft, Ban, CheckCheck, CheckCircle2, Copy, Link2, ListChecks, PencilLine, Plus, RefreshCw, RotateCcw, Search, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Botao } from "@/components/ui/botao";
import { CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import type { DetalheImportacao } from "@/lib/importacao/consultas";
import type { CamposLinha, Candidato, DadosRegra, LinhaRevisao, StatusLinha } from "@/lib/importacao/tipos";
import type { Opcoes } from "@/lib/lancamentos/tipos";
import { CampoCategoria, CampoComNovo, CampoTags } from "../../lancamentos/campos";
import {
  adicionarLinhas,
  buscarLancamentos,
  conciliarEncontradas,
  conciliarLinha,
  concluirImportacao,
  desfazerLinhas,
  editarLinha,
  ignorarLinhas,
  mudarCategoria,
  preencherEmBranco,
  reaplicarRegras,
  voltarEtapa,
} from "../acoes";
import { CampoCategoriaTodas, ModalRegra, novaRegra } from "../modal-regra";
import { useAcao } from "./assistente";

const STATUS: Record<StatusLinha, { rotulo: string; estilo: string; dica: string }> = {
  novo: { rotulo: "Novo", estilo: "bg-blue-50 text-receita", dica: "Não existe no sistema. Escolha a categoria e adicione." },
  encontrado: { rotulo: "Encontrado", estilo: "bg-amber-100 text-amber-800", dica: "Já existe um lançamento igual no sistema. Concilie para dar baixa nele." },
  pendente: { rotulo: "Pendente", estilo: "bg-orange-100 text-despesa", dica: "Mais de um lançamento pode ser este. Escolha qual." },
  ignorado: { rotulo: "Ignorado", estilo: "bg-gray-100 text-gray-500", dica: "Não vai virar lançamento." },
  adicionado: { rotulo: "Adicionado", estilo: "bg-pago-fundo text-pago-texto", dica: "Virou lançamento (já pago)." },
  conciliado: { rotulo: "Conciliado", estilo: "bg-pago-fundo text-pago-texto", dica: "Ligado ao lançamento que já existia, que ficou como pago." },
};

const FILTROS: { valor: "" | StatusLinha | "sem_categoria"; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "novo", rotulo: "Novos" },
  { valor: "sem_categoria", rotulo: "Sem categoria" },
  { valor: "encontrado", rotulo: "Encontrados" },
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "ignorado", rotulo: "Ignorados" },
  { valor: "adicionado", rotulo: "Adicionados" },
  { valor: "conciliado", rotulo: "Conciliados" },
];

const aberta = (l: LinhaRevisao) => l.status === "novo" || l.status === "encontrado" || l.status === "pendente";
const comSinal = (l: { tipo: "receita" | "despesa"; valorCentavos: number }) => (l.tipo === "despesa" ? -l.valorCentavos : l.valorCentavos);

export function Revisao({ imp, opcoes }: { imp: DetalheImportacao; opcoes: Opcoes }) {
  const router = useRouter();
  const somenteLeitura = imp.situacao !== "rascunho";
  const { erro, setErro, ocupado, rodar } = useAcao();
  const [mensagem, setMensagem] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("");
  const [selecao, setSelecao] = useState<{ base: LinhaRevisao[]; ids: number[] }>({ base: imp.linhas, ids: [] });
  const selecionados = selecao.base === imp.linhas ? selecao.ids : [];
  const setSelecionados = (ids: number[]) => setSelecao({ base: imp.linhas, ids });

  const [editando, setEditando] = useState<LinhaRevisao | null>(null);
  const [buscando, setBuscando] = useState<LinhaRevisao | null>(null);
  const [preencher, setPreencher] = useState(false);
  const [concluir, setConcluir] = useState(false);
  const [regra, setRegra] = useState<DadosRegra | null>(null);
  const [bruto, setBruto] = useState<LinhaRevisao | null>(null);

  const conta = (s: (typeof FILTROS)[number]["valor"]) =>
    s === "" ? imp.linhas.length : s === "sem_categoria" ? imp.linhas.filter((l) => l.status === "novo" && !l.campos.categoriaId).length : imp.linhas.filter((l) => l.status === s).length;
  const visiveis = useMemo(
    () => imp.linhas.filter((l) => (filtro === "" ? true : filtro === "sem_categoria" ? l.status === "novo" && !l.campos.categoriaId : l.status === filtro)),
    [imp.linhas, filtro],
  );
  const escolhidas = imp.linhas.filter((l) => selecionados.includes(l.id));
  const todosMarcados = visiveis.length > 0 && visiveis.every((l) => selecionados.includes(l.id));

  const entradas = imp.linhas.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valorCentavos, 0);
  const saidas = imp.linhas.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valorCentavos, 0);
  const prontasAdicionar = imp.linhas.filter((l) => l.status === "novo" && l.campos.categoriaId).length;
  const prontasConciliar = imp.linhas.filter((l) => l.status === "encontrado").length;
  const deFora = imp.linhas.filter((l) => (l.status === "novo" && !l.campos.categoriaId) || l.status === "pendente").length;

  const feito = (texto: string) => () => {
    setMensagem(texto);
    setSelecionados([]);
  };
  const acaoEmLote = (acao: (id: number, ids: number[]) => Promise<{ ok: boolean; erro?: string; feitas?: number }>, texto: (n: number) => string) => {
    setMensagem("");
    rodar(
      () => acao(imp.id, selecionados),
      (r: { feitas?: number }) => feito(texto(r.feitas ?? selecionados.length))(),
    );
  };

  const criarRegra = (l: LinhaRevisao) =>
    setRegra(
      novaRegra({
        nome: l.descricaoOriginal.slice(0, 60),
        destino: imp.destino,
        condicoes: [{ campo: "descricao", operador: "contem", valor: l.descricaoOriginal.slice(0, 120) }],
        categoriaId: l.campos.categoriaId ? String(l.campos.categoriaId) : "",
        contatoId: l.campos.contatoId ? String(l.campos.contatoId) : "",
      }),
    );

  return (
    <>
      {/* Resumo do arquivo */}
      <Cartao>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Arquivo</p>
            <p className="font-semibold text-gray-900">{imp.arquivoNome}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{imp.eCartao ? "Cartão" : "Conta"}</p>
            <p className="font-semibold text-gray-900">{imp.destinoNome}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Entradas</p>
            <Valor centavos={entradas} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Saídas</p>
            <Valor centavos={-saidas} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Checagem</p>
            <p className="text-gray-700">
              {imp.toleranciaDias ? `± ${imp.toleranciaDias} dias` : "Data exata"}
              {imp.qualquerConta ? ", qualquer conta" : ""}
            </p>
          </div>
          {somenteLeitura && imp.concluidoEm && (
            <div>
              <p className="text-xs text-gray-500">Concluída em</p>
              <p className="text-gray-700">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(imp.concluidoEm))}</p>
            </div>
          )}
          {!somenteLeitura && (
            <div className="ml-auto flex flex-wrap gap-2">
              <Botao variante="secundario" icone={<Wand2 className="h-4 w-4" />} onClick={() => setRegra(novaRegra({ destino: imp.destino }))}>
                Nova Regra
              </Botao>
              <Botao variante="secundario" disabled={ocupado} icone={<RefreshCw className="h-4 w-4" />} title="Roda as regras e a conciliação de novo nas linhas que ainda não foram resolvidas" onClick={() => rodar(() => reaplicarRegras(imp.id), feito("Regras e conciliação aplicadas de novo."))}>
                Aplicar regras
              </Botao>
            </div>
          )}
        </div>
      </Cartao>

      {imp.linhasPuladas > 0 && (
        <p className="rounded-md border border-borda bg-white px-3 py-2 text-sm text-gray-600">
          {imp.linhasPuladas === 1 ? "1 linha do arquivo foi pulada" : `${imp.linhasPuladas} linhas do arquivo foram puladas`} por não ter data ou valor (ex.: linhas de saldo ou de total).
        </p>
      )}
      <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      {mensagem && !erro && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-pago-texto/20 bg-pago-fundo px-3 py-2 text-sm text-pago-texto">
          <CheckCircle2 className="h-4 w-4" /> {mensagem}
        </p>
      )}

      {/* Filtros por status */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por situação">
        {FILTROS.filter((f) => f.valor === "" || conta(f.valor) > 0).map((f) => (
          <button
            key={f.valor}
            type="button"
            role="tab"
            aria-selected={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cn("rounded-full border px-3 py-1 text-sm font-medium", filtro === f.valor ? "border-verde bg-verde text-white" : "border-borda bg-white text-gray-700 hover:bg-gray-50")}
          >
            {f.rotulo} <span className={cn("ml-1 text-xs", filtro === f.valor ? "text-white/80" : "text-gray-400")}>{conta(f.valor)}</span>
          </button>
        ))}
      </div>

      {/* Ações em lote */}
      {!somenteLeitura && escolhidas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-verde/30 bg-verde-claro px-4 py-2 text-sm">
          <strong>{escolhidas.length === 1 ? "1 selecionada" : `${escolhidas.length} selecionadas`}</strong>
          <Botao variante="secundario" className="h-8" disabled={ocupado} icone={<Plus className="h-4 w-4" />} onClick={() => acaoEmLote(adicionarLinhas, (n) => (n === 1 ? "1 lançamento adicionado." : `${n} lançamentos adicionados.`))}>
            Adicionar Agora
          </Botao>
          <Botao variante="secundario" className="h-8" disabled={ocupado} icone={<Link2 className="h-4 w-4" />} onClick={() => acaoEmLote(conciliarEncontradas, (n) => (n === 1 ? "1 lançamento conciliado." : `${n} lançamentos conciliados.`))}>
            Conciliar Agora
          </Botao>
          <Botao variante="secundario" className="h-8" disabled={ocupado} icone={<ListChecks className="h-4 w-4" />} onClick={() => setPreencher(true)}>
            Preencher em branco
          </Botao>
          <Botao variante="secundario" className="h-8" disabled={ocupado} icone={<Ban className="h-4 w-4" />} onClick={() => acaoEmLote(ignorarLinhas, () => "Linhas ignoradas.")}>
            Ignorar
          </Botao>
          <Botao variante="secundario" className="h-8" disabled={ocupado} icone={<RotateCcw className="h-4 w-4" />} onClick={() => acaoEmLote(desfazerLinhas, () => "Desfeito.")}>
            Desfazer
          </Botao>
          <button type="button" onClick={() => setSelecionados([])} className="ml-auto text-gray-600 hover:underline">
            Limpar seleção
          </button>
        </div>
      )}

      {/* Linhas */}
      <div className="overflow-hidden rounded-xl border border-borda bg-white shadow-cartao">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-borda bg-subcabecalho text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {!somenteLeitura && (
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas"
                      checked={todosMarcados}
                      onChange={() => setSelecionados(todosMarcados ? [] : visiveis.map((l) => l.id))}
                      className="h-4 w-4 accent-verde"
                    />
                  </th>
                )}
                <th className="px-3 py-2.5 text-left font-semibold">Data</th>
                <th className="px-3 py-2.5 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2.5 text-left font-semibold">Categoria</th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-3 py-2.5 text-center font-semibold">Situação</th>
                {!somenteLeitura && (
                  <th className="px-3 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Nenhuma linha {filtro ? "com essa situação" : "no arquivo"}.
                  </td>
                </tr>
              )}
              {visiveis.map((l) => (
                <LinhaTabela
                  key={l.id}
                  l={l}
                  imp={imp}
                  opcoes={opcoes}
                  somenteLeitura={somenteLeitura}
                  ocupado={ocupado}
                  marcado={selecionados.includes(l.id)}
                  aoMarcar={() => setSelecionados(selecionados.includes(l.id) ? selecionados.filter((x) => x !== l.id) : [...selecionados, l.id])}
                  aoMudarCategoria={(v) => rodar(() => mudarCategoria(imp.id, l.id, v))}
                  aoAdicionar={() => rodar(() => adicionarLinhas(imp.id, [l.id]), feito(`Lançamento "${l.campos.descricao || l.descricaoOriginal}" adicionado.`))}
                  aoConciliar={() => (l.status === "encontrado" ? rodar(() => conciliarLinha(imp.id, l.id, l.candidatos[0].chave), feito("Lançamento conciliado.")) : setBuscando(l))}
                  aoDesfazer={() => rodar(() => desfazerLinhas(imp.id, [l.id]), feito("Desfeito."))}
                  menu={[
                    { rotulo: "Editar Registro", icone: <PencilLine className="h-4 w-4" />, aoClicar: () => setEditando(l), desabilitado: !(aberta(l) || l.status === "ignorado") },
                    { rotulo: "Encontrar Lançamento", icone: <Search className="h-4 w-4" />, aoClicar: () => setBuscando(l), desabilitado: !aberta(l) },
                    { rotulo: "Criar Regra", icone: <Wand2 className="h-4 w-4" />, aoClicar: () => criarRegra(l) },
                    l.status === "ignorado" || l.status === "adicionado" || l.status === "conciliado"
                      ? { rotulo: "Desfazer", icone: <RotateCcw className="h-4 w-4" />, aoClicar: () => rodar(() => desfazerLinhas(imp.id, [l.id]), feito("Desfeito.")) }
                      : { rotulo: "Ignorar", icone: <Ban className="h-4 w-4" />, aoClicar: () => rodar(() => ignorarLinhas(imp.id, [l.id]), feito("Linha ignorada.")) },
                    { rotulo: "Informações da Transação", icone: <Copy className="h-4 w-4" />, aoClicar: () => setBruto(l) },
                  ]}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé */}
      {!somenteLeitura ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-white px-4 py-3 shadow-cartao">
          <Botao
            variante="secundario"
            disabled={ocupado}
            icone={<ArrowLeft className="h-4 w-4" />}
            onClick={() => rodar(() => voltarEtapa(imp.id, imp.formato === "csv" ? "vinculo" : "destino"), () => router.refresh())}
            title="Voltar às etapas anteriores (só antes de adicionar ou conciliar linhas)"
          >
            Voltar
          </Botao>
          <span className="ml-auto text-sm text-gray-500">
            Prontas: {prontasAdicionar} para adicionar, {prontasConciliar} para conciliar
          </span>
          <Link href="/financeiro/importacoes" className="inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100" title="Sai e guarda como rascunho para continuar depois.">
            Cancelar
          </Link>
          <Botao icone={<CheckCheck className="h-4 w-4" />} disabled={ocupado} onClick={() => setConcluir(true)}>
            Concluir Importação
          </Botao>
        </div>
      ) : (
        <Link href="/financeiro/importacoes" className="inline-flex h-9 items-center gap-2 rounded-md px-1 text-sm font-semibold text-verde hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar para Importações
        </Link>
      )}

      {editando && <ModalEditar key={editando.id} l={editando} imp={imp} opcoes={opcoes} aoFechar={() => setEditando(null)} />}
      {buscando && <ModalEncontrar key={buscando.id} l={buscando} imp={imp} aoFechar={() => setBuscando(null)} aoConciliar={() => feito("Lançamento conciliado.")()} />}
      {preencher && (
        <ModalPreencher
          opcoes={opcoes}
          aoFechar={() => setPreencher(false)}
          aoSalvar={(campos) =>
            rodar(
              () => preencherEmBranco(imp.id, selecionados, campos),
              (r: { feitas?: number }) => {
                setPreencher(false);
                feito(r.feitas ? `${r.feitas} linhas preenchidas.` : "Nenhuma linha tinha esses campos em branco.")();
              },
            )
          }
          erro={erro}
          setErro={setErro}
          ocupado={ocupado}
        />
      )}
      <Modal
        aberto={concluir}
        aoFechar={() => setConcluir(false)}
        titulo="Concluir Importação"
        resumo={imp.arquivoNome}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setConcluir(false)}>
              Voltar
            </Botao>
            <Botao
              carregando={ocupado}
              icone={<CheckCheck className="h-4 w-4" />}
              onClick={() =>
                rodar(
                  () => concluirImportacao(imp.id),
                  () => {
                    setConcluir(false);
                    router.refresh();
                  },
                )
              }
            >
              Concluir
            </Botao>
          </>
        }
      >
        <div className="space-y-2 text-sm text-gray-700">
          <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
          <p>Ao concluir, o que já está pronto entra sozinho:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>{prontasAdicionar}</strong> linhas novas com categoria serão <strong>adicionadas</strong> {imp.eCartao ? "como compras no cartão" : "como pagas/recebidas"};
            </li>
            <li>
              <strong>{prontasConciliar}</strong> linhas encontradas serão <strong>conciliadas</strong> (o lançamento que já existia fica como pago).
            </li>
          </ul>
          {deFora > 0 && (
            <p className="rounded-md bg-amarelo px-3 py-2 text-amarelo-texto">
              <strong>{deFora}</strong> {deFora === 1 ? "linha ficará" : "linhas ficarão"} de fora (sem categoria ou pendentes). Se quiser, volte e resolva antes.
            </p>
          )}
          <p className="text-xs text-gray-500">Depois de concluída, a importação não pode mais ser alterada. Se importar o mesmo arquivo de novo, o que já entrou aparece como já importado.</p>
        </div>
      </Modal>
      <ModalRegra aberto={!!regra} aoFechar={() => setRegra(null)} regraId={null} inicial={regra ?? novaRegra()} opcoes={opcoes} importacaoId={somenteLeitura ? undefined : imp.id} aoSalvar={() => setMensagem("Regra salva e aplicada nas linhas.")} />
      <Modal aberto={!!bruto} aoFechar={() => setBruto(null)} titulo="Informações da Transação" resumo={bruto ? `Linha ${bruto.numeroLinha} do arquivo` : ""}>
        {bruto && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {Object.entries(bruto.bruto).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium text-gray-500">{k}</dt>
                <dd className="break-all text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </>
  );
}

function LinhaTabela({ l, imp, opcoes, somenteLeitura, ocupado, marcado, aoMarcar, aoMudarCategoria, aoAdicionar, aoConciliar, aoDesfazer, menu }: {
  l: LinhaRevisao;
  imp: DetalheImportacao;
  opcoes: Opcoes;
  somenteLeitura: boolean;
  ocupado: boolean;
  marcado: boolean;
  aoMarcar: () => void;
  aoMudarCategoria: (v: string) => void;
  aoAdicionar: () => void;
  aoConciliar: () => void;
  aoDesfazer: () => void;
  menu: React.ComponentProps<typeof MenuLinha>["itens"];
}) {
  const s = STATUS[l.status];
  const descricao = l.campos.descricao?.trim() || l.descricaoOriginal;
  const cinza = l.status === "ignorado";
  const categoria = opcoes.categorias.find((c) => c.id === l.campos.categoriaId);
  const candidato = l.candidatos[0];
  const editavel = !somenteLeitura && l.status === "novo";
  return (
    <tr className={cn("border-b border-borda align-top last:border-0", cinza && "bg-gray-50 text-gray-400", marcado && "bg-verde-claro/60")}>
      {!somenteLeitura && (
        <td className="px-3 py-2.5">
          <input type="checkbox" aria-label={`Selecionar ${descricao}`} checked={marcado} onChange={aoMarcar} className="h-4 w-4 accent-verde" />
        </td>
      )}
      <td className="whitespace-nowrap px-3 py-2.5">{formatarData(l.data)}</td>
      <td className="px-3 py-2.5">
        <p className={cn("font-medium", cinza ? "text-gray-400" : "text-gray-900")}>{descricao}</p>
        {descricao !== l.descricaoOriginal && <p className="text-xs text-gray-400">No banco: {l.descricaoOriginal}</p>}
        <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
          {l.duplicada && <span className="rounded bg-gray-200 px-1.5 text-gray-600">Já importada antes</span>}
          {l.regra && (
            <span className="inline-flex items-center gap-1 rounded bg-verde-claro px-1.5 text-verde" title="Regra aplicada">
              <Wand2 className="h-3 w-3" /> {l.regra.nome}
            </span>
          )}
          {l.campos.origemCategoria === "historico" && (
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 text-receita" title="Mesma categoria da última vez que esta descrição foi importada">
              <Sparkles className="h-3 w-3" /> Sugerida pelo histórico
            </span>
          )}
          {l.campos.contatoNome && !l.campos.contatoId && <span className="rounded bg-amber-50 px-1.5 text-amber-800">Novo contato: {l.campos.contatoNome}</span>}
        </div>
        {l.status === "encontrado" && candidato && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-800">
            <Link2 className="h-3 w-3" /> {candidato.previsto ? "Recorrente previsto" : "Lançamento"}: {candidato.descricao} · {formatarData(candidato.data)}
            {candidato.destino !== imp.destinoNome && ` · ${candidato.destino}`}
            {candidato.realizado && " · já pago"}
          </p>
        )}
        {l.status === "pendente" && <p className="mt-1 text-xs text-despesa">{l.candidatos.length} lançamentos podem ser este. Clique em Escolher.</p>}
        {(l.status === "adicionado" || l.status === "conciliado") && l.lancamento && <p className="mt-1 text-xs text-pago-texto">→ {l.lancamento.descricao}</p>}
      </td>
      <td className="min-w-52 px-3 py-2.5">
        {editavel ? (
          <select
            aria-label={`Categoria de ${descricao}`}
            value={l.campos.categoriaId ? String(l.campos.categoriaId) : ""}
            disabled={ocupado}
            onChange={(e) => aoMudarCategoria(e.target.value)}
            className={cn("h-8 w-full rounded-md border bg-white px-2 text-sm outline-none focus:border-verde", !l.campos.categoriaId && l.status === "novo" ? "border-despesa/50" : "border-borda")}
          >
            <option value="">Escolha a categoria</option>
            {opcoes.categorias
              .filter((c) => c.natureza === l.tipo && (c.ativo || c.id === l.campos.categoriaId))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {"   ".repeat(c.nivel - 1)}
                  {c.rotulo}
                </option>
              ))}
          </select>
        ) : l.status === "encontrado" || l.status === "pendente" ? (
          <span className="text-xs text-gray-500" title="Ao conciliar, o lançamento que já existe mantém a categoria dele.">Fica a do lançamento existente</span>
        ) : (
          <span className="text-sm">{categoria?.rotulo ?? <span className="text-gray-400">—</span>}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">{cinza ? <span className="font-semibold tabular-nums text-gray-400">{(l.tipo === "despesa" ? "-" : "") + (l.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> : <Valor centavos={comSinal(l)} />}</td>
      <td className="px-3 py-2.5 text-center">
        <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", s.estilo)} title={s.dica}>
          {s.rotulo}
        </span>
      </td>
      {!somenteLeitura && (
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <span className="inline-flex items-center gap-1">
            {l.status === "novo" && (
              <Botao className="h-8 px-3" disabled={ocupado || !l.campos.categoriaId} title={l.campos.categoriaId ? "Vira lançamento" : "Escolha a categoria antes"} onClick={aoAdicionar}>
                Adicionar
              </Botao>
            )}
            {l.status === "encontrado" && (
              <Botao className="h-8 px-3" disabled={ocupado} onClick={aoConciliar}>
                Conciliar
              </Botao>
            )}
            {l.status === "pendente" && (
              <Botao className="h-8 px-3" variante="secundario" disabled={ocupado} onClick={aoConciliar}>
                Escolher
              </Botao>
            )}
            {(l.status === "adicionado" || l.status === "conciliado" || l.status === "ignorado") && (
              <Botao className="h-8 px-3" variante="fantasma" disabled={ocupado} icone={<RotateCcw className="h-3.5 w-3.5" />} onClick={aoDesfazer}>
                Desfazer
              </Botao>
            )}
            <MenuLinha rotulo={descricao} itens={menu} />
          </span>
        </td>
      )}
    </tr>
  );
}

/** Editar Registro: o que a linha vai ter quando virar lançamento. */
function ModalEditar({ l, imp, opcoes, aoFechar }: { l: LinhaRevisao; imp: DetalheImportacao; opcoes: Opcoes; aoFechar: () => void }) {
  const { erro, ocupado, rodar } = useAcao();
  const [c, setC] = useState<CamposLinha>({ ...l.campos, descricao: l.campos.descricao || l.descricaoOriginal, tagIds: l.campos.tagIds ?? [] });
  const mudar = <K extends keyof CamposLinha>(k: K, v: CamposLinha[K]) => setC((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Editar Registro"
      resumo={`${formatarData(l.data)} · ${l.tipo === "despesa" ? "Saída" : "Entrada"} de R$ ${(l.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao carregando={ocupado} onClick={() => rodar(() => editarLinha(imp.id, l.id, c), aoFechar)}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <p className="text-xs text-gray-500">No banco: {l.descricaoOriginal}</p>
        <CampoTexto rotulo="Descrição" obrigatorio maxLength={120} valor={c.descricao ?? ""} aoMudar={(v) => mudar("descricao", v)} />
        <CampoCategoria valor={c.categoriaId ? String(c.categoriaId) : ""} aoMudar={(v) => mudar("categoriaId", v ? Number(v) : null)} categorias={opcoes.categorias} natureza={l.tipo} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <CampoComNovo rotulo="Cliente ou Fornecedor" valor={c.contatoId ? String(c.contatoId) : ""} aoMudar={(v) => setC((x) => ({ ...x, contatoId: v ? Number(v) : null, contatoNome: v ? null : x.contatoNome }))} opcoes={opcoes.contatos} />
            {c.contatoNome && !c.contatoId && <p className="mt-1 text-xs text-amber-800">Será cadastrado: {c.contatoNome}</p>}
          </div>
          <CampoComNovo rotulo="Forma de Pagamento" valor={c.formaPagamentoId ? String(c.formaPagamentoId) : ""} aoMudar={(v) => mudar("formaPagamentoId", v ? Number(v) : null)} opcoes={opcoes.formas} />
        </div>
        <CampoTags valor={c.tagIds ?? []} aoMudar={(v) => mudar("tagIds", v)} tags={opcoes.tags} aoCriar={() => undefined} />
      </div>
    </Modal>
  );
}

/** Encontrar Lançamento (busca manual) e Escolher (linha pendente). */
function ModalEncontrar({ l, imp, aoFechar, aoConciliar }: { l: LinhaRevisao; imp: DetalheImportacao; aoFechar: () => void; aoConciliar: () => void }) {
  const { erro, setErro, ocupado, rodar } = useAcao();
  const [texto, setTexto] = useState("");
  const [mesmoValor, setMesmoValor] = useState(true);
  const [dias, setDias] = useState("30");
  const [lista, setLista] = useState<Candidato[] | null>(l.status === "pendente" ? l.candidatos : null);
  const [buscandoAgora, setBuscandoAgora] = useState(false);

  const buscar = async () => {
    setBuscandoAgora(true);
    setErro("");
    try {
      const r = await buscarLancamentos(imp.id, l.id, { texto, mesmoValor, dias: Number(dias) });
      if ("erro" in r) setErro(r.erro);
      else setLista(r.candidatos);
    } catch {
      setErro("Não foi possível buscar agora. Tente de novo.");
    }
    setBuscandoAgora(false);
  };

  return (
    <Modal aberto aoFechar={aoFechar} largura="larga" titulo={l.status === "pendente" ? "Escolher o lançamento" : "Encontrar Lançamento"} resumo={`${formatarData(l.data)} · ${l.descricaoOriginal} · R$ ${(l.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}>
      <div className="space-y-3">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <CampoTexto rotulo="Descrição contém" className="min-w-48 flex-1" valor={texto} aoMudar={setTexto} maxLength={60} />
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">Perto da data</span>
            <select value={dias} onChange={(e) => setDias(e.target.value)} className="h-10 rounded-md border border-borda bg-white px-2 text-sm">
              {["7", "15", "30", "60", "120"].map((d) => (
                <option key={d} value={d}>
                  ± {d} dias
                </option>
              ))}
            </select>
          </label>
          <div className="pb-2">
            <Chave ligada={mesmoValor} aoMudar={setMesmoValor} rotulo="Mesmo valor" />
          </div>
          <Botao type="submit" carregando={buscandoAgora} icone={<Search className="h-4 w-4" />}>
            Buscar
          </Botao>
        </form>
        {lista && (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-borda">
            {lista.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhum lançamento encontrado. Tente sem &quot;Mesmo valor&quot; ou com mais dias.</p>
            ) : (
              <ul>
                {lista.map((c) => (
                  <li key={c.chave} className="flex items-center gap-3 border-b border-borda px-3 py-2 text-sm last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{c.descricao}</p>
                      <p className="text-xs text-gray-500">
                        {formatarData(c.data)} · {c.destino}
                        {c.previsto ? " · recorrente previsto" : c.realizado ? " · já pago" : " · não pago"}
                      </p>
                    </div>
                    <Valor centavos={c.tipo === "despesa" ? -c.valorCentavos : c.valorCentavos} />
                    <Botao className="h-8 px-3" disabled={ocupado} onClick={() => rodar(() => conciliarLinha(imp.id, l.id, c.chave), () => {
                      aoConciliar();
                      aoFechar();
                    })}>
                      Conciliar
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="text-xs text-gray-500">Conciliar marca o lançamento como pago com a data e o valor do extrato. Dá para desfazer antes de concluir.</p>
      </div>
    </Modal>
  );
}

/** Ação em lote: preencher só os campos em branco das linhas selecionadas. */
function ModalPreencher({ opcoes, aoFechar, aoSalvar, erro, setErro, ocupado }: { opcoes: Opcoes; aoFechar: () => void; aoSalvar: (c: CamposLinha) => void; erro: string; setErro: (e: string) => void; ocupado: boolean }) {
  const [c, setC] = useState<{ categoriaId: string; contatoId: string; formaPagamentoId: string; tagIds: number[] }>({ categoriaId: "", contatoId: "", formaPagamentoId: "", tagIds: [] });
  return (
    <Modal
      aberto
      aoFechar={() => {
        setErro("");
        aoFechar();
      }}
      titulo="Preencher campos em branco"
      resumo="Só as linhas selecionadas que estão com o campo vazio recebem o valor."
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao
            carregando={ocupado}
            onClick={() => aoSalvar({ categoriaId: c.categoriaId ? Number(c.categoriaId) : null, contatoId: c.contatoId ? Number(c.contatoId) : null, formaPagamentoId: c.formaPagamentoId ? Number(c.formaPagamentoId) : null, tagIds: c.tagIds })}
          >
            Preencher
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <CampoCategoriaTodas valor={c.categoriaId} aoMudar={(v) => setC((x) => ({ ...x, categoriaId: v }))} opcoes={opcoes} />
        <p className="-mt-2 text-xs text-gray-500">Uma categoria de despesa só vai para as saídas; uma de receita, só para as entradas.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoComNovo rotulo="Cliente ou Fornecedor" vazio="Não preencher" valor={c.contatoId} aoMudar={(v) => setC((x) => ({ ...x, contatoId: v }))} opcoes={opcoes.contatos} />
          <CampoComNovo rotulo="Forma de Pagamento" vazio="Não preencher" valor={c.formaPagamentoId} aoMudar={(v) => setC((x) => ({ ...x, formaPagamentoId: v }))} opcoes={opcoes.formas} />
        </div>
        <CampoTags valor={c.tagIds} aoMudar={(v) => setC((x) => ({ ...x, tagIds: v }))} tags={opcoes.tags} aoCriar={() => undefined} />
      </div>
    </Modal>
  );
}
