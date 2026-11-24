"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { atualizarSessao } from "@/auth";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { formatarCep, formatarTelefone, somenteDigitos } from "@/lib/cadastros/documentos";
import { SEXOS, UFS } from "@/lib/cadastros/opcoes";
import { falha, obrigatorio, opcional, primeiroErro, type Resultado } from "@/lib/cadastros/resultado";
import { gravarConfiguracao } from "@/lib/configuracao";
import { dataValida, hojeIso } from "@/lib/datas";
import { CHAVE_TEMPO_SESSAO, rotuloTempo, TEMPOS_SESSAO } from "@/lib/preferencias";
import { exigirLogin } from "@/lib/sessao";

const { usuario } = schema;
const TELA = "Meus Dados";

async function usuarioDaSessao() {
  const sessao = await exigirLogin();
  const id = Number(sessao.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Sessão expirada. Entre de novo no sistema.");
  const [u] = await getDb().select().from(usuario).where(eq(usuario.id, id)).limit(1);
  if (!u) throw new Error("Sessão expirada. Entre de novo no sistema.");
  return u;
}

export type DadosPerfil = {
  nome: string;
  apelido: string;
  email: string;
  senhaAtual: string;
  telefone: string;
  nascimento: string;
  sexo: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

const formularioPerfil = z.object({
  nome: obrigatorio("Nome", 80),
  apelido: opcional("Apelido", 40),
  email: obrigatorio("E-mail", 120).pipe(z.email("Informe um **E-mail** válido.")),
  senhaAtual: z.string(),
  telefone: z.string().trim(),
  nascimento: z.string().trim(),
  sexo: z.enum(SEXOS.map((s) => s.valor) as [string, ...string[]], { error: "Selecione uma opção válida em **Sexo**." }),
  cep: z.string().trim(),
  logradouro: opcional("Logradouro", 120),
  numero: opcional("Número", 20),
  complemento: opcional("Complemento", 80),
  bairro: opcional("Bairro", 80),
  cidade: opcional("Cidade", 80),
  uf: z.string().trim(),
});

/** Grava as Informações e Endereço do usuário. Trocar o e-mail (o login) pede a senha atual. */
export async function salvarPerfil(entrada: DadosPerfil): Promise<Resultado> {
  const atual = await usuarioDaSessao();
  const v = formularioPerfil.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  const d = v.data;

  const tel = somenteDigitos(d.telefone);
  if (tel && (tel.length < 10 || tel.length > 11)) return falha("Informe o **Telefone** com DDD (10 ou 11 números).");
  if (d.nascimento && (!dataValida(d.nascimento) || d.nascimento > hojeIso())) return falha("Informe uma data válida no campo **Nascimento**.");
  const cep = somenteDigitos(d.cep);
  if (cep && cep.length !== 8) return falha("O **CEP** precisa ter 8 números.");
  if (d.uf && !(UFS as readonly string[]).includes(d.uf)) return falha("Selecione um **Estado** válido.");

  const email = d.email.toLowerCase();
  const trocouEmail = email !== atual.email.toLowerCase();
  if (trocouEmail) {
    if (!d.senhaAtual) return falha("Para trocar o e-mail de acesso, digite a sua **Senha atual**.");
    if (!(await bcrypt.compare(d.senhaAtual, atual.senhaHash))) return falha("A **Senha atual** não confere.");
    const [outro] = await getDb()
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(sql`lower(${usuario.email}) = ${email}`, ne(usuario.id, atual.id)))
      .limit(1);
    if (outro) return falha("Este **E-mail** já é usado por outro acesso.");
  }

  const novos = {
    nome: d.nome,
    apelido: d.apelido,
    email,
    telefone: tel ? formatarTelefone(tel) : null,
    nascimento: d.nascimento || null,
    sexo: d.sexo as (typeof SEXOS)[number]["valor"],
    cep: cep ? formatarCep(cep) : null,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf || null,
  };
  await getDb().transaction(async (tx) => {
    await tx.update(usuario).set(novos).where(eq(usuario.id, atual.id));
    await registrarAuditoria(tx, { tela: TELA, entidade: "Usuário", entidadeId: atual.id, acao: "alterou", descricao: `os dados de ${novos.nome}`, dados: diferencas(atual, novos) });
  });
  await atualizarSessao({ user: { name: novos.nome, email: novos.email } });
  refresh();
  return { ok: true };
}

export type DadosSenha = { atual: string; nova: string; confirmacao: string };

/** Troca a senha de acesso (guardada só como hash). */
export async function trocarSenha(entrada: DadosSenha): Promise<Resultado> {
  const atual = await usuarioDaSessao();
  const d = z.object({ atual: z.string(), nova: z.string(), confirmacao: z.string() }).safeParse(entrada);
  if (!d.success) return falha("Preencha os campos de senha.");
  const { atual: senhaAtual, nova, confirmacao } = d.data;
  if (!senhaAtual) return falha("Preencha o campo **Senha atual**.");
  if (!nova) return falha("Preencha o campo **Nova senha**.");
  if (nova.length < 8) return falha("A **Nova senha** precisa ter pelo menos 8 caracteres.");
  if (nova.length > 72) return falha("A **Nova senha** aceita no máximo 72 caracteres.");
  if (nova !== confirmacao) return falha("A **Confirmação** não é igual à nova senha.");
  if (!(await bcrypt.compare(senhaAtual, atual.senhaHash))) return falha("A **Senha atual** não confere.");
  if (await bcrypt.compare(nova, atual.senhaHash)) return falha("A **Nova senha** é igual à atual.");

  const senhaHash = await bcrypt.hash(nova, 12);
  await getDb().transaction(async (tx) => {
    await tx.update(usuario).set({ senhaHash }).where(eq(usuario.id, atual.id));
    // A senha nunca vai para a auditoria, só o registro de que foi trocada.
    await registrarAuditoria(tx, { tela: TELA, entidade: "Usuário", entidadeId: atual.id, acao: "alterou", descricao: `a senha de ${atual.nome}` });
  });
  return { ok: true };
}

/** Preferências: tempo da sessão (minutos sem uso até sair sozinho). */
export async function salvarPreferencias(entrada: { tempoSessao: number }): Promise<Resultado> {
  await usuarioDaSessao();
  const tempo = entrada?.tempoSessao;
  if (!(TEMPOS_SESSAO as readonly number[]).includes(tempo)) return falha("Selecione um **Tempo da Sessão** da lista.");
  await getDb().transaction((tx) => gravarConfiguracao(tx, CHAVE_TEMPO_SESSAO, tempo, { tela: TELA, descricao: `o Tempo da Sessão para ${rotuloTempo(tempo)}` }));
  await atualizarSessao({});
  refresh();
  return { ok: true };
}
