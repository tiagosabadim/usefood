-- Delivery lançado no PDV: endereço, celular e taxa ficam na conta e saem no ticket.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e7', 'caixa@ticket.teste');
insert into public.brands (id, slug, name, status) values ('1e000000-0000-4000-8000-000000000001', 'marca-ticket', 'Marca Ticket', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2e000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('3e000000-0000-4000-8000-000000000001', '2e000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000001', 'ticket', 'Pizzaria', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('3e000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000e7', 'caixa');
insert into public.categories (id, restaurant_id, name) values ('4e000000-0000-4000-8000-000000000001', '3e000000-0000-4000-8000-000000000001', 'Pizzas');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('5e000000-0000-4000-8000-000000000001', '3e000000-0000-4000-8000-000000000001', '4e000000-0000-4000-8000-000000000001', 'Pizza', 5000);
insert into public.printers (restaurant_id, station_id, name, host)
select s.restaurant_id, s.id, 'Cozinha', '10.0.0.3' from public.stations s where s.restaurant_id = '3e000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e7", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.criar_pedido('3e000000-0000-4000-8000-000000000001', 'delivery', 'nome', 'Rui',
       '[{"product_id": "5e000000-0000-4000-8000-000000000001", "quantidade": 1}]') $$,
  '22023', null, 'delivery sem endereço não passa');

create temp table p on commit drop as
select * from public.criar_pedido('3e000000-0000-4000-8000-000000000001', 'delivery', 'nome', 'Rui',
  '[{"product_id": "5e000000-0000-4000-8000-000000000001", "quantidade": 1}]', null, 'dinheiro', 10000,
  '(17) 98765-1234', '{"rua": "Av. Brasil", "numero": "300", "bairro": "Vila Nova", "referencia": "portão azul"}', 700);

select is((select total_cents from public.tabs where id = (select conta_id from p)), 5700, 'total da conta inclui a taxa de entrega');
select is((select customer_phone from public.tabs where id = (select conta_id from p)), '17987651234', 'celular guardado só com números');
create temp table j on commit drop as select payload from public.print_jobs where order_id = (select id from p);
select is((select payload #>> '{entrega,endereco,rua}' from j), 'Av. Brasil', 'ticket leva o endereço');
select is((select payload #>> '{entrega,endereco,referencia}' from j), 'portão azul', 'ticket leva a referência');
select is((select (payload #>> '{entrega,total}')::int from j), 5700, 'ticket leva quanto cobrar');

select * from finish();
rollback;
