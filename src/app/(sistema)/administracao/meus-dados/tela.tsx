"use client";

import { CheckCircle2, KeyRound, Mail, MapPin, Pencil, Phone, Settings, Star, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { Botao } from "@/components/ui/botao";
import { CampoSelecao, CampoTexto, TextoComDestaque } from "@/components/ui/campo";
import { Cartao } from "@/components/ui/cartao";
import { FaixaErro } from "@/components/ui/faixa-erro";
import { Modal } from "@/components/ui/modal";
import { formatarCep, formatarTelefone } from "@/lib/cadastros/documentos";
import { SEXOS, UFS } from "@/lib/cadastros/opcoes";
import { cn } from "@/lib/cn";
import { formatarData } from "@/lib/datas";
import { rotuloTempo, TEMPOS_SESSAO } from "@/lib/preferencias";
import { salvarPerfil, salvarPreferencias, trocarSenha, type DadosPerfil } from "./acoes";

type Perfil = Omit<DadosPerfil, "senhaAtual">;
type Aba = "dados" | "preferencias" | "senha";

const ABAS: { valor: Aba; rotulo: string; icone: React.ReactNode }[] = [
  { valor: "dados", rotulo: "Meus Dados", icone: <UserRound className="h-4 w-4" /> },
  { valor: "preferencias", rotulo: "Preferências", icone: <Settings className="h-4 w-4" /> },
  { valor: "senha", rotulo: "Senha", icone: <KeyRound className="h-4 w-4" /> },
];

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

export function TelaMeusDados({ perfil, tempoSessao, desde }: { perfil: Perfil; tempoSessao: number; desde: string }) {
  const [aba, setAba] = useState<Aba>("dados");
  const pendente = !perfil.telefone || !perfil.nascimento || !perfil.cidade;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Cartao>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-verde text-xl font-bold text-white">{iniciais(perfil.nome)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{perfil.nome}</h2>
            <p className="text-sm text-gray-500">{perfil.email}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-dourado">
              <Star className="h-3.5 w-3.5 fill-current" /> Administrador
              <span className="ml-2 font-normal text-gray-400">· usando o Gui desde {formatarData(desde)}</span>
            </p>
          </div>
        </div>
        <div role="tablist" className="-mb-4 mt-4 flex gap-1 border-t border-borda pt-1">
          {ABAS.map((a) => (
            <button
              key={a.valor}
              role="tab"
              type="button"
              aria-selected={aba === a.valor}
              onClick={() => setAba(a.valor)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold",
                aba === a.valor ? "border-verde text-verde" : "border-transparent text-gray-500 hover:text-gray-800",
              )}
            >
              {a.icone}
              {a.rotulo}
              {a.valor === "dados" && pendente && <span className="h-2 w-2 rounded-full bg-orange-500" title="Há informações para completar" />}
            </button>
          ))}
        </div>
      </Cartao>

      {aba === "dados" && <AbaDados perfil={perfil} pendente={pendente} />}
      {aba === "preferencias" && <AbaPreferencias tempoSessao={tempoSessao} />}
      {aba === "senha" && <AbaSenha />}
    </div>
  );
}

function Informacao({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-gray-400">{icone}</span>
      <div>
        <p className="text-xs text-gray-500">{rotulo}</p>
        {valor ? <p className="text-sm text-gray-800">{valor}</p> : <p className="text-sm italic text-negativo">não informado</p>}
      </div>
    </div>
  );
}

function AbaDados({ perfil, pendente }: { perfil: Perfil; pendente: boolean }) {
  const [editando, setEditando] = useState(false);
  const endereco = [
    [perfil.logradouro, perfil.numero].filter(Boolean).join(", "),
    perfil.complemento,
    perfil.bairro,
    [perfil.cidade, perfil.uf].filter(Boolean).join(" - "),
    perfil.cep,
  ]
    .filter(Boolean)
    .join(" · ");
  const sexo = SEXOS.find((s) => s.valor === perfil.sexo);
  return (
    <>
      <Cartao
        titulo={
          <span className="flex items-center gap-2">
            Informações e Endereço
            {pendente && <span className="h-2 w-2 rounded-full bg-orange-500" title="Há informações para completar" />}
          </span>
        }
        acoes={
          <button type="button" onClick={() => setEditando(true)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-verde" aria-label="Editar informações">
            <Pencil className="h-4 w-4" />
          </button>
        }
      >
        <div className="grid gap-x-8 sm:grid-cols-2">
          <Informacao icone={<UserRound className="h-4 w-4" />} rotulo="Nome" valor={perfil.nome + (perfil.apelido ? ` (${perfil.apelido})` : "")} />
          <Informacao icone={<Mail className="h-4 w-4" />} rotulo="E-mail (usado para entrar)" valor={perfil.email} />
          <Informacao icone={<Phone className="h-4 w-4" />} rotulo="Telefone" valor={perfil.telefone} />
          <Informacao icone={<MapPin className="h-4 w-4" />} rotulo="Mora em" valor={endereco} />
          <Informacao icone={<Star className="h-4 w-4" />} rotulo="Nasceu em" valor={formatarData(perfil.nascimento)} />
          <Informacao icone={<UserRound className="h-4 w-4" />} rotulo="Sexo" valor={sexo && sexo.valor !== "nao_informado" ? sexo.rotulo : ""} />
        </div>
      </Cartao>
      <Cartao titulo="Horários para Acesso">
        <p className="text-sm text-gray-600">Administradores possuem acesso irrestrito ao sistema, a qualquer hora.</p>
      </Cartao>
      {editando && <ModalPerfil perfil={perfil} aoFechar={() => setEditando(false)} />}
    </>
  );
}

function ModalPerfil({ perfil, aoFechar }: { perfil: Perfil; aoFechar: () => void }) {
  const [dados, setDados] = useState<DadosPerfil>({ ...perfil, senhaAtual: "" });
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const mudar = (campo: keyof DadosPerfil, valor: string) => {
    setDados((d) => ({ ...d, [campo]: valor }));
    setErro("");
  };
  const trocandoEmail = dados.email.trim().toLowerCase() !== perfil.email.toLowerCase();
  const salvar = () =>
    iniciar(async () => {
      try {
        const r = await salvarPerfil(dados);
        if (r.ok) aoFechar();
        else setErro(r.erro);
      } catch {
        setErro("Não foi possível salvar agora. Tente de novo.");
      }
    });

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="larga"
      titulo="Editando Informações e Endereço"
      resumo={dados.nome || "Nome"}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto rotulo="Nome" obrigatorio autoFocus maxLength={80} valor={dados.nome} aoMudar={(v) => mudar("nome", v)} />
          <CampoTexto rotulo="Apelido" maxLength={40} ajuda="Como prefere ser chamado (opcional)." valor={dados.apelido} aoMudar={(v) => mudar("apelido", v)} />
          <CampoTexto rotulo="E-mail" obrigatorio type="email" maxLength={120} ajuda="É o e-mail que você usa para entrar no sistema." valor={dados.email} aoMudar={(v) => mudar("email", v)} />
          <CampoTexto rotulo="Telefone" inputMode="tel" maxLength={16} valor={dados.telefone} aoMudar={(v) => mudar("telefone", formatarTelefone(v))} placeholder="(11) 91234-5678" />
          {trocandoEmail && (
            <div className="rounded-lg border border-amarelo-borda bg-amarelo/50 p-3 sm:col-span-2">
              <CampoTexto rotulo="Senha atual" obrigatorio type="password" autoComplete="current-password" ajuda="Você está trocando o e-mail de acesso. Confirme a sua senha." valor={dados.senhaAtual} aoMudar={(v) => mudar("senhaAtual", v)} />
              <p className="mt-1 text-xs text-amarelo-texto">Depois de salvar, use o novo e-mail para entrar.</p>
            </div>
          )}
          <CampoTexto rotulo="Nascimento" type="date" valor={dados.nascimento} aoMudar={(v) => mudar("nascimento", v)} />
          <CampoSelecao rotulo="Sexo" valor={dados.sexo} aoMudar={(v) => mudar("sexo", v)} opcoes={SEXOS.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))} />
        </div>
        <fieldset className="rounded-lg bg-creme p-4">
          <legend className="sr-only">Endereço</legend>
          <div className="grid gap-4 sm:grid-cols-6">
            <CampoTexto className="sm:col-span-2" rotulo="CEP" inputMode="numeric" maxLength={9} valor={dados.cep} aoMudar={(v) => mudar("cep", formatarCep(v))} placeholder="00000-000" />
            <CampoTexto className="sm:col-span-4" rotulo="Logradouro" maxLength={120} valor={dados.logradouro} aoMudar={(v) => mudar("logradouro", v)} />
            <CampoTexto className="sm:col-span-2" rotulo="Número" maxLength={20} valor={dados.numero} aoMudar={(v) => mudar("numero", v)} />
            <CampoTexto className="sm:col-span-4" rotulo="Complemento" maxLength={80} valor={dados.complemento} aoMudar={(v) => mudar("complemento", v)} />
            <CampoTexto className="sm:col-span-2" rotulo="Bairro" maxLength={80} valor={dados.bairro} aoMudar={(v) => mudar("bairro", v)} />
            <CampoTexto className="sm:col-span-3" rotulo="Cidade" maxLength={80} valor={dados.cidade} aoMudar={(v) => mudar("cidade", v)} />
            <CampoSelecao className="sm:col-span-1" rotulo="UF" valor={dados.uf} aoMudar={(v) => mudar("uf", v)} opcoes={[{ valor: "", rotulo: "--" }, ...UFS.map((u) => ({ valor: u, rotulo: u }))]} />
          </div>
        </fieldset>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function AbaPreferencias({ tempoSessao }: { tempoSessao: number }) {
  const [tempo, setTempo] = useState(String(tempoSessao));
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [salvando, iniciar] = useTransition();
  const salvar = () =>
    iniciar(async () => {
      try {
        const r = await salvarPreferencias({ tempoSessao: Number(tempo) });
        if (r.ok) setSalvo(true);
        else setErro(r.erro);
      } catch {
        setErro("Não foi possível salvar agora. Tente de novo.");
      }
    });
  return (
    <Cartao titulo="Gerais">
      <div className="max-w-sm space-y-4">
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <CampoSelecao
          rotulo="Tempo da Sessão"
          ajuda="Quanto tempo sem usar o sistema até ele sair sozinho e pedir a senha de novo."
          valor={tempo}
          aoMudar={(v) => {
            setTempo(v);
            setSalvo(false);
            setErro("");
          }}
          opcoes={TEMPOS_SESSAO.map((t) => ({ valor: String(t), rotulo: rotuloTempo(t) }))}
        />
        <p className="text-xs text-gray-500">Tempo sem atividade até sair do sistema. Quanto menor, mais seguro se outra pessoa usar o seu computador.</p>
        <div className="flex items-center gap-3">
          <Botao onClick={salvar} carregando={salvando}>
            Salvar Alterações
          </Botao>
          {salvo && (
            <span className="flex items-center gap-1 text-sm text-pago-texto">
              <CheckCircle2 className="h-4 w-4" /> Salvo
            </span>
          )}
        </div>
      </div>
    </Cartao>
  );
}

function AbaSenha() {
  const vazio = { atual: "", nova: "", confirmacao: "" };
  const [dados, setDados] = useState(vazio);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [salvando, iniciar] = useTransition();
  const mudar = (campo: keyof typeof vazio, valor: string) => {
    setDados((d) => ({ ...d, [campo]: valor }));
    setErro("");
    setSalvo(false);
  };
  const salvar = () =>
    iniciar(async () => {
      try {
        const r = await trocarSenha(dados);
        if (r.ok) {
          setDados(vazio);
          setSalvo(true);
        } else setErro(r.erro);
      } catch {
        setErro("Não foi possível trocar a senha agora. Tente de novo.");
      }
    });
  return (
    <Cartao titulo="Trocar a senha">
      <form
        className="max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <FaixaErro>{erro && <TextoComDestaque texto={erro} />}</FaixaErro>
        <CampoTexto rotulo="Senha atual" obrigatorio type="password" autoComplete="current-password" valor={dados.atual} aoMudar={(v) => mudar("atual", v)} />
        <CampoTexto rotulo="Nova senha" obrigatorio type="password" autoComplete="new-password" ajuda="Pelo menos 8 caracteres." valor={dados.nova} aoMudar={(v) => mudar("nova", v)} />
        <CampoTexto rotulo="Confirmação" obrigatorio type="password" autoComplete="new-password" ajuda="Digite a nova senha de novo." valor={dados.confirmacao} aoMudar={(v) => mudar("confirmacao", v)} />
        <div className="flex items-center gap-3">
          <Botao type="submit" carregando={salvando}>
            Trocar senha
          </Botao>
          {salvo && (
            <span className="flex items-center gap-1 text-sm text-pago-texto">
              <CheckCircle2 className="h-4 w-4" /> Senha trocada. Use a nova no próximo acesso.
            </span>
          )}
        </div>
      </form>
    </Cartao>
  );
}
