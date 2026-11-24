-- Carga inicial (Fase 0): bancos, formas de pagamento, feriados, categorias e parâmetros.
-- Roda uma única vez, como as outras migrações.
insert into banco (codigo, nome, padrao_sistema) values
  (null, 'Outro', true),
  ('001', 'Banco do Brasil', true),
  ('033', 'Santander', true),
  ('041', 'Banrisul', true),
  ('077', 'Banco Inter', true),
  ('104', 'Caixa Econômica Federal', true),
  ('208', 'BTG Pactual', true),
  ('212', 'Banco Original', true),
  ('237', 'Bradesco', true),
  ('260', 'Nubank', true),
  ('290', 'PagBank', true),
  ('323', 'Mercado Pago', true),
  ('336', 'C6 Bank', true),
  ('341', 'Itaú', true),
  ('380', 'PicPay', true),
  ('102', 'XP Investimentos', true),
  ('748', 'Sicredi', true),
  ('756', 'Sicoob', true);
--> statement-breakpoint
insert into forma_pagamento (descricao, sigla, padrao_sistema) values
  ('Boleto Bancário', 'BO', true),
  ('Cartão de Crédito', 'CC', true),
  ('Dinheiro', 'DN', true),
  ('Pix', 'PX', true),
  ('Transferência', 'TR', true);
--> statement-breakpoint
insert into feriado (nome, dia, mes, ano, recorrente, padrao_sistema) values
  ('Ano Novo', 1, 1, null, true, true),
  ('Tiradentes', 21, 4, null, true, true),
  ('Dia do Trabalhador', 1, 5, null, true, true),
  ('Independência do Brasil', 7, 9, null, true, true),
  ('Nossa Senhora Aparecida', 12, 10, null, true, true),
  ('Natal', 25, 12, null, true, true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, especial, padrao_sistema) values
  ('Acerto de Saldo', 0, '#9CA3AF', 'despesa', 'acerto_saldo', true),
  ('Cartão de Crédito', 0, '#9CA3AF', 'despesa', 'cartao_credito', true),
  ('Transferência', 0, '#9CA3AF', 'despesa', 'transferencia', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Receita', 1, '#16A34A', 'receita', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Aluguel', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 1, 'receita', true),
  ('Salário', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 2, 'receita', true),
  ('Pensão', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 3, 'receita', true),
  ('Hora Extra', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 4, 'receita', true),
  ('13º Salário', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 5, 'receita', true),
  ('Férias', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 6, 'receita', true),
  ('Rendimento', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 7, 'receita', true),
  ('Outro', (select id from categoria where nome = 'Receita' and categoria_pai_id is null and especial is null), 8, 'receita', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Alimentação', 2, '#DC2626', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Restaurante', (select id from categoria where nome = 'Alimentação' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Supermercado', (select id from categoria where nome = 'Alimentação' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Feira', (select id from categoria where nome = 'Alimentação' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Padaria', (select id from categoria where nome = 'Alimentação' and categoria_pai_id is null and especial is null), 4, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Moradia', 3, '#7C3AED', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Aluguel', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Condomínio', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Limpeza', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Energia', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 4, 'despesa', true),
  ('Água', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 5, 'despesa', true),
  ('Gás', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 6, 'despesa', true),
  ('Telefone', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 7, 'despesa', true),
  ('Internet', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 8, 'despesa', true),
  ('Manutenção', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 9, 'despesa', true),
  ('Imposto', (select id from categoria where nome = 'Moradia' and categoria_pai_id is null and especial is null), 10, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Saúde', 4, '#0891B2', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Plano de Saúde', (select id from categoria where nome = 'Saúde' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Medicamento', (select id from categoria where nome = 'Saúde' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Médico', (select id from categoria where nome = 'Saúde' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Dentista', (select id from categoria where nome = 'Saúde' and categoria_pai_id is null and especial is null), 4, 'despesa', true),
  ('Hospital', (select id from categoria where nome = 'Saúde' and categoria_pai_id is null and especial is null), 5, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Cuidado Pessoal', 5, '#DB2777', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Academia', (select id from categoria where nome = 'Cuidado Pessoal' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Clube', (select id from categoria where nome = 'Cuidado Pessoal' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Esteticista', (select id from categoria where nome = 'Cuidado Pessoal' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Cabeleireiro', (select id from categoria where nome = 'Cuidado Pessoal' and categoria_pai_id is null and especial is null), 4, 'despesa', true),
  ('Manicure', (select id from categoria where nome = 'Cuidado Pessoal' and categoria_pai_id is null and especial is null), 5, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Lazer', 6, '#F59E0B', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Viagem', (select id from categoria where nome = 'Lazer' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Cinema', (select id from categoria where nome = 'Lazer' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Teatro', (select id from categoria where nome = 'Lazer' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Pizzaria', (select id from categoria where nome = 'Lazer' and categoria_pai_id is null and especial is null), 4, 'despesa', true),
  ('Bar', (select id from categoria where nome = 'Lazer' and categoria_pai_id is null and especial is null), 5, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Vestuário', 7, '#4F46E5', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Roupa', (select id from categoria where nome = 'Vestuário' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Calçado', (select id from categoria where nome = 'Vestuário' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Acessório', (select id from categoria where nome = 'Vestuário' and categoria_pai_id is null and especial is null), 3, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Educação', 8, '#0D9488', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Curso', (select id from categoria where nome = 'Educação' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Faculdade', (select id from categoria where nome = 'Educação' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Escola', (select id from categoria where nome = 'Educação' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Material', (select id from categoria where nome = 'Educação' and categoria_pai_id is null and especial is null), 4, 'despesa', true),
  ('Uniforme', (select id from categoria where nome = 'Educação' and categoria_pai_id is null and especial is null), 5, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Transporte', 9, '#92400E', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Metrô', (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Ônibus', (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Táxi/Motorista', (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Veículo', (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null), 4, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Combustível', (select id from categoria where nome = 'Veículo' and categoria_pai_id = (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null)), 1, 'despesa', true),
  ('Estacionamento', (select id from categoria where nome = 'Veículo' and categoria_pai_id = (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null)), 2, 'despesa', true),
  ('Seguro', (select id from categoria where nome = 'Veículo' and categoria_pai_id = (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null)), 3, 'despesa', true),
  ('Limpeza', (select id from categoria where nome = 'Veículo' and categoria_pai_id = (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null)), 4, 'despesa', true),
  ('Manutenção', (select id from categoria where nome = 'Veículo' and categoria_pai_id = (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null)), 5, 'despesa', true),
  ('Imposto', (select id from categoria where nome = 'Veículo' and categoria_pai_id = (select id from categoria where nome = 'Transporte' and categoria_pai_id is null and especial is null)), 6, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Animal de Estimação', 10, '#65A30D', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Alimentação', (select id from categoria where nome = 'Animal de Estimação' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Pet Shop', (select id from categoria where nome = 'Animal de Estimação' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Veterinário', (select id from categoria where nome = 'Animal de Estimação' and categoria_pai_id is null and especial is null), 3, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Investimento', 11, '#1D6CE0', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Ação', (select id from categoria where nome = 'Investimento' and categoria_pai_id is null and especial is null), 1, 'despesa', true),
  ('Renda Fixa', (select id from categoria where nome = 'Investimento' and categoria_pai_id is null and especial is null), 2, 'despesa', true),
  ('Fundo Imobiliário', (select id from categoria where nome = 'Investimento' and categoria_pai_id is null and especial is null), 3, 'despesa', true),
  ('Previdência Privada', (select id from categoria where nome = 'Investimento' and categoria_pai_id is null and especial is null), 4, 'despesa', true),
  ('Outro', (select id from categoria where nome = 'Investimento' and categoria_pai_id is null and especial is null), 5, 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, ordem, cor, natureza, padrao_sistema) values ('Outro', 12, '#64748B', 'despesa', true);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema) values
  ('Presente', (select id from categoria where nome = 'Outro' and categoria_pai_id is null and especial is null), 1, 'despesa', true);
--> statement-breakpoint
insert into configuracao (chave, valor, padrao_sistema) values
  ('titulo', '"Gui"'::jsonb, true),
  ('logotipo_url', 'null'::jsonb, true),
  ('categorias.exibir_cores', 'true'::jsonb, true),
  ('categorias.exibir_numeracao', 'true'::jsonb, true),
  ('novo_ou_atualizado_horas', '24'::jsonb, true),
  ('previsao_recorrente_dias', '360'::jsonb, true),
  ('fatura.considerar_previstos', 'false'::jsonb, true),
  ('realizar_automatico.quando', '"no_vencimento"'::jsonb, true),
  ('pagamento_parcial.ativo', 'false'::jsonb, true),
  ('campos.data_referencia', 'false'::jsonb, true),
  ('campos.documento', 'true'::jsonb, true),
  ('campos.observacao', 'true'::jsonb, true),
  ('campos.anexos', 'true'::jsonb, true),
  ('recursos.cartoes', 'true'::jsonb, true),
  ('recursos.recorrentes', 'true'::jsonb, true),
  ('recursos.categorias', 'true'::jsonb, true),
  ('recursos.formas_pagamento', 'true'::jsonb, true),
  ('recursos.contatos', 'true'::jsonb, true),
  ('recursos.tags', 'true'::jsonb, true),
  ('recursos.orcamentos', 'true'::jsonb, true),
  ('recursos.importacao', 'true'::jsonb, true),
  ('recursos.exportacao', 'true'::jsonb, true),
  ('recursos.impressao', 'true'::jsonb, true),
  ('visao_geral.vencidos_dias', '7'::jsonb, true),
  ('visao_geral.futuro_dias', '7'::jsonb, true),
  ('visao_geral.despesas_categorias_dias', '28'::jsonb, true),
  ('listagem.destacar_linhas_pares', 'true'::jsonb, true),
  ('listagem.compactar_linhas', 'false'::jsonb, true),
  ('sessao.minutos', '20'::jsonb, true);
