CREATE TYPE "public"."acao_auditoria" AS ENUM('cadastrou', 'alterou', 'ativou', 'inativou', 'excluiu');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"tela" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" integer,
	"acao" "acao_auditoria" NOT NULL,
	"descricao" text NOT NULL,
	"dados" jsonb
);
--> statement-breakpoint
ALTER TABLE "conta_financeira" ADD COLUMN "saldo_inicial_centavos" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conta_financeira" ADD COLUMN "saldo_inicial_data" date;--> statement-breakpoint
CREATE INDEX "auditoria_quando_idx" ON "auditoria" USING btree ("quando");--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "auditoria" USING btree ("entidade","entidade_id");