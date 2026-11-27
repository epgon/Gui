CREATE TABLE "consultor_uso_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"dia" date NOT NULL,
	"chamadas" integer DEFAULT 0 NOT NULL,
	"falhas" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultor_uso_ia_dia_unique" UNIQUE("dia")
);
