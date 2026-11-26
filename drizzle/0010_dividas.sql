CREATE TYPE "public"."forma_divida" AS ENUM('parcelas_fixas', 'sem_parcelas');--> statement-breakpoint
CREATE TYPE "public"."garantia_divida" AS ENUM('nenhuma', 'bem_financiado', 'desconto_folha', 'fiador');--> statement-breakpoint
CREATE TYPE "public"."situacao_divida" AS ENUM('ativa', 'quitada', 'renegociada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_divida" AS ENUM('emprestimo_pessoal', 'consignado', 'financiamento_veiculo', 'financiamento_imovel', 'cartao', 'cheque_especial', 'crediario', 'pessoa_fisica', 'conta_atrasada', 'acordo', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento_divida" AS ENUM('cadastro', 'pagamento', 'atualizacao_saldo', 'amortizacao', 'encargo', 'renegociacao', 'quitacao', 'vinculo', 'anotacao', 'cancelamento', 'desfeito');--> statement-breakpoint
CREATE TABLE "divida" (
	"id" serial PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"contato_id" integer NOT NULL,
	"tipo" "tipo_divida" DEFAULT 'outro' NOT NULL,
	"situacao" "situacao_divida" DEFAULT 'ativa' NOT NULL,
	"forma" "forma_divida" NOT NULL,
	"valor_original_centavos" bigint,
	"data_contratacao" date,
	"taxa_mensal" numeric(8, 4),
	"multa_percentual" numeric(6, 2),
	"mora_mensal" numeric(6, 2),
	"garantia" "garantia_divida" DEFAULT 'nenhuma' NOT NULL,
	"conta_id" integer,
	"categoria_id" integer,
	"forma_pagamento_id" integer,
	"parcelamento_id" integer,
	"observacao" varchar(1000),
	"quitada_em" date,
	"encerrada_em" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divida_evento" (
	"id" serial PRIMARY KEY NOT NULL,
	"divida_id" integer NOT NULL,
	"data" date NOT NULL,
	"tipo" "tipo_evento_divida" NOT NULL,
	"valor_centavos" bigint,
	"saldo_centavos" bigint,
	"origem_saldo" text,
	"lancamento_id" integer,
	"descricao" text NOT NULL,
	"dados" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divida_vinculo" (
	"id" serial PRIMARY KEY NOT NULL,
	"divida_id" integer NOT NULL,
	"fatura_id" integer,
	"recorrencia_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "divida_vinculo_so_um" CHECK (num_nonnulls("divida_vinculo"."fatura_id", "divida_vinculo"."recorrencia_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "lancamento" ADD COLUMN "divida_id" integer;--> statement-breakpoint
ALTER TABLE "divida" ADD CONSTRAINT "divida_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida" ADD CONSTRAINT "divida_conta_id_conta_financeira_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta_financeira"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida" ADD CONSTRAINT "divida_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida" ADD CONSTRAINT "divida_forma_pagamento_id_forma_pagamento_id_fk" FOREIGN KEY ("forma_pagamento_id") REFERENCES "public"."forma_pagamento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida" ADD CONSTRAINT "divida_parcelamento_id_parcelamento_id_fk" FOREIGN KEY ("parcelamento_id") REFERENCES "public"."parcelamento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida_evento" ADD CONSTRAINT "divida_evento_divida_id_divida_id_fk" FOREIGN KEY ("divida_id") REFERENCES "public"."divida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida_evento" ADD CONSTRAINT "divida_evento_lancamento_id_lancamento_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida_vinculo" ADD CONSTRAINT "divida_vinculo_divida_id_divida_id_fk" FOREIGN KEY ("divida_id") REFERENCES "public"."divida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida_vinculo" ADD CONSTRAINT "divida_vinculo_fatura_id_fatura_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."fatura"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divida_vinculo" ADD CONSTRAINT "divida_vinculo_recorrencia_id_recorrencia_id_fk" FOREIGN KEY ("recorrencia_id") REFERENCES "public"."recorrencia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "divida_contato_idx" ON "divida" USING btree ("contato_id");--> statement-breakpoint
CREATE INDEX "divida_situacao_idx" ON "divida" USING btree ("situacao");--> statement-breakpoint
CREATE INDEX "divida_evento_divida_idx" ON "divida_evento" USING btree ("divida_id","data");--> statement-breakpoint
CREATE UNIQUE INDEX "divida_vinculo_fatura_unico" ON "divida_vinculo" USING btree ("fatura_id") WHERE "divida_vinculo"."fatura_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "divida_vinculo_recorrencia_unico" ON "divida_vinculo" USING btree ("recorrencia_id") WHERE "divida_vinculo"."recorrencia_id" is not null;--> statement-breakpoint
CREATE INDEX "divida_vinculo_divida_idx" ON "divida_vinculo" USING btree ("divida_id");--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_divida_id_divida_id_fk" FOREIGN KEY ("divida_id") REFERENCES "public"."divida"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamento_divida_idx" ON "lancamento" USING btree ("divida_id");--> statement-breakpoint
-- Gestão de Dívidas: a categoria "Dívidas" (13.1 Parcelas de Dívidas e 13.2 Juros e Encargos) só nasce se ainda não existir
-- uma categoria principal com esse nome. Nenhuma categoria existente é alterada.
insert into categoria (nome, ordem, cor, natureza, padrao_sistema)
select 'Dívidas', coalesce((select max(ordem) from categoria where categoria_pai_id is null and especial is null), 0) + 1, '#9F1239', 'despesa', true
where not exists (select 1 from categoria where nome = 'Dívidas' and categoria_pai_id is null and especial is null);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema)
select 'Parcelas de Dívidas', c.id, 1, 'despesa', true
from categoria c
where c.nome = 'Dívidas' and c.categoria_pai_id is null and c.especial is null and c.padrao_sistema
  and not exists (select 1 from categoria f where f.categoria_pai_id = c.id);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema)
select 'Juros e Encargos', c.id, 2, 'despesa', true
from categoria c
where c.nome = 'Dívidas' and c.categoria_pai_id is null and c.especial is null and c.padrao_sistema
  and (select count(*) from categoria f where f.categoria_pai_id = c.id) = 1
  and exists (select 1 from categoria f where f.categoria_pai_id = c.id and f.nome = 'Parcelas de Dívidas');
