-- Pedido online: cliente sem login, taxa calculada no banco, aguardando aceite e acompanhamento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.brands (id, slug, name, status) values
  ('1c000000-0000-4000-8000-000000000001', 'marca-web', 'Marca Web', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('2c000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, city, accepts_delivery,
                                delivery_fee_mode, min_order_cents, phone) values
  ('3c000000-0000-4000-8000-000000000001', '2c000000-0000-4000-8000-000000000001', '1c000000-0000-4000-8000-000000000001',
   'web', 'Pastelaria Web', 'ativo', 'Mirassol', true, 'bairro', 1000, '17991234567');
-- Aberta o dia todo, todos os dias
insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '3c000000-0000-4000-8000-000000000001', d, '00:00', '23:59:59' from generate_series(0, 6) d;
insert into public.delivery_districts (restaurant_id, name, fee_cents) values
  ('3c000000-0000-4000-8000-000000000001', 'Centro', 500);
insert into public.categories (id, restaurant_id, name) values
  ('4c000000-0000-4000-8000-000000000001', '3c000000-0000-4000-8000-000000000001', 'Pastéis');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('5c000000-0000-4000-8000-000000000001', '3c000000-0000-4000-8000-000000000001', '4c000000-0000-4000-8000-000000000001', 'Pastel', 800);
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.9' from public.stations s where s.restaurant_id = '3c000000-0000-4000-8000-000000000001';

-- Cliente sem login
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select taxa_cents from public.calcular_entrega('3c000000-0000-4000-8000-000000000001', '  centro ', 'Mirassol', null, null, 1600)),
  500, 'taxa do bairro, sem diferença de maiúscula e espaço');
select is(
  (select motivo from public.calcular_entrega('3c000000-0000-4000-8000-000000000001', 'Jardim Longe', 'Mirassol', null, null, 1600)),
  'Ainda não entregamos neste bairro.', 'bairro fora da lista não é atendido');

create temp table p1 on commit drop as
select * from public.fazer_pedido_online('3c000000-0000-4000-8000-000000000001', 'delivery',
  '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 2, "price_cents": 1}]',
  'Maria', '(17) 98888-4321', 'dinheiro', 5000,
  '{"rua": "Rua A", "numero": "10", "bairro": "Centro", "cidade": "Mirassol"}');
select is((select total_cents from p1), 2100, 'total = 2 pastéis do cardápio (16,00) + taxa do bairro (5,00)');
select is(
  public.acompanhar_pedido((select token from p1)) ->> 'codigo_entrega', '4321',
  'código de entrega são os 4 últimos números do celular');
select is(
  public.acompanhar_pedido((select token from p1)) ->> 'situacao', 'aguardando',
  'pedido online nasce aguardando a loja aceitar');
select is(public.acompanhar_pedido(gen_random_uuid()), null, 'link inventado não mostra nada');

select throws_ok(
  $$ select * from public.fazer_pedido_online('3c000000-0000-4000-8000-000000000001', 'retirada',
       '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 1}]', 'Ana', '17977776666', 'pix') $$,
  'P0001', null, 'abaixo do pedido mínimo não passa');
select throws_ok(
  $$ select * from public.fazer_pedido_online('3c000000-0000-4000-8000-000000000001', 'retirada',
       '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 2}]', 'Ana', '1234', 'pix') $$,
  '22023', null, 'celular precisa de DDD');
select throws_ok(
  $$ select * from public.criar_pedido('3c000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
       '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 1}]') $$,
  '42501', null, 'cliente não usa a função da equipe');

-- Proteção contra pedido falso: 3 aguardando por celular
select * from public.fazer_pedido_online('3c000000-0000-4000-8000-000000000001', 'retirada',
  '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 2}]', 'Maria', '17988884321', 'pix');
select * from public.fazer_pedido_online('3c000000-0000-4000-8000-000000000001', 'retirada',
  '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 2}]', 'Maria', '17988884321', 'pix');
select throws_ok(
  $$ select * from public.fazer_pedido_online('3c000000-0000-4000-8000-000000000001', 'retirada',
       '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 2}]', 'Maria', '17988884321', 'pix') $$,
  'P0001', null, 'quarto pedido aguardando do mesmo celular é barrado');

reset role;
select is(
  (select count(*)::int from public.print_jobs j join public.orders o on o.id = j.order_id
     where o.tracking_token = (select token from p1)),
  0, 'pedido online só imprime depois que a loja aceitar');
select is(
  (select type::text || '/' || channel from public.orders where tracking_token = (select token from p1)),
  'delivery/online', 'pedido marcado como online');

-- Loja fechada
delete from public.opening_hours where restaurant_id = '3c000000-0000-4000-8000-000000000001';
set local role anon;
select throws_ok(
  $$ select * from public.fazer_pedido_online('3c000000-0000-4000-8000-000000000001', 'retirada',
       '[{"product_id": "5c000000-0000-4000-8000-000000000001", "quantidade": 2}]', 'João', '17911112222', 'pix') $$,
  'P0001', null, 'loja fechada não recebe pedido');

select * from finish();
rollback;
