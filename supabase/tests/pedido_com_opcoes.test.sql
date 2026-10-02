-- E05 · Tamanhos, adicionais e conta dividida: o banco confere tudo e soma o preço.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'caixa@opcoes.teste');
insert into public.brands (id, slug, name, status) values
  ('13000000-0000-4000-8000-000000000001', 'marca-opcoes', 'Marca Opções', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('23000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('33000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
   '13000000-0000-4000-8000-000000000001', 'opcoes', 'Pizzaria', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('33000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d1', 'caixa');
insert into public.categories (id, restaurant_id, name) values
  ('43000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'Pizzas');

-- Pizza com tamanhos; Lanche com "Ponto" (obrigatório, 1) e "Extras" (opcional, até 2)
insert into public.products (id, restaurant_id, category_id, name, price_cents) values
  ('53000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Pizza', 1),
  ('53000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Lanche', 2000);
insert into public.product_variants (id, restaurant_id, product_id, name, price_cents) values
  ('63000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', 'Média', 3500),
  ('63000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', 'Grande', 4500);
insert into public.modifier_groups (id, restaurant_id, name, min_select, max_select) values
  ('73000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'Ponto', 1, 1),
  ('73000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', 'Extras', 0, 2),
  ('73000000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000001', 'Bordas', 0, 1);
insert into public.modifiers (id, restaurant_id, group_id, name, price_cents) values
  ('83000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', 'Ao ponto', 0),
  ('83000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000002', 'Bacon', 400),
  ('83000000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000002', 'Ovo', 250),
  ('83000000-0000-4000-8000-000000000004', '33000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000002', 'Cheddar', 300),
  ('83000000-0000-4000-8000-000000000005', '33000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000003', 'Catupiry', 800);
insert into public.product_modifier_groups (restaurant_id, product_id, group_id) values
  ('33000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000001'),
  ('33000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002');

-- Pagamento exige caixa aberto (E06)
insert into public.cash_sessions (restaurant_id, opening_cents) values ('33000000-0000-4000-8000-000000000001', 0);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.criar_pedido('33000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
       '[{"product_id": "53000000-0000-4000-8000-000000000001", "quantidade": 1}]') $$,
  '22023', null, 'produto com tamanhos exige o tamanho');

create temp table pizza on commit drop as
select * from public.criar_pedido('33000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
  '[{"product_id": "53000000-0000-4000-8000-000000000001", "quantidade": 2, "variant_id": "63000000-0000-4000-8000-000000000002"}]');
select is((select total_cents from pizza), 9000, 'preço vem do tamanho escolhido (2 × Grande 45,00)');
select is(
  (select variant_name from public.order_items where order_id = (select id from pizza)),
  'Grande', 'item guarda o nome do tamanho');

select throws_ok(
  $$ select * from public.criar_pedido('33000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
       '[{"product_id": "53000000-0000-4000-8000-000000000002", "quantidade": 1}]') $$,
  '22023', null, 'grupo obrigatório (Ponto) precisa de escolha');
select throws_ok(
  $$ select * from public.criar_pedido('33000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
       '[{"product_id": "53000000-0000-4000-8000-000000000002", "quantidade": 1,
          "adicionais": ["83000000-0000-4000-8000-000000000001", "83000000-0000-4000-8000-000000000002",
                         "83000000-0000-4000-8000-000000000003", "83000000-0000-4000-8000-000000000004"]}]') $$,
  '22023', null, 'grupo Extras aceita no máximo 2');
select throws_ok(
  $$ select * from public.criar_pedido('33000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
       '[{"product_id": "53000000-0000-4000-8000-000000000002", "quantidade": 1,
          "adicionais": ["83000000-0000-4000-8000-000000000001", "83000000-0000-4000-8000-000000000005"]}]') $$,
  '22023', null, 'adicional de grupo não ligado ao produto é recusado');

create temp table lanche on commit drop as
select * from public.criar_pedido('33000000-0000-4000-8000-000000000001', 'balcao', 'senha', null,
  '[{"product_id": "53000000-0000-4000-8000-000000000002", "quantidade": 1, "observacao": "sem cebola",
     "adicionais": ["83000000-0000-4000-8000-000000000001", "83000000-0000-4000-8000-000000000002", "83000000-0000-4000-8000-000000000003"]}]');
select is((select total_cents from lanche), 2650, 'adicionais somam no preço (20,00 + 4,00 + 2,50)');
select is(
  (select count(*)::int from public.order_item_modifiers m
     join public.order_items i on i.id = m.order_item_id where i.order_id = (select id from lanche)),
  3, 'item guarda os 3 adicionais escolhidos');

-- Conta dividida do lanche (26,50): 13,25 no Pix e 13,25 em dinheiro com nota de 20
create temp table parte1 on commit drop as
select * from public.registrar_pagamento((select id from lanche), 'pix', 1325);
select is((select falta_cents from parte1), 1325, 'primeira parte paga, falta a outra metade');
create temp table parte2 on commit drop as
select * from public.registrar_pagamento((select id from lanche), 'dinheiro', 1325, 2000);
select is((select troco_cents from parte2), 675, 'troco calculado sobre a parte (20,00 − 13,25)');
select is((select falta_cents from parte2), 0, 'conta quitada nas duas partes');
select throws_ok(
  format($$ select * from public.registrar_pagamento(%L, 'pix', 100, 200) $$, (select id from pizza)),
  '22023', null, 'valor recebido só vale para dinheiro');

select * from finish();
rollback;
