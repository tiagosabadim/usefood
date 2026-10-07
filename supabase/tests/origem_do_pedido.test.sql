-- Origem do pedido online (app USE! ou link da loja) e as vendas por canal no console.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'admin@origem.teste');
insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-0000000000e1');
insert into public.brands (id, slug, name, status) values ('1a000000-0000-4000-8000-0000000000c1', 'marca-origem', 'Marca', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2a000000-0000-4000-8000-0000000000c1', '1a000000-0000-4000-8000-0000000000c1', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, city, state, accepts_delivery, accepts_pickup, delivery_fee_mode, phone) values
  ('3a000000-0000-4000-8000-0000000000c1', '2a000000-0000-4000-8000-0000000000c1', '1a000000-0000-4000-8000-0000000000c1',
   'origem', 'Pastelaria Origem', 'ativo', 'Mirassol', 'SP', true, true, 'gratis', '17991234567');
insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '3a000000-0000-4000-8000-0000000000c1', d, '00:00', '23:59:59' from generate_series(0, 6) d;
insert into public.categories (id, restaurant_id, name) values ('4a000000-0000-4000-8000-0000000000c1', '3a000000-0000-4000-8000-0000000000c1', 'Pastéis');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('5a000000-0000-4000-8000-0000000000c1', '3a000000-0000-4000-8000-0000000000c1', '4a000000-0000-4000-8000-0000000000c1', 'Pastel', 1000);
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.9' from public.stations s where s.restaurant_id = '3a000000-0000-4000-8000-0000000000c1';

set local role anon;
select * from public.fazer_pedido_online('3a000000-0000-4000-8000-0000000000c1', 'retirada',
  '[{"product_id": "5a000000-0000-4000-8000-0000000000c1", "quantidade": 2}]', 'Ana', '(17) 98888-1111', 'pix', null, null, null, null, null, 'app');
select * from public.fazer_pedido_online('3a000000-0000-4000-8000-0000000000c1', 'retirada',
  '[{"product_id": "5a000000-0000-4000-8000-0000000000c1", "quantidade": 1}]', 'Bia', '(17) 98888-2222', 'pix');
reset role;

select is((select count(*)::int from public.orders where online_origin = 'app'), 1, 'pedido pelo app fica marcado como app');
select is((select count(*)::int from public.orders where online_origin = 'loja'), 1, 'sem origem informada, vale o link da loja');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
select is((select app_30d_cents from public.console_lojas() where slug = 'origem'), 2000::bigint, 'console: vendas pelo app');
select is((select link_30d_cents from public.console_lojas() where slug = 'origem'), 1000::bigint, 'console: vendas pelo link da loja');
select is((select app_pedidos_30d + link_pedidos_30d from public.console_lojas() where slug = 'origem'), 2, 'console: pedidos por canal');

select * from finish();
rollback;
