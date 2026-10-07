-- Promoções: o pedido cobra o preço da promoção enquanto ela vale; o app lista as ofertas da cidade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.brands (id, slug, name, status) values
  ('1d000000-0000-4000-8000-000000000001', 'marca-promo', 'Marca Promo', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, city, state, accepts_delivery,
                                accepts_pickup, delivery_fee_mode, phone) values
  ('3d000000-0000-4000-8000-000000000001', '2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001',
   'promo', 'Lanche Promo', 'ativo', 'Mirassol', 'SP', true, true, 'gratis', '17991234567');
insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '3d000000-0000-4000-8000-000000000001', d, '00:00', '23:59:59' from generate_series(0, 6) d;
insert into public.categories (id, restaurant_id, name) values
  ('4d000000-0000-4000-8000-000000000001', '3d000000-0000-4000-8000-000000000001', 'Lanches');
insert into public.products (id, restaurant_id, category_id, name, price_cents, promo_price_cents, promo_ends_at) values
  ('5d000000-0000-4000-8000-000000000001', '3d000000-0000-4000-8000-000000000001', '4d000000-0000-4000-8000-000000000001', 'X-Promo', 3000, 2400, null),
  ('5d000000-0000-4000-8000-000000000002', '3d000000-0000-4000-8000-000000000001', '4d000000-0000-4000-8000-000000000001', 'X-Vencido', 3000, 2000, now() - interval '1 hour'),
  ('5d000000-0000-4000-8000-000000000003', '3d000000-0000-4000-8000-000000000001', '4d000000-0000-4000-8000-000000000001', 'X-Normal', 3000, null, null);
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.9' from public.stations s where s.restaurant_id = '3d000000-0000-4000-8000-000000000001';

select throws_ok(
  $$ update public.products set promo_price_cents = 3500 where id = '5d000000-0000-4000-8000-000000000003' $$,
  '23514', null, 'promoção precisa ser menor que o preço');
select is(private.preco_vigente(3000, 2400, null), 2400, 'promoção sem data de fim vale');
select is(private.preco_vigente(3000, 2000, now() - interval '1 minute'), 3000, 'promoção vencida volta ao preço normal');

set local role anon;
create temp table p1 as
select * from public.fazer_pedido_online('3d000000-0000-4000-8000-000000000001', 'retirada',
  '[{"product_id": "5d000000-0000-4000-8000-000000000001", "quantidade": 2, "price_cents": 1}]',
  'Maria', '(17) 98888-4321', 'pix', null, null);
select is((select total_cents from p1), 4800, 'pedido cobra o preço da promoção (2 × 24,00), calculado no servidor');
create temp table p2 as
select * from public.fazer_pedido_online('3d000000-0000-4000-8000-000000000001', 'retirada',
  '[{"product_id": "5d000000-0000-4000-8000-000000000002", "quantidade": 1}]',
  'Maria', '(17) 98888-4321', 'pix', null, null);
select is((select total_cents from p2), 3000, 'promoção vencida: pedido cobra o preço normal');

select is(
  (select array_agg(produto order by produto) from public.vitrine_ofertas('marca-promo', 'mirassol-sp')),
  array['X-Promo'], 'ofertas da cidade: só promoções valendo');
select is(
  (select promo_cents from public.vitrine_ofertas('marca-promo', 'mirassol-sp') limit 1), 2400, 'oferta traz o preço da promoção');

select * from finish();
rollback;
