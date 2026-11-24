CREATE TYPE "public"."categoria_especial" AS ENUM('acerto_saldo', 'cartao_credito', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."natureza_categoria" AS ENUM('receita', 'despesa');--> statement-breakpoint
CREATE TYPE "public"."sexo" AS ENUM('masculino', 'feminino', 'outro', 'nao_informado');--> statement-breakpoint
CREATE TYPE "public"."tipo_conta" AS ENUM('outro', 'conta_corrente', 'carteira', 'poupanca', 'investimento');--> statement-breakpoint
CREATE TYPE "public"."tipo_pessoa" AS ENUM('fisica', 'juridica');--> statement-breakpoint
CREATE TABLE "banco" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"codigo" varchar(10),
	"nome" text NOT NULL,
	"logo_url" text,
	CONSTRAINT "banco_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "cartao_credito" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"descricao" text NOT NULL,
	"banco_id" integer,
	"limite_centavos" integer DEFAULT 0 NOT NULL,
	"ilimitado" boolean DEFAULT false NOT NULL,
	"dia_fechamento" smallint NOT NULL,
	"dia_vencimento" smallint NOT NULL,
	"conta_pagamento_id" integer,
	"ordem" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "cartao_dia_fechamento_valido" CHECK ("cartao_credito"."dia_fechamento" between 1 and 31),
	CONSTRAINT "cartao_dia_vencimento_valido" CHECK ("cartao_credito"."dia_vencimento" between 1 and 31),
	CONSTRAINT "cartao_limite_positivo" CHECK ("cartao_credito"."limite_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"categoria_pai_id" integer,
	"ordem" integer DEFAULT 0 NOT NULL,
	"cor" varchar(7),
	"natureza" "natureza_categoria" DEFAULT 'despesa' NOT NULL,
	"especial" "categoria_especial",
	CONSTRAINT "categoria_especial_unique" UNIQUE("especial")
);
--> statement-breakpoint
CREATE TABLE "configuracao" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"chave" text NOT NULL,
	"valor" jsonb NOT NULL,
	CONSTRAINT "configuracao_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "conta_financeira" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"descricao" text NOT NULL,
	"banco_id" integer,
	"tipo" "tipo_conta" DEFAULT 'outro' NOT NULL,
	"considerar_nos_saldos" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contato" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"pessoa" "tipo_pessoa" DEFAULT 'fisica' NOT NULL,
	"nome" text NOT NULL,
	"razao_social" text,
	"documento" varchar(18),
	"email" text,
	"telefone" varchar(20),
	"telefone_whatsapp" boolean DEFAULT false NOT NULL,
	"sexo" "sexo" DEFAULT 'nao_informado' NOT NULL,
	"nascimento" date,
	"cep" varchar(9),
	"logradouro" text,
	"numero" varchar(20),
	"complemento" text,
	"bairro" text,
	"cidade" text,
	"uf" varchar(2),
	"observacoes" text,
	"e_cliente" boolean DEFAULT false NOT NULL,
	"e_fornecedor" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feriado" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"dia" smallint NOT NULL,
	"mes" smallint NOT NULL,
	"ano" smallint,
	"recorrente" boolean DEFAULT true NOT NULL,
	CONSTRAINT "feriado_dia_valido" CHECK ("feriado"."dia" between 1 and 31),
	CONSTRAINT "feriado_mes_valido" CHECK ("feriado"."mes" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "forma_pagamento" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"descricao" text NOT NULL,
	"sigla" varchar(5)
);
--> statement-breakpoint
CREATE TABLE "preferencia_listagem" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"tela" text NOT NULL,
	"colunas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ordenacao" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"registros_por_pagina" smallint DEFAULT 20 NOT NULL,
	"sem_paginacao" boolean DEFAULT false NOT NULL,
	CONSTRAINT "preferencia_listagem_tela_unique" UNIQUE("tela")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"apelido" text,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"telefone" varchar(20),
	"nascimento" date,
	"sexo" "sexo" DEFAULT 'nao_informado' NOT NULL,
	"cep" varchar(9),
	"logradouro" text,
	"numero" varchar(20),
	"complemento" text,
	"bairro" text,
	"cidade" text,
	"uf" varchar(2),
	"avatar_url" text
);
--> statement-breakpoint
ALTER TABLE "cartao_credito" ADD CONSTRAINT "cartao_credito_banco_id_banco_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."banco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartao_credito" ADD CONSTRAINT "cartao_credito_conta_pagamento_id_conta_financeira_id_fk" FOREIGN KEY ("conta_pagamento_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_categoria_pai_id_categoria_id_fk" FOREIGN KEY ("categoria_pai_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_financeira" ADD CONSTRAINT "conta_financeira_banco_id_banco_id_fk" FOREIGN KEY ("banco_id") REFERENCES "public"."banco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categoria_pai_idx" ON "categoria" USING btree ("categoria_pai_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_email_unico" ON "usuario" USING btree (lower("email"));