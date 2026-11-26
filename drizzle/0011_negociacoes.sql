CREATE TYPE "public"."canal_negociacao" AS ENUM('telefone', 'aplicativo', 'agencia', 'site', 'feirao', 'advogado', 'outro');--> statement-breakpoint
CREATE TYPE "public"."modalidade_proposta" AS ENUM('a_vista', 'parcelada');--> statement-breakpoint
CREATE TYPE "public"."quem_propos" AS ENUM('credor', 'eu');--> statement-breakpoint
CREATE TYPE "public"."situacao_negociacao" AS ENUM('em_andamento', 'proposta_recebida', 'aguardando_resposta', 'aceita', 'recusada', 'desistida');--> statement-breakpoint
CREATE TYPE "public"."situacao_proposta" AS ENUM('aberta', 'aceita', 'recusada');--> statement-breakpoint
ALTER TYPE "public"."acao_auditoria" ADD VALUE 'renegociou';--> statement-breakpoint
ALTER TYPE "public"."acao_auditoria" ADD VALUE 'aprovou';--> statement-breakpoint
CREATE TABLE "divida_renegociacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"acordo_id" integer NOT NULL,
	"original_id" integer NOT NULL,
	"negociacao_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negociacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"situacao" "situacao_negociacao" DEFAULT 'em_andamento' NOT NULL,
	"canal" "canal_negociacao" DEFAULT 'telefone' NOT NULL,
	"protocolo" varchar(60),
	"data_inicio" date NOT NULL,
	"prazo_resposta" date,
	"sobra_mensal_centavos" bigint,
	"observacao" varchar(1000),
	"acordo_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negociacao_divida" (
	"id" serial PRIMARY KEY NOT NULL,
	"negociacao_id" integer NOT NULL,
	"divida_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negociacao_proposta" (
	"id" serial PRIMARY KEY NOT NULL,
	"negociacao_id" integer NOT NULL,
	"data" date NOT NULL,
	"quem_propos" "quem_propos" NOT NULL,
	"modalidade" "modalidade_proposta" NOT NULL,
	"entrada_centavos" bigint DEFAULT 0 NOT NULL,
	"parcelas" smallint DEFAULT 0 NOT NULL,
	"valor_parcela_centavos" bigint DEFAULT 0 NOT NULL,
	"primeiro_vencimento" date,
	"total_centavos" bigint NOT NULL,
	"validade" date,
	"situacao" "situacao_proposta" DEFAULT 'aberta' NOT NULL,
	"observacao" varchar(500),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "divida_renegociacao" ADD CONSTRAINT "divida_renegociacao_acordo_id_divida_id_fk" FOREIGN KEY ("acordo_id") REFERENCES "public"."divida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida_renegociacao" ADD CONSTRAINT "divida_renegociacao_original_id_divida_id_fk" FOREIGN KEY ("original_id") REFERENCES "public"."divida"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida_renegociacao" ADD CONSTRAINT "divida_renegociacao_negociacao_id_negociacao_id_fk" FOREIGN KEY ("negociacao_id") REFERENCES "public"."negociacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negociacao" ADD CONSTRAINT "negociacao_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negociacao" ADD CONSTRAINT "negociacao_acordo_id_divida_id_fk" FOREIGN KEY ("acordo_id") REFERENCES "public"."divida"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negociacao_divida" ADD CONSTRAINT "negociacao_divida_negociacao_id_negociacao_id_fk" FOREIGN KEY ("negociacao_id") REFERENCES "public"."negociacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negociacao_divida" ADD CONSTRAINT "negociacao_divida_divida_id_divida_id_fk" FOREIGN KEY ("divida_id") REFERENCES "public"."divida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negociacao_proposta" ADD CONSTRAINT "negociacao_proposta_negociacao_id_negociacao_id_fk" FOREIGN KEY ("negociacao_id") REFERENCES "public"."negociacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "divida_renegociacao_unico" ON "divida_renegociacao" USING btree ("acordo_id","original_id");--> statement-breakpoint
CREATE INDEX "divida_renegociacao_original_idx" ON "divida_renegociacao" USING btree ("original_id");--> statement-breakpoint
CREATE INDEX "negociacao_contato_idx" ON "negociacao" USING btree ("contato_id");--> statement-breakpoint
CREATE INDEX "negociacao_situacao_idx" ON "negociacao" USING btree ("situacao");--> statement-breakpoint
CREATE UNIQUE INDEX "negociacao_divida_unico" ON "negociacao_divida" USING btree ("negociacao_id","divida_id");--> statement-breakpoint
CREATE INDEX "negociacao_divida_divida_idx" ON "negociacao_divida" USING btree ("divida_id");--> statement-breakpoint
CREATE INDEX "negociacao_proposta_negociacao_idx" ON "negociacao_proposta" USING btree ("negociacao_id");