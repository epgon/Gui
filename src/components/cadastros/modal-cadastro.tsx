"use client";

import { Save } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { Botao } from "@/components/ui/botao";
import { Chave } from "@/components/ui/chave";
import { TextoComDestaque } from "@/components/ui/campo";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import type { Resultado } from "@/lib/cadastros/resultado";

/**
 * Controla a janela de cadastro: dados do formulário, se é novo ou edição,
 * a faixa amarela de erro e o "Salvar e Adicionar Novo".
 */
export function useFormularioCadastro<T extends object>(vazio: T) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<T>(vazio);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [continuar, setContinuar] = useState(false);
  const [salvando, iniciar] = useTransition();
  const [salvos, setSalvos] = useState(0);

  const abrirNovo = useCallback(
    (parcial?: Partial<T>) => {
      setDados({ ...vazio, ...parcial });
      setEditandoId(null);
      setErro("");
      setSalvos(0);
      setAberto(true);
    },
    [vazio],
  );

  const abrirEdicao = useCallback((id: number, valores: T) => {
    setDados(valores);
    setEditandoId(id);
    setErro("");
    setAberto(true);
  }, []);

  const mudar = useCallback(<K extends keyof T>(campo: K, valor: T[K]) => {
    setDados((d) => ({ ...d, [campo]: valor }));
    setErro("");
  }, []);

  const salvar = (acao: (id: number | null, dados: T) => Promise<Resultado>, manter?: (d: T) => Partial<T>) => {
    setErro("");
    iniciar(async () => {
      try {
        const r = await acao(editandoId, dados);
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        if (continuar && editandoId === null) {
          setDados({ ...vazio, ...manter?.(dados) });
          setSalvos((n) => n + 1);
        } else {
          setAberto(false);
        }
      } catch {
        setErro("Não foi possível salvar agora. Confira sua conexão e tente de novo.");
      }
    });
  };

  return {
    aberto,
    fechar: () => setAberto(false),
    dados,
    mudar,
    editandoId,
    novo: editandoId === null,
    erro,
    setErro,
    salvando,
    continuar,
    setContinuar,
    salvos,
    abrirNovo,
    abrirEdicao,
    salvar,
  };
}

/** O que a janela precisa saber do formulário. */
type EstadoJanela = {
  aberto: boolean;
  fechar: () => void;
  novo: boolean;
  continuar: boolean;
  setContinuar: (v: boolean) => void;
  salvando: boolean;
  erro: string;
  salvos: number;
};

/** Janela de cadastro com rodapé Salvar / Voltar / "Salvar e Adicionar Novo". */
export function ModalCadastro({ formulario, titulo, resumo, aoSalvar, children, largura }: {
  formulario: EstadoJanela;
  titulo: React.ReactNode;
  resumo?: React.ReactNode;
  aoSalvar: () => void;
  children: React.ReactNode;
  largura?: "normal" | "larga";
}) {
  const f = formulario;
  return (
    <Modal
      aberto={f.aberto}
      aoFechar={f.fechar}
      titulo={titulo}
      resumo={resumo}
      largura={largura}
      rodape={
        <>
          {f.novo && (
            <div className="mr-auto">
              <Chave ligada={f.continuar} aoMudar={f.setContinuar} rotulo="Salvar e Adicionar Novo" />
            </div>
          )}
          <Botao variante="secundario" type="button" onClick={f.fechar}>
            Voltar
          </Botao>
          <Botao type="submit" form="formulario-cadastro" carregando={f.salvando} icone={<Save className="h-4 w-4" />}>
            Salvar
          </Botao>
        </>
      }
    >
      <form
        id="formulario-cadastro"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        {f.salvos > 0 && f.novo && !f.erro && (
          <p className="rounded-md bg-pago-fundo px-3 py-2 text-sm text-pago-texto">
            {f.salvos === 1 ? "1 cadastro salvo." : `${f.salvos} cadastros salvos.`} Preencha o próximo.
          </p>
        )}
        {children}
        <FaixaErro>{f.erro && <TextoComDestaque texto={f.erro} />}</FaixaErro>
      </form>
    </Modal>
  );
}
