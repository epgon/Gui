"use client";

import { CalendarPlus, CheckCircle2, Pencil, Plus, Power, Repeat, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ChaveSituacao } from "@/components/cadastros/chave-situacao";
import { MenuLinha } from "@/components/cadastros/menu-linha";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { CampoSelecao, CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { ListaOrdenavel } from "@/components/ui/lista-ordenavel";
import { SECOES, type Secao } from "./secoes";
import { Modal } from "@/components/ui/modal";
import type { Resultado } from "@/lib/cadastros/resultado";
import { cn } from "@/lib/cn";
import { CADASTROS_AUXILIARES, OPCOES_NOVO_ATUALIZADO, OPCOES_PREVISAO, type Parametros } from "@/lib/parametros/tipos";
import {
  adicionarFeriadosNacionais,
  alterarSituacaoFeriado,
  excluirFeriado,
  salvarCamposAuxiliares,
  salvarFeriado,
  salvarOrdemContasCartoes,
  salvarParametrosGerais,
  salvarParametrosDividas,
  salvarParametrosLancamentos,
  type DadosFeriado,
} from "./acoes";


type Feriado = { id: number; nome: string; dia: number; mes: number; ano: number | null; recorrente: boolean; ativo: boolean };
type Item = { id: number; descricao: string; ativo: boolean };

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Estado de "salvar" de cada seção: ocupado, erro e a confirmação verde. */
function useSalvar() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  async function executar(acao: () => Promise<Resultado>) {
    setOcupado(true);
    setErro("");
    setSalvo(false);
    try {
      const r = await acao();
      if (r.ok) setSalvo(true);
      else setErro(r.erro);
      return r.ok;
    } catch {
      setErro("Não foi possível salvar agora. Confira a internet e tente de novo.");
      return false;
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, erro, salvo, executar, marcarMudanca: () => setSalvo(false) };
}

function Rodape({ s, aoSalvar, desabilitado }: { s: ReturnType<typeof useSalvar>; aoSalvar: () => void; desabilitado?: boolean }) {
  return (
    <div className="mt-5 space-y-3 border-t border-borda pt-4">
      <FaixaErro>{s.erro && <TextoComDestaque texto={s.erro} />}</FaixaErro>
      <div className="flex items-center gap-3">
        <Botao onClick={aoSalvar} carregando={s.ocupado} disabled={desabilitado} icone={<Save className="h-4 w-4" />}>
          Salvar Alterações
        </Botao>
        {s.salvo && (
          <span className="flex items-center gap-1 text-sm text-verde-vivo" role="status">
            <CheckCircle2 className="h-4 w-4" /> Alterações salvas.
          </span>
        )}
      </div>
    </div>
  );
}

function LinhaChave({ titulo, texto, ligada, aoMudar }: { titulo: string; texto: string; ligada: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">{titulo}</p>
        <p className="text-xs text-gray-500">{texto}</p>
      </div>
      <Chave ligada={ligada} aoMudar={aoMudar} rotulo={ligada ? "Ativado" : "Desativado"} />
    </div>
  );
}

export function TelaParametros({ secao, parametros, feriados, contas, cartoes, anoAtual }: {
  secao: Secao;
  parametros: Parametros;
  feriados: Feriado[];
  contas: Item[];
  cartoes: Item[];
  anoAtual: number;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav className="shrink-0 rounded-xl border border-borda bg-white p-2 shadow-cartao lg:w-56" aria-label="Seções dos parâmetros">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {SECOES.map((s) => (
            <li key={s.chave}>
              <Link
                href={`/configuracoes/parametros?secao=${s.chave}`}
                className={cn("block whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-verde-claro", s.chave === secao ? "bg-verde-claro font-semibold text-verde" : "text-gray-700")}
                aria-current={s.chave === secao ? "page" : undefined}
              >
                {s.titulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        {secao === "gerais" && <Gerais p={parametros} />}
        {secao === "lancamentos" && <Lancamentos p={parametros} />}
        {secao === "contas" && <ContasCartoes contas={contas} cartoes={cartoes} />}
        {secao === "auxiliares" && <Auxiliares p={parametros} />}
        {secao === "dividas" && <Dividas p={parametros} contas={contas} />}
        {secao === "feriados" && <Feriados feriados={feriados} anoAtual={anoAtual} />}
      </div>
    </div>
  );
}

function Gerais({ p }: { p: Parametros }) {
  const [d, setD] = useState({ titulo: p.titulo, exibirCores: p.exibirCores, exibirNumeracao: p.exibirNumeracao, novoAtualizadoHoras: p.novoAtualizadoHoras });
  const s = useSalvar();
  const mudar = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    s.marcarMudanca();
  };
  return (
    <Cartao titulo="Parâmetros Gerais">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto rotulo="Título" obrigatorio maxLength={60} valor={d.titulo} aoMudar={(v) => mudar("titulo", v)} ajuda="Aparece no cabeçalho do sistema e no topo das impressões." />
        <CampoSelecao
          rotulo="Novo ou Atualizado"
          valor={String(d.novoAtualizadoHoras)}
          aoMudar={(v) => mudar("novoAtualizadoHoras", Number(v))}
          opcoes={OPCOES_NOVO_ATUALIZADO.map((o) => ({ valor: String(o.valor), rotulo: o.rotulo }))}
          ajuda="Por quanto tempo o ícone laranja aparece nos cadastros novos ou alterados."
        />
      </div>
      <div className="mt-4 divide-y divide-borda">
        <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Categorias</p>
        <LinhaChave titulo="Exibir Cores" texto="Mostra a bolinha de cor das categorias e deixa escolher a cor no cadastro." ligada={d.exibirCores} aoMudar={(v) => mudar("exibirCores", v)} />
        <LinhaChave titulo="Exibir Numeração" texto="Mostra a numeração (1., 1.1., 9.4.1.) na lista de categorias." ligada={d.exibirNumeracao} aoMudar={(v) => mudar("exibirNumeracao", v)} />
      </div>
      <Rodape s={s} aoSalvar={() => s.executar(() => salvarParametrosGerais(d))} />
    </Cartao>
  );
}

function Lancamentos({ p }: { p: Parametros }) {
  const [d, setD] = useState({ previsaoRecorrenteDias: p.previsaoRecorrenteDias, pagamentoParcial: p.pagamentoParcial, campos: p.campos });
  const s = useSalvar();
  const campo = (k: keyof Parametros["campos"], v: boolean) => {
    setD((x) => ({ ...x, campos: { ...x.campos, [k]: v } }));
    s.marcarMudanca();
  };
  const opcoesPrevisao = [...OPCOES_PREVISAO, ...((OPCOES_PREVISAO as readonly number[]).includes(d.previsaoRecorrenteDias) ? [] : [d.previsaoRecorrenteDias])];
  return (
    <Cartao titulo="Lançamentos">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao
          rotulo="Previsão Recorrente"
          valor={String(d.previsaoRecorrenteDias)}
          aoMudar={(v) => {
            setD((x) => ({ ...x, previsaoRecorrenteDias: Number(v) }));
            s.marcarMudanca();
          }}
          opcoes={opcoesPrevisao.map((n) => ({ valor: String(n), rotulo: `${n} dias` }))}
          ajuda="Por quantos dias à frente os próximos lançamentos recorrentes aparecem."
        />
      </div>
      <div className="mt-2 divide-y divide-borda">
        <LinhaChave
          titulo="Pagamento Parcial"
          texto="Ao pagar ou receber menos que o valor, oferece criar um novo lançamento com o restante. Desligado, a diferença fica como desconto."
          ligada={d.pagamentoParcial}
          aoMudar={(v) => {
            setD((x) => ({ ...x, pagamentoParcial: v }));
            s.marcarMudanca();
          }}
        />
        <p className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Campos e Recursos do lançamento</p>
        <LinhaChave titulo="Data de Referência" texto="Mês a que a conta se refere, além do vencimento e do pagamento." ligada={d.campos.dataReferencia} aoMudar={(v) => campo("dataReferencia", v)} />
        <LinhaChave titulo="Documento" texto="Número da nota, boleto ou recibo." ligada={d.campos.documento} aoMudar={(v) => campo("documento", v)} />
        <LinhaChave titulo="Observação" texto="Texto livre de até 1000 caracteres em cada lançamento." ligada={d.campos.observacao} aoMudar={(v) => campo("observacao", v)} />
        <LinhaChave titulo="Anexos" texto="Imagens e PDFs anexados ao lançamento." ligada={d.campos.anexos} aoMudar={(v) => campo("anexos", v)} />
      </div>
      <p className="mt-3 text-xs text-gray-500">Desligar um campo só o esconde do formulário: o que já foi gravado continua guardado e volta a aparecer se você ligar de novo.</p>
      <Rodape s={s} aoSalvar={() => s.executar(() => salvarParametrosLancamentos(d))} />
    </Cartao>
  );
}

function Dividas({ p, contas }: { p: Parametros; contas: Item[] }) {
  const fmt = (n: number) => String(n).replace(".", ",");
  const c = p.dividas;
  const [d, setD] = useState({
    multaPadraoPct: fmt(c.multaPadraoPct),
    moraMensalPct: fmt(c.moraMensalPct),
    reservaMeses: String(c.reservaMeses),
    sobraMeses: String(c.sobraMeses),
    cenarioConservador: fmt(c.cenarios.conservador),
    cenarioIntermediario: fmt(c.cenarios.intermediario),
    cenarioAcelerado: fmt(c.cenarios.acelerado),
  });
  const [reserva, setReserva] = useState<number[]>(c.contasReserva);
  const s = useSalvar();
  const mudar = (k: keyof typeof d) => (v: string) => {
    setD((x) => ({ ...x, [k]: v }));
    s.marcarMudanca();
  };
  const alternar = (id: number) => {
    setReserva((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
    s.marcarMudanca();
  };
  return (
    <Cartao titulo="Gestão de Dívidas">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Atraso</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto rotulo="Multa padrão (%)" valor={d.multaPadraoPct} aoMudar={mudar("multaPadraoPct")} maxLength={6} ajuda="Cobrada uma vez sobre a parcela vencida. Usada quando a dívida não tem a própria multa." />
        <CampoTexto rotulo="Juros de mora ao mês (%)" valor={d.moraMensalPct} aoMudar={mudar("moraMensalPct")} maxLength={6} ajuda="Proporcional aos dias de atraso. Usado quando a dívida não tem os próprios juros de mora." />
      </div>
      <p className="mt-3 text-xs text-gray-500">São só estimativas para o saldo em atraso: o valor certo é o que o credor informa (Atualizar saldo). Mudar aqui não altera pagamentos já feitos.</p>

      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Simulador</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto rotulo="Reserva mínima (meses de despesas)" valor={d.reservaMeses} aoMudar={mudar("reservaMeses")} maxLength={2} inputMode="numeric" ajuda="A reserva mínima é este número de meses multiplicado pela despesa média mensal (sem as parcelas de dívida)." />
        <CampoTexto rotulo="Meses na média da sobra" valor={d.sobraMeses} aoMudar={mudar("sobraMeses")} maxLength={2} inputMode="numeric" ajuda="Quantos meses fechados entram na média de receitas menos despesas (sem as parcelas de dívida)." />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <CampoTexto rotulo="Cenário Conservador (%)" valor={d.cenarioConservador} aoMudar={mudar("cenarioConservador")} maxLength={6} ajuda="Parcelas mais este percentual da sobra que fica livre depois delas. A reserva fica intocada." />
        <CampoTexto rotulo="Cenário Intermediário (%)" valor={d.cenarioIntermediario} aoMudar={mudar("cenarioIntermediario")} maxLength={6} ajuda="Parcelas mais este percentual da sobra livre. A reserva fica intocada." />
        <CampoTexto rotulo="Cenário Acelerado (%)" valor={d.cenarioAcelerado} aoMudar={mudar("cenarioAcelerado")} maxLength={6} ajuda="Parcelas mais este percentual da sobra livre e, uma vez, o que passar da reserva mínima." />
      </div>
      <div className="mt-4">
        <p className="mb-1 text-sm font-medium text-gray-700">Contas que formam a reserva</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {contas.filter((x) => x.ativo || reserva.includes(x.id)).map((x) => (
            <label key={x.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={reserva.includes(x.id)} onChange={() => alternar(x.id)} className="h-4 w-4 accent-verde" />
              {x.descricao}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{reserva.length === 0 ? "Nenhuma marcada: o Simulador usa as contas dos tipos Poupança e Investimento." : `${reserva.length} ${reserva.length === 1 ? "conta marcada" : "contas marcadas"}.`}</p>
      </div>
      <Rodape s={s} aoSalvar={() => s.executar(() => salvarParametrosDividas({ ...d, contasReserva: reserva }))} />
    </Cartao>
  );
}

function ContasCartoes({ contas: c0, cartoes: k0 }: { contas: Item[]; cartoes: Item[] }) {
  const [contas, setContas] = useState(c0);
  const [cartoes, setCartoes] = useState(k0);
  const s = useSalvar();
  const item = (i: Item) => <span className={i.ativo ? "" : "text-gray-400"}>{i.descricao}{!i.ativo && " (inativa)"}</span>;
  return (
    <Cartao titulo="Contas e Cartões">
      <p className="mb-4 text-sm text-gray-600">Arraste (ou use as setas) para ordenar. Essa ordem vale em todas as listas de opções do sistema.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Contas Financeiras</h3>
          <ListaOrdenavel itens={contas} chave={(i) => i.id} conteudo={item} aoMudar={(n) => { setContas(n); s.marcarMudanca(); }} vazio="Nenhuma conta cadastrada." />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Cartões de Crédito</h3>
          <ListaOrdenavel itens={cartoes} chave={(i) => i.id} conteudo={item} aoMudar={(n) => { setCartoes(n); s.marcarMudanca(); }} vazio="Nenhum cartão cadastrado." />
        </div>
      </div>
      <Rodape s={s} aoSalvar={() => s.executar(() => salvarOrdemContasCartoes(contas.map((x) => x.id), cartoes.map((x) => x.id)))} />
    </Cartao>
  );
}

function Auxiliares({ p }: { p: Parametros }) {
  const [d, setD] = useState(p.camposAuxiliares);
  const s = useSalvar();
  return (
    <Cartao titulo="Campos Auxiliares">
      <p className="mb-3 text-sm text-gray-600">
        Um campo de texto extra, com o nome que você quiser, no cadastro escolhido (ex.: &quot;Agência e conta&quot; nas Contas Financeiras). Ele aparece no formulário, pode virar coluna da lista
        e entra no filtro avançado e na impressão personalizada.
      </p>
      <div className="divide-y divide-borda">
        {CADASTROS_AUXILIARES.map(({ chave, rotulo }) => (
          <div key={chave} className="grid items-end gap-3 py-3 sm:grid-cols-[1fr_1fr_auto]">
            <p className="text-sm font-semibold text-gray-800 sm:pb-2.5">{rotulo}</p>
            <CampoTexto
              rotulo="Nome do campo"
              maxLength={40}
              valor={d[chave].rotulo}
              aoMudar={(v) => {
                setD((x) => ({ ...x, [chave]: { ...x[chave], rotulo: v } }));
                s.marcarMudanca();
              }}
            />
            <div className="sm:pb-2">
              <Chave
                ligada={d[chave].ativo}
                aoMudar={(v) => {
                  setD((x) => ({ ...x, [chave]: { ...x[chave], ativo: v } }));
                  s.marcarMudanca();
                }}
                rotulo={d[chave].ativo ? "Ativado" : "Desativado"}
              />
            </div>
          </div>
        ))}
      </div>
      <Rodape s={s} aoSalvar={() => s.executar(() => salvarCamposAuxiliares(d))} />
    </Cartao>
  );
}

const VAZIO: DadosFeriado = { nome: "", dia: "", mes: "1", recorrente: true, ano: "" };

function Feriados({ feriados, anoAtual }: { feriados: Feriado[]; anoAtual: number }) {
  const [editando, setEditando] = useState<{ id: number | null; dados: DadosFeriado } | null>(null);
  const [ano, setAno] = useState(String(anoAtual));
  const [aviso, setAviso] = useState("");
  const s = useSalvar();
  const lista = useSalvar();

  async function salvar() {
    if (!editando) return;
    const ok = await s.executar(() => salvarFeriado(editando.id, editando.dados));
    if (ok) setEditando(null);
  }

  async function nacionais() {
    setAviso("");
    const n = Number(ano);
    await lista.executar(async () => {
      const r = await adicionarFeriadosNacionais(n);
      if (r.ok) setAviso(r.adicionados ? `${r.adicionados} feriado(s) adicionado(s).` : "Todos os feriados nacionais deste ano já estavam cadastrados.");
      return r;
    });
  }

  const data = (f: Feriado) => `${String(f.dia).padStart(2, "0")}/${String(f.mes).padStart(2, "0")}${f.ano ? `/${f.ano}` : ""}`;
  return (
    <Cartao
      titulo="Feriados"
      acoes={
        <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando({ id: null, dados: VAZIO })}>
          Adicionar Feriado
        </Botao>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        Usados no &quot;Apenas dia útil&quot; dos recorrentes: se o vencimento cair num feriado, vai para o próximo dia útil. O ícone <Repeat className="inline h-3.5 w-3.5 text-verde" /> marca os que se
        repetem todo ano.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md bg-subcabecalho p-3">
        <CampoTexto rotulo="Ano" type="number" min={2000} max={2100} valor={ano} aoMudar={setAno} className="w-28" />
        <Botao variante="secundario" icone={<CalendarPlus className="h-4 w-4" />} onClick={nacionais} carregando={lista.ocupado}>
          Adicionar feriados nacionais
        </Botao>
        <p className="w-full text-xs text-gray-500">Inclui Finados, Proclamação da República e Consciência Negra (todo ano) e Carnaval, Sexta-feira Santa e Corpus Christi do ano escolhido.</p>
        {aviso && <p className="w-full text-sm text-verde-vivo">{aviso}</p>}
        <FaixaErro className="w-full">{lista.erro && <TextoComDestaque texto={lista.erro} />}</FaixaErro>
      </div>
      <ul className="divide-y divide-borda rounded-md border border-borda">
        {feriados.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">Nenhum feriado cadastrado.</li>}
        {feriados.map((f) => (
          <li key={f.id} className={cn("flex items-center gap-3 px-3 py-2 text-sm", !f.ativo && "text-gray-400")}>
            <span className="w-24 shrink-0 tabular-nums">{data(f)}</span>
            <span className="min-w-0 flex-1 truncate">
              {f.nome}
              {f.recorrente && <Repeat className="ml-1.5 inline h-3.5 w-3.5 text-verde" aria-label="Repete todo ano" />}
            </span>
            <ChaveSituacao ativo={f.ativo} aoMudar={() => lista.executar(() => alterarSituacaoFeriado(f.id, !f.ativo))} rotulo={`o feriado ${f.nome}`} />
            <MenuLinha
              rotulo={f.nome}
              itens={[
                {
                  rotulo: "Editar",
                  icone: <Pencil className="h-4 w-4" />,
                  aoClicar: () => setEditando({ id: f.id, dados: { nome: f.nome, dia: String(f.dia), mes: String(f.mes), recorrente: f.ano === null, ano: f.ano ? String(f.ano) : "" } }),
                },
                { rotulo: f.ativo ? "Inativar" : "Ativar", icone: <Power className="h-4 w-4" />, aoClicar: () => lista.executar(() => alterarSituacaoFeriado(f.id, !f.ativo)) },
                {
                  rotulo: "Excluir",
                  icone: <Trash2 className="h-4 w-4" />,
                  aoClicar: () => {
                    if (confirm(`Excluir o feriado ${f.nome}?`)) lista.executar(() => excluirFeriado(f.id));
                  },
                },
              ]}
            />
          </li>
        ))}
      </ul>

      <Modal
        aberto={!!editando}
        aoFechar={() => setEditando(null)}
        titulo={editando?.id ? "Editando Feriado" : "Novo Feriado"}
        resumo={editando?.dados.nome || "Nome"}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEditando(null)}>
              Voltar
            </Botao>
            <Botao onClick={salvar} carregando={s.ocupado}>
              Salvar
            </Botao>
          </>
        }
      >
        {editando && (
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto className="sm:col-span-3" rotulo="Nome" obrigatorio autoFocus maxLength={60} valor={editando.dados.nome} aoMudar={(v) => setEditando({ ...editando, dados: { ...editando.dados, nome: v } })} />
            <CampoTexto rotulo="Dia" obrigatorio type="number" min={1} max={31} valor={editando.dados.dia} aoMudar={(v) => setEditando({ ...editando, dados: { ...editando.dados, dia: v } })} />
            <CampoSelecao
              rotulo="Mês"
              obrigatorio
              valor={editando.dados.mes}
              aoMudar={(v) => setEditando({ ...editando, dados: { ...editando.dados, mes: v } })}
              opcoes={MESES.map((m, i) => ({ valor: String(i + 1), rotulo: m }))}
            />
            <CampoTexto
              rotulo="Ano"
              type="number"
              min={2000}
              max={2100}
              desabilitado={editando.dados.recorrente}
              valor={editando.dados.recorrente ? "" : editando.dados.ano}
              aoMudar={(v) => setEditando({ ...editando, dados: { ...editando.dados, ano: v } })}
            />
            <div className="sm:col-span-3">
              <Chave
                ligada={editando.dados.recorrente}
                aoMudar={(v) => setEditando({ ...editando, dados: { ...editando.dados, recorrente: v } })}
                rotulo="Repete todo ano"
              />
            </div>
            <FaixaErro className="sm:col-span-3">{s.erro && <TextoComDestaque texto={s.erro} />}</FaixaErro>
          </div>
        )}
      </Modal>
    </Cartao>
  );
}
