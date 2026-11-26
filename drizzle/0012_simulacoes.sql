CREATE TABLE "simulacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(80) NOT NULL,
	"modo" varchar(20) NOT NULL,
	"parametros" jsonb NOT NULL,
	"resumo" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
