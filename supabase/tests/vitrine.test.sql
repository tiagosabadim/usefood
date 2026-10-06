-- Vitrine do app de delivery: cidades, lojas da cidade, horário e busca por prato.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.brands (id, slug, name, status) values
  ('1c000000-0000-4000-8000-000000000001', 'marca-vitrine', 'Marca Vitrine', 'ativa'),
  ('1c000000-0000-4000-8000-000000000002', 'outra-marca', 'Outra', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('2c000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001', 'Org'),
  ('2c000000-0000-4000-8000-000000000002', '1c000000-0000-4000-8000-000000000002', 'Org 2');
-- Duas lojas publicadas em São José do Rio Preto, uma em rascunho, uma de outra marca
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, city, state, district,
                                delivery_fee_mode, accepts_delivery, cuisines, location) values
  ('3c000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001',
   'lanche-bom', 'Lanche Bom', 'ativo', 'São José do Rio Preto', 'SP', 'Centro', 'bairro', true, '{lanches}',
   extensions.st_setsrid(extensions.st_makepoint(-49.38, -20.81), 4326)::extensions.geography),
  ('3c000000-0000-4000-8000-000000000002', '2c000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001',
   'pizza-noite', 'Pizza da Noite', 'ativo', 'Sao Jose do Rio Preto', 'SP', 'Redentora', 'gratis', true, '{pizza}',
   extensions.st_setsrid(extensions.st_makepoint(-49.39, -20.82), 4326)::extensions.geography),
  ('3c000000-0000-4000-8000-000000000003', '2c000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001',
   'rascunho', 'Ainda não', 'rascunho', 'São José do Rio Preto', 'SP', null, 'gratis', true, '{}', null),
  ('3c000000-0000-4000-8000-000000000004', '2c000000-0000-4000-8000-000000000002', '1c000000-0000-4000-8000-000000000002',
   'outra', 'Outra Marca', 'ativo', 'São José do Rio Preto', 'SP', null, 'gratis', true, '{}', null);
insert into public.delivery_districts (restaurant_id, name, fee_cents) values
  ('3c000000-0000-4000-8000-000000000001', 'Centro', 500), ('3c000000-0000-4000-8000-000000000001', 'Boa Vista', 800);
-- Lanche Bom: aberto o dia todo, todos os dias; Pizza da Noite: só às 23:59 de segunda
insert into public.opening_hours (restaurant_id, weekday, opens, closes)
  select '3c000000-0000-4000-8000-000000000001', d, '00:00', '23:59:59' from generate_series(0, 6) d;
insert into public.opening_hours (restaurant_id, weekday, opens, closes) values
  ('3c000000-0000-4000-8000-000000000002', 1, '23:59', '23:59:30');
insert into public.categories (id, restaurant_id, name) values
  ('4c000000-0000-4000-8000-000000000001', '3c000000-0000-4000-8000-000000000001', 'Lanches');
insert into public.products (restaurant_id, category_id, name, description, price_cents) values
  ('3c000000-0000-4000-8000-000000000001', '4c000000-0000-4000-8000-000000000001', 'X-Salada Especial', 'Pão, hambúrguer e salada', 2500),
  ('3c000000-0000-4000-8000-000000000001', '4c000000-0000-4000-8000-000000000001', 'Batata', 'Porção com salada de maionese', 1800);

set local role anon;

select is(private.slug_da_cidade('São José do Rio Preto', 'SP'), 'sao-jose-do-rio-preto-sp', 'cidade vira endereço sem acento');
select is(
  (select lojas from public.vitrine_cidades('marca-vitrine') where slug = 'sao-jose-do-rio-preto-sp'), 2,
  'conta só as lojas publicadas da marca, juntando a cidade escrita com e sem acento');
select is((select count(*)::int from public.vitrine_cidades('outra-marca')), 1, 'outra marca tem a própria vitrine');
select is(
  (select array_agg(slug order by slug) from public.vitrine_da_cidade('marca-vitrine', 'sao-jose-do-rio-preto-sp')),
  array['lanche-bom', 'pizza-noite'], 'lojas da cidade: publicadas e da marca');
select is(
  (select slug from public.vitrine_da_cidade('marca-vitrine', 'sao-jose-do-rio-preto-sp') limit 1), 'lanche-bom',
  'abertas primeiro');
select is(
  (select taxa_minima_cents from public.vitrine_da_cidade('marca-vitrine', 'sao-jose-do-rio-preto-sp') where slug = 'lanche-bom'), 500,
  'entrega por bairro mostra a menor taxa');
select is(
  (select abre_as from public.vitrine_da_cidade('marca-vitrine', 'sao-jose-do-rio-preto-sp') where slug = 'pizza-noite'), '23:59'::time,
  'loja fechada diz quando abre');
select is(
  (select count(*)::int from public.vitrine_buscar('marca-vitrine', 'sao-jose-do-rio-preto-sp', 'SALADA')), 2,
  'busca por prato no nome e na descrição, sem diferenciar maiúscula');
select is(
  (select count(*)::int from public.vitrine_buscar('marca-vitrine', 'sao-jose-do-rio-preto-sp', 'x')), 0,
  'busca com menos de 2 letras não traz nada');
select is(
  (select cozinhas from public.vitrine_da_cidade('marca-vitrine', 'sao-jose-do-rio-preto-sp') where slug = 'pizza-noite'),
  '{pizza}'::public.cuisine_type[], 'tipo de cozinha vem no cartão');

select * from finish();
rollback;
