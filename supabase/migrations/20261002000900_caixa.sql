-- E06 · Caixa: abertura com fundo de troco, sangria, suprimento e fechamento conferido.
-- Todo pagamento cai no caixa aberto da loja; sem caixa aberto, não se recebe.

create type public.cash_session_status as enum ('aberto', 'fechado');
create type public.cash_movement_type as enum ('sangria', 'suprimento');

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  register_name text not null default 'Caixa 1' check (length(trim(register_name)) between 1 and 40),
  status public.cash_session_status not null default 'aberto',
  opening_cents integer not null check (opening_cents >= 0),
  opened_by uuid references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  expected_cents integer,
  counted_cents integer check (counted_cents >= 0),
  difference_cents integer,
  closing_notes text check (length(closing_notes) <= 300),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  unique (id, restaurant_id)
);
-- Um caixa aberto por vez em cada ponto de venda da loja
create unique index cash_sessions_um_aberto on public.cash_sessions (restaurant_id, register_name)
  where status = 'aberto';
create index cash_sessions_restaurant_idx on public.cash_sessions (restaurant_id, opened_at desc);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  session_id uuid not null,
  type public.cash_movement_type not null,
  amount_cents integer not null check (amount_cents > 0),
  reason text check (length(reason) <= 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (session_id, restaurant_id)
    references public.cash_sessions (id, restaurant_id) on delete cascade
);
create index cash_movements_session_idx on public.cash_movements (session_id);

alter table public.payments
  add column cash_session_id uuid references public.cash_sessions (id) on delete set null;
create index payments_cash_session_idx on public.payments (cash_session_id);

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
create policy "equipe vê o caixa" on public.cash_sessions
  for select to authenticated using (private.pode_ver_loja(restaurant_id));
create policy "equipe vê os movimentos do caixa" on public.cash_movements
  for select to authenticated using (private.pode_ver_loja(restaurant_id));

-- ---------------------------------------------------------------------------
-- Abrir, movimentar e fechar: só pelas funções (quem cobra: dono, gerente, caixa)
-- ---------------------------------------------------------------------------
create function public.abrir_caixa(
  p_restaurant_id uuid,
  p_fundo_cents integer,
  p_caixa text default 'Caixa 1'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao uuid;
begin
  if not private.pode_cobrar(p_restaurant_id) then
    raise exception 'Você não pode abrir o caixa desta loja' using errcode = '42501';
  end if;
  if p_fundo_cents is null or p_fundo_cents < 0 then
    raise exception 'Fundo de troco inválido' using errcode = '22023';
  end if;
  if exists (select 1 from public.cash_sessions s
             where s.restaurant_id = p_restaurant_id and s.register_name = coalesce(nullif(trim(p_caixa), ''), 'Caixa 1')
               and s.status = 'aberto') then
    raise exception 'Este caixa já está aberto' using errcode = 'P0001';
  end if;

  insert into public.cash_sessions (restaurant_id, register_name, opening_cents, opened_by)
  values (p_restaurant_id, coalesce(nullif(trim(p_caixa), ''), 'Caixa 1'), p_fundo_cents, (select auth.uid()))
  returning id into v_sessao;
  return v_sessao;
end;
$$;

create function public.movimentar_caixa(
  p_sessao uuid,
  p_tipo public.cash_movement_type,
  p_valor_cents integer,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao record;
  v_movimento uuid;
begin
  select s.id, s.restaurant_id, s.status into v_sessao
  from public.cash_sessions s where s.id = p_sessao for update;
  if not found or not private.pode_cobrar(v_sessao.restaurant_id) then
    raise exception 'Caixa não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v_sessao.status <> 'aberto' then
    raise exception 'Este caixa já foi fechado' using errcode = 'P0001';
  end if;
  if p_valor_cents is null or p_valor_cents <= 0 then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;

  insert into public.cash_movements (restaurant_id, session_id, type, amount_cents, reason, created_by)
  values (v_sessao.restaurant_id, v_sessao.id, p_tipo, p_valor_cents, nullif(trim(p_motivo), ''), (select auth.uid()))
  returning id into v_movimento;
  return v_movimento;
end;
$$;

-- Números do turno: vendas por forma, movimentos e o dinheiro esperado na gaveta
create function public.resumo_do_caixa(p_sessao uuid)
returns table (
  fundo_cents integer,
  dinheiro_cents integer,
  pix_cents integer,
  credito_cents integer,
  debito_cents integer,
  outros_cents integer,
  suprimentos_cents integer,
  sangrias_cents integer,
  esperado_cents integer,
  pedidos integer,
  vendido_cents integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with s as (
    select id, opening_cents from public.cash_sessions where id = p_sessao
  ), p as (
    select method, amount_cents, order_id from public.payments where cash_session_id = p_sessao
  ), m as (
    select type, amount_cents from public.cash_movements where session_id = p_sessao
  ), n as (
    select
      (select opening_cents from s) as fundo,
      coalesce((select sum(amount_cents) from p where method = 'dinheiro'), 0)::integer as dinheiro,
      coalesce((select sum(amount_cents) from p where method = 'pix'), 0)::integer as pix,
      coalesce((select sum(amount_cents) from p where method = 'credito'), 0)::integer as credito,
      coalesce((select sum(amount_cents) from p where method = 'debito'), 0)::integer as debito,
      coalesce((select sum(amount_cents) from p where method in ('vale_refeicao', 'outro')), 0)::integer as outros,
      coalesce((select sum(amount_cents) from m where type = 'suprimento'), 0)::integer as suprimentos,
      coalesce((select sum(amount_cents) from m where type = 'sangria'), 0)::integer as sangrias,
      (select count(distinct order_id) from p)::integer as pedidos,
      coalesce((select sum(amount_cents) from p), 0)::integer as vendido
  )
  select fundo, dinheiro, pix, credito, debito, outros, suprimentos, sangrias,
         fundo + dinheiro + suprimentos - sangrias, pedidos, vendido
  from n
  where fundo is not null;
$$;

create function public.fechar_caixa(
  p_sessao uuid,
  p_contado_cents integer,
  p_observacao text default null
)
returns table (esperado_cents integer, contado_cents integer, diferenca_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao record;
  v_esperado integer;
begin
  select s.id, s.restaurant_id, s.status into v_sessao
  from public.cash_sessions s where s.id = p_sessao for update;
  if not found or not private.pode_cobrar(v_sessao.restaurant_id) then
    raise exception 'Caixa não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v_sessao.status <> 'aberto' then
    raise exception 'Este caixa já foi fechado' using errcode = 'P0001';
  end if;
  if p_contado_cents is null or p_contado_cents < 0 then
    raise exception 'Valor contado inválido' using errcode = '22023';
  end if;

  select r.esperado_cents into v_esperado from public.resumo_do_caixa(p_sessao) r;

  update public.cash_sessions s
  set status = 'fechado', expected_cents = v_esperado, counted_cents = p_contado_cents,
      difference_cents = p_contado_cents - v_esperado, closing_notes = nullif(trim(p_observacao), ''),
      closed_by = (select auth.uid()), closed_at = now()
  where s.id = p_sessao;

  return query select v_esperado, p_contado_cents, p_contado_cents - v_esperado;
end;
$$;

-- ---------------------------------------------------------------------------
-- registrar_pagamento passa a exigir caixa aberto e a gravar o pagamento nele
-- ---------------------------------------------------------------------------
create or replace function public.registrar_pagamento(
  p_pedido uuid,
  p_metodo public.payment_method,
  p_valor_cents integer,
  p_recebido_cents integer default null
)
returns table (pago_cents integer, falta_cents integer, troco_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_sessao uuid;
  v_falta integer;
  v_valor integer;
  v_troco integer := 0;
begin
  select o.id, o.restaurant_id, o.status, o.total_cents, o.paid_cents into v_pedido
  from public.orders o where o.id = p_pedido
  for update;
  if not found or not private.pode_cobrar(v_pedido.restaurant_id) then
    raise exception 'Pedido não encontrado ou você não pode cobrar nesta loja' using errcode = '42501';
  end if;
  if v_pedido.status = 'cancelado' then
    raise exception 'Este pedido foi cancelado' using errcode = 'P0001';
  end if;
  if p_valor_cents is null or p_valor_cents <= 0 then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;

  select s.id into v_sessao from public.cash_sessions s
  where s.restaurant_id = v_pedido.restaurant_id and s.status = 'aberto'
  order by s.opened_at limit 1;
  if v_sessao is null then
    raise exception 'Abra o caixa antes de receber pagamentos' using errcode = 'P0001';
  end if;

  v_falta := v_pedido.total_cents - v_pedido.paid_cents;
  if v_falta <= 0 then
    raise exception 'Este pedido já está pago' using errcode = 'P0001';
  end if;

  if p_recebido_cents is not null then
    if p_metodo <> 'dinheiro' then
      raise exception 'Valor recebido só vale para dinheiro' using errcode = '22023';
    end if;
    v_valor := least(p_valor_cents, v_falta);
    if p_recebido_cents < v_valor then
      raise exception 'Valor recebido menor que a parte' using errcode = '22023';
    end if;
    v_troco := p_recebido_cents - v_valor;
  elsif p_valor_cents > v_falta then
    if p_metodo <> 'dinheiro' then
      raise exception 'Valor maior que o que falta pagar' using errcode = '22023';
    end if;
    v_troco := p_valor_cents - v_falta;
    v_valor := v_falta;
  else
    v_valor := p_valor_cents;
  end if;

  insert into public.payments (restaurant_id, order_id, method, amount_cents, change_cents, created_by, cash_session_id)
  values (v_pedido.restaurant_id, v_pedido.id, p_metodo, v_valor, v_troco, (select auth.uid()), v_sessao);

  update public.orders o set paid_cents = o.paid_cents + v_valor where o.id = v_pedido.id;

  return query select v_pedido.paid_cents + v_valor, v_falta - v_valor, v_troco;
end;
$$;

revoke execute on function public.abrir_caixa(uuid, integer, text) from public, anon;
grant execute on function public.abrir_caixa(uuid, integer, text) to authenticated;
revoke execute on function public.movimentar_caixa(uuid, public.cash_movement_type, integer, text) from public, anon;
grant execute on function public.movimentar_caixa(uuid, public.cash_movement_type, integer, text) to authenticated;
revoke execute on function public.fechar_caixa(uuid, integer, text) from public, anon;
grant execute on function public.fechar_caixa(uuid, integer, text) to authenticated;
revoke execute on function public.resumo_do_caixa(uuid) from public, anon;
grant execute on function public.resumo_do_caixa(uuid) to authenticated;
