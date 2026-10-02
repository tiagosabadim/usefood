-- E03 · Critério de pronto: uma loja nunca enxerga os dados de outra.
-- Roda com `pnpm db:test` (pgTAP). Tudo acontece numa transação desfeita no fim.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Cenário: uma marca, duas lojas em rascunho, um dono para cada e um franqueado
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'dono.a@teste.local'),
  ('00000000-0000-4000-8000-00000000000b', 'dono.b@teste.local'),
  ('00000000-0000-4000-8000-00000000000f', 'franqueado@teste.local');

insert into public.brands (id, slug, name, status) values
  ('10000000-0000-4000-8000-000000000001', 'marca-teste', 'Marca Teste', 'ativa');

insert into public.organizations (id, brand_id, name) values
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 'Org A'),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', 'Org B');

insert into public.restaurants (id, organization_id, brand_id, slug, name) values
  ('30000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a',
   '10000000-0000-4000-8000-000000000001', 'loja-a', 'Loja A'),
  ('30000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b',
   '10000000-0000-4000-8000-000000000001', 'loja-b', 'Loja B');

insert into public.memberships (restaurant_id, user_id, role) values
  ('30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'dono'),
  ('30000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'dono');

insert into public.brand_members (brand_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000f', 'franqueado');

-- Domínio próprio ativo da loja A e um domínio ainda pendente de verificação
insert into public.domains (brand_id, kind, restaurant_id, hostname, status) values
  ('10000000-0000-4000-8000-000000000001', 'loja', '30000000-0000-4000-8000-00000000000a',
   'loja-a.teste', 'ativo');
insert into public.domains (brand_id, hostname, status) values
  ('10000000-0000-4000-8000-000000000001', 'pendente.teste', 'pendente');

-- Como dono da loja A
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.restaurants where id = '30000000-0000-4000-8000-00000000000a'),
  1, 'dono A vê a própria loja');
select is(
  (select count(*)::int from public.restaurants where id = '30000000-0000-4000-8000-00000000000b'),
  0, 'dono A não vê a loja B em rascunho');
select is(
  (select count(*)::int from public.memberships where restaurant_id = '30000000-0000-4000-8000-00000000000b'),
  0, 'dono A não vê a equipe da loja B');

update public.restaurants set name = 'Invadida' where id = '30000000-0000-4000-8000-00000000000b';

select throws_ok(
  $$ insert into public.memberships (restaurant_id, user_id, role)
     values ('30000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000a', 'gerente') $$,
  '42501', null, 'dono A não entra na equipe da loja B');
select throws_ok(
  $$ update public.restaurants set brand_id = '10000000-0000-4000-8000-000000000001'
     where id = '30000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'dono A não troca a marca da própria loja');

-- Como franqueado da marca
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000f", "role": "authenticated"}';
select is(
  (select count(*)::int from public.restaurants where brand_id = '10000000-0000-4000-8000-000000000001'),
  2, 'franqueado vê todas as lojas da marca');

-- Visitante anônimo: só lojas ativas
reset role;
update public.restaurants set status = 'ativo' where id = '30000000-0000-4000-8000-00000000000a';
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select count(*)::int from public.restaurants where brand_id = '10000000-0000-4000-8000-000000000001'),
  1, 'visitante vê só a loja ativa');
select is(
  (select count(*)::int from public.memberships),
  0, 'visitante não vê nenhuma equipe');
select is(
  (select restaurant_slug from public.resolver_dominio('WWW.Loja-A.teste')),
  'loja-a', 'domínio próprio leva direto à loja, com ou sem www');
select is(
  (select count(*)::int from public.domains where hostname = 'pendente.teste'),
  0, 'visitante não vê domínio pendente');
select is(
  (select count(*)::int from public.resolver_dominio('pendente.teste')),
  0, 'domínio pendente não resolve');

-- A tentativa de edição do dono A não alterou a loja B
reset role;
select is(
  (select name from public.restaurants where id = '30000000-0000-4000-8000-00000000000b'),
  'Loja B', 'loja B continua intacta');

select * from finish();
rollback;
