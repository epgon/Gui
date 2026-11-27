-- Categoria "Tecnologia" e subcategorias. Idempotente: a categoria principal só nasce se ainda não existir uma com esse nome,
-- e cada subcategoria só é criada se a principal ainda não tiver uma com o mesmo nome. Nenhuma categoria ou lançamento existente é alterado.
-- Como o sistema é de um único cadastro, esta migração também é a "semente" para bancos novos (roda depois da carga inicial).
insert into categoria (nome, ordem, cor, natureza, padrao_sistema)
select 'Tecnologia', coalesce((select max(ordem) from categoria where categoria_pai_id is null and especial is null), 0) + 1, '#0EA5E9', 'despesa', true
where not exists (select 1 from categoria where nome = 'Tecnologia' and categoria_pai_id is null and especial is null);
--> statement-breakpoint
insert into categoria (nome, categoria_pai_id, ordem, natureza, padrao_sistema)
select s.nome, c.id, s.ordem, 'despesa', true
from categoria c
cross join (values
  ('Assinaturas de Aplicativos', 1),
  ('Assinaturas de IA e Desenvolvimento', 2),
  ('Eletrônicos e Informática', 3),
  ('Periféricos e Acessórios', 4),
  ('Domínios e Hospedagem', 5),
  ('Softwares e Licenças', 6),
  ('Armazenamento em Nuvem', 7),
  ('Manutenção e Assistência Técnica', 8)
) as s(nome, ordem)
where c.nome = 'Tecnologia' and c.categoria_pai_id is null and c.especial is null
  and not exists (select 1 from categoria f where f.categoria_pai_id = c.id and f.nome = s.nome);
