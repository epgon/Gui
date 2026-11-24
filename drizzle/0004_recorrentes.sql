CREATE TYPE "public"."formato_recorrencia" AS ENUM('simples', 'detalhado', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."intervalo_recorrencia" AS ENUM('semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'livre');--> statement-breakpoint
CREATE TABLE "plano" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text NOT NULL,
	"tipo" "natureza_categoria" DEFAULT 'despesa' NOT NULL,
	"valor_centavos" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recorrencia" (
	"id" serial PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"padrao_sistema" boolean DEFAULT false NOT NULL,
	"campo_auxiliar" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"formato" "formato_recorrencia" DEFAULT 'simples' NOT NULL,
	"tipo" "natureza_categoria" DEFAULT 'despesa' NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"media_ultimos" smallint DEFAULT 0 NOT NULL,
	"intervalo" intervalo_recorrencia DEFAULT 'mensal' NOT NULL,
	"intervalo_dias" smallint,
	"dia_fixo" smallint NOT NULL,
	"data_inicio" date NOT NULL,
	"repeticoes" smallint,
	"data_fim" date,
	"realizar_automaticamente" boolean DEFAULT false NOT NULL,
	"apenas_dia_util" boolean DEFAULT false NOT NULL,
	"conta_id" integer,
	"cartao_id" integer,
	"conta_destino_id" integer,
	"categoria_id" integer,
	"forma_pagamento_id" integer,
	"contato_id" integer,
	"plano_id" integer,
	"observacao" varchar(1000),
	CONSTRAINT "recorrencia_conta_ou_cartao" CHECK (num_nonnulls("recorrencia"."conta_id", "recorrencia"."cartao_id") = 1),
	CONSTRAINT "recorrencia_dia_fixo_valido" CHECK ("recorrencia"."dia_fixo" between 1 and 31),
	CONSTRAINT "recorrencia_valor_positivo" CHECK ("recorrencia"."valor_centavos" >= 0),
	CONSTRAINT "recorrencia_media_valida" CHECK ("recorrencia"."media_ultimos" between 0 and 12)
);
--> statement-breakpoint
CREATE TABLE "recorrencia_excecao" (
	"id" serial PRIMARY KEY NOT NULL,
	"recorrencia_id" integer NOT NULL,
	"data_ocorrencia" date NOT NULL,
	"motivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recorrencia_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"recorrencia_id" integer NOT NULL,
	"tipo" "natureza_categoria" NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"categoria_id" integer NOT NULL,
	"ordem" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recorrencia_tag" (
	"recorrencia_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lancamento" ADD COLUMN "recorrencia_id" integer;--> statement-breakpoint
ALTER TABLE "lancamento" ADD COLUMN "data_ocorrencia" date;--> statement-breakpoint
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_conta_id_conta_financeira_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_cartao_id_cartao_credito_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartao_credito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_conta_destino_id_conta_financeira_id_fk" FOREIGN KEY ("conta_destino_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_forma_pagamento_id_forma_pagamento_id_fk" FOREIGN KEY ("forma_pagamento_id") REFERENCES "public"."forma_pagamento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_plano_id_plano_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia_excecao" ADD CONSTRAINT "recorrencia_excecao_recorrencia_id_recorrencia_id_fk" FOREIGN KEY ("recorrencia_id") REFERENCES "public"."recorrencia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia_item" ADD CONSTRAINT "recorrencia_item_recorrencia_id_recorrencia_id_fk" FOREIGN KEY ("recorrencia_id") REFERENCES "public"."recorrencia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia_item" ADD CONSTRAINT "recorrencia_item_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia_tag" ADD CONSTRAINT "recorrencia_tag_recorrencia_id_recorrencia_id_fk" FOREIGN KEY ("recorrencia_id") REFERENCES "public"."recorrencia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencia_tag" ADD CONSTRAINT "recorrencia_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recorrencia_excecao_unica" ON "recorrencia_excecao" USING btree ("recorrencia_id","data_ocorrencia");--> statement-breakpoint
CREATE INDEX "recorrencia_item_recorrencia_idx" ON "recorrencia_item" USING btree ("recorrencia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recorrencia_tag_unico" ON "recorrencia_tag" USING btree ("recorrencia_id","tag_id");--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_recorrencia_id_recorrencia_id_fk" FOREIGN KEY ("recorrencia_id") REFERENCES "public"."recorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lancamento_ocorrencia_unica" ON "lancamento" USING btree ("recorrencia_id","data_ocorrencia","tipo") WHERE "lancamento"."recorrencia_id" is not null;