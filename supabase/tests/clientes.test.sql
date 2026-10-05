-- Clientes da loja: agrupados pelo celular, só dono e gerente veem.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'dono@clientes.teste'),
  ('00000000-0000-4000-8000-0000000000e2', 'garcom@clientes.teste');
insert into public.brands (id, slug, name, status) values ('1b100000-0000-4000-8000-000000000001', 'marca-cli', 'Marca Cli', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2b100000-0000-4000-8000-000000000001', '1b100000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('3b100000-0000-4000-8000-000000000001', '2b100000-0000-4000-8000-000000000001', '1b100000-0000-4000-8000-000000000001', 'cli', 'Pizzaria', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('3b100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000e1', 'dono'),
  ('3b100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000e2', 'garcom');
insert into public.categories (id, restaurant_id, name) values ('4b100000-0000-4000-8000-000000000001', '3b100000-0000-4000-8000-000000000001', 'Pizzas');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('5b100000-0000-4000-8000-000000000001', '3b100000-0000-4000-8000-000000000001', '4b100000-0000-4000-8000-000000000001', 'Calabresa', 5000),
  ('5b100000-0000-4000-8000-000000000002', '3b100000-0000-4000-8000-000000000001', '4b100000-0000-4000-8000-000000000001', 'Refri', 1000);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
-- Ana pede duas vezes (delivery), Bia uma (retirada), balcão sem celular não entra
select * from public.criar_pedido('3b100000-0000-4000-8000-000000000001', 'delivery', 'nome', 'Ana',
  '[{"product_id": "5b100000-0000-4000-8000-000000000001", "quantidade": 2}]', null, 'pix', null,
  '17911112222', '{"rua": "Rua A", "numero": "1", "bairro": "Centro"}', 0);
select * from public.criar_pedido('3b100000-0000-4000-8000-000000000001', 'delivery', 'nome', 'Ana Paula',
  '[{"product_id": "5b100000-0000-4000-8000-000000000002", "quantidade": 1}]', null, 'pix', null,
  '17911112222', '{"rua": "Rua B", "numero": "2", "bairro": "Jardim"}', 0);
select * from public.criar_pedido('3b100000-0000-4000-8000-000000000001', 'retirada', 'nome', 'Bia',
  '[{"product_id": "5b100000-0000-4000-8000-000000000002", "quantidade": 1}]', null, 'pix', null, '17933334444');
select * from public.criar_pedido('3b100000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
  '[{"product_id": "5b100000-0000-4000-8000-000000000002", "quantidade": 1}]');

select is((select count(*)::int from public.clientes_da_loja('3b100000-0000-4000-8000-000000000001')), 2, 'dois clientes (o balcão sem celular não entra)');
select is(
  (select row(nome, bairro, pedidos, total_cents)::text from public.clientes_da_loja('3b100000-0000-4000-8000-000000000001') where telefone = '17911112222'),
  row('Ana Paula', 'Jardim', 2, 11000::bigint)::text, 'nome e bairro mais recentes, pedidos e total somados');
select is(
  (select favorito from public.clientes_da_loja('3b100000-0000-4000-8000-000000000001') where telefone = '17911112222'),
  'Calabresa', 'produto favorito pela quantidade');
select is(
  jsonb_array_length(public.cliente_da_loja('3b100000-0000-4000-8000-000000000001', '17911112222') -> 'enderecos'), 2,
  'ficha mostra os dois endereços usados');
select is(
  jsonb_array_length(public.cliente_da_loja('3b100000-0000-4000-8000-000000000001', '17911112222') -> 'pedidos'), 2,
  'ficha mostra os pedidos');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}';
select throws_ok($$ select * from public.clientes_da_loja('3b100000-0000-4000-8000-000000000001') $$, '42501', null, 'garçom não vê os clientes');

select * from finish();
rollback;
