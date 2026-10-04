-- Equipe com PIN: só aparelho conectado aceita PIN, 5 erros travam, o hash do PIN não sai pela API.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000e0a1', 'dono@equipe.teste'),
  ('00000000-0000-4000-8000-00000000e0a2', 'agente-garcom@equipe.usefood.app'),
  ('00000000-0000-4000-8000-00000000e0a3', 'agente-caixa@equipe.usefood.app');
insert into public.brands (id, slug, name, status) values
  ('19000000-0000-4000-8000-000000000001', 'marca-equipe', 'Marca Equipe', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('29000000-0000-4000-8000-000000000001', '19000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('39000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000001', '19000000-0000-4000-8000-000000000001', 'equipe', 'Bar da Equipe', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a1', 'dono'),
  ('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a2', 'garcom'),
  ('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a3', 'caixa');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e0a1", "role": "authenticated"}';

select lives_ok(
  $$ select public.definir_pin('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a2', '1234', 'Carlos') $$,
  'dono define o PIN do garçom');
select throws_ok(
  $$ select public.definir_pin('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a3', '1234', 'Ana') $$,
  '23505', null, 'dois PINs iguais na mesma loja não');
select throws_ok(
  $$ select public.definir_pin('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a3', '12a4', 'Ana') $$,
  '22023', null, 'PIN tem 4 números');
select lives_ok(
  $$ select public.definir_pin('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a3', '5678', 'Ana') $$,
  'PIN da caixa');
select is(
  (select count(*)::int from public.membros_da_equipe('39000000-0000-4000-8000-000000000001')), 3,
  'dono vê as 3 pessoas da equipe');
select throws_ok(
  $$ select pin_hash from public.staff_pins $$,
  '42501', null, 'o hash do PIN não sai pela API');

create temp table codigo on commit drop as
select codigo from public.criar_codigo_de_pareamento('39000000-0000-4000-8000-000000000001', 'equipe');
grant select on codigo to service_role;

-- Garçom não gerencia a equipe nem chama a função do PIN
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e0a2", "role": "authenticated"}';
select is(
  (select count(*)::int from public.membros_da_equipe('39000000-0000-4000-8000-000000000001')), 0,
  'garçom não vê a lista da equipe');
select throws_ok(
  $$ select * from public.entrar_com_pin('qualquer', '1234') $$,
  '42501', null, 'só a Edge Function confere PIN');

-- Edge Function (service_role): pareia o aparelho e confere PINs
set local role service_role;
select is(
  (select loja from public.parear_aparelho((select codigo from codigo), 'Celular do salão', 'hash-celular')),
  'Bar da Equipe', 'código conecta o aparelho à loja');
select is(
  (select count(*)::int from public.parear_aparelho((select codigo from codigo), 'Outro', 'hash-outro')),
  0, 'o mesmo código não conecta dois aparelhos');
select is(
  (select nome from public.entrar_com_pin('hash-celular', '1234')), 'Carlos',
  'PIN certo no aparelho conectado entra como o garçom');
select is(
  (select ok from public.entrar_com_pin('hash-desconhecido', '1234')), false,
  'aparelho não conectado não entra');

select is((select ok from public.entrar_com_pin('hash-celular', '0000')), false, 'PIN errado não entra');
select public.entrar_com_pin('hash-celular', '0001');
select public.entrar_com_pin('hash-celular', '0002');
select public.entrar_com_pin('hash-celular', '0003');
select is(
  (select mensagem from public.entrar_com_pin('hash-celular', '0004')),
  'PIN incorreto. Aparelho travado por 5 minutos.', 'quinto erro trava o aparelho');
select matches(
  (select mensagem from public.entrar_com_pin('hash-celular', '1234')),
  '^Muitas tentativas', 'travado, nem o PIN certo entra');

-- Dono remove o garçom: o PIN dele deixa de valer (outro aparelho, sem trava)
reset role;
insert into public.staff_devices (restaurant_id, name, token_hash)
values ('39000000-0000-4000-8000-000000000001', 'Tablet', 'hash-tablet');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e0a1", "role": "authenticated"}';
select public.remover_da_equipe('39000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000e0a2');
set local role service_role;
select is(
  (select ok from public.entrar_com_pin('hash-tablet', '1234')), false,
  'quem saiu da equipe não entra mais');

select * from finish();
rollback;
