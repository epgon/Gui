"use client";

import { AvisoAntesDeConfirmar } from "./aviso-confirmar";
import { useMemo, useState } from "react";
import { JanelaAjuda } from "@/components/ajuda/central-ajuda";
import { type DadosDivida, salvarDivida } from "@/app/(sistema)/gestao/dividas/acoes";
import { ModalCadastro, useFormularioCadastro } from "@/components/cadastros/modal-cadastro";
import { CampoAreaTexto, CampoSelecao, CampoTexto, CampoValor } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { CampoCategoria, CampoComNovo, CampoDestino } from "@/app/(sistema)/financeiro/lancamentos/campos";
import { ModalNovoContato } from "@/app/(sistema)/financeiro/lancamentos/formulario";
import { useSistema } from "@/components/layout/provedor-sistema";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { FORMAS_DIVIDA, GARANTIAS, taxaAnualParaMensal, TIPOS_DIVIDA } from "@/lib/dividas/regras";
import type { LinhaDivida } from "@/lib/dividas/tipos";
import { gerarParcelas, PERIODICIDADES, type Periodicidade } from "@/lib/lancamentos/regras";
import type { Opcoes } from "@/lib/lancamentos/tipos";

export type PadroesDivida = { contaId: string; categoriaId: string };

const texto = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export function dadosVaziosDivida(padroes: PadroesDivida, hoje: string): DadosDivida {
  return {
    descricao: "",
    contatoId: "",
    tipo: "emprestimo_pessoal",
    forma: "parcelas_fixas",
    valorOriginal: "",
    dataContratacao: "",
    parcelas: { modo: "parcela", valor: "", quantidade: "12", primeiroVencimento: hoje, periodicidade: "mensal", jaPagas: "0" },
    saldoHoje: "",
    taxa: "",
    taxaTipo: "mensal",
    multa: "",
    mora: "",
    garantia: "nenhuma",
    contaId: padroes.contaId,
    categoriaId: padroes.categoriaId,
    formaPagamentoId: "",
    observacao: "",
    registrarEntrada: false,
    lembrete: { ativo: false, dia: String(Number(hoje.slice(8, 10)) || 1), valor: "" },
  };
}

/** Dados de uma dívida existente para editar (as parcelas já criadas não mudam por aqui) ou clonar. */
export function dadosDaDivida(d: LinhaDivida, hoje: string, padroes: PadroesDivida): DadosDivida {
  return {
    ...dadosVaziosDivida(padroes, hoje),
    descricao: d.descricao,
    contatoId: String(d.contatoId),
    tipo: d.tipo,
    forma: d.forma,
    valorOriginal: d.valorOriginalCentavos ? formatarCentavos(d.valorOriginalCentavos) : "",
    dataContratacao: d.dataContratacao ?? "",
    taxa: texto(d.taxaMensal),
    multa: texto(d.multaPercentual),
    mora: texto(d.moraMensal),
    garantia: d.garantia,
    contaId: d.contaId ? String(d.contaId) : padroes.contaId,
    categoriaId: d.categoriaId ? String(d.categoriaId) : padroes.categoriaId,
    formaPagamentoId: d.formaPagamentoId ? String(d.formaPagamentoId) : "",
    observacao: d.observacao ?? "",
  };
}

type Formulario = ReturnType<typeof useFormularioCadastro<DadosDivida>>;

export function ModalDivida({ formulario: form, opcoes, multaPadrao, moraPadrao, limiteTaxaAltaPct }: { formulario: Formulario; opcoes: Opcoes; multaPadrao: number; moraPadrao: number; limiteTaxaAltaPct?: number }) {
  const [avisoTaxa, setAvisoTaxa] = useState(false);
  const { recursos } = useSistema();
  const [novoCredor, setNovoCredor] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [credoresNovos, setCredoresNovos] = useState<{ id: number; rotulo: string; ativo: boolean }[]>([]);
  const d = form.dados;
  const edicao = !form.novo;
  const credores = useMemo(() => [...opcoes.contatos, ...credoresNovos.filter((n) => !opcoes.contatos.some((o) => o.id === n.id))], [opcoes.contatos, credoresNovos]);
  const mudarParcelas = <K extends keyof DadosDivida["parcelas"]>(campo: K, valor: DadosDivida["parcelas"][K]) => form.mudar("parcelas", { ...d.parcelas, [campo]: valor });

  // Prévia das parcelas ("12 parcelas de R$ 250,00, de 10/12/2026 a 10/11/2027").
  const previa = useMemo(() => {
    if (d.forma !== "parcelas_fixas" || edicao) return null;
    const valor = lerValorEmCentavos(d.parcelas.valor);
    const quantidade = Number(d.parcelas.quantidade);
    const jaPagas = Number(d.parcelas.jaPagas || 0);
    if (!valor || valor <= 0 || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 360 || !d.parcelas.primeiroVencimento || !Number.isInteger(jaPagas) || jaPagas < 0 || jaPagas >= quantidade) return null;
    const lista = gerarParcelas({ descricao: "x", valorCentavos: valor, quantidade, iniciarNaParcela: jaPagas + 1, dividirValor: d.parcelas.modo === "total", incluirParcelaNaDescricao: false, primeiraData: d.parcelas.primeiroVencimento, periodicidade: (d.parcelas.periodicidade || "mensal") as Periodicidade });
    const total = lista.reduce((s, p) => s + p.valorCentavos, 0);
    const igual = lista.every((p) => p.valorCentavos === lista[0].valorCentavos);
    return `${lista.length} ${lista.length === 1 ? "parcela" : "parcelas"}${igual ? ` de R$ ${formatarCentavos(lista[0].valorCentavos)}` : ""}, de ${formatarData(lista[0].data)} a ${formatarData(lista[lista.length - 1].data)}. Total a pagar: R$ ${formatarCentavos(total)}.`;
  }, [d.forma, d.parcelas, edicao]);

  const taxaInformada = Number(d.taxa.replace(",", "."));
  const taxaConvertida = d.taxa && Number.isFinite(taxaInformada) && d.taxaTipo === "anual" ? taxaAnualParaMensal(taxaInformada) : null;
  const fixa = d.forma === "parcelas_fixas";
  const taxaMensalPct = d.taxa && Number.isFinite(taxaInformada) ? (taxaConvertida ?? taxaInformada) : null;
  const taxaAlta = !edicao && limiteTaxaAltaPct !== undefined && taxaMensalPct !== null && taxaMensalPct > limiteTaxaAltaPct;

  return (
    <>
      <ModalCadastro
        formulario={form}
        largura="larga"
        titulo={form.novo ? "Nova Dívida" : "Editando Dívida"}
        resumo={[d.descricao || "Descrição", TIPOS_DIVIDA.find((t) => t.valor === d.tipo)?.rotulo].join(" · ")}
        aoSalvar={() => (taxaAlta ? setAvisoTaxa(true) : form.salvar(salvarDivida))}
      >
        {!edicao && (
          <p className="text-sm text-gray-600">
            Não sabe como preencher?{" "}
            <button type="button" onClick={() => setAjudaAberta(true)} className="font-semibold text-verde hover:underline">
              Veja o passo a passo do seu caso
            </button>
          </p>
        )}
        <CampoTexto rotulo="Descrição" obrigatorio autoFocus maxLength={120} ajuda="Como você reconhece esta dívida. Ex.: Empréstimo pessoal Banco X." valor={d.descricao} aoMudar={(v) => form.mudar("descricao", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoComNovo rotulo="Credor" obrigatorio vazio="Selecione" valor={d.contatoId} aoMudar={(v) => form.mudar("contatoId", v)} opcoes={credores} aoCriar={() => setNovoCredor(true)} rotuloNovo="Novo Cliente ou Fornecedor" />
          <CampoSelecao rotulo="Tipo" obrigatorio valor={d.tipo} aoMudar={(v) => form.mudar("tipo", v)} opcoes={TIPOS_DIVIDA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoValor rotulo="Valor Original" ajuda="Quanto foi emprestado ou o valor da compra. Opcional: serve para o histórico." valor={d.valorOriginal} aoMudar={(v) => form.mudar("valorOriginal", v)} />
          <CampoTexto rotulo="Data de Contratação" type="date" valor={d.dataContratacao} aoMudar={(v) => form.mudar("dataContratacao", v)} />
        </div>

        <CampoSelecao
          rotulo="Forma de Pagamento da Dívida"
          obrigatorio
          desabilitado={edicao}
          ajuda={edicao ? "A forma não muda depois de cadastrada." : "Parcelas fixas criam os lançamentos das parcelas. Sem parcelas definidas guarda só o saldo, e cada pagamento é registrado pelo botão Pagar."}
          valor={d.forma}
          aoMudar={(v) => form.mudar("forma", v as DadosDivida["forma"])}
          opcoes={FORMAS_DIVIDA.map((f) => ({ valor: f.valor, rotulo: f.rotulo }))}
        />

        {!edicao && fixa && (
          <div className="rounded-lg bg-creme p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoSelecao rotulo="O valor informado é" valor={d.parcelas.modo} aoMudar={(v) => mudarParcelas("modo", v as "parcela" | "total")} opcoes={[{ valor: "parcela", rotulo: "O valor de cada parcela" }, { valor: "total", rotulo: "O valor total (dividido)" }]} />
              <CampoValor rotulo={d.parcelas.modo === "total" ? "Valor Total" : "Valor da Parcela"} obrigatorio valor={d.parcelas.valor} aoMudar={(v) => mudarParcelas("valor", v)} />
              <CampoTexto rotulo="Quantidade de Parcelas" obrigatorio inputMode="numeric" maxLength={3} valor={d.parcelas.quantidade} aoMudar={(v) => mudarParcelas("quantidade", v.replace(/\D/g, ""))} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <CampoTexto rotulo="Primeiro Vencimento" type="date" obrigatorio valor={d.parcelas.primeiroVencimento} aoMudar={(v) => mudarParcelas("primeiroVencimento", v)} ajuda="Vencimento da primeira parcela que ainda falta pagar." />
              <CampoSelecao rotulo="Periodicidade" valor={d.parcelas.periodicidade} aoMudar={(v) => mudarParcelas("periodicidade", v)} opcoes={PERIODICIDADES.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))} />
              <CampoTexto rotulo="Parcelas já pagas" inputMode="numeric" maxLength={3} valor={d.parcelas.jaPagas} aoMudar={(v) => mudarParcelas("jaPagas", v.replace(/\D/g, ""))} ajuda="Para dívida antiga: só as parcelas que faltam viram lançamentos. As já pagas ficam anotadas no histórico, sem mexer no saldo das suas contas." />
            </div>
            <p className="mt-3 text-xs text-gray-600">{previa ?? "Preencha o valor, a quantidade e o primeiro vencimento para ver as parcelas."} Elas aparecem em Lançamentos, Agenda e Vencidos como contas a pagar.</p>
          </div>
        )}
        {!edicao && !fixa && (
          <div className="rounded-lg bg-creme p-4">
            <CampoValor rotulo="Saldo devedor hoje" obrigatorio valor={d.saldoHoje} aoMudar={(v) => form.mudar("saldoHoje", v)} ajuda="Quanto você deve hoje, conferido no extrato ou com o credor. Nenhum lançamento é criado: cada pagamento é registrado pelo botão Pagar." />
            {recursos.recorrentes && (
              <div className="mt-4 border-t border-borda pt-3">
                <Chave ligada={!!d.lembrete?.ativo} aoMudar={(v) => form.mudar("lembrete", { ativo: v, dia: d.lembrete?.dia ?? "1", valor: d.lembrete?.valor ?? "" })} rotulo="Lembrar todo mês" />
                {d.lembrete?.ativo && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <CampoTexto rotulo="No dia" obrigatorio inputMode="numeric" maxLength={2} valor={d.lembrete.dia} aoMudar={(v) => form.mudar("lembrete", { ...d.lembrete!, dia: v.replace(/\D/g, "") })} ajuda="Cria um lançamento recorrente ligado a esta dívida: todo mês aparece em Lançamentos e na Agenda para você pagar." />
                    <CampoValor rotulo="Valor do lembrete" obrigatorio valor={d.lembrete.valor} aoMudar={(v) => form.mudar("lembrete", { ...d.lembrete!, valor: v })} ajuda="O quanto pretende pagar por mês. Ao pagar, o saldo da dívida cai pelo valor pago." />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {edicao && fixa && <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">As parcelas já criadas não mudam por aqui. Para mudar uma parcela, edite o lançamento dela em Lançamentos.</p>}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <CampoTexto rotulo="Taxa de Juros (%)" inputMode="decimal" maxLength={9} valor={d.taxa} aoMudar={(v) => form.mudar("taxa", v.replace(/[^\d.,]/g, ""))} ajuda="Opcional (pessoa física pode não ter). Sem taxa, as simulações são aproximadas." />
            {taxaConvertida !== null && <p className="mt-1 text-xs text-gray-500">Equivale a {String(taxaConvertida).replace(".", ",")}% ao mês.</p>}
          </div>
          <CampoSelecao rotulo="A taxa é" valor={d.taxaTipo} aoMudar={(v) => form.mudar("taxaTipo", v as "mensal" | "anual")} opcoes={[{ valor: "mensal", rotulo: "Ao mês" }, { valor: "anual", rotulo: "Ao ano" }]} />
          <CampoSelecao rotulo="Garantia ou Risco" valor={d.garantia} aoMudar={(v) => form.mudar("garantia", v)} opcoes={GARANTIAS.map((g) => ({ valor: g.valor, rotulo: g.rotulo }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto rotulo="Multa por Atraso (%)" inputMode="decimal" maxLength={7} valor={d.multa} aoMudar={(v) => form.mudar("multa", v.replace(/[^\d.,]/g, ""))} placeholder={`Padrão: ${String(multaPadrao).replace(".", ",")}`} ajuda="Cobrada uma vez sobre a parcela atrasada. Vazio usa o padrão de Configurações > Parâmetros." />
          <CampoTexto rotulo="Juros de Mora (% ao mês)" inputMode="decimal" maxLength={7} valor={d.mora} aoMudar={(v) => form.mudar("mora", v.replace(/[^\d.,]/g, ""))} placeholder={`Padrão: ${String(moraPadrao).replace(".", ",")}`} ajuda="Proporcional aos dias de atraso. Vazio usa o padrão de Configurações > Parâmetros." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoDestino rotulo="Conta de Pagamento" soContas valor={d.contaId ? `conta:${d.contaId}` : ""} aoMudar={(v) => form.mudar("contaId", v.replace("conta:", ""))} destinos={opcoes.destinos} ajuda="Conta de onde saem as parcelas." />
          <CampoCategoria valor={d.categoriaId} aoMudar={(v) => form.mudar("categoriaId", v)} categorias={opcoes.categorias} natureza="despesa" />
        </div>
        <CampoComNovo rotulo="Forma de Pagamento" valor={d.formaPagamentoId} aoMudar={(v) => form.mudar("formaPagamentoId", v)} opcoes={opcoes.formas} />
        <CampoAreaTexto rotulo="Observação" linhas={3} valor={d.observacao} aoMudar={(v) => form.mudar("observacao", v)} />
        {!edicao && (
          <Chave ligada={d.registrarEntrada} aoMudar={(v) => form.mudar("registrarEntrada", v)} rotulo="Registrar a entrada do dinheiro na conta (empréstimo novo)" />
        )}
      </ModalCadastro>
      <JanelaAjuda tela="minhas" artigoInicial="qual-e-o-seu-caso" aberto={ajudaAberta} aoFechar={() => setAjudaAberta(false)} />
      <AvisoAntesDeConfirmar
        aberto={avisoTaxa}
        titulo="Taxa de juros alta"
        motivos={[`A taxa informada equivale a ${String(taxaMensalPct).replace(".", ",")}% ao mês, acima do limite de ${String(limiteTaxaAltaPct).replace(".", ",")}% ao mês definido em Parâmetros. Confira se digitou ao mês ou ao ano corretamente.`]}
        aoVoltar={() => setAvisoTaxa(false)}
        aoContinuar={() => {
          setAvisoTaxa(false);
          form.salvar(salvarDivida);
        }}
      />
      {novoCredor && (
        <ModalNovoContato
          tipo="despesa"
          aoFechar={() => setNovoCredor(false)}
          aoCriar={(id, rotulo) => {
            setCredoresNovos((x) => [...x, { id, rotulo, ativo: true }]);
            form.mudar("contatoId", String(id));
            setNovoCredor(false);
          }}
        />
      )}
    </>
  );
}
