-- Leads das landing pages: envio sem login, regras e quem vê.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'admin@leads.teste'),
  ('00000000-0000-4000-8000-0000000000f2', 'dono@leads.teste');
insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-0000000000f1');

set local role anon;
select isnt(
  public.enviar_lead('restaurante', 'Carlos', '(17) 99999-1111', 'Mirassol', 'sp', true, null, 'Lanches do Carlos', 'Lanches', '30 a 100',
                     null, '{"utm_source": "instagram"}'),
  null, 'visitante envia o formulário sem login');
select throws_ok(
  $$ select public.enviar_lead('franquia', 'Ana', '17988887777', 'Bálsamo', 'SP', false) $$,
  '22023', null, 'sem aceite da LGPD não envia');
select throws_ok(
  $$ select public.enviar_lead('franquia', 'Ana', '1234', 'Bálsamo', 'SP', true) $$,
  '22023', null, 'WhatsApp precisa de DDD');
select public.enviar_lead('franquia', 'Ana', '17988887777', 'Bálsamo', 'SP', true);
select public.enviar_lead('franquia', 'Ana', '17988887777', 'Bálsamo', 'SP', true);
select public.enviar_lead('franquia', 'Ana', '17988887777', 'Bálsamo', 'SP', true);
select throws_ok(
  $$ select public.enviar_lead('franquia', 'Ana', '17988887777', 'Bálsamo', 'SP', true) $$,
  'P0001', null, 'quarto envio do mesmo celular em 24 horas é barrado');
select is((select count(*)::int from public.leads), 0, 'visitante não lê os leads');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated"}';
select is((select count(*)::int from public.leads), 0, 'dono de restaurante não vê os leads');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f1", "role": "authenticated"}';
select is(
  (select state || ' · ' || (source ->> 'utm_source') from public.leads where kind = 'restaurante'),
  'SP · instagram', 'equipe da plataforma vê, com UF em maiúscula e a origem da campanha');

select * from finish();
rollback;
