-- Para viagem por item: fica na conta da mesa e chega marcado na cozinha.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f9', 'garcom@viagem.teste');
insert into public.brands (id, slug, name, status) values
  ('1a000000-0000-4000-8000-000000000001', 'marca-viagem', 'Marca Viagem', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('2a000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('3a000000-0000-4000-8000-000000000001', '2a000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000001', 'viagem', 'Lanchonete', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('3a000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000f9', 'garcom');
insert into public.categories (id, restaurant_id, name) values
  ('4a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001', 'Lanches');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('5a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', 'X-Burguer', 2000);
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.5' from public.stations s where s.restaurant_id = '3a000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f9", "role": "authenticated"}';

-- Mesa 4: um lanche para comer e um para levar, na mesma rodada
create temp table r1 on commit drop as
select * from public.criar_pedido('3a000000-0000-4000-8000-000000000001', 'mesa', 'mesa', '4',
  '[{"product_id": "5a000000-0000-4000-8000-000000000001", "quantidade": 1},
    {"product_id": "5a000000-0000-4000-8000-000000000001", "quantidade": 1, "para_viagem": true}]');
select is(
  (select array_agg(to_go order by to_go) from public.order_items where order_id = (select id from r1)),
  array[false, true], 'um item para comer aqui e outro para viagem');
select is(
  (select subtotal_cents from public.tabs where id = (select conta_id from r1)), 4000,
  'os dois ficam na conta da mesa');
select is(
  (select count(*)::int from public.print_jobs j, jsonb_array_elements(j.payload -> 'itens') item
    where j.order_id = (select id from r1) and (item ->> 'para_viagem')::boolean),
  1, 'o ticket da cozinha leva a marca do item para viagem');

-- Mesa 4 de novo, só para viagem: soma na mesma conta
create temp table r2 on commit drop as
select * from public.criar_pedido('3a000000-0000-4000-8000-000000000001', 'mesa', 'mesa', '4',
  '[{"product_id": "5a000000-0000-4000-8000-000000000001", "quantidade": 2, "para_viagem": true}]');
select is((select conta_id from r2), (select conta_id from r1), 'pedido só para viagem segue na conta da mesa');

-- Para viagem e delivery: tudo embalado, mesmo sem marcar
create temp table v on commit drop as
select * from public.criar_pedido('3a000000-0000-4000-8000-000000000001', 'retirada', 'senha', null,
  '[{"product_id": "5a000000-0000-4000-8000-000000000001", "quantidade": 1}]');
select is(
  (select bool_and(to_go) from public.order_items where order_id = (select id from v)), true,
  'pedido para viagem sai todo embalado');
select is(
  (select bool_or(to_go) from public.order_items where order_id = (select id from r1) and to_go = false), false,
  'item de mesa sem marca continua para comer aqui');

select * from finish();
rollback;
