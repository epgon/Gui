CREATE TYPE "public"."formato_lancamento" AS ENUM('simples', 'detalhado');--> statement-breakpoint
CREATE TYPE "public"."origem_lancamento" AS ENUM('manual', 'parcelamento', 'recorrente', 'importacao', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."periodicidade" AS ENUM('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');--> statement-breakpoint
CREATE TYPE "public"."situacao_fatura" AS ENUM('aberta', 'fechada', 'paga');--> statement-breakpoint
CREATE TYPE "public"."tipo_lancamento" AS ENUM('despesa', 'receita', 'transferencia_saida', 'transferencia_entrada', 'saldo_inicial', 'acerto_saldo', 'pagamento_fatura');--> statement-breakpoint
CREATE TABLE "anexo" (
	"id" serial PRIMARY KEY NOT NULL,
	"lancamento_id" integer NOT NULL,
	"nome_arquivo" text NOT NULL,
	"tipo_mime" varchar(100) NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"conteudo" "bytea" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fatura" (
	"id" serial PRIMARY KEY NOT NULL,
	"cartao_id" integer NOT NULL,
	"competencia" date NOT NULL,
	"data_fechamento" date NOT NULL,
	"data_vencimento" date NOT NULL,
	"situacao" "situacao_fatura" DEFAULT 'aberta' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lancamento" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" "tipo_lancamento" NOT NULL,
	"formato" "formato_lancamento" DEFAULT 'simples' NOT NULL,
	"descricao" text NOT NULL,
	"documento" varchar(60),
	"observacao" varchar(1000),
	"valor_centavos" bigint NOT NULL,
	"valor_pago_centavos" bigint,
	"data_vencimento" date NOT NULL,
	"data_pagamento" date,
	"data_referencia" date,
	"data_compra" date,
	"realizar_automaticamente" boolean DEFAULT false NOT NULL,
	"conta_id" integer,
	"cartao_id" integer,
	"fatura_id" integer,
	"categoria_id" integer,
	"forma_pagamento_id" integer,
	"contato_id" integer,
	"parcelamento_id" integer,
	"parcela_numero" smallint,
	"parcela_total" smallint,
	"transferencia_id" integer,
	"origem" "origem_lancamento" DEFAULT 'manual' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_conta_ou_cartao" CHECK (num_nonnulls("lancamento"."conta_id", "lancamento"."cartao_id") = 1),
	CONSTRAINT "lancamento_valor_positivo" CHECK ("lancamento"."valor_centavos" >= 0 or "lancamento"."tipo" in ('saldo_inicial', 'acerto_saldo'))
);
--> statement-breakpoint
CREATE TABLE "lancamento_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"lancamento_id" integer NOT NULL,
	"tipo" "natureza_categoria" NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"categoria_id" integer NOT NULL,
	"ordem" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "lancamento_item_valor_positivo" CHECK ("lancamento_item"."valor_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "lancamento_tag" (
	"lancamento_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcelamento" (
	"id" serial PRIMARY KEY NOT NULL,
	"descricao_base" text NOT NULL,
	"valor_total_centavos" bigint NOT NULL,
	"quantidade" smallint NOT NULL,
	"periodicidade" "periodicidade" DEFAULT 'mensal' NOT NULL,
	"iniciar_na_parcela" smallint DEFAULT 1 NOT NULL,
	"dividir_valor" boolean DEFAULT true NOT NULL,
	"incluir_parcela_na_descricao" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transferencia" (
	"id" serial PRIMARY KEY NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_lancamento_id_lancamento_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fatura" ADD CONSTRAINT "fatura_cartao_id_cartao_credito_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartao_credito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_conta_id_conta_financeira_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_cartao_id_cartao_credito_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartao_credito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_fatura_id_fatura_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."fatura"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_forma_pagamento_id_forma_pagamento_id_fk" FOREIGN KEY ("forma_pagamento_id") REFERENCES "public"."forma_pagamento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_parcelamento_id_parcelamento_id_fk" FOREIGN KEY ("parcelamento_id") REFERENCES "public"."parcelamento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_transferencia_id_transferencia_id_fk" FOREIGN KEY ("transferencia_id") REFERENCES "public"."transferencia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_item" ADD CONSTRAINT "lancamento_item_lancamento_id_lancamento_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_item" ADD CONSTRAINT "lancamento_item_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_tag" ADD CONSTRAINT "lancamento_tag_lancamento_id_lancamento_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_tag" ADD CONSTRAINT "lancamento_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anexo_lancamento_idx" ON "anexo" USING btree ("lancamento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fatura_cartao_competencia_unica" ON "fatura" USING btree ("cartao_id","competencia");--> statement-breakpoint
CREATE INDEX "lancamento_vencimento_idx" ON "lancamento" USING btree ("data_vencimento");--> statement-breakpoint
CREATE INDEX "lancamento_pagamento_idx" ON "lancamento" USING btree ("data_pagamento");--> statement-breakpoint
CREATE INDEX "lancamento_conta_idx" ON "lancamento" USING btree ("conta_id");--> statement-breakpoint
CREATE INDEX "lancamento_cartao_idx" ON "lancamento" USING btree ("cartao_id");--> statement-breakpoint
CREATE INDEX "lancamento_fatura_idx" ON "lancamento" USING btree ("fatura_id");--> statement-breakpoint
CREATE INDEX "lancamento_parcelamento_idx" ON "lancamento" USING btree ("parcelamento_id");--> statement-breakpoint
CREATE INDEX "lancamento_transferencia_idx" ON "lancamento" USING btree ("transferencia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamento_saldo_inicial_unico" ON "lancamento" USING btree ("conta_id") WHERE "lancamento"."tipo" = 'saldo_inicial';--> statement-breakpoint
CREATE INDEX "lancamento_item_lancamento_idx" ON "lancamento_item" USING btree ("lancamento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamento_tag_unico" ON "lancamento_tag" USING btree ("lancamento_id","tag_id");--> statement-breakpoint
-- Contas já cadastradas: o saldo inicial vira o lançamento "Saldo Inicial" (já realizado).
INSERT INTO "lancamento" ("tipo", "descricao", "valor_centavos", "valor_pago_centavos", "data_vencimento", "data_pagamento", "conta_id", "categoria_id", "origem")
SELECT 'saldo_inicial', 'Saldo Inicial', c."saldo_inicial_centavos", c."saldo_inicial_centavos",
       coalesce(c."saldo_inicial_data", (c."criado_em" at time zone 'America/Sao_Paulo')::date),
       coalesce(c."saldo_inicial_data", (c."criado_em" at time zone 'America/Sao_Paulo')::date),
       c."id", (SELECT "id" FROM "categoria" WHERE "especial" = 'acerto_saldo'), 'sistema'
FROM "conta_financeira" c
WHERE c."saldo_inicial_centavos" <> 0;
