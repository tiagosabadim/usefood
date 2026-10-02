-- E06 · Caixa: o fechamento confere fundo + dinheiro + suprimentos − sangrias.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'caixa@caixa.teste'),
  ('00000000-0000-4000-8000-0000000000e2', 'garcom@caixa.teste');
insert into public.brands (id, slug, name, status) values
  ('14000000-0000-4000-8000-000000000001', 'marca-caixa', 'Marca Caixa', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'Org A'),
  ('24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', 'Org B');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('34000000-0000-4000-8000-00000000000a', '24000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'caixa-a', 'Loja A', 'ativo'),
  ('34000000-0000-4000-8000-00000000000b', '24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', 'caixa-b', 'Loja B', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('34000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000e1', 'caixa'),
  ('34000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000e1', 'caixa'),
  ('34000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000e2', 'garcom');
insert into public.categories (id, restaurant_id, name) values
  ('44000000-0000-4000-8000-00000000000a', '34000000-0000-4000-8000-00000000000a', 'Pastéis'),
  ('44000000-0000-4000-8000-00000000000b', '34000000-0000-4000-8000-00000000000b', 'Pastéis');
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('54000000-0000-4000-8000-00000000000a', '34000000-0000-4000-8000-00000000000a', '44000000-0000-4000-8000-00000000000a', 'Pastel', 3700),
  ('54000000-0000-4000-8000-00000000000c', '34000000-0000-4000-8000-00000000000a', '44000000-0000-4000-8000-00000000000a', 'Caldo', 2000),
  ('54000000-0000-4000-8000-00000000000b', '34000000-0000-4000-8000-00000000000b', '44000000-0000-4000-8000-00000000000b', 'Pastel', 1000);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';

-- Loja B: sem caixa aberto, não recebe
create temp table pedido_b on commit drop as
select * from public.criar_pedido('34000000-0000-4000-8000-00000000000b', 'balcao', 'senha', null,
  '[{"product_id": "54000000-0000-4000-8000-00000000000b", "quantidade": 1}]');
select throws_ok(
  format($$ select * from public.registrar_pagamento(%L, 'pix', 1000) $$, (select id from pedido_b)),
  'P0001', null, 'sem caixa aberto não se recebe pagamento');

-- Loja A: abre com R$ 100,00 de fundo
create temp table sessao on commit drop as
select public.abrir_caixa('34000000-0000-4000-8000-00000000000a', 10000) as id;
select isnt((select id from sessao), null, 'caixa aberto com fundo de troco');
select throws_ok(
  $$ select public.abrir_caixa('34000000-0000-4000-8000-00000000000a', 5000) $$,
  'P0001', null, 'o mesmo caixa não abre duas vezes');

-- Vendas: 37,00 em dinheiro (nota de 50) e 20,00 no Pix
create temp table v1 on commit drop as
select * from public.criar_pedido('34000000-0000-4000-8000-00000000000a', 'balcao', 'senha', null,
  '[{"product_id": "54000000-0000-4000-8000-00000000000a", "quantidade": 1}]');
select lives_ok(
  format($$ select * from public.registrar_pagamento(%L, 'dinheiro', 3700, 5000) $$, (select id from v1)),
  'venda em dinheiro com troco');
create temp table v2 on commit drop as
select * from public.criar_pedido('34000000-0000-4000-8000-00000000000a', 'balcao', 'senha', null,
  '[{"product_id": "54000000-0000-4000-8000-00000000000c", "quantidade": 1}]');
select lives_ok(
  format($$ select * from public.registrar_pagamento(%L, 'pix', 2000) $$, (select id from v2)),
  'venda no Pix');
select is(
  (select count(*)::int from public.payments where cash_session_id = (select id from sessao)),
  2, 'os dois pagamentos caem no caixa aberto');

-- Movimentos: sangria de 30,00 e suprimento de 10,00
select lives_ok(
  format($$ select public.movimentar_caixa(%L, 'sangria', 3000, 'Depósito no banco') $$, (select id from sessao)),
  'sangria registrada');
select lives_ok(
  format($$ select public.movimentar_caixa(%L, 'suprimento', 1000, 'Troco extra') $$, (select id from sessao)),
  'suprimento registrado');

create temp table resumo on commit drop as select * from public.resumo_do_caixa((select id from sessao));
select is((select dinheiro_cents from resumo), 3700, 'vendas em dinheiro somam o valor da venda, não a nota recebida');
select is((select esperado_cents from resumo), 11700, 'esperado = 100 + 37 + 10 − 30 = 117,00');

-- Garçom não mexe no caixa
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}';
select throws_ok(
  format($$ select public.movimentar_caixa(%L, 'sangria', 100, null) $$, (select id from sessao)),
  '42501', null, 'garçom não faz sangria');

-- Fechamento: contou 115,00 (faltaram 2,00)
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
create temp table fechamento on commit drop as
select * from public.fechar_caixa((select id from sessao), 11500, 'Conferido');
select is((select diferenca_cents from fechamento), -200, 'diferença de −2,00 registrada');
select throws_ok(
  format($$ select public.movimentar_caixa(%L, 'suprimento', 100, null) $$, (select id from sessao)),
  'P0001', null, 'caixa fechado não aceita movimento');
select throws_ok(
  format($$ select * from public.fechar_caixa(%L, 100) $$, (select id from sessao)),
  'P0001', null, 'caixa fechado não fecha de novo');

select * from finish();
rollback;
