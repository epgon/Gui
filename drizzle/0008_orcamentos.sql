CREATE TABLE "orcamento_categoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"categoria_id" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_categoria_categoria_id_unique" UNIQUE("categoria_id")
);
--> statement-breakpoint
CREATE TABLE "orcamento_limite" (
	"id" serial PRIMARY KEY NOT NULL,
	"categoria_id" integer NOT NULL,
	"competencia" date NOT NULL,
	"valor_centavos" bigint,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orcamento_categoria" ADD CONSTRAINT "orcamento_categoria_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_limite" ADD CONSTRAINT "orcamento_limite_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orcamento_limite_categoria_mes_idx" ON "orcamento_limite" USING btree ("categoria_id","competencia");