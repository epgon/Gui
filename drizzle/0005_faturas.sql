ALTER TYPE "public"."acao_auditoria" ADD VALUE 'pagou';--> statement-breakpoint
ALTER TABLE "lancamento" ADD COLUMN "fatura_paga_id" integer;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_fatura_paga_id_fatura_id_fk" FOREIGN KEY ("fatura_paga_id") REFERENCES "public"."fatura"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamento_fatura_paga_idx" ON "lancamento" USING btree ("fatura_paga_id");