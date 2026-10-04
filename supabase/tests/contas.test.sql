-- Contas: mesa acumula rodadas, balcão e delivery têm conta própria, taxa decidida no fechamento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000c0a1', 'caixa@contas.teste'),
  ('00000000-0000-4000-8000-00000000c0a2', 'garcom@contas.teste');
insert into public.brands (id, slug, name, status) values
  ('16000000-0000-4000-8000-000000000001', 'marca-contas', 'Marca Contas', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('26000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('36000000-0000-4000-8000-000000000001', '26000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001', 'contas', 'Bar do Zé', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('36000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000c0a1', 'caixa'),
  ('36000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000c0a2', 'garcom');
insert into public.categories (id, restaurant_id, name) values
  ('46000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', 'Tudo');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('56000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 'Chopp', 1200),
  ('56000000-0000-4000-8000-000000000002', '36000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 'Porção', 3600);

set local role authenticated;

-- Garçom lança duas rodadas na mesa 12, sem caixa aberto
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000c0a2", "role": "authenticated"}';
create temp table r1 on commit drop as
select * from public.criar_pedido('36000000-0000-4000-8000-000000000001', 'mesa', 'mesa', '12',
  '[{"product_id": "56000000-0000-4000-8000-000000000001", "quantidade": 2}]');
create temp table r2 on commit drop as
select * from public.criar_pedido('36000000-0000-4000-8000-000000000001', 'mesa', 'mesa', ' 12 ',
  '[{"product_id": "56000000-0000-4000-8000-000000000002", "quantidade": 1}]');
select is((select conta_id from r2), (select conta_id from r1), 'segunda rodada cai na mesma conta da mesa');
select is(
  (select subtotal_cents from public.tabs where id = (select conta_id from r1)), 6000,
  'conta da mesa soma as rodadas (2 × 12,00 + 36,00)');
select throws_ok(
  format($$ select * from public.receber_conta(%L, 'pix', 6600, null, true) $$, (select conta_id from r1)),
  '42501', null, 'garçom não recebe');

-- Balcão e delivery: cada pedido com a sua conta
create temp table b1 on commit drop as
select * from public.criar_pedido('36000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
  '[{"product_id": "56000000-0000-4000-8000-000000000001", "quantidade": 1}]');
create temp table b2 on commit drop as
select * from public.criar_pedido('36000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
  '[{"product_id": "56000000-0000-4000-8000-000000000001", "quantidade": 1}]');
select isnt((select conta_id from b2), (select conta_id from b1), 'cada pedido de balcão tem a sua conta');
create temp table d1 on commit drop as
select * from public.criar_pedido('36000000-0000-4000-8000-000000000001', 'delivery', 'nome', 'Maria',
  '[{"product_id": "56000000-0000-4000-8000-000000000002", "quantidade": 1}]', null, 'dinheiro', 5000);
select is(
  (select change_for_cents from public.tabs where id = (select conta_id from d1)), 5000,
  'delivery guarda a forma prevista e o troco para 50,00');

-- Caixa fecha a mesa com 10%
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000c0a1", "role": "authenticated"}';
select throws_ok(
  format($$ select * from public.receber_conta(%L, 'pix', 100) $$, (select conta_id from r1)),
  'P0001', null, 'sem caixa aberto não se recebe');
reset role;
insert into public.cash_sessions (restaurant_id, opening_cents) values ('36000000-0000-4000-8000-000000000001', 0);
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000c0a1", "role": "authenticated"}';

create temp table pg1 on commit drop as
select * from public.receber_conta((select conta_id from r1), 'pix', 3300, null, true);
select is((select total_cents from pg1), 6600, 'taxa de 10% aplicada no fechamento (60,00 + 6,00)');
select is((select falta_cents from pg1), 3300, 'metade paga no Pix');
select throws_ok(
  format($$ select * from public.receber_conta(%L, 'pix', 100, null, false) $$, (select conta_id from r1)),
  'P0001', null, 'taxa não muda depois do primeiro pagamento');
create temp table pg2 on commit drop as
select * from public.receber_conta((select conta_id from r1), 'dinheiro', 3300, 5000);
select is((select troco_cents from pg2), 1700, 'outra metade em dinheiro, troco de 17,00');
select is(
  (select status::text from public.tabs where id = (select conta_id from r1)), 'fechada',
  'mesa paga fecha a conta');

-- Mesa 12 de novo: conta nova
create temp table r3 on commit drop as
select * from public.criar_pedido('36000000-0000-4000-8000-000000000001', 'mesa', 'mesa', '12',
  '[{"product_id": "56000000-0000-4000-8000-000000000001", "quantidade": 1}]');
select isnt((select conta_id from r3), (select conta_id from r1), 'depois de fechada, a mesa abre uma conta nova');

-- Balcão sem taxa: paga o valor do pedido
create temp table pg3 on commit drop as
select * from public.receber_conta((select conta_id from b1), 'debito', 1200, null, false);
select is((select falta_cents from pg3), 0, 'balcão pago sem taxa');

select * from finish();
rollback;
