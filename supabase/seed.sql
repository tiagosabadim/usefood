-- Dados de desenvolvimento: duas marcas, seus domínios, uma loja ativa em cada
-- e uma loja com domínio próprio.
-- Roda em `pnpm db:reset`. Nunca é aplicado em homologação ou produção.

insert into public.brands (id, slug, name, status, is_franchise, theme) values
  ('b0000000-0000-4000-8000-000000000001', 'usefood', 'usefood', 'ativa', false,
   '{}'),
  ('b0000000-0000-4000-8000-000000000002', 'guapifood', 'guapifood', 'ativa', true,
   '{"light": {"brand": "#b4441b", "brand-ink": "#ffffff", "brand-soft": "#fbe9e2", "brand-text": "#a53c15"},
     "dark": {"brand": "#ff8a5c", "brand-ink": "#1a0a04", "brand-soft": "#3a1d12", "brand-text": "#ff9f7a"}}');

insert into public.domains (brand_id, hostname, is_primary, status) values
  ('b0000000-0000-4000-8000-000000000001', 'usefood.com.br', true, 'ativo'),
  ('b0000000-0000-4000-8000-000000000001', 'usefood.localhost', false, 'ativo'),
  ('b0000000-0000-4000-8000-000000000002', 'guapifood.com.br', true, 'ativo'),
  ('b0000000-0000-4000-8000-000000000002', 'guapifood.localhost', false, 'ativo');

insert into public.territories (brand_id, name) values
  ('b0000000-0000-4000-8000-000000000002', 'Guapiaçu - SP');

insert into public.organizations (id, brand_id, name) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Lanchoneteria'),
  ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Sabor da Praça');

insert into public.restaurants (organization_id, brand_id, slug, name, status) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'lanchoneteria', 'Lanchoneteria', 'ativo'),
  ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
   'sabor-da-praca', 'Sabor da Praça', 'ativo');

-- Loja com domínio próprio: lanchoneteria.localhost abre direto na loja
insert into public.domains (brand_id, kind, restaurant_id, hostname, status)
select brand_id, 'loja', id, 'lanchoneteria.localhost', 'ativo'
from public.restaurants where slug = 'lanchoneteria';
