"use client";

import { DicaAjuda } from "@/components/ui/dica-ajuda";
import { CalendarClock, X } from "lucide-react";
import { CampoSelecao, CampoTexto, Rotulo } from "@/components/ui/campo";
import { Chave } from "@/components/ui/chave";
import { formatarData } from "@/lib/datas";
import type { DadosRecorrencia } from "@/lib/lancamentos/tipos";
import { INTERVALOS, ocorrencias, usaDiaFixo, type Intervalo } from "@/lib/recorrentes/regras";

/** Bloco em branco: mensal, no dia da data informada, começando nela. */
export function recorrenciaPadrao(data: string): DadosRecorrencia {
  return { intervalo: "mensal", intervaloDias: "30", diaFixo: String(Number(data.slice(8, 10)) || 1), dataInicio: data, fim: "repeticoes", repeticoes: "", dataFim: "", apenasDiaUtil: false };
}

/** As próximas datas, para conferir na tela (sem feriados: o servidor ajusta ao gravar). */
function proximas(d: DadosRecorrencia, quantas: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataInicio)) return [];
  const intervalo = d.intervalo as Intervalo;
  const dia = Number(d.diaFixo);
  if (usaDiaFixo(intervalo) && !(dia >= 1 && dia <= 31)) return [];
  const regra = {
    intervalo,
    intervaloDias: Number(d.intervaloDias) || 1,
    diaFixo: usaDiaFixo(intervalo) ? dia : Number(d.dataInicio.slice(8, 10)),
    dataInicio: d.dataInicio,
    repeticoes: d.fim === "repeticoes" && Number(d.repeticoes) > 0 ? Math.min(Number(d.repeticoes), quantas) : quantas,
    dataFim: d.fim === "data" && /^\d{4}-\d{2}-\d{2}$/.test(d.dataFim) ? d.dataFim : null,
    apenasDiaUtil: false,
  };
  return ocorrencias(regra, [], "9999-12-31").map((o) => o.data);
}

/**
 * Configuração do recorrente: Intervalo, Dia Fixo, Início, Repetições ou Fim,
 * e as chaves "Realizar automaticamente" e "Apenas dia útil".
 */
export function BlocoRecorrencia({ valor, aoMudar, realizar, aoMudarRealizar, aoFechar, eCartao }: {
  valor: DadosRecorrencia;
  aoMudar: (v: Partial<DadosRecorrencia>) => void;
  realizar: boolean;
  aoMudarRealizar: (v: boolean) => void;
  aoFechar?: () => void;
  eCartao?: boolean;
}) {
  const intervalo = valor.intervalo as Intervalo;
  const datas = proximas(valor, 4);
  return (
    <fieldset className="rounded-lg border border-amarelo-borda bg-creme p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <legend className="flex items-center gap-2 text-sm font-semibold text-verde">
          <CalendarClock className="h-4 w-4" /> Recorrência
        </legend>
        {aoFechar && (
          <button type="button" onClick={aoFechar} aria-label="Fechar Gerar Recorrente" className="rounded p-1 text-gray-500 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoSelecao rotulo="Intervalo" obrigatorio valor={valor.intervalo} aoMudar={(v) => aoMudar({ intervalo: v })} opcoes={INTERVALOS} />
        {intervalo === "livre" ? (
          <CampoTexto rotulo="A cada quantos dias" obrigatorio type="number" min={1} max={3650} valor={valor.intervaloDias} aoMudar={(v) => aoMudar({ intervaloDias: v })} />
        ) : usaDiaFixo(intervalo) ? (
          <CampoTexto
            rotulo="Dia Fixo"
            obrigatorio
            type="number"
            min={1}
            max={31}
            valor={valor.diaFixo}
            aoMudar={(v) => aoMudar({ diaFixo: v })}
            ajuda="Dia do vencimento em cada mês. Dia 31 em mês curto vira o último dia do mês."
          />
        ) : (
          <div>
            <Rotulo texto="Dia" />
            <p className="flex h-10 items-center text-sm text-gray-600">Mesmo dia da semana do Início</p>
          </div>
        )}
        <CampoTexto
          rotulo="Início"
          obrigatorio
          type="date"
          valor={valor.dataInicio}
          aoMudar={(v) => aoMudar({ dataInicio: v })}
          ajuda="A partir de quando o lançamento se repete. A primeira vez é o primeiro Dia Fixo a partir desta data."
        />
      </div>
      <div className="mt-4 grid items-end gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-4 text-sm font-medium text-gray-700" role="radiogroup" aria-label="Repetições ou Fim">
            {(
              [
                ["repeticoes", "Repetições"],
                ["data", "Fim"],
              ] as const
            ).map(([v, r]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="fim-recorrencia" checked={valor.fim === v} onChange={() => aoMudar({ fim: v })} className="accent-verde" /> {r}
              </label>
            ))}
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              (opcional)
              <DicaAjuda texto="Para lançamentos que se repetem por tempo indeterminado, mantenha este campo em branco." />
            </span>
          </div>
          {valor.fim === "repeticoes" ? (
            <input
              type="number"
              min={1}
              max={999}
              aria-label="Repetições"
              placeholder="Opcional: deixe em branco para não ter fim"
              value={valor.repeticoes}
              onChange={(e) => aoMudar({ repeticoes: e.target.value })}
              className="h-10 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none focus:border-verde"
            />
          ) : (
            <input
              type="date"
              aria-label="Fim"
              value={valor.dataFim}
              onChange={(e) => aoMudar({ dataFim: e.target.value })}
              className="h-10 w-full rounded-md border border-borda bg-white px-3 text-sm outline-none focus:border-verde"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pb-2">
          <span title={eCartao ? "No cartão: a compra é lançada sozinha na fatura no dia." : "O sistema dá baixa sozinho no dia do vencimento."}>
            <Chave ligada={realizar} aoMudar={aoMudarRealizar} rotulo="Realizar automaticamente" />
          </span>
          <span title="Se cair em sábado, domingo ou feriado, vai para o próximo dia útil.">
            <Chave ligada={valor.apenasDiaUtil} aoMudar={(v) => aoMudar({ apenasDiaUtil: v })} rotulo="Apenas dia útil" />
          </span>
        </div>
      </div>
      {datas.length > 0 && (
        <p className="mt-3 text-xs text-gray-600">
          Próximas datas: <strong>{datas.map((d) => formatarData(d)).join(", ")}</strong>
          {valor.apenasDiaUtil && " (ajustadas para dia útil ao lançar)"}.
        </p>
      )}
    </fieldset>
  );
}
