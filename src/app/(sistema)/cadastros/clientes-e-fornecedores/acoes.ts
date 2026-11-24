"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { diferencas, registrarAuditoria } from "@/lib/auditoria";
import { cnpjValido, cpfValido, formatarCep, formatarDocumento, formatarTelefone, somenteDigitos } from "@/lib/cadastros/documentos";
import { SEXOS, UFS } from "@/lib/cadastros/opcoes";
import { falha, idValido, obrigatorio, opcional, primeiroErro, type Resultado, ERRO_AUXILIAR, lerCampoAuxiliar } from "@/lib/cadastros/resultado";
import { dataValida, hojeIso } from "@/lib/datas";
import { exigirLogin } from "@/lib/sessao";

const { contato } = schema;
const TELA = "Clientes e Fornecedores";
const ENTIDADE = "Cliente e Fornecedor";

const formulario = z
  .object({
    pessoa: z.enum(["fisica", "juridica"], { error: "Escolha **Pessoa Física** ou **Pessoa Jurídica**." }),
    nome: z.string(),
    eCliente: z.boolean(),
    eFornecedor: z.boolean(),
    razaoSocial: opcional("Razão Social", 150),
    documento: z.string().trim(),
    email: opcional("E-mail", 150).refine((v) => v === null || z.email().safeParse(v).success, "Informe um endereço válido no campo **E-mail**."),
    telefone: z.string().trim(),
    telefoneWhatsapp: z.boolean(),
    sexo: z.enum(SEXOS.map((s) => s.valor) as [string, ...string[]]),
    nascimento: z.string().trim(),
    cep: z.string().trim(),
    logradouro: opcional("Endereço", 150),
    numero: opcional("Número", 20),
    complemento: opcional("Complemento", 100),
    bairro: opcional("Bairro", 100),
    cidade: opcional("Cidade", 100),
    uf: z.string().trim(),
    observacoes: opcional("Observações", 2000),
  })
  .superRefine((d, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: "custom", message });
    const nomeCampo = d.pessoa === "juridica" ? "Nome Fantasia" : "Nome";
    const nome = obrigatorio(nomeCampo, 120).safeParse(d.nome);
    if (!nome.success) return erro(nome.error.issues[0].message);
    const doc = somenteDigitos(d.documento);
    if (doc) {
      if (d.pessoa === "fisica" && !cpfValido(doc)) return erro("O **CPF** informado não é válido. Confira os números.");
      if (d.pessoa === "juridica" && !cnpjValido(doc)) return erro("O **CNPJ** informado não é válido. Confira os números.");
    }
    const tel = somenteDigitos(d.telefone);
    if (tel && (tel.length < 10 || tel.length > 11)) return erro("Informe o **Telefone** com DDD (ex.: (11) 98765-4321).");
    if (d.nascimento && (!dataValida(d.nascimento) || d.nascimento > hojeIso())) return erro("Informe uma data válida no campo **Nascimento**.");
    const cep = somenteDigitos(d.cep);
    if (cep && cep.length !== 8) return erro("O **CEP** precisa ter 8 números (aba Endereço).");
    if (d.uf && !(UFS as readonly string[]).includes(d.uf)) return erro("Selecione um **Estado** válido (aba Endereço).");
  })
  .transform((d) => {
    const juridica = d.pessoa === "juridica";
    return {
      ...d,
      nome: d.nome.trim(),
      sexo: (juridica ? "nao_informado" : d.sexo) as (typeof SEXOS)[number]["valor"],
      nascimento: !juridica && d.nascimento ? d.nascimento : null,
      razaoSocial: juridica ? d.razaoSocial : null,
      documento: d.documento ? formatarDocumento(d.documento) : null,
      telefone: d.telefone ? formatarTelefone(d.telefone) : null,
      telefoneWhatsapp: d.telefone ? d.telefoneWhatsapp : false,
      cep: d.cep ? formatarCep(d.cep) : null,
      uf: d.uf || null,
    };
  });

export type DadosContato = {
  pessoa: "fisica" | "juridica";
  nome: string;
  eCliente: boolean;
  eFornecedor: boolean;
  razaoSocial: string;
  documento: string;
  email: string;
  telefone: string;
  telefoneWhatsapp: boolean;
  sexo: string;
  nascimento: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
  /** Parâmetros > Campos Auxiliares. */
  campoAuxiliar?: string;
};

export async function salvarContato(id: number | null, entrada: DadosContato): Promise<Resultado> {
  await exigirLogin();
  const v = formulario.safeParse(entrada);
  if (!v.success) return primeiroErro(v.error);
  const aux = lerCampoAuxiliar(entrada);
  if (!aux) return falha(ERRO_AUXILIAR);
  if (id !== null && !idValido.safeParse(id).success) return falha("Cadastro não encontrado.");
  const dados = { ...v.data, ...aux };
  const rotulo = (d: { eCliente: boolean; eFornecedor: boolean }) =>
    d.eCliente && !d.eFornecedor ? "o Cliente" : d.eFornecedor && !d.eCliente ? "o Fornecedor" : "o Cliente e Fornecedor";

  return getDb().transaction(async (tx) => {
    if (id === null) {
      const [novo] = await tx.insert(contato).values(dados).returning();
      await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: novo.id, acao: "cadastrou", descricao: `${rotulo(dados)} ${novo.nome}`, dados });
      refresh();
      return { ok: true, id: novo.id } as const;
    }
    const [antes] = await tx.select().from(contato).where(eq(contato.id, id)).for("update");
    if (!antes) return falha("Este cadastro não existe mais.");
    await tx.update(contato).set(dados).where(eq(contato.id, id));
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: "alterou", descricao: `${rotulo(dados)} ${dados.nome}`, dados: diferencas(antes, dados) });
    refresh();
    return { ok: true, id } as const;
  });
}

export async function alterarSituacaoContato(id: number, ativo: boolean): Promise<Resultado> {
  await exigirLogin();
  if (!idValido.safeParse(id).success || typeof ativo !== "boolean") return falha("Cadastro não encontrado.");
  return getDb().transaction(async (tx) => {
    const [linha] = await tx.update(contato).set({ ativo }).where(eq(contato.id, id)).returning();
    if (!linha) return falha("Este cadastro não existe mais.");
    await registrarAuditoria(tx, { tela: TELA, entidade: ENTIDADE, entidadeId: id, acao: ativo ? "ativou" : "inativou", descricao: linha.nome });
    refresh();
    return { ok: true } as const;
  });
}
