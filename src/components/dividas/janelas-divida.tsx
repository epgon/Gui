"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  amortizarDivida,
  anotarDivida,
  atualizarSaldoDivida,
  cancelarDivida,
  detalharDivida,
  lancarEncargoDivida,
  pagarDivida,
  quitarDivida,
} from "@/app/(sistema)/gestao/dividas/acoes";
import { CampoDestino } from "@/app/(sistema)/financeiro/lancamentos/campos";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, CampoTexto, CampoValor, TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { Valor } from "@/components/ui/valor";
import { formatarData } from "@/lib/datas";
import { formatarCentavos, lerValorEmCentavos } from "@/lib/dinheiro";
import { amortizarReduzindoQuantidade, amortizarReduzindoValor } from "@/lib/dividas/regras";
import type { DetalheDivida, LinhaDivida } from "@/lib/dividas/tipos";
import type { OpcaoDestino } from "@/lib/lancamentos/tipos";

type Comum = { divida: LinhaDivida; destinos: OpcaoDestino[]; hoje: string; aoFechar: () => void };

/** Roda uma ação do servidor, mostra o erro na faixa amarela e fecha a janela quando dá certo. */
function useEnvio(aoFechar: () => void) {
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const enviar = (acao: () => Promise<{ ok: boolean; erro?: string }>) =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await acao();
        if (!r.ok) return setErro(r.erro ?? "Não foi possível concluir agora.");
        aoFechar();
      } catch {
        setErro("Não foi possível concluir agora. Confira sua conexão e tente de novo.");
      }
    });
  return { erro, setErro, ocupado, enviar };
}

function Rodape({ ocupado, aoFechar, rotulo, icone, perigo, aoConfirmar }: { ocupado: boolean; aoFechar: () => void; rotulo: string; icone?: React.ReactNode; perigo?: boolean; aoConfirmar: () => void }) {
  return (
    <>
      <Botao variante="secundario" type="button" onClick={aoFechar} disabled={ocupado}>
        Voltar
      </Botao>
      <Botao variante={perigo ? "perigo" : "primario"} type="button" carregando={ocupado} onClick={aoConfirmar} icone={icone ?? <CheckCircle2 className="h-4 w-4" />}>
        {rotulo}
      </Botao>
    </>
  );
}

const contaPadrao = (d: LinhaDivida, destinos: OpcaoDestino[]) => (d.contaId ? `conta:${d.contaId}` : (destinos.find((x) => x.grupo === "Contas" && x.ativo)?.valor ?? ""));

function CampoConta({ valor, aoMudar, destinos, rotulo = "Conta de Pagamento" }: { valor: string; aoMudar: (v: string) => void; destinos: OpcaoDestino[]; rotulo?: string }) {
  return <CampoDestino rotulo={rotulo} soContas valor={valor} aoMudar={aoMudar} destinos={destinos} ajuda="Conta de onde o dinheiro sai." />;
}

/** Dívida sem parcelas: Pagar cria um lançamento já pago na conta escolhida. */
export function JanelaPagarDivida({ divida: d, destinos, hoje, aoFechar }: Comum) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [conta, setConta] = useState(contaPadrao(d, destinos));
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Pagar" resumo={`${d.descricao} · saldo de R$ ${formatarCentavos(d.saldo.exibido)}`} rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} rotulo="Confirmar" aoConfirmar={() => enviar(() => pagarDivida(d.id, { valor, data, contaId: conta.replace("conta:", "") }))} />}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Cria um lançamento de despesa já pago, na conta escolhida, e o saldo da dívida cai nesse valor.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoValor rotulo="Valor Pago" obrigatorio valor={valor} aoMudar={setValor} />
          <CampoTexto rotulo="Data do Pagamento" type="date" valor={data} aoMudar={setData} />
        </div>
        <CampoConta valor={conta} aoMudar={setConta} destinos={destinos} />
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

/** Carrega o detalhe (parcelas em aberto) para as janelas que mostram uma prévia. */
function useDetalhe(id: number) {
  const [detalhe, setDetalhe] = useState<DetalheDivida | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    detalharDivida(id)
      .then((d) => vivo && (d ? setDetalhe(d) : setErro("Esta dívida não existe mais.")))
      .catch(() => vivo && setErro("Não foi possível carregar a dívida agora."));
    return () => {
      vivo = false;
    };
  }, [id]);
  return { detalhe, erro };
}

/** Pagamento extra: reduz o valor das próximas parcelas ou a quantidade, com prévia antes de gravar. */
export function JanelaAmortizar({ divida: d, destinos, hoje, aoFechar }: Comum) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const { detalhe, erro: erroCarga } = useDetalhe(d.id);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [modo, setModo] = useState<"valor" | "quantidade">("valor");
  const [conta, setConta] = useState(contaPadrao(d, destinos));
  const abertas = (detalhe?.obrigacoes ?? []).filter((o) => o.origem === "lancamento" && !o.dataPagamento && o.podePagarAqui && !o.encargo).map((o) => ({ id: o.id, vencimento: o.vencimento, valorCentavos: o.valorCentavos }));
  const centavos = lerValorEmCentavos(valor);
  const previa = centavos && centavos > 0 ? (modo === "quantidade" ? amortizarReduzindoQuantidade(abertas, centavos) : amortizarReduzindoValor(abertas, centavos)) : null;
  const nomes = new Map((detalhe?.obrigacoes ?? []).map((o) => [o.id, o.descricao]));
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo="Amortizar"
      resumo={`${d.descricao} · pagamento fora das parcelas`}
      rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} rotulo="Confirmar" aoConfirmar={() => enviar(() => amortizarDivida(d.id, { valor, data, contaId: conta.replace("conta:", ""), modo }))} />}
    >
      <div className="space-y-4">
        <FaixaErro>{(erro || erroCarga) && <TextoComDestaque texto={erro || erroCarga} />}</FaixaErro>
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoValor rotulo="Valor do Pagamento Extra" obrigatorio valor={valor} aoMudar={setValor} />
          <CampoTexto rotulo="Data do Pagamento" type="date" valor={data} aoMudar={setData} />
          <CampoSelecao rotulo="O que fazer com as parcelas" valor={modo} aoMudar={(v) => setModo(v as "valor" | "quantidade")} opcoes={[{ valor: "valor", rotulo: "Reduzir o valor das próximas" }, { valor: "quantidade", rotulo: "Reduzir a quantidade (quitar as últimas)" }]} />
        </div>
        <CampoConta valor={conta} aoMudar={setConta} destinos={destinos} />
        {!detalhe && !erroCarga && <p className="text-sm text-gray-500">Carregando as parcelas...</p>}
        {previa && !previa.ok && <FaixaErro><TextoComDestaque texto={previa.erro} /></FaixaErro>}
        {previa?.ok && (
          <div className="overflow-hidden rounded-lg border border-borda">
            <p className="bg-subcabecalho px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Como as parcelas ficam (nada é gravado antes do Confirmar)</p>
            <table className="w-full text-sm">
              <tbody>
                {previa.ajustes.map((a) => (
                  <tr key={a.id} className="border-t border-borda">
                    <td className="px-3 py-1.5 text-gray-600">{formatarData(a.vencimento)}</td>
                    <td className="px-3 py-1.5">{nomes.get(a.id)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatarCentavos(a.antesCentavos)}</td>
                    <td className="px-3 py-1.5 text-right">{a.removida ? <span className="rounded bg-pago-fundo px-1.5 text-xs text-pago-texto">Quitada</span> : a.depoisCentavos === a.antesCentavos ? <span className="text-gray-400">sem mudança</span> : <Valor centavos={-a.depoisCentavos} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Quitar: paga o valor combinado e retira as parcelas que restavam. */
export function JanelaQuitar({ divida: d, destinos, hoje, aoFechar }: Comum) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const { detalhe } = useDetalhe(d.id);
  const [valor, setValor] = useState(formatarCentavos(d.saldo.exibido));
  const [data, setData] = useState(hoje);
  const [conta, setConta] = useState(contaPadrao(d, destinos));
  const restantes = (detalhe?.obrigacoes ?? []).filter((o) => o.origem === "lancamento" && !o.dataPagamento && o.podePagarAqui);
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Quitar dívida" resumo={`${d.descricao} · saldo de R$ ${formatarCentavos(d.saldo.exibido)}`} rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} perigo rotulo="Quitar" aoConfirmar={() => enviar(() => quitarDivida(d.id, { valor, data, contaId: conta.replace("conta:", "") }))} />}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Informe o valor que o credor pediu para quitar (com o desconto, se houver). O pagamento vira um lançamento pago e a dívida fica <strong>Quitada</strong>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoValor rotulo="Valor da Quitação" obrigatorio valor={valor} aoMudar={setValor} ajuda="Pode ser menor que o saldo, se o credor deu desconto." />
          <CampoTexto rotulo="Data do Pagamento" type="date" valor={data} aoMudar={setData} />
        </div>
        <CampoConta valor={conta} aoMudar={setConta} destinos={destinos} />
        {restantes.length > 0 && (
          <p className="rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-sm text-amarelo-texto">
            As {restantes.length} {restantes.length === 1 ? "parcela restante" : "parcelas restantes"} ({formatarCentavos(restantes.reduce((s, o) => s + o.valorCentavos, 0))}) saem de Lançamentos. Uma cópia fica no histórico da dívida e na Auditoria.
          </p>
        )}
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

const ORIGENS = ["extrato", "aplicativo", "boleto de quitação", "contato com o credor"];

/** Atualizar saldo: o que o credor informou. Vale até haver outro saldo ou os pagamentos que vierem depois dele. */
export function JanelaSaldo({ divida: d, hoje, aoFechar }: Omit<Comum, "destinos">) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const [saldo, setSaldo] = useState("");
  const [data, setData] = useState(hoje);
  const [origem, setOrigem] = useState(ORIGENS[0]);
  const [nota, setNota] = useState("");
  const informado = lerValorEmCentavos(saldo);
  const dif = informado !== null ? informado - d.saldo.estimado : null;
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Atualizar saldo" resumo={d.descricao} rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} rotulo="Salvar" icone={<Save className="h-4 w-4" />} aoConfirmar={() => enviar(() => atualizarSaldoDivida(d.id, { saldo, data, origem, observacao: nota }))} />}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          O Gui estima o saldo; o número certo é o do credor. O último saldo informado vale até você informar outro ou entrarem pagamentos depois dele. O que havia antes fica no histórico.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoValor rotulo="Saldo Devedor" obrigatorio valor={saldo} aoMudar={setSaldo} ajuda="O valor que o credor disse que você deve nessa data." />
          <CampoTexto rotulo="Data do Saldo" type="date" valor={data} aoMudar={setData} />
        </div>
        <CampoSelecao rotulo="Origem do Saldo" valor={origem} aoMudar={setOrigem} opcoes={ORIGENS.map((o) => ({ valor: o, rotulo: o.charAt(0).toUpperCase() + o.slice(1) }))} />
        <CampoTexto rotulo="Observação" maxLength={300} valor={nota} aoMudar={setNota} />
        <p className="rounded-md bg-subcabecalho px-3 py-2 text-sm text-gray-600">
          Hoje o Gui mostra <strong>R$ {formatarCentavos(d.saldo.exibido)}</strong> (estimado em R$ {formatarCentavos(d.saldo.estimado)}).
          {dif !== null && dif !== 0 && (
            <>
              {" "}
              O credor informou <strong>R$ {formatarCentavos(Math.abs(dif))}</strong> a {dif > 0 ? "mais" : "menos"} que o estimado.
            </>
          )}
        </p>
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

/** Lançar encargo: tarifa, juro ou multa cobrados a mais, que viram uma despesa ainda não paga ligada à dívida. */
export function JanelaEncargo({ divida: d, destinos, hoje, aoFechar }: Comum) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const [descricao, setDescricao] = useState("Tarifa");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [conta, setConta] = useState(contaPadrao(d, destinos));
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Lançar encargo" resumo={d.descricao} rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} rotulo="Salvar" icone={<Save className="h-4 w-4" />} aoConfirmar={() => enviar(() => lancarEncargoDivida(d.id, { descricao, valor, vencimento, contaId: conta.replace("conta:", "") }))} />}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Cria uma despesa ainda não paga, na categoria Juros e Encargos, ligada a esta dívida. Ela aparece em Lançamentos e entra no saldo.</p>
        <CampoTexto rotulo="Descrição" obrigatorio maxLength={100} valor={descricao} aoMudar={setDescricao} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoValor rotulo="Valor" obrigatorio valor={valor} aoMudar={setValor} />
          <CampoTexto rotulo="Vencimento" type="date" valor={vencimento} aoMudar={setVencimento} />
        </div>
        <CampoConta valor={conta} aoMudar={setConta} destinos={destinos} />
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

/** Cancelar dívida: cadastrada por engano ou perdoada. Não conta mais nos totais. */
export function JanelaCancelar({ divida: d, aoFechar }: Omit<Comum, "destinos" | "hoje">) {
  const { erro, ocupado, enviar } = useEnvio(aoFechar);
  const { detalhe } = useDetalhe(d.id);
  const [retirar, setRetirar] = useState(true);
  const restantes = (detalhe?.obrigacoes ?? []).filter((o) => o.origem === "lancamento" && !o.dataPagamento && o.podePagarAqui);
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Cancelar dívida" resumo={d.descricao} rodape={<Rodape ocupado={ocupado} aoFechar={aoFechar} perigo rotulo="Cancelar dívida" aoConfirmar={() => enviar(() => cancelarDivida(d.id, retirar))} />}>
      <div className="space-y-4 text-sm text-gray-700">
        <p>
          A dívida <strong>{d.descricao}</strong> fica como <strong>Cancelada</strong> e deixa de contar nos totais. Os pagamentos já feitos continuam em Lançamentos.
        </p>
        {restantes.length > 0 && (
          <label className="flex items-start gap-2 rounded-md border border-amarelo-borda bg-amarelo px-3 py-2 text-amarelo-texto">
            <input type="checkbox" className="mt-0.5 accent-verde" checked={retirar} onChange={(e) => setRetirar(e.target.checked)} />
            <span>
              Retirar de Lançamentos as {restantes.length} {restantes.length === 1 ? "parcela não paga" : "parcelas não pagas"} ({formatarCentavos(restantes.reduce((s, o) => s + o.valorCentavos, 0))}). Uma cópia fica no histórico e na Auditoria.
            </span>
          </label>
        )}
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
      </div>
    </Modal>
  );
}

/** Anotação livre no histórico (usada pelo Detalhando Dívida). */
export function useAnotacao(id: number, aoSalvar: () => void) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const salvar = () =>
    iniciar(async () => {
      setErro("");
      try {
        const r = await anotarDivida(id, texto);
        if (!r.ok) return setErro(r.erro);
        setTexto("");
        aoSalvar();
      } catch {
        setErro("Não foi possível salvar agora. Tente de novo.");
      }
    });
  return { texto, setTexto, erro, ocupado, salvar };
}
