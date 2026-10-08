-- Mais pedidos da semana: ranking pelas vendas de 7 dias; sem vendas, destaques e fotos primeiro.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.brands (id, slug, name, status) values ('1b000000-0000-4000-8000-0000000000d1', 'marca-ranking', 'Marca', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2b000000-0000-4000-8000-0000000000d1', '1b000000-0000-4000-8000-0000000000d1', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, city, state, accepts_delivery, accepts_pickup, delivery_fee_mode, phone) values
  ('3b000000-0000-4000-8000-0000000000d1', '2b000000-0000-4000-8000-0000000000d1', '1b000000-0000-4000-8000-0000000000d1',
   'ranking', 'Pastelaria Ranking', 'ativo', 'Mirassol', 'SP', true, true, 'gratis', '17991234567');
insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '3b000000-0000-4000-8000-0000000000d1', d, '00:00', '23:59:59' from generate_series(0, 6) d;
insert into public.categories (id, restaurant_id, name) values ('4b000000-0000-4000-8000-0000000000d1', '3b000000-0000-4000-8000-0000000000d1', 'Pastéis');
insert into public.products (id, restaurant_id, category_id, name, price_cents, is_featured, photo_path) values
  ('5b000000-0000-4000-8000-0000000000d1', '3b000000-0000-4000-8000-0000000000d1', '4b000000-0000-4000-8000-0000000000d1', 'Pastel Simples', 1000, false, null),
  ('5b000000-0000-4000-8000-0000000000d2', '3b000000-0000-4000-8000-0000000000d1', '4b000000-0000-4000-8000-0000000000d1', 'Pastel Destaque', 1200, true, null),
  ('5b000000-0000-4000-8000-0000000000d3', '3b000000-0000-4000-8000-0000000000d1', '4b000000-0000-4000-8000-0000000000d1', 'Pastel com Foto', 1100, false, 'x.webp');
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.9' from public.stations s where s.restaurant_id = '3b000000-0000-4000-8000-0000000000d1';

set local role anon;
select is((select produto from public.vitrine_mais_pedidos('marca-ranking', 'mirassol-sp') limit 1), 'Pastel Destaque',
  'sem vendas: destaque primeiro');
select is((select produto from public.vitrine_mais_pedidos('marca-ranking', 'mirassol-sp') offset 1 limit 1), 'Pastel com Foto',
  'sem vendas: depois os que têm foto');

select * from public.fazer_pedido_online('3b000000-0000-4000-8000-0000000000d1', 'retirada',
  '[{"product_id": "5b000000-0000-4000-8000-0000000000d1", "quantidade": 3}]', 'Ana', '(17) 98888-1111', 'pix');
select is((select produto from public.vitrine_mais_pedidos('marca-ranking', 'mirassol-sp') limit 1), 'Pastel Simples',
  'com vendas na semana: o mais pedido sobe para o primeiro');
select is((select vendidos_semana from public.vitrine_mais_pedidos('marca-ranking', 'mirassol-sp') limit 1), 3,
  'quantidade vendida na semana');

select * from finish();
rollback;
