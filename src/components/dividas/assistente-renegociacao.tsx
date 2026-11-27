"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Handshake } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { CampoCategoria, CampoComNovo, CampoDestino } from "@/app/(sistema)/financeiro/lancamentos/campos";
import { prepararRenegociacao, renegociarDividas } from "@/app/(sistema)/gestao/dividas/negociacoes/acoes";
import { Botao } from "@/components/ui/botao";
import { CampoAreaTexto, CampoSelecao, CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { analisarProposta, planejarRenegociacao, validarRenegociacao, type CondicoesRenegociacao } from "@/lib/dividas/negociacao";
import { estaAtiva } from "@/lib/dividas/regras";
import type { DividaParaRenegociar, LinhaDivida, LinhaNegociacao, PropostaLinha } from "@/lib/dividas/tipos";
import { AvisoAntesDeConfirmar } from "./aviso-confirmar";
import { PERIODICIDADES, type Periodicidade } from "@/lib/lancamentos/regras";
import type { Opcoes } from "@/lib/lancamentos/tipos";

export type InicioRenegociacao = {
  /** Dívidas já marcadas (ex.: a dívida do menu, ou as da negociação). */
  dividaIds: number[];
  /** Quando o acordo nasce de uma negociação aceita. */
  negociacao?: LinhaNegociacao;
  proposta?: PropostaLinha;
};

const reais = (c: number) => `R$ ${formatarCentavos(c)}`;
const centavos = (texto: string) => (texto.trim() ? (lerValorEmCentavos(texto) ?? 0) : 0);
const emTexto = (c: number) => (c > 0 ? formatarCentavos(c) : "");

/**
 * Renegociação em etapas (seção 7.3.1): 1. Dívidas originais, 2. Condições do acordo, 3. Revisão e Confirmar.
 * Nada é gravado antes do Confirmar.
 */
export function AssistenteRenegociacao({ dividas, opcoes, hoje, inicio, padroes, aoFechar, aoConcluir }: {
  dividas: LinhaDivida[];
  opcoes: Opcoes;
  hoje: string;
  inicio: InicioRenegociacao;
  padroes: { contaId: string; categoriaId: string };
  aoFechar: () => void;
  aoConcluir: (acordoId: number) => void;
}) {
  const { negociacao, proposta } = inicio;
  const ativas = useMemo(() => dividas.filter((d) => estaAtiva(d.situacao)), [dividas]);
  const primeira = ativas.find((d) => inicio.dividaIds.includes(d.id));
  const [aviso, setAviso] = useState(false);
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [credorId, setCredorId] = useState<string>(negociacao ? String(negociacao.contatoId) : primeira ? String(primeira.contatoId) : "");
  const [marcadas, setMarcadas] = useState<number[]>(inicio.dividaIds);

  const credorNome = ativas.find((d) => String(d.contatoId) === credorId)?.credor ?? negociacao?.credor ?? "";
  const doCredor = ativas.filter((d) => String(d.contatoId) === credorId && (!negociacao || negociacao.dividas.some((x) => x.id === d.id)));
  const escolhidas = doCredor.filter((d) => marcadas.includes(d.id));
  const saldoEscolhidas = escolhidas.reduce((s, d) => s + d.saldo.exibido, 0);
  const credores = [...new Map(ativas.map((d) => [d.contatoId, d.credor])).entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Condições (etapa 2), pré-preenchidas com a proposta aceita.
  const aVista = proposta?.modalidade === "a_vista";
  const [descricaoDigitada, setDescricao] = useState<string | null>(null);
  const [modo, setModo] = useState<"parcelado" | "a_vista">(aVista ? "a_vista" : "parcelado");
  const [entrada, setEntrada] = useState(proposta ? emTexto(proposta.entradaCentavos) : "");
  const [dataEntrada, setDataEntrada] = useState(hoje);
  const [parcelas, setParcelas] = useState(proposta ? String(proposta.parcelas) : "12");
  const [valorParcela, setValorParcela] = useState(proposta && proposta.parcelas ? emTexto(proposta.valorParcelaCentavos) : "");
  const [primeiroVencimento, setPrimeiroVencimento] = useState(proposta?.primeiroVencimento ?? hoje);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("mensal");
  const [taxaDigitada, setTaxa] = useState<string | null>(null);
  const [contaId, setContaId] = useState(primeira?.contaId ? String(primeira.contaId) : padroes.contaId);
  const [categoriaId, setCategoriaId] = useState(primeira?.categoriaId ? String(primeira.categoriaId) : padroes.categoriaId);
  const [formaId, setFormaId] = useState(primeira?.formaPagamentoId ? String(primeira.formaPagamentoId) : "");
  const [observacao, setObservacao] = useState("");

  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const [preparadas, setPreparadas] = useState<DividaParaRenegociar[] | null>(null);

  const condicoes: CondicoesRenegociacao = {
    entradaCentavos: centavos(entrada),
    dataEntrada: dataEntrada || null,
    parcelas: modo === "a_vista" ? 0 : Math.max(0, Math.floor(Number(parcelas) || 0)),
    valorParcelaCentavos: modo === "a_vista" ? 0 : centavos(valorParcela),
    primeiroVencimento: primeiroVencimento || null,
    periodicidade,
  };
  const analise = analisarProposta({ ...condicoes, saldoCentavos: saldoEscolhidas, sobraMensalCentavos: negociacao?.sobraMensalCentavos ?? null });

  const alternar = (id: number) => setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  // Ao mudar de credor, só ficam marcadas as dívidas dele.
  const trocarCredor = (id: string) => {
    setCredorId(id);
    setMarcadas([]);
  };

  // A descrição e a taxa são sugeridas enquanto a pessoa não mexe nelas.
  const descricao = descricaoDigitada ?? (escolhidas.length === 1 ? `Acordo ${escolhidas[0].descricao}` : escolhidas.length > 1 ? `Acordo ${credorNome}` : "").slice(0, 120);
  const taxa = taxaDigitada ?? (analise.jurosImplicitosMensal ? String(analise.jurosImplicitosMensal).replace(".", ",") : "");

  const avancarParaCondicoes = () => {
    if (!escolhidas.length) return setErro("Escolha pelo menos uma dívida para renegociar.");
    setErro("");
    setEtapa(2);
  };

  const avancarParaRevisao = () => {
    const problema = validarRenegociacao({ originais: escolhidas.map((d) => ({ id: d.id, contatoId: d.contatoId, ativa: true, descricao: d.descricao })), condicoes });
    if (problema) return setErro(problema);
    if (!descricao.trim()) return setErro("Preencha o campo **Descrição do Acordo**.");
    if (condicoes.entradaCentavos > 0 && !condicoes.dataEntrada) return setErro("Informe o vencimento da **Entrada**.");
    if (!contaId) return setErro("Preencha o campo **Conta de Pagamento**.");
    if (!categoriaId) return setErro("Preencha o campo **Categoria**.");
    setErro("");
    iniciar(async () => {
      try {
        setPreparadas(await prepararRenegociacao(escolhidas.map((d) => d.id)));
        setEtapa(3);
      } catch {
        setErro("Não foi possível montar a revisão agora. Tente de novo.");
      }
    });
  };

  const plano = useMemo(() => {
    if (!preparadas || etapa !== 3) return null;
    return planejarRenegociacao({
      originais: preparadas.map((p) => ({ id: p.id, descricao: p.descricao, saldoCentavos: p.saldoCentavos, lancamentos: p.lancamentos })),
      condicoes,
      descricaoAcordo: descricao.trim(),
      sobraMensalCentavos: negociacao?.sobraMensalCentavos ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparadas, etapa]);

  const motivosAviso = [
    ...(analise.maisCaro ? [`O acordo soma ${reais(analise.totalCentavos)}, ${reais(analise.acrescimoCentavos)} a mais que o saldo atual das dívidas (${reais(analise.saldoCentavos)}).`] : []),
    ...(analise.cabeNaSobra === false ? ["A parcela do acordo não cabe na sobra mensal informada na negociação."] : []),
  ];
  const tentarConfirmar = () => (motivosAviso.length ? setAviso(true) : confirmar());

  const confirmar = () =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await renegociarDividas({
          dividaIds: escolhidas.map((d) => d.id),
          negociacaoId: negociacao?.id ?? null,
          propostaId: proposta?.id ?? null,
          descricao,
          entrada,
          dataEntrada,
          parcelas: String(condicoes.parcelas),
          valorParcela,
          primeiroVencimento,
          periodicidade,
          taxa,
          contaId,
          categoriaId,
          formaPagamentoId: formaId,
          observacao,
        });
        if (!r.ok) return setErro(r.erro);
        aoConcluir(r.id ?? 0);
      } catch {
        setErro("Não foi possível renegociar agora. Confira sua conexão e tente de novo.");
      }
    });

  const rodape =
    etapa === 1 ? (
      <>
        <Botao variante="secundario" type="button" onClick={aoFechar}>Voltar</Botao>
        <Botao type="button" icone={<ArrowRight className="h-4 w-4" />} onClick={avancarParaCondicoes}>Continuar</Botao>
      </>
    ) : etapa === 2 ? (
      <>
        <Botao variante="secundario" type="button" icone={<ArrowLeft className="h-4 w-4" />} onClick={() => setEtapa(1)}>Dívidas</Botao>
        <Botao type="button" carregando={ocupado} icone={<ArrowRight className="h-4 w-4" />} onClick={avancarParaRevisao}>Revisar</Botao>
      </>
    ) : (
      <>
        <Botao variante="secundario" type="button" icone={<ArrowLeft className="h-4 w-4" />} onClick={() => setEtapa(2)} disabled={ocupado}>Condições</Botao>
        <Botao type="button" carregando={ocupado} icone={<CheckCircle2 className="h-4 w-4" />} onClick={tentarConfirmar}>Confirmar renegociação</Botao>
      </>
    );

  return (
    <>
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo={
        <span className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-verde" /> Renegociação
        </span>
      }
      resumo={`${credorNome || "Escolha as dívidas"}${negociacao ? " · a partir de uma negociação" : ""}`}
      rodape={rodape}
    >
      <div className="space-y-4">
        <Etapas etapa={etapa} />

        {etapa === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Escolha as dívidas que entram no acordo. Um acordo junta só dívidas do mesmo credor.</p>
            {credores.length > 1 && (
              <CampoSelecao rotulo="Credor" obrigatorio valor={credorId} aoMudar={trocarCredor} opcoes={[{ valor: "", rotulo: "Selecione" }, ...credores.map((c) => ({ valor: String(c.id), rotulo: c.nome }))]} />
            )}
            {credorId && <ListaDividas dividas={doCredor} marcadas={marcadas} aoAlternar={alternar} />}
            {!credorId && <p className="rounded-lg border border-dashed border-borda py-8 text-center text-sm text-gray-500">Escolha o credor para ver as dívidas dele.</p>}
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {escolhidas.length === 1 ? "Dívida" : "Dívidas"} no acordo: <strong>{escolhidas.map((d) => d.descricao).join(", ")}</strong> ({reais(saldoEscolhidas)}).
            </p>
            <CampoTexto rotulo="Descrição do Acordo" obrigatorio maxLength={120} valor={descricao} aoMudar={setDescricao} />
            <CampoSelecao rotulo="Como será pago" valor={modo} aoMudar={(v) => setModo(v as "parcelado" | "a_vista")} opcoes={[{ valor: "parcelado", rotulo: "Parcelado (com ou sem entrada)" }, { valor: "a_vista", rotulo: "À vista" }]} />
            <div className="rounded-lg bg-creme p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <CampoValor rotulo={modo === "a_vista" ? "Valor à Vista" : "Entrada"} obrigatorio={modo === "a_vista"} valor={entrada} aoMudar={setEntrada} ajuda={modo === "a_vista" ? "Quanto você paga para encerrar a dívida." : "Opcional. A entrada é a primeira parcela do acordo."} />
                {condicoes.entradaCentavos > 0 && <CampoTexto rotulo="Vencimento da Entrada" type="date" obrigatorio valor={dataEntrada} aoMudar={setDataEntrada} />}
              </div>
              {modo === "parcelado" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  <CampoTexto rotulo="Quantidade de Parcelas" obrigatorio inputMode="numeric" maxLength={3} valor={parcelas} aoMudar={(v) => setParcelas(v.replace(/\D/g, ""))} />
                  <CampoValor rotulo="Valor da Parcela" obrigatorio valor={valorParcela} aoMudar={setValorParcela} />
                  <CampoTexto rotulo="Primeiro Vencimento" type="date" obrigatorio valor={primeiroVencimento} aoMudar={setPrimeiroVencimento} />
                  <CampoSelecao rotulo="Periodicidade" valor={periodicidade} aoMudar={(v) => setPeriodicidade(v as Periodicidade)} opcoes={PERIODICIDADES.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))} />
                </div>
              )}
              <Conferencia analise={analise} condicoes={condicoes} temSobra={negociacao?.sobraMensalCentavos != null} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoTexto rotulo="Taxa de Juros (% ao mês)" inputMode="decimal" maxLength={9} valor={taxa} aoMudar={(v) => setTaxa(v.replace(/[^\d.,]/g, ""))} ajuda="Opcional. Sugerida pelos juros implícitos da proposta; pode apagar ou trocar pela taxa do contrato." />
              <CampoDestino rotulo="Conta de Pagamento" soContas valor={contaId ? `conta:${contaId}` : ""} aoMudar={(v) => setContaId(v.replace("conta:", ""))} destinos={opcoes.destinos} ajuda="Conta de onde saem as parcelas do acordo." />
              <CampoCategoria valor={categoriaId} aoMudar={setCategoriaId} categorias={opcoes.categorias} natureza="despesa" />
            </div>
            <CampoComNovo rotulo="Forma de Pagamento" valor={formaId} aoMudar={setFormaId} opcoes={opcoes.formas} />
            <CampoAreaTexto rotulo="Observação" linhas={2} valor={observacao} aoMudar={setObservacao} />
          </div>
        )}

        {etapa === 3 && plano && preparadas && <Revisao plano={plano} preparadas={preparadas} saldoCentavos={saldoEscolhidas} descricao={descricao} />}

        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
    <AvisoAntesDeConfirmar
      aberto={aviso}
      titulo="Confira antes de renegociar"
      motivos={motivosAviso}
      aoVoltar={() => setAviso(false)}
      aoContinuar={() => {
        setAviso(false);
        confirmar();
      }}
    />
    </>
  );
}

function Etapas({ etapa }: { etapa: number }) {
  const passos = ["Dívidas originais", "Condições do acordo", "Revisão e confirmação"];
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {passos.map((p, i) => (
        <li key={p} className={cn("flex items-center gap-2", etapa === i + 1 ? "font-semibold text-verde" : etapa > i + 1 ? "text-gray-600" : "text-gray-400")}>
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border text-xs", etapa === i + 1 ? "border-verde bg-verde text-white" : etapa > i + 1 ? "border-verde text-verde" : "border-borda")}>{etapa > i + 1 ? "✓" : i + 1}</span>
          {p}
        </li>
      ))}
    </ol>
  );
}

function ListaDividas({ dividas, marcadas, aoAlternar }: { dividas: LinhaDivida[]; marcadas: number[]; aoAlternar: (id: number) => void }) {
  if (!dividas.length) return <p className="text-sm text-gray-500">Este credor não tem dívidas ativas.</p>;
  return (
    <ul className="divide-y divide-borda rounded-lg border border-borda">
      {dividas.map((d) => (
        <li key={d.id}>
          <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
            <input type="checkbox" className="accent-verde" checked={marcadas.includes(d.id)} onChange={() => aoAlternar(d.id)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-900">{d.descricao}</span>
              <span className="block text-xs text-gray-500">
                {d.parcelasTotal ? `${d.parcelasPagas}/${d.parcelasTotal} parcelas pagas` : "Sem parcelas definidas"}
                {d.diasAtraso > 0 ? ` · em atraso há ${d.diasAtraso} d` : ""}
                {d.situacao === "em_negociacao" ? " · em negociação" : ""}
              </span>
            </span>
            <span className="text-sm font-semibold text-gray-800">{reais(d.saldo.exibido)}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Conferência ao vivo das condições: total, desconto ou acréscimo, juros implícitos e se cabe na sobra. */
export function Conferencia({ analise, condicoes, temSobra }: { analise: ReturnType<typeof analisarProposta>; condicoes: { parcelas: number }; temSobra: boolean }) {
  if (analise.totalCentavos <= 0) return <p className="mt-3 text-xs text-gray-600">Preencha as condições para ver o total, o desconto e os juros do acordo.</p>;
  return (
    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <Numero titulo="Total do acordo" valor={reais(analise.totalCentavos)} />
      <Numero titulo="Saldo atual das dívidas" valor={reais(analise.saldoCentavos)} />
      {analise.maisCaro ? <Numero titulo="Acréscimo sobre o saldo" valor={reais(analise.acrescimoCentavos)} alerta /> : <Numero titulo="Desconto sobre o saldo" valor={`${reais(analise.descontoCentavos)} (${String(analise.descontoPct).replace(".", ",")}%)`} bom={analise.descontoCentavos > 0} />}
      {condicoes.parcelas > 0 && <Numero titulo="Juros implícitos" valor={analise.jurosImplicitosMensal === null ? "Sem juros" : `${String(analise.jurosImplicitosMensal).replace(".", ",")}% ao mês`} />}
      {temSobra && analise.cabeNaSobra !== null && <Numero titulo="Cabe na sobra mensal?" valor={analise.cabeNaSobra ? "Sim" : "Não"} bom={analise.cabeNaSobra} alerta={!analise.cabeNaSobra} />}
    </div>
  );
}

export function Numero({ titulo, valor, alerta, bom }: { titulo: string; valor: string; alerta?: boolean; bom?: boolean }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={cn("font-semibold", alerta ? "text-despesa" : bom ? "text-pago-texto" : "text-gray-900")}>{valor}</p>
    </div>
  );
}

function Revisao({ plano, preparadas, saldoCentavos, descricao }: { plano: ReturnType<typeof planejarRenegociacao>; preparadas: DividaParaRenegociar[]; saldoCentavos: number; descricao: string }) {
  const faturas = preparadas.flatMap((p) => p.faturas.map((f) => `${f} (${p.descricao})`));
  const recorrentes = preparadas.flatMap((p) => p.recorrentes.map((r) => `${r} (${p.descricao})`));
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-creme p-4 text-sm text-gray-800">
        <p className="mb-2 font-semibold">O que vai acontecer ao confirmar</p>
        <ul className="list-disc space-y-1 pl-5">
          {plano.frases.map((f) => (
            <li key={f}>{f}</li>
          ))}
          <li>
            As dívidas originais ficam <strong>Renegociadas</strong>, com o link para o acordo <strong>{descricao}</strong>. Parcelas já pagas continuam intactas ({plano.mantidas.length} {plano.mantidas.length === 1 ? "lançamento pago" : "lançamentos pagos"}).
          </li>
          {faturas.length > 0 && <li>Deixa de acompanhar as faturas: {faturas.join(", ")}. A fatura continua no cartão e precisa ser tratada com o credor.</li>}
          {recorrentes.length > 0 && <li>O recorrente {recorrentes.join(", ")} será inativado (o que já foi gerado e não está pago continua em Lançamentos).</li>}
          <li>Uma cópia completa do que sai de Lançamentos fica no histórico e na Auditoria. Dá para <strong>desfazer</strong> enquanto nenhuma parcela do acordo for paga.</li>
        </ul>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <Numero titulo="Saldo das dívidas hoje" valor={reais(saldoCentavos)} />
        <Numero titulo="Total do acordo" valor={reais(plano.totalAcordoCentavos)} />
        {plano.diferencaCentavos > 0 ? <Numero titulo="Acordo mais caro em" valor={reais(plano.diferencaCentavos)} alerta /> : <Numero titulo="Desconto" valor={reais(-plano.diferencaCentavos)} bom={plano.diferencaCentavos < 0} />}
      </div>
      {plano.avisos.map((a) => (
        <p key={a} className="rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-sm text-amarelo-texto">
          {a}
        </p>
      ))}
      <div className="grid gap-4 md:grid-cols-2">
        <Quadro titulo={`Sai de Lançamentos (${plano.retiradas.length})`} vazio="Nenhum lançamento sai.">
          {plano.retiradas.map((x) => (
            <Linha key={x.id} esq={`${formatarData(x.vencimento)} · ${x.descricao}`} dir={reais(x.valorCentavos)} />
          ))}
        </Quadro>
        <Quadro titulo={`O acordo cria (${plano.parcelasAcordo.length})`} vazio="Nenhuma parcela.">
          {plano.parcelasAcordo.map((x) => (
            <Linha key={x.numero} esq={`${formatarData(x.data)} · ${x.descricao}`} dir={reais(x.valorCentavos)} />
          ))}
        </Quadro>
      </div>
    </div>
  );
}

function Quadro({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-borda">
      <p className="border-b border-borda bg-subcabecalho px-3 py-2 text-sm font-semibold text-gray-700">{titulo}</p>
      <ul className="max-h-56 divide-y divide-borda overflow-auto text-sm">{children.length ? children : <li className="px-3 py-3 text-gray-500">{vazio}</li>}</ul>
    </div>
  );
}

function Linha({ esq, dir }: { esq: string; dir: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="truncate text-gray-700">{esq}</span>
      <span className="shrink-0 font-medium text-gray-900">{dir}</span>
    </li>
  );
}
