CREATE TABLE "consultor_assunto" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(80) NOT NULL,
	"situacao" varchar(12) DEFAULT 'aberto' NOT NULL,
	"divida_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultor_mensagem" (
	"id" serial PRIMARY KEY NOT NULL,
	"assunto_id" integer NOT NULL,
	"autor" varchar(10) NOT NULL,
	"texto" text NOT NULL,
	"dados" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultor_assunto" ADD CONSTRAINT "consultor_assunto_divida_id_divida_id_fk" FOREIGN KEY ("divida_id") REFERENCES "public"."divida"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultor_mensagem" ADD CONSTRAINT "consultor_mensagem_assunto_id_consultor_assunto_id_fk" FOREIGN KEY ("assunto_id") REFERENCES "public"."consultor_assunto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consultor_assunto_situacao_idx" ON "consultor_assunto" USING btree ("situacao","atualizado_em");--> statement-breakpoint
CREATE INDEX "consultor_mensagem_assunto_idx" ON "consultor_mensagem" USING btree ("assunto_id","criado_em");