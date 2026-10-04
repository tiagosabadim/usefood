-- Salão: configurações de atendimento, mesas e a correção de quais colunas da loja a equipe altera.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000d0a1', 'dono@salao.teste'),
  ('00000000-0000-4000-8000-00000000d0a2', 'garcom@salao.teste'),
  ('00000000-0000-4000-8000-00000000d0b1', 'dono.b@salao.teste');
insert into public.brands (id, slug, name, status) values
  ('18000000-0000-4000-8000-000000000001', 'marca-salao', 'Marca Salão', 'ativa'),
  ('18000000-0000-4000-8000-000000000002', 'outra-marca', 'Outra Marca', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('28000000-0000-4000-8000-00000000000a', '18000000-0000-4000-8000-000000000001', 'Org A'),
  ('28000000-0000-4000-8000-00000000000b', '18000000-0000-4000-8000-000000000001', 'Org B');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('38000000-0000-4000-8000-00000000000a', '28000000-0000-4000-8000-00000000000a', '18000000-0000-4000-8000-000000000001', 'salao-a', 'Bar A', 'rascunho'),
  ('38000000-0000-4000-8000-00000000000b', '28000000-0000-4000-8000-00000000000b', '18000000-0000-4000-8000-000000000001', 'salao-b', 'Bar B', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('38000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000d0a1', 'dono'),
  ('38000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000d0a2', 'garcom'),
  ('38000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000d0b1', 'dono');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000d0a1", "role": "authenticated"}';

update public.restaurants set call_by = 'nome', counter_dine_in = 'garcom_leva'
where id = '38000000-0000-4000-8000-00000000000a';
select is(
  (select call_by::text || '/' || counter_dine_in::text from public.restaurants where id = '38000000-0000-4000-8000-00000000000a'),
  'nome/garcom_leva', 'dono muda o jeito de atender');
select throws_ok(
  $$ update public.restaurants set status = 'ativo' where id = '38000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'dono não ativa a própria loja pela API');
select throws_ok(
  $$ update public.restaurants set brand_id = '18000000-0000-4000-8000-000000000002' where id = '38000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'dono não troca a loja de marca');

select is(public.criar_mesas('38000000-0000-4000-8000-00000000000a', 1, 10), 10, 'cria as mesas de 1 a 10');
select is(public.criar_mesas('38000000-0000-4000-8000-00000000000a', 8, 12, 'Varanda'), 2, 'mesas repetidas são mantidas; só 11 e 12 são novas');
select throws_ok(
  $$ insert into public.dining_tables (restaurant_id, label) values ('38000000-0000-4000-8000-00000000000a', '1') $$,
  '23505', null, 'não existem duas mesas 1');
select throws_ok(
  $$ select public.criar_mesas('38000000-0000-4000-8000-00000000000a', 1, 500) $$,
  '22023', null, 'intervalo grande demais é recusado');

-- Garçom vê as mesas, mas não cadastra
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000d0a2", "role": "authenticated"}';
select is((select count(*)::int from public.dining_tables), 12, 'garçom vê as 12 mesas');
select throws_ok(
  $$ select public.criar_mesas('38000000-0000-4000-8000-00000000000a', 20, 21) $$,
  '42501', null, 'garçom não cadastra mesas');

-- Outra loja não vê as mesas
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000d0b1", "role": "authenticated"}';
select is((select count(*)::int from public.dining_tables), 0, 'outra loja não vê as mesas');

select * from finish();
rollback;
