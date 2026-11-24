ALTER TABLE "preferencia_listagem" ADD COLUMN "destacar_pares" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "preferencia_listagem" ADD COLUMN "compactar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Fase 11: os parâmetros passam a valer. Para nada sumir de repente, ficam como o sistema já funcionava
-- (pagamento parcial e Data de Referência ligados), a não ser que já tenham sido alterados.
update configuracao set valor = 'true'::jsonb where chave in ('pagamento_parcial.ativo', 'campos.data_referencia') and atualizado_em = criado_em;
--> statement-breakpoint
insert into configuracao (chave, valor, padrao_sistema) values ('recursos.agenda', 'true'::jsonb, true) on conflict (chave) do nothing;
