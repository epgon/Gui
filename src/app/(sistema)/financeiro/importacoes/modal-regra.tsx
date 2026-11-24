"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto, Rotulo, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { CAMPOS_CONDICAO, OPERADORES } from "@/lib/importacao/regras";
import type { Condicao, DadosRegra } from "@/lib/importacao/tipos";
import type { Opcoes } from "@/lib/lancamentos/tipos";
import { CampoComNovo, CampoDestino, CampoTags } from "../lancamentos/campos";
import { salvarRegra } from "./acoes";

export const REGRA_VAZIA: DadosRegra = {
  nome: "",
  destino: "",
  condicoes: [{ campo: "descricao", operador: "contem", valor: "" }],
  acao: "preencher",
  descricao: "",
  categoriaId: "",
  contatoId: "",
  formaPagamentoId: "",
  tagIds: [],
  ordem: "10",
};

/** Regra em branco (objeto novo a cada vez, para o formulário recomeçar). */
export const novaRegra = (parcial: Partial<DadosRegra> = {}): DadosRegra => ({ ...REGRA_VAZIA, condicoes: [{ campo: "descricao", operador: "contem", valor: "" }], ...parcial });

const estilo = "h-10 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none focus:border-verde focus:ring-2 focus:ring-verde/15";

/** Categoria de qualquer natureza (a regra pode valer para despesas e receitas). */
export function CampoCategoriaTodas({ valor, aoMudar, opcoes, rotulo = "Categoria", natureza }: { valor: string; aoMudar: (v: string) => void; opcoes: Opcoes; rotulo?: string; natureza?: "receita" | "despesa" }) {
  const id = useId();
  const grupos = (["despesa", "receita"] as const).filter((n) => !natureza || n === natureza);
  return (
    <div>
      <Rotulo texto={rotulo} htmlFor={id} />
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={estilo}>
        <option value="">Não preencher</option>
        {grupos.map((n) => (
          <optgroup key={n} label={n === "despesa" ? "Despesas" : "Receitas"}>
            {opcoes.categorias
              .filter((c) => c.natureza === n && (c.ativo || String(c.id) === valor))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {"   ".repeat(c.nivel - 1)}
                  {c.rotulo}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function ModalRegra({ aberto, aoFechar, regraId, inicial, opcoes, importacaoId, aoSalvar }: {
  aberto: boolean;
  aoFechar: () => void;
  regraId: number | null;
  inicial: DadosRegra;
  opcoes: Opcoes;
  /** Aberta na revisão de uma importação: "Salvar e Executar" aplica nas linhas. */
  importacaoId?: number;
  aoSalvar?: () => void;
}) {
  const [dados, setDados] = useState(inicial);
  const [base, setBase] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  // Abriu com outros dados: recomeça o formulário.
  if (base !== inicial) {
    setBase(inicial);
    setDados(inicial);
    setErro("");
  }
  const mudar = <K extends keyof DadosRegra>(k: K, v: DadosRegra[K]) => {
    setDados((d) => ({ ...d, [k]: v }));
    setErro("");
  };
  const mudarCondicao = (i: number, c: Partial<Condicao>) => mudar("condicoes", dados.condicoes.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const salvar = () =>
    iniciar(async () => {
      try {
        const r = await salvarRegra(regraId, dados, importacaoId ?? null);
        if (!r.ok) setErro(r.erro);
        else {
          aoFechar();
          aoSalvar?.();
        }
      } catch {
        setErro("Não foi possível salvar agora. Confira sua conexão e tente de novo.");
      }
    });

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      largura="larga"
      titulo={regraId ? "Editando Regra" : "Nova Regra de Importação"}
      resumo={dados.nome || "Regras preenchem ou ignoram as linhas do extrato sozinhas."}
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} carregando={salvando} icone={<Save className="h-4 w-4" />}>
            {importacaoId ? "Salvar e Executar" : "Salvar"}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
          <CampoTexto rotulo="Nome da regra" obrigatorio maxLength={80} valor={dados.nome} aoMudar={(v) => mudar("nome", v)} placeholder="Ex.: Supermercado" />
          <CampoDestino rotulo="Vale para" obrigatorio={false} valor={dados.destino} aoMudar={(v) => mudar("destino", v)} destinos={opcoes.destinos} ajuda="Deixe em branco para valer em todas as contas e cartões." />
          <CampoTexto rotulo="Ordem" inputMode="numeric" valor={dados.ordem} aoMudar={(v) => mudar("ordem", v.replace(/\D/g, "").slice(0, 4))} ajuda="Quando mais de uma regra vale para a mesma linha, a de menor ordem ganha." />
        </div>

        <fieldset className="rounded-lg border border-borda p-3">
          <legend className="px-1 text-sm font-semibold text-gray-800">Quando (todas as condições)</legend>
          <div className="space-y-2">
            {dados.condicoes.map((c, i) => {
              const operadores = OPERADORES.filter((o) => (c.campo === "valor" ? o.numerico : c.campo === "tipo" ? o.valor === "igual" : o.texto));
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
                  <select
                    aria-label={`Campo da condição ${i + 1}`}
                    value={c.campo}
                    onChange={(e) => {
                      const campo = e.target.value as Condicao["campo"];
                      mudarCondicao(i, { campo, operador: campo === "valor" || campo === "tipo" ? "igual" : "contem", valor: campo === "tipo" ? "despesa" : c.campo === "tipo" ? "" : c.valor });
                    }}
                    className={estilo}
                  >
                    {CAMPOS_CONDICAO.map((x) => (
                      <option key={x.valor} value={x.valor}>
                        {x.rotulo}
                      </option>
                    ))}
                  </select>
                  <select aria-label={`Condição ${i + 1}`} value={c.operador} onChange={(e) => mudarCondicao(i, { operador: e.target.value as Condicao["operador"] })} className={estilo}>
                    {operadores.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                  {c.campo === "tipo" ? (
                    <select aria-label={`Valor da condição ${i + 1}`} value={c.valor} onChange={(e) => mudarCondicao(i, { valor: e.target.value })} className={estilo}>
                      <option value="despesa">Despesa (saída)</option>
                      <option value="receita">Receita (entrada)</option>
                    </select>
                  ) : (
                    <input
                      aria-label={`Valor da condição ${i + 1}`}
                      value={c.valor}
                      maxLength={120}
                      inputMode={c.campo === "valor" ? "decimal" : undefined}
                      placeholder={c.campo === "valor" ? "0,00" : "Ex.: supermercado"}
                      onChange={(e) => mudarCondicao(i, { valor: e.target.value })}
                      className={estilo}
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Tirar a condição ${i + 1}`}
                    disabled={dados.condicoes.length === 1}
                    onClick={() => mudar("condicoes", dados.condicoes.filter((_, j) => j !== i))}
                    className="h-10 rounded-md px-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          {dados.condicoes.length < 10 && (
            <button type="button" onClick={() => mudar("condicoes", [...dados.condicoes, { campo: "descricao", operador: "contem", valor: "" }])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-verde hover:underline">
              <Plus className="h-4 w-4" /> Condição
            </button>
          )}
          <p className="mt-2 text-xs text-gray-500">Maiúsculas e acentos não fazem diferença. A descrição comparada é a que vem do banco.</p>
        </fieldset>

        <fieldset className="rounded-lg border border-borda p-3">
          <legend className="px-1 text-sm font-semibold text-gray-800">Então</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ação da regra">
            {(
              [
                ["preencher", "Preencher automaticamente"],
                ["ignorar", "Ignorar registro"],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={dados.acao === v}
                onClick={() => mudar("acao", v)}
                className={cn("h-9 rounded-md border px-4 text-sm font-semibold", dados.acao === v ? "border-verde bg-verde text-white" : "border-borda bg-white text-gray-700 hover:bg-gray-50")}
              >
                {r}
              </button>
            ))}
          </div>
          {dados.acao === "ignorar" ? (
            <p className="mt-3 text-sm text-gray-600">As linhas que atendem às condições ficam em cinza e não viram lançamento. Útil para o <strong>pagamento da fatura do cartão</strong>, que já está contado nas compras.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <CampoTexto rotulo="Descrição" maxLength={120} valor={dados.descricao} aoMudar={(v) => mudar("descricao", v)} placeholder="Deixe em branco para manter a do banco" />
              <CampoCategoriaTodas valor={dados.categoriaId} aoMudar={(v) => mudar("categoriaId", v)} opcoes={opcoes} />
              <CampoComNovo rotulo="Cliente ou Fornecedor" vazio="Não preencher" valor={dados.contatoId} aoMudar={(v) => mudar("contatoId", v)} opcoes={opcoes.contatos} />
              <CampoComNovo rotulo="Forma de Pagamento" vazio="Não preencher" valor={dados.formaPagamentoId} aoMudar={(v) => mudar("formaPagamentoId", v)} opcoes={opcoes.formas} />
              <div className="sm:col-span-2">
                <CampoTags valor={dados.tagIds} aoMudar={(v) => mudar("tagIds", v)} tags={opcoes.tags} aoCriar={() => setErro("Cadastre tags novas em Cadastros > Tags.")} />
              </div>
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}

