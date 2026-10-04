-- Loja online, parte 1: o que falta para publicar, horários e bairros.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b9', 'dono@online.teste');
insert into public.brands (id, slug, name, status) values
  ('1b000000-0000-4000-8000-000000000001', 'marca-online', 'Marca Online', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('2b000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('3b000000-0000-4000-8000-000000000001', '2b000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000001', 'online', 'Pastelaria', 'rascunho');
insert into public.memberships (restaurant_id, user_id, role) values
  ('3b000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b9', 'dono');
insert into public.categories (id, restaurant_id, name) values
  ('4b000000-0000-4000-8000-000000000001', '3b000000-0000-4000-8000-000000000001', 'Pastéis');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b9", "role": "authenticated"}';

select is(
  cardinality(public.pendencias_para_publicar('3b000000-0000-4000-8000-000000000001')), 4,
  'loja nova: falta endereço, telefone, horários e produto');
select throws_ok(
  $$ select public.publicar_loja('3b000000-0000-4000-8000-000000000001') $$,
  'P0001', null, 'não publica com pendências');

update public.restaurants
set street = 'Rua XV', street_number = '100', district = 'Centro', city = 'Mirassol', state = 'SP',
    phone = '17991234567', accepts_delivery = true, delivery_fee_mode = 'bairro'
where id = '3b000000-0000-4000-8000-000000000001';
insert into public.products (restaurant_id, category_id, name, price_cents) values
  ('3b000000-0000-4000-8000-000000000001', '4b000000-0000-4000-8000-000000000001', 'Pastel', 1200);
-- Sexta, 18h às 2h da madrugada
insert into public.opening_hours (restaurant_id, weekday, opens, closes) values
  ('3b000000-0000-4000-8000-000000000001', 5, '18:00', '02:00');

select is(
  public.pendencias_para_publicar('3b000000-0000-4000-8000-000000000001'),
  array['Cadastrar os bairros atendidos'], 'entrega por bairro exige os bairros');

insert into public.delivery_districts (restaurant_id, name, fee_cents) values
  ('3b000000-0000-4000-8000-000000000001', '  Jardim São José ', 500);
select is(
  (select name_key from public.delivery_districts where restaurant_id = '3b000000-0000-4000-8000-000000000001'),
  'jardim sao jose', 'bairro guardado sem acento e sem espaço, para comparar com o endereço do cliente');
select throws_ok(
  $$ insert into public.delivery_districts (restaurant_id, name) values ('3b000000-0000-4000-8000-000000000001', 'JARDIM SAO JOSE') $$,
  '23505', null, 'o mesmo bairro não entra duas vezes');

select lives_ok($$ select public.publicar_loja('3b000000-0000-4000-8000-000000000001') $$, 'sem pendências, publica');
select is((select status::text from public.restaurants where id = '3b000000-0000-4000-8000-000000000001'), 'ativo', 'loja no ar');
select throws_ok(
  $$ update public.restaurants set slug = 'outro' where id = '3b000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'endereço da loja (slug) continua fora do alcance da API');

-- Horários (fuso de São Paulo): sexta 2026-10-02
select is(public.loja_aberta_agora('3b000000-0000-4000-8000-000000000001', '2026-10-02 21:30-03'), true, 'sexta 21h30: aberta');
select is(public.loja_aberta_agora('3b000000-0000-4000-8000-000000000001', '2026-10-03 01:30-03'), true, 'sábado 1h30: ainda aberta (começou na sexta)');
select is(public.loja_aberta_agora('3b000000-0000-4000-8000-000000000001', '2026-10-03 15:00-03'), false, 'sábado 15h: fechada');

select * from finish();
rollback;
