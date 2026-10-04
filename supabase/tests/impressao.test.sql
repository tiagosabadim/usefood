-- E07 · Impressão: um ticket por praça, cada agente só vê a própria loja e ninguém imprime duas vezes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'dono@impressao.teste'),
  ('00000000-0000-4000-8000-0000000000f2', 'caixa@impressao.teste'),
  ('00000000-0000-4000-8000-0000000000f3', 'agente.a@impressao.teste'),
  ('00000000-0000-4000-8000-0000000000f4', 'agente.b@impressao.teste');
insert into public.brands (id, slug, name, status) values
  ('15000000-0000-4000-8000-000000000001', 'marca-impressao', 'Marca Impressão', 'ativa');
insert into public.organizations (id, brand_id, name) values
  ('25000000-0000-4000-8000-00000000000a', '15000000-0000-4000-8000-000000000001', 'Org A'),
  ('25000000-0000-4000-8000-00000000000b', '15000000-0000-4000-8000-000000000001', 'Org B');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status) values
  ('35000000-0000-4000-8000-00000000000a', '25000000-0000-4000-8000-00000000000a', '15000000-0000-4000-8000-000000000001', 'impressao-a', 'Pastelaria A', 'ativo'),
  ('35000000-0000-4000-8000-00000000000b', '25000000-0000-4000-8000-00000000000b', '15000000-0000-4000-8000-000000000001', 'impressao-b', 'Loja B', 'ativo');
insert into public.memberships (restaurant_id, user_id, role) values
  ('35000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000f1', 'dono'),
  ('35000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000f2', 'caixa');
insert into public.print_agents (id, restaurant_id, user_id, name) values
  ('65000000-0000-4000-8000-00000000000a', '35000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000f3', 'Computador do caixa'),
  ('65000000-0000-4000-8000-00000000000b', '35000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000f4', 'Outra loja');

-- Praças: Cozinha (nasce sozinha) e Bar; só a Cozinha tem impressora
insert into public.stations (id, restaurant_id, name) values
  ('75000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-00000000000a', 'Bar');
insert into public.printers (id, restaurant_id, station_id, name, host)
select '85000000-0000-4000-8000-000000000001', s.restaurant_id, s.id, 'Térmica da cozinha', '192.168.0.50'
from public.stations s where s.restaurant_id = '35000000-0000-4000-8000-00000000000a' and s.name = 'Cozinha';
insert into public.categories (id, restaurant_id, name) values
  ('45000000-0000-4000-8000-00000000000a', '35000000-0000-4000-8000-00000000000a', 'Tudo');
insert into public.products (id, restaurant_id, category_id, name, price_cents, station_id) values
  ('55000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-00000000000a', '45000000-0000-4000-8000-00000000000a', 'Pastel de feijão', 1400, null),
  ('55000000-0000-4000-8000-000000000002', '35000000-0000-4000-8000-00000000000a', '45000000-0000-4000-8000-00000000000a', 'Caipirinha', 2000, '75000000-0000-4000-8000-000000000001');

-- Caixa lança um pedido com item da Cozinha e do Bar
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated"}';
create temp table pedido on commit drop as
select * from public.criar_pedido('35000000-0000-4000-8000-00000000000a', 'balcao', 'nome', 'João',
  '[{"product_id": "55000000-0000-4000-8000-000000000001", "quantidade": 2, "observacao": "bem passado"},
    {"product_id": "55000000-0000-4000-8000-000000000002", "quantidade": 1}]');

select is(
  (select count(*)::int from public.print_jobs where order_id = (select id from pedido)),
  2, 'um ticket por praça');
select is(
  (select status::text from public.print_jobs where order_id = (select id from pedido) and printer_id is not null),
  'pendente', 'ticket da Cozinha fica na fila');
select is(
  (select error from public.print_jobs where order_id = (select id from pedido) and printer_id is null),
  'Praça Bar sem impressora cadastrada', 'praça sem impressora já avisa');
select is(
  (select jsonb_array_length(payload -> 'itens') from public.print_jobs
     where order_id = (select id from pedido) and printer_id is not null),
  1, 'ticket da Cozinha leva só os itens da Cozinha');
select is(
  (select payload ->> 'identificador' from public.print_jobs
     where order_id = (select id from pedido) and printer_id is not null),
  'João', 'ticket leva o identificador do pedido');
select is(
  (select count(*)::int from public.print_agent_pairings), 0, 'caixa não vê códigos de pareamento');
select throws_ok(
  $$ select * from public.criar_codigo_de_pareamento('35000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'caixa não gera código de pareamento');

-- Dono gera o código
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f1", "role": "authenticated"}';
select matches(
  (select codigo from public.criar_codigo_de_pareamento('35000000-0000-4000-8000-00000000000a')),
  '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$', 'código de pareamento no formato XXXX-XXXX, sem letras ambíguas');

-- Agente da loja A
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f3", "role": "authenticated"}';
select is(public.agente_presente('0.1.0'), '35000000-0000-4000-8000-00000000000a'::uuid, 'agente avisa que está vivo');
create temp table job on commit drop as
select id from public.print_jobs where status = 'pendente';
select is((select count(*)::int from job), 1, 'agente vê a fila da própria loja');
select is(
  (select host from public.pegar_impressao((select id from job))), '192.168.0.50',
  'agente reserva a ordem e recebe o endereço da impressora');
select is(
  (select count(*)::int from public.pegar_impressao((select id from job))), 0,
  'a mesma ordem não é reservada duas vezes');
select is(
  public.concluir_impressao((select id from job), true), 'impresso'::public.print_job_status,
  'ticket confirmado como impresso');

-- Agente da loja B não vê nada da loja A
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f4", "role": "authenticated"}';
select is(
  (select count(*)::int from public.print_jobs where restaurant_id = '35000000-0000-4000-8000-00000000000a'),
  0, 'agente de outra loja não vê a fila');

-- Caixa reimprime
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated"}';
select is(public.reimprimir_pedido((select id from pedido)), 1, 'reimpressão gera ticket de novo para a Cozinha');
select is(
  (select count(*)::int from public.print_jobs where order_id = (select id from pedido) and kind = 'reimpressao'),
  2, 'reimpressão também avisa a praça sem impressora');

select * from finish();
rollback;
