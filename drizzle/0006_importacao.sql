CREATE TYPE "public"."acao_regra_importacao" AS ENUM('ignorar', 'preencher');--> statement-breakpoint
CREATE TYPE "public"."etapa_importacao" AS ENUM('destino', 'vinculo', 'revisao');--> statement-breakpoint
CREATE TYPE "public"."formato_importacao" AS ENUM('ofx', 'csv');--> statement-breakpoint
CREATE TYPE "public"."situacao_importacao" AS ENUM('rascunho', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_linha_importacao" AS ENUM('novo', 'encontrado', 'pendente', 'ignorado', 'adicionado', 'conciliado');--> statement-breakpoint
ALTER TYPE "public"."acao_auditoria" ADD VALUE 'importou';--> statement-breakpoint
CREATE TABLE "importacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"arquivo_nome" text NOT NULL,
	"formato" "formato_importacao" NOT NULL,
	"conteudo" text NOT NULL,
	"conta_id" integer,
	"cartao_id" integer,
	"mapeamento_id" integer,
	"situacao" "situacao_importacao" DEFAULT 'rascunho' NOT NULL,
	"etapa" "etapa_importacao" DEFAULT 'destino' NOT NULL,
	"tolerancia_dias" smallint DEFAULT 0 NOT NULL,
	"qualquer_conta" boolean DEFAULT false NOT NULL,
	"contato_pessoa" "tipo_pessoa" DEFAULT 'juridica' NOT NULL,
	"contato_cliente" boolean DEFAULT false NOT NULL,
	"contato_fornecedor" boolean DEFAULT true NOT NULL,
	"info_arquivo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"linhas_puladas" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluido_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "importacao_linha" (
	"id" serial PRIMARY KEY NOT NULL,
	"importacao_id" integer NOT NULL,
	"numero_linha" integer NOT NULL,
	"dados_brutos" jsonb NOT NULL,
	"fitid" text,
	"data" date NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"tipo" "natureza_categoria" NOT NULL,
	"descricao" text NOT NULL,
	"documento" text,
	"campos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "status_linha_importacao" DEFAULT 'novo' NOT NULL,
	"duplicada" boolean DEFAULT false NOT NULL,
	"candidatos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lancamento_id" integer,
	"conciliacao_antes" jsonb,
	"regra_id" integer
);
--> statement-breakpoint
CREATE TABLE "mapeamento_csv" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"conta_id" integer,
	"cartao_id" integer,
	"configuracao" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regra_importacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"conta_id" integer,
	"cartao_id" integer,
	"ordem" integer DEFAULT 0 NOT NULL,
	"condicoes" jsonb NOT NULL,
	"acao" "acao_regra_importacao" NOT NULL,
	"preencher" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_conta_id_conta_financeira_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_cartao_id_cartao_credito_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartao_credito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_mapeamento_id_mapeamento_csv_id_fk" FOREIGN KEY ("mapeamento_id") REFERENCES "public"."mapeamento_csv"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_linha" ADD CONSTRAINT "importacao_linha_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_linha" ADD CONSTRAINT "importacao_linha_lancamento_id_lancamento_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_linha" ADD CONSTRAINT "importacao_linha_regra_id_regra_importacao_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."regra_importacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapeamento_csv" ADD CONSTRAINT "mapeamento_csv_conta_id_conta_financeira_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapeamento_csv" ADD CONSTRAINT "mapeamento_csv_cartao_id_cartao_credito_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartao_credito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regra_importacao" ADD CONSTRAINT "regra_importacao_conta_id_conta_financeira_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regra_importacao" ADD CONSTRAINT "regra_importacao_cartao_id_cartao_credito_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartao_credito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "importacao_linha_importacao_idx" ON "importacao_linha" USING btree ("importacao_id");--> statement-breakpoint
CREATE INDEX "importacao_linha_fitid_idx" ON "importacao_linha" USING btree ("fitid");--> statement-breakpoint
CREATE INDEX "importacao_linha_lancamento_idx" ON "importacao_linha" USING btree ("lancamento_id");--> statement-breakpoint
-- Regra pronta: o pagamento da fatura que aparece no extrato é ignorado (a despesa já está nas compras do cartão).
INSERT INTO "regra_importacao" ("nome", "padrao_sistema", "ordem", "condicoes", "acao", "preencher")
VALUES ('Ignorar pagamento de fatura', true, 0, '[{"campo":"descricao","operador":"contem","valor":"pagamento de fatura"}]'::jsonb, 'ignorar', '{}'::jsonb);
