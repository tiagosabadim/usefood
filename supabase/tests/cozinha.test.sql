-- Tela da cozinha: cada praça marca a sua parte; o pedido só fica pronto quando todas terminam.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'cozinha@kds.teste'),
  ('00000000-0000-4000-8000-0000000000c2', 'garcom@kds.teste'),
  ('00000000-0000-4000-8000-0000000000c3', 'cozinha.b@kds.teste');
insert into public.brands (id, slug, name, status) values
  ('17000000-0000-4000-8000-000000000001', 'marca-kds', 'Marca KDS', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('27000000-0000-4000-8000-00000000000a', '17000000-0000-4000-8000-000000000001', 'Org A'),
  ('27000000-0000-4000-8000-00000000000b', '17000000-0000-4000-8000-000000000001', 'Org B');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('37000000-0000-4000-8000-00000000000a', '27000000-0000-4000-8000-00000000000a', '17000000-0000-4000-8000-000000000001', 'kds-a', 'Bar A', 'ativo'),
  ('37000000-0000-4000-8000-00000000000b', '27000000-0000-4000-8000-00000000000b', '17000000-0000-4000-8000-000000000001', 'kds-b', 'Bar B', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('37000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000c1', 'cozinha'),
  ('37000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000c2', 'garcom'),
  ('37000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000c3', 'cozinha');
insert into public.stations (id, restaurant_id, name) values
  ('77000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-00000000000a', 'Bar');
insert into public.categories (id, restaurant_id, name) values
  ('47000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-00000000000a', 'Tudo');
insert into public.products (id, restaurant_id, category_id, name, price_cents, station_id) values
  ('57000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-00000000000a', '47000000-0000-4000-8000-000000000001', 'Porção', 3600, null),
  ('57000000-0000-4000-8000-000000000002', '37000000-0000-4000-8000-00000000000a', '47000000-0000-4000-8000-000000000001', 'Caipirinha', 2000, '77000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c2", "role": "authenticated"}';
create temp table p on commit drop as
select * from public.criar_pedido('37000000-0000-4000-8000-00000000000a', 'mesa', 'mesa', '7',
  '[{"product_id": "57000000-0000-4000-8000-000000000001", "quantidade": 1},
    {"product_id": "57000000-0000-4000-8000-000000000002", "quantidade": 2}]');
create temp table cozinha on commit drop as
select id from public.stations where restaurant_id = '37000000-0000-4000-8000-00000000000a' and name = 'Cozinha';

select throws_ok(
  format($$ select public.marcar_entregue(%L) $$, (select id from p)),
  'P0001', null, 'pedido em preparo não pode ser entregue');

-- Cozinha marca a parte dela
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}';
select is(
  public.marcar_pronto((select id from p), (select id from cozinha)), 'em_preparo'::public.order_status,
  'cozinha pronta, mas o Bar ainda não: pedido segue em preparo');
select is(
  (select count(*)::int from public.order_items where order_id = (select id from p) and prepared_at is not null),
  1, 'só o item da Cozinha ficou pronto');
select is(
  public.marcar_pronto((select id from p), '77000000-0000-4000-8000-000000000001'), 'pronto'::public.order_status,
  'Bar termina e o pedido inteiro fica pronto');
select isnt((select ready_at from public.orders where id = (select id from p)), null, 'hora em que ficou pronto registrada');

-- Desfazer e refazer
select is(
  public.desfazer_pronto((select id from p), '77000000-0000-4000-8000-000000000001'), 'em_preparo'::public.order_status,
  'desfazer o Bar volta o pedido para em preparo');
select is(
  public.marcar_pronto((select id from p), null), 'pronto'::public.order_status,
  'marcar sem praça termina tudo');

-- Cozinha de outra loja não mexe
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c3", "role": "authenticated"}';
select throws_ok(
  format($$ select public.marcar_pronto(%L, null) $$, (select id from p)),
  '42501', null, 'outra loja não marca pronto');

-- Garçom entrega
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c2", "role": "authenticated"}';
select is(public.marcar_entregue((select id from p)), 'concluido'::public.order_status, 'garçom marca como entregue');
select throws_ok(
  format($$ select public.marcar_pronto(%L, null) $$, (select id from p)),
  'P0001', null, 'pedido entregue não volta para a cozinha');

select * from finish();
rollback;
