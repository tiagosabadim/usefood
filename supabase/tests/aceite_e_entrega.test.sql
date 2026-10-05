-- Aceite do pedido online e entrega com código.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d7', 'caixa@entrega.teste'),
  ('00000000-0000-4000-8000-0000000000d8', 'moto@entrega.teste'),
  ('00000000-0000-4000-8000-0000000000d9', 'cozinha@entrega.teste');
insert into public.brands (id, slug, name, status) values ('1d000000-0000-4000-8000-000000000001', 'marca-moto', 'Marca Moto', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, accepts_delivery) values
  ('3d000000-0000-4000-8000-000000000001', '2d000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', 'moto', 'Lanches Moto', 'ativo', true);
insert into public.memberships (restaurant_id, user_id, role) values
  ('3d000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d7', 'caixa'),
  ('3d000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d8', 'entregador'),
  ('3d000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d9', 'cozinha');
insert into public.opening_hours (restaurant_id, weekday, opens, closes)
select '3d000000-0000-4000-8000-000000000001', d, '00:00', '23:59:59' from generate_series(0, 6) d;
insert into public.categories (id, restaurant_id, name) values ('4d000000-0000-4000-8000-000000000001', '3d000000-0000-4000-8000-000000000001', 'Lanches');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('5d000000-0000-4000-8000-000000000001', '3d000000-0000-4000-8000-000000000001', '4d000000-0000-4000-8000-000000000001', 'X-Tudo', 3000);
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.7' from public.stations s where s.restaurant_id = '3d000000-0000-4000-8000-000000000001';

set local role anon;
create temp table p on commit drop as
select * from public.fazer_pedido_online('3d000000-0000-4000-8000-000000000001', 'delivery',
  '[{"product_id": "5d000000-0000-4000-8000-000000000001", "quantidade": 1}]', 'Carla', '17955554321', 'pix', null,
  '{"rua": "Rua B", "numero": "5", "bairro": "Centro", "cidade": "X"}');
create temp table p2 on commit drop as
select * from public.fazer_pedido_online('3d000000-0000-4000-8000-000000000001', 'retirada',
  '[{"product_id": "5d000000-0000-4000-8000-000000000001", "quantidade": 1}]', 'Davi', '17900001111', 'pix');
reset role;
grant select on p, p2 to authenticated;
create temp table ids on commit drop as
select (select id from public.orders where tracking_token = (select token from p)) as entrega,
       (select id from public.orders where tracking_token = (select token from p2)) as retirada;
grant select on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d9", "role": "authenticated"}';
select throws_ok(format($$ select public.aceitar_pedido(%L) $$, (select entrega from ids)), '42501', null, 'cozinha não aceita pedido');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d7", "role": "authenticated"}';
select is(public.aceitar_pedido((select entrega from ids)), 'em_preparo'::public.order_status, 'caixa aceita o pedido');
select is((select count(*)::int from public.print_jobs where order_id = (select entrega from ids)), 1, 'aceito, vai para a impressora');
select throws_ok(format($$ select public.aceitar_pedido(%L) $$, (select entrega from ids)), 'P0001', null, 'não aceita duas vezes');
select throws_ok(format($$ select public.recusar_pedido(%L, ' ') $$, (select retirada from ids)), '22023', null, 'recusar exige motivo');
select public.recusar_pedido((select retirada from ids), 'Produto esgotado');
select is(public.acompanhar_pedido((select token from p2)) ->> 'motivo', 'Produto esgotado', 'cliente vê o motivo da recusa');

-- Cozinha termina; entregador sai e confirma com o código
select public.marcar_pronto((select entrega from ids), null);
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d8", "role": "authenticated"}';
select is(public.sair_para_entrega((select entrega from ids)), 'em_entrega'::public.order_status, 'entregador sai para a entrega');
select is(public.acompanhar_pedido((select token from p)) ->> 'situacao', 'em_entrega', 'cliente vê que saiu para entrega');
select throws_ok(format($$ select public.confirmar_entrega(%L, '0000') $$, (select entrega from ids)), 'P0001', null, 'código errado não conclui');
select is(public.confirmar_entrega((select entrega from ids), '4321'), 'concluido'::public.order_status, 'código certo conclui a entrega');
select isnt((select delivered_at from public.orders where id = (select entrega from ids)), null, 'hora da entrega registrada');

-- Sem entregador no app: o caixa despacha e confirma sem o código
reset role;
create temp table p4 on commit drop as
select * from public.fazer_pedido_online('3d000000-0000-4000-8000-000000000001', 'delivery',
  '[{"product_id": "5d000000-0000-4000-8000-000000000001", "quantidade": 1}]', 'Eva', '17922223333', 'pix', null,
  '{"rua": "Rua C", "numero": "9", "bairro": "Centro", "cidade": "X"}');
grant select on p4 to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d7", "role": "authenticated"}';
create temp table id4 on commit drop as select id from public.orders where tracking_token = (select token from p4);
select public.aceitar_pedido((select id from id4));
select public.marcar_pronto((select id from id4), null);
select public.sair_para_entrega((select id from id4));
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d8", "role": "authenticated"}';
select throws_ok(format($$ select public.confirmar_entrega(%L) $$, (select id from id4)), 'P0001', null,
  'entregador sem código não conclui');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d7", "role": "authenticated"}';
select is(public.confirmar_entrega((select id from id4)), 'concluido'::public.order_status, 'caixa confirma sem o código');

select * from finish();
rollback;
