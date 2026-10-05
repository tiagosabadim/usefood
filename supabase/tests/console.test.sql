-- Console da plataforma: só administradores veem todas as lojas e criam lojas para donos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'admin@usefood.teste'),
  ('00000000-0000-4000-8000-0000000000a2', 'dono-novo@loja.teste'),
  ('00000000-0000-4000-8000-0000000000a3', 'curioso@loja.teste');
insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.brands (id, slug, name, status) values ('1f000000-0000-4000-8000-000000000001', 'marca-console', 'Marca Console', 'ativa');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated"}';
select is(public.sou_admin_da_plataforma(), false, 'quem não é da equipe usefood não é admin');
select throws_ok($$ select * from public.console_lojas() $$, '42501', null, 'e não vê todas as lojas');
select throws_ok(
  $$ select public.console_criar_loja('marca-console', 'Loja X', 'loja-x', '00000000-0000-4000-8000-0000000000a3') $$,
  '42501', null, 'nem cria loja para outra pessoa');
select throws_ok($$ select public.console_usuario_por_email('admin@usefood.teste') $$, '42501', null, 'nem procura gente pelo e-mail');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';
create temp table nova on commit drop as
select public.console_criar_loja('marca-console', '  Pastelaria do Zé ', 'pastel-do-ze', '00000000-0000-4000-8000-0000000000a2') as id;
select is(
  (select donos from public.console_lojas() where slug = 'pastel-do-ze'),
  array['dono-novo@loja.teste'], 'admin cria a loja e o dono aparece na lista');
select is((select situacao::text from public.console_lojas() where slug = 'pastel-do-ze'), 'rascunho', 'loja nasce em cadastro');
select throws_ok(
  $$ select public.console_criar_loja('marca-console', 'Outra', 'pastel-do-ze', '00000000-0000-4000-8000-0000000000a2') $$,
  '23505', null, 'endereço repetido na mesma marca não passa');
select throws_ok(
  format($$ select public.console_mudar_situacao(%L, 'ativo') $$, (select id from nova)),
  'P0001', null, 'admin não publica no lugar do dono');
select is(public.console_mudar_situacao((select id from nova), 'encerrado'), 'encerrado'::public.restaurant_status, 'admin encerra a loja');

select * from finish();
rollback;
