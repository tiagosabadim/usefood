-- E05 · Pedidos: o banco calcula o preço, numera o dia e controla o pagamento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'caixa.a@pedidos.teste'),
  ('00000000-0000-4000-8000-0000000000c2', 'garcom.a@pedidos.teste'),
  ('00000000-0000-4000-8000-0000000000c3', 'cozinha.a@pedidos.teste'),
  ('00000000-0000-4000-8000-0000000000c4', 'dono.b@pedidos.teste');
insert into public.brands (id, slug, name, status) values
  ('12000000-0000-4000-8000-000000000001', 'marca-pedidos', 'Marca Pedidos', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('22000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-000000000001', 'Org A'),
  ('22000000-0000-4000-8000-00000000000b', '12000000-0000-4000-8000-000000000001', 'Org B');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('32000000-0000-4000-8000-00000000000a', '22000000-0000-4000-8000-00000000000a',
   '12000000-0000-4000-8000-000000000001', 'pedidos-a', 'Loja A', 'ativo'),
  ('32000000-0000-4000-8000-00000000000b', '22000000-0000-4000-8000-00000000000b',
   '12000000-0000-4000-8000-000000000001', 'pedidos-b', 'Loja B', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('32000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000c1', 'caixa'),
  ('32000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000c2', 'garcom'),
  ('32000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000c3', 'cozinha'),
  ('32000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000c4', 'dono');
insert into public.categories (id, restaurant_id, name) values
  ('42000000-0000-4000-8000-00000000000a', '32000000-0000-4000-8000-00000000000a', 'Pastéis'),
  ('42000000-0000-4000-8000-00000000000b', '32000000-0000-4000-8000-00000000000b', 'Lanches');
insert into public.products (id, restaurant_id, category_id, name, price_cents, is_active) values
  ('52000000-0000-4000-8000-0000000000a1', '32000000-0000-4000-8000-00000000000a', '42000000-0000-4000-8000-00000000000a', 'Pastel de carne', 1400, true),
  ('52000000-0000-4000-8000-0000000000a2', '32000000-0000-4000-8000-00000000000a', '42000000-0000-4000-8000-00000000000a', 'Caldo de cana', 900, true),
  ('52000000-0000-4000-8000-0000000000a3', '32000000-0000-4000-8000-00000000000a', '42000000-0000-4000-8000-00000000000a', 'Pastel de palmito', 1500, false),
  ('52000000-0000-4000-8000-0000000000b1', '32000000-0000-4000-8000-00000000000b', '42000000-0000-4000-8000-00000000000b', 'X-Burguer', 2200, true);

-- Caixa da loja A
-- Pagamento exige caixa aberto (E06)
insert into public.cash_sessions (restaurant_id, opening_cents) values ('32000000-0000-4000-8000-00000000000a', 0);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}';

create temp table p1 on commit drop as
select * from public.criar_pedido('32000000-0000-4000-8000-00000000000a', 'balcao', 'senha', null,
  '[{"product_id": "52000000-0000-4000-8000-0000000000a1", "quantidade": 2, "price_cents": 1},
    {"product_id": "52000000-0000-4000-8000-0000000000a2", "quantidade": 1}]');
select is((select total_cents from p1), 3700, 'total vem do cardápio (2 × 14,00 + 9,00), ignorando preço enviado pela tela');
select is((select identificador from p1), '001', 'primeiro pedido do dia ganha a senha 001');

create temp table p2 on commit drop as
select * from public.criar_pedido('32000000-0000-4000-8000-00000000000a', 'balcao', 'nome', 'João',
  '[{"product_id": "52000000-0000-4000-8000-0000000000a1", "quantidade": 1}]', true);
select is((select numero from p2), 2, 'segundo pedido do dia é o número 2');
select is((select total_cents from p2), 1540, 'taxa de serviço de 10% entra no total');

select throws_ok(
  $$ select * from public.criar_pedido('32000000-0000-4000-8000-00000000000a', 'balcao', 'senha', null,
       '[{"product_id": "52000000-0000-4000-8000-0000000000a3", "quantidade": 1}]') $$,
  'P0001', null, 'produto pausado não entra no pedido');
select throws_ok(
  $$ select * from public.criar_pedido('32000000-0000-4000-8000-00000000000a', 'balcao', 'senha', null,
       '[{"product_id": "52000000-0000-4000-8000-0000000000b1", "quantidade": 1}]') $$,
  'P0002', null, 'produto de outra loja não entra no pedido');
select throws_ok(
  $$ select * from public.criar_pedido('32000000-0000-4000-8000-00000000000a', 'mesa', 'mesa', ' ',
       '[{"product_id": "52000000-0000-4000-8000-0000000000a1", "quantidade": 1}]') $$,
  '22023', null, 'pedido de mesa exige o número da mesa');
select throws_ok(
  $$ insert into public.orders (restaurant_id, day, number, type, identifier, total_cents)
     values ('32000000-0000-4000-8000-00000000000a', current_date, 99, 'balcao', 'x', 1) $$,
  '42501', null, 'ninguém grava pedido direto na tabela, só pela função');

-- Pagamento em dinheiro com troco: total 37,00, recebe 50,00
create temp table pg1 on commit drop as
select * from public.registrar_pagamento((select id from p1), 'dinheiro', 5000);
select is((select troco_cents from pg1), 1300, 'troco de R$ 13,00');
select is((select falta_cents from pg1), 0, 'pedido quitado');
select throws_ok(
  format($$ select * from public.registrar_pagamento(%L, 'pix', 100) $$, (select id from p1)),
  'P0001', null, 'pedido pago não aceita outro pagamento');
select throws_ok(
  format($$ select * from public.registrar_pagamento(%L, 'pix', 999999) $$, (select id from p2)),
  '22023', null, 'Pix não pode passar do valor (não existe troco de Pix)');

-- Garçom lança, mas não cobra
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c2", "role": "authenticated"}';
select lives_ok(
  $$ select * from public.criar_pedido('32000000-0000-4000-8000-00000000000a', 'mesa', 'mesa', '12',
       '[{"product_id": "52000000-0000-4000-8000-0000000000a2", "quantidade": 2}]') $$,
  'garçom lança pedido de mesa');
select throws_ok(
  format($$ select * from public.registrar_pagamento(%L, 'pix', 100) $$, (select id from p2)),
  '42501', null, 'garçom não registra pagamento');

-- Cozinha não lança pedido
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c3", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.criar_pedido('32000000-0000-4000-8000-00000000000a', 'balcao', 'senha', null,
       '[{"product_id": "52000000-0000-4000-8000-0000000000a1", "quantidade": 1}]') $$,
  '42501', null, 'cozinha não lança pedido');

-- Dono de outra loja não vê os pedidos da loja A
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c4", "role": "authenticated"}';
select is(
  (select count(*)::int from public.orders where restaurant_id = '32000000-0000-4000-8000-00000000000a'),
  0, 'outra loja não vê os pedidos');

select * from finish();
rollback;
