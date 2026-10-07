-- Combos: itens com quantidade, regras e o pedido gravando a lista do combo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.brands (id, slug, name, status) values ('1f000000-0000-4000-8000-000000000001', 'marca-combo', 'Marca', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2f000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, city, state, accepts_delivery, accepts_pickup, delivery_fee_mode, phone) values
  ('3f000000-0000-4000-8000-000000000001', '2f000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000001',
   'combo', 'Lanche Combo', 'ativo', 'Mirassol', 'SP', true, true, 'gratis', '17991234567');
insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '3f000000-0000-4000-8000-000000000001', d, '00:00', '23:59:59' from generate_series(0, 6) d;
insert into public.categories (id, restaurant_id, name) values ('4f000000-0000-4000-8000-000000000001', '3f000000-0000-4000-8000-000000000001', 'Combos');
insert into public.products (id, restaurant_id, category_id, name, price_cents, is_combo) values
  ('5f000000-0000-4000-8000-000000000001', '3f000000-0000-4000-8000-000000000001', '4f000000-0000-4000-8000-000000000001', 'Combo Casa', 4500, true),
  ('5f000000-0000-4000-8000-000000000002', '3f000000-0000-4000-8000-000000000001', '4f000000-0000-4000-8000-000000000001', 'X-Burguer', 3000, false),
  ('5f000000-0000-4000-8000-000000000003', '3f000000-0000-4000-8000-000000000001', '4f000000-0000-4000-8000-000000000001', 'Batata', 1800, false),
  ('5f000000-0000-4000-8000-000000000004', '3f000000-0000-4000-8000-000000000001', '4f000000-0000-4000-8000-000000000001', 'Outro Combo', 5000, true);
insert into public.product_combo_items (restaurant_id, combo_id, item_id, quantity, position) values
  ('3f000000-0000-4000-8000-000000000001', '5f000000-0000-4000-8000-000000000001', '5f000000-0000-4000-8000-000000000002', 1, 0),
  ('3f000000-0000-4000-8000-000000000001', '5f000000-0000-4000-8000-000000000001', '5f000000-0000-4000-8000-000000000003', 2, 1);
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.9' from public.stations s where s.restaurant_id = '3f000000-0000-4000-8000-000000000001';

select throws_ok(
  $$ insert into public.product_combo_items (restaurant_id, combo_id, item_id) values
     ('3f000000-0000-4000-8000-000000000001', '5f000000-0000-4000-8000-000000000001', '5f000000-0000-4000-8000-000000000004') $$,
  '22023', null, 'combo não pode ter outro combo dentro');
select throws_ok(
  $$ insert into public.product_combo_items (restaurant_id, combo_id, item_id) values
     ('3f000000-0000-4000-8000-000000000001', '5f000000-0000-4000-8000-000000000002', '5f000000-0000-4000-8000-000000000003') $$,
  '22023', null, 'só produto marcado como combo recebe itens');
select throws_ok(
  $$ delete from public.products where id = '5f000000-0000-4000-8000-000000000003' $$,
  '23503', null, 'produto que está num combo não pode ser excluído');

set local role anon;
create temp table p1 as
select * from public.fazer_pedido_online('3f000000-0000-4000-8000-000000000001', 'retirada',
  '[{"product_id": "5f000000-0000-4000-8000-000000000001", "quantidade": 1, "observacao": "sem cebola"}]',
  'Maria', '(17) 98888-4321', 'pix', null, null);
select is((select total_cents from p1), 4500, 'pedido cobra o preço do combo');
reset role;
select is(
  (select notes from public.order_items where product_id = '5f000000-0000-4000-8000-000000000001'),
  'Inclui: 1× X-Burguer, 2× Batata · sem cebola', 'item do combo leva a lista e a observação do cliente');

update public.products set is_active = false where id = '5f000000-0000-4000-8000-000000000003';
set local role anon;
select throws_ok(
  $$ select * from public.fazer_pedido_online('3f000000-0000-4000-8000-000000000001', 'retirada',
     '[{"product_id": "5f000000-0000-4000-8000-000000000001", "quantidade": 1}]', 'Maria', '(17) 98888-4321', 'pix', null, null) $$,
  'P0001', null, 'combo com item em falta não pode ser pedido');
select is((select count(*)::int from public.product_combo_items), 2, 'visitante vê os itens do combo da loja ativa');

select * from finish();
rollback;
