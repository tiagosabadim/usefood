-- E04 · Cardápio: cada loja só mexe no próprio cardápio; a vitrine só vê o que está ativo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'dono.a@cardapio.teste'),
  ('00000000-0000-4000-8000-0000000000a2', 'gerente.a@cardapio.teste'),
  ('00000000-0000-4000-8000-0000000000a3', 'garcom.a@cardapio.teste'),
  ('00000000-0000-4000-8000-0000000000b1', 'dono.b@cardapio.teste');

insert into public.brands (id, slug, name, status) values
  ('11000000-0000-4000-8000-000000000001', 'marca-cardapio', 'Marca Cardápio', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('21000000-0000-4000-8000-00000000000a', '11000000-0000-4000-8000-000000000001', 'Org A'),
  ('21000000-0000-4000-8000-00000000000b', '11000000-0000-4000-8000-000000000001', 'Org B');
-- Loja A em cadastro, loja B no ar
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('31000000-0000-4000-8000-00000000000a', '21000000-0000-4000-8000-00000000000a',
   '11000000-0000-4000-8000-000000000001', 'cardapio-a', 'Loja A', 'rascunho'),
  ('31000000-0000-4000-8000-00000000000b', '21000000-0000-4000-8000-00000000000b',
   '11000000-0000-4000-8000-000000000001', 'cardapio-b', 'Loja B', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('31000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'dono'),
  ('31000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'gerente'),
  ('31000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 'garcom'),
  ('31000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'dono');

-- Cardápio da loja B (no ar): um produto ativo e um pausado
insert into public.categories (id, restaurant_id, name) values
  ('41000000-0000-4000-8000-00000000000b', '31000000-0000-4000-8000-00000000000b', 'Lanches');
insert into public.products (restaurant_id, category_id, name, price_cents, is_active) values
  ('31000000-0000-4000-8000-00000000000b', '41000000-0000-4000-8000-00000000000b', 'X-Burguer', 2200, true),
  ('31000000-0000-4000-8000-00000000000b', '41000000-0000-4000-8000-00000000000b', 'X-Salada', 2400, false);

select is(
  (select name from public.stations where restaurant_id = '31000000-0000-4000-8000-00000000000a'),
  'Cozinha', 'toda loja nasce com a praça Cozinha');

-- Dono da loja A
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.categories (id, restaurant_id, name) values
     ('41000000-0000-4000-8000-00000000000a', '31000000-0000-4000-8000-00000000000a', 'Pastéis') $$,
  'dono cria categoria');
select lives_ok(
  $$ insert into public.products (id, restaurant_id, category_id, name, price_cents) values
     ('51000000-0000-4000-8000-00000000000a', '31000000-0000-4000-8000-00000000000a',
      '41000000-0000-4000-8000-00000000000a', 'Pastel de carne', 1400) $$,
  'dono cria produto');
select throws_ok(
  $$ insert into public.products (restaurant_id, category_id, name, price_cents) values
     ('31000000-0000-4000-8000-00000000000a', '41000000-0000-4000-8000-00000000000a', 'Errado', -1) $$,
  '23514', null, 'preço negativo é recusado');
select is(
  private.pode_editar_arquivo_do_cardapio('31000000-0000-4000-8000-00000000000a/pastel.jpg'),
  true, 'dono pode enviar foto na pasta da própria loja');

-- Garçom da loja A: vê, não edita
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated"}';
select is(
  (select count(*)::int from public.products where restaurant_id = '31000000-0000-4000-8000-00000000000a'),
  1, 'garçom vê o cardápio da loja');
select throws_ok(
  $$ insert into public.categories (restaurant_id, name) values
     ('31000000-0000-4000-8000-00000000000a', 'Bebidas') $$,
  '42501', null, 'garçom não cria categoria');
select is(
  private.pode_editar_arquivo_do_cardapio('31000000-0000-4000-8000-00000000000a/pastel.jpg'),
  false, 'garçom não envia foto');

-- Gerente da loja A: edita
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated"}';
update public.products set price_cents = 1500 where id = '51000000-0000-4000-8000-00000000000a';
select is(
  (select price_cents from public.products where id = '51000000-0000-4000-8000-00000000000a'),
  1500, 'gerente muda o preço');

-- Dono da loja B: não enxerga nem usa nada da loja A
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}';
select is(
  (select count(*)::int from public.products where restaurant_id = '31000000-0000-4000-8000-00000000000a'),
  0, 'outra loja não vê o cardápio da loja A');
select throws_ok(
  $$ insert into public.products (restaurant_id, category_id, name, price_cents) values
     ('31000000-0000-4000-8000-00000000000b', '41000000-0000-4000-8000-00000000000a', 'Intruso', 100) $$,
  '23503', null, 'produto não pode usar categoria de outra loja');
select is(
  private.pode_editar_arquivo_do_cardapio('31000000-0000-4000-8000-00000000000a/pastel.jpg'),
  false, 'outra loja não envia foto na pasta da loja A');
select is(
  private.pode_editar_arquivo_do_cardapio('../qualquer/coisa.jpg'),
  false, 'caminho fora do padrão é recusado');

-- Visitante
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select count(*)::int from public.products where restaurant_id = '31000000-0000-4000-8000-00000000000a'),
  0, 'visitante não vê cardápio de loja em cadastro');
select is(
  (select array_agg(name order by name) from public.products where restaurant_id = '31000000-0000-4000-8000-00000000000b'),
  array['X-Burguer'], 'visitante vê só os produtos ativos de loja no ar');

select * from finish();
rollback;
