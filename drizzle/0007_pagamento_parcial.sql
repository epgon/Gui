ALTER TABLE "lancamento" ADD COLUMN "valor_original_centavos" bigint;--> statement-breakpoint
ALTER TABLE "lancamento" ADD COLUMN "lancamento_origem_id" integer;--> statement-breakpoint
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_lancamento_origem_id_lancamento_id_fk" FOREIGN KEY ("lancamento_origem_id") REFERENCES "public"."lancamento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamento_origem_idx" ON "lancamento" USING btree ("lancamento_origem_id");