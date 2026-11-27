CREATE TABLE "plano_ajuste" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano_id" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"motivo" text NOT NULL,
	"proposta" jsonb NOT NULL,
	"situacao" varchar(10) DEFAULT 'pendente' NOT NULL,
	"opcao" varchar(10),
	"decidido_em" timestamp with time zone,
	"plano_novo_id" integer
);
--> statement-breakpoint
CREATE TABLE "plano_quitacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(80) NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"plano_anterior_id" integer,
	"situacao" varchar(12) DEFAULT 'ativo' NOT NULL,
	"estrategia" varchar(20) NOT NULL,
	"valor_mensal_centavos" bigint,
	"reserva_minima_centavos" bigint DEFAULT 0 NOT NULL,
	"inicio" date NOT NULL,
	"parametros" jsonb NOT NULL,
	"aprovado_em" timestamp with time zone,
	"encerrado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plano_quitacao_mes" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano_id" integer NOT NULL,
	"competencia" date NOT NULL,
	"divida_id" integer NOT NULL,
	"planejado_centavos" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plano_ajuste" ADD CONSTRAINT "plano_ajuste_plano_id_plano_quitacao_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano_quitacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_ajuste" ADD CONSTRAINT "plano_ajuste_plano_novo_id_plano_quitacao_id_fk" FOREIGN KEY ("plano_novo_id") REFERENCES "public"."plano_quitacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_quitacao" ADD CONSTRAINT "plano_quitacao_plano_anterior_id_plano_quitacao_id_fk" FOREIGN KEY ("plano_anterior_id") REFERENCES "public"."plano_quitacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_quitacao_mes" ADD CONSTRAINT "plano_quitacao_mes_plano_id_plano_quitacao_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano_quitacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_quitacao_mes" ADD CONSTRAINT "plano_quitacao_mes_divida_id_divida_id_fk" FOREIGN KEY ("divida_id") REFERENCES "public"."divida"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plano_ajuste_plano_idx" ON "plano_ajuste" USING btree ("plano_id","situacao");--> statement-breakpoint
CREATE INDEX "plano_quitacao_situacao_idx" ON "plano_quitacao" USING btree ("situacao");--> statement-breakpoint
CREATE UNIQUE INDEX "plano_quitacao_mes_unico" ON "plano_quitacao_mes" USING btree ("plano_id","competencia","divida_id");--> statement-breakpoint
CREATE INDEX "plano_quitacao_mes_divida_idx" ON "plano_quitacao_mes" USING btree ("divida_id");