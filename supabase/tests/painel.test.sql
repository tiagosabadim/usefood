-- Dashboard: números do período, comparação e quem pode ver.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'dono@painel.teste'),
  ('00000000-0000-4000-8000-0000000000c2', 'garcom@painel.teste');
insert into public.brands (id, slug, name, status) values ('1a100000-0000-4000-8000-000000000001', 'marca-painel', 'Marca Painel', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2a100000-0000-4000-8000-000000000001', '1a100000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('3a100000-0000-4000-8000-000000000001', '2a100000-0000-4000-8000-000000000001', '1a100000-0000-4000-8000-000000000001', 'painel', 'Lanchonete', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('3a100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1', 'dono'),
  ('3a100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2', 'garcom');
insert into public.categories (id, restaurant_id, name) values ('4a100000-0000-4000-8000-000000000001', '3a100000-0000-4000-8000-000000000001', 'Lanches');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('5a100000-0000-4000-8000-000000000001', '3a100000-0000-4000-8000-000000000001', '4a100000-0000-4000-8000-000000000001', 'X-Burguer', 2000),
  ('5a100000-0000-4000-8000-000000000002', '3a100000-0000-4000-8000-000000000001', '4a100000-0000-4000-8000-000000000001', 'Suco', 800);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}';
-- Mesa 1 com duas rodadas e um balcão
select * from public.criar_pedido('3a100000-0000-4000-8000-000000000001', 'mesa', 'mesa', '1',
  '[{"product_id": "5a100000-0000-4000-8000-000000000001", "quantidade": 2}]');
select * from public.criar_pedido('3a100000-0000-4000-8000-000000000001', 'mesa', 'mesa', '1',
  '[{"product_id": "5a100000-0000-4000-8000-000000000002", "quantidade": 1}]');
select * from public.criar_pedido('3a100000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
  '[{"product_id": "5a100000-0000-4000-8000-000000000001", "quantidade": 1}]');

create temp table p on commit drop as
select public.painel_da_loja('3a100000-0000-4000-8000-000000000001', now() - interval '1 day', now() + interval '1 minute') as j;

select is((select (j #>> '{atual,vendas}')::int from p), 6800, 'vendas: 2 X-Burguer + suco + 1 X-Burguer');
select is((select (j #>> '{atual,pedidos}')::int from p), 3, 'três pedidos (duas rodadas da mesa e um balcão)');
select is((select (j #>> '{atual,contas}')::int from p), 2, 'duas contas: a mesa e o balcão (ticket médio por conta)');
select is((select (j #>> '{anterior,vendas}')::int from p), 0, 'período anterior vazio, para comparar');
select is((select j #>> '{produtos,0,nome}' from p), 'X-Burguer', 'mais vendido primeiro');
select is((select jsonb_array_length(j -> 'canais') from p), 2, 'dois canais: mesa e balcão');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c2", "role": "authenticated"}';
select throws_ok(
  $$ select public.painel_da_loja('3a100000-0000-4000-8000-000000000001', now() - interval '1 day', now()) $$,
  '42501', null, 'garçom não vê os números da loja');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}';
select throws_ok(
  $$ select public.painel_da_loja('3a100000-0000-4000-8000-000000000001', now(), now() - interval '1 day') $$,
  '22023', null, 'período invertido é recusado');

select * from finish();
rollback;
