-- Contas: o pagamento sai do pedido e vai para a conta.
--   Balcão, retirada e delivery: cada pedido tem a sua conta.
--   Mesa: as rodadas somam na conta aberta da mesa até ela ser fechada.
-- A taxa de serviço (10%) é decidida no primeiro pagamento da conta, não em cada pedido.
-- Lançar pedido não exige caixa aberto; receber exige.

create type public.tab_status as enum ('aberta', 'fechada', 'cancelada');

create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  type public.order_type not null,
  identifier_type public.identifier_type not null,
  identifier text not null check (length(identifier) between 1 and 40),
  status public.tab_status not null default 'aberta',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  service_fee_cents integer not null default 0 check (service_fee_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  -- delivery e retirada: como o cliente disse que vai pagar
  expected_method public.payment_method,
  change_for_cents integer check (change_for_cents > 0),
  opened_by uuid references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (id, restaurant_id)
);
-- Uma conta aberta por mesa
create unique index tabs_uma_por_mesa on public.tabs (restaurant_id, lower(identifier))
  where identifier_type = 'mesa' and status = 'aberta';
create index tabs_abertas_idx on public.tabs (restaurant_id, status, opened_at);

alter table public.orders add column tab_id uuid;
alter table public.orders
  add constraint orders_tab_fkey foreign key (tab_id, restaurant_id)
  references public.tabs (id, restaurant_id) on delete restrict;
create index orders_tab_idx on public.orders (tab_id);

alter table public.payments alter column order_id drop not null;
alter table public.payments add column tab_id uuid;
alter table public.payments
  add constraint payments_tab_fkey foreign key (tab_id, restaurant_id)
  references public.tabs (id, restaurant_id) on delete cascade;
create index payments_tab_idx on public.payments (tab_id);

-- Pedidos que já existiam ganham uma conta cada, com o que já foi pago
do $$
declare
  v_pedido record;
  v_conta uuid;
begin
  for v_pedido in select * from public.orders where tab_id is null loop
    insert into public.tabs (restaurant_id, type, identifier_type, identifier, status, subtotal_cents,
                             service_fee_cents, discount_cents, total_cents, paid_cents, opened_by, opened_at, closed_at)
    values (v_pedido.restaurant_id, v_pedido.type, v_pedido.identifier_type, v_pedido.identifier,
            case when v_pedido.paid_cents >= v_pedido.total_cents then 'fechada'::public.tab_status else 'aberta'::public.tab_status end,
            v_pedido.subtotal_cents, v_pedido.service_fee_cents, v_pedido.discount_cents, v_pedido.total_cents,
            v_pedido.paid_cents, v_pedido.created_by, v_pedido.created_at,
            case when v_pedido.paid_cents >= v_pedido.total_cents then v_pedido.updated_at end)
    returning id into v_conta;
    update public.orders set tab_id = v_conta where id = v_pedido.id;
    update public.payments set tab_id = v_conta where order_id = v_pedido.id;
  end loop;
end;
$$;

alter table public.tabs enable row level security;
create policy "equipe vê as contas" on public.tabs
  for select to authenticated using (private.pode_ver_loja(restaurant_id));

-- Soma dos pedidos da conta (pedidos cancelados não contam)
create function private.recalcular_conta(p_conta uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tabs t
  set subtotal_cents = s.subtotal,
      total_cents = greatest(s.subtotal + t.service_fee_cents - t.discount_cents, 0)
  from (
    select coalesce(sum(o.subtotal_cents), 0)::integer as subtotal
    from public.orders o where o.tab_id = p_conta and o.status <> 'cancelado'
  ) s
  where t.id = p_conta;
$$;

-- ---------------------------------------------------------------------------
-- criar_pedido: lança na cozinha e põe o pedido na conta certa. Não cobra.
-- ---------------------------------------------------------------------------
drop function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text);

create function public.criar_pedido(
  p_restaurant_id uuid,
  p_tipo public.order_type,
  p_identificador_tipo public.identifier_type,
  p_identificador text,
  p_itens jsonb,
  p_observacao text default null,
  p_pagamento_previsto public.payment_method default null,
  p_troco_para_cents integer default null
)
returns table (id uuid, numero integer, identificador text, total_cents integer, conta_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_conta uuid;
begin
  if p_tipo = 'mesa' and p_identificador_tipo <> 'mesa' then
    raise exception 'Pedido de mesa precisa do número da mesa' using errcode = '22023';
  end if;

  select * into v from private.criar_pedido_sem_impressao(
    p_restaurant_id, p_tipo, p_identificador_tipo, p_identificador, p_itens, false, p_observacao);

  if p_identificador_tipo = 'mesa' then
    select t.id into v_conta from public.tabs t
    where t.restaurant_id = p_restaurant_id and t.identifier_type = 'mesa' and t.status = 'aberta'
      and lower(t.identifier) = lower(v.identificador)
    for update;
  end if;

  if v_conta is null then
    insert into public.tabs (restaurant_id, type, identifier_type, identifier, expected_method, change_for_cents, opened_by)
    values (p_restaurant_id, p_tipo, p_identificador_tipo, v.identificador, p_pagamento_previsto,
            case when p_pagamento_previsto = 'dinheiro' then p_troco_para_cents end, (select auth.uid()))
    returning tabs.id into v_conta;
  end if;

  update public.orders o set tab_id = v_conta where o.id = v.id;
  perform private.recalcular_conta(v_conta);
  perform private.gerar_impressoes(v.id, 'pedido');

  return query select v.id, v.numero, v.identificador, v.total_cents, v_conta;
end;
$$;
revoke execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, text, public.payment_method, integer) from public, anon;
grant execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, text, public.payment_method, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- receber_conta: paga a conta inteira, em partes ou dividida.
--   p_taxa_servico: liga ou desliga os 10%; só vale antes do primeiro pagamento.
--   p_recebido_cents: nota entregue (dinheiro); o troco sai sobre a parte.
-- ---------------------------------------------------------------------------
drop function public.registrar_pagamento(uuid, public.payment_method, integer, integer);

create function public.receber_conta(
  p_conta uuid,
  p_metodo public.payment_method,
  p_valor_cents integer,
  p_recebido_cents integer default null,
  p_taxa_servico boolean default null
)
returns table (pago_cents integer, falta_cents integer, troco_cents integer, total_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conta record;
  v_sessao uuid;
  v_taxa integer;
  v_falta integer;
  v_valor integer;
  v_troco integer := 0;
begin
  select t.* into v_conta from public.tabs t where t.id = p_conta for update;
  if not found or not private.pode_cobrar(v_conta.restaurant_id) then
    raise exception 'Conta não encontrada ou você não pode receber nesta loja' using errcode = '42501';
  end if;
  if v_conta.status <> 'aberta' then
    raise exception 'Esta conta já está fechada' using errcode = 'P0001';
  end if;
  if p_valor_cents is null or p_valor_cents <= 0 then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;

  select s.id into v_sessao from public.cash_sessions s
  where s.restaurant_id = v_conta.restaurant_id and s.status = 'aberto'
  order by s.opened_at limit 1;
  if v_sessao is null then
    raise exception 'Abra o caixa antes de receber pagamentos' using errcode = 'P0001';
  end if;

  -- Taxa de serviço: decidida antes do primeiro pagamento
  if p_taxa_servico is not null then
    v_taxa := case when p_taxa_servico then round(v_conta.subtotal_cents * 0.10)::integer else 0 end;
    if v_taxa <> v_conta.service_fee_cents then
      if v_conta.paid_cents > 0 then
        raise exception 'A taxa de serviço só pode mudar antes do primeiro pagamento' using errcode = 'P0001';
      end if;
      update public.tabs t set service_fee_cents = v_taxa where t.id = p_conta;
      perform private.recalcular_conta(p_conta);
      select t.* into v_conta from public.tabs t where t.id = p_conta;
    end if;
  end if;

  v_falta := v_conta.total_cents - v_conta.paid_cents;
  if v_falta <= 0 then
    raise exception 'Esta conta já está paga' using errcode = 'P0001';
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

  insert into public.payments (restaurant_id, tab_id, method, amount_cents, change_cents, created_by, cash_session_id)
  values (v_conta.restaurant_id, p_conta, p_metodo, v_valor, v_troco, (select auth.uid()), v_sessao);

  update public.tabs t
  set paid_cents = t.paid_cents + v_valor,
      status = case when t.paid_cents + v_valor >= t.total_cents then 'fechada'::public.tab_status else t.status end,
      closed_at = case when t.paid_cents + v_valor >= t.total_cents then now() else t.closed_at end
  where t.id = p_conta;

  return query select v_conta.paid_cents + v_valor, v_falta - v_valor, v_troco, v_conta.total_cents;
end;
$$;
revoke execute on function public.receber_conta(uuid, public.payment_method, integer, integer, boolean) from public, anon;
grant execute on function public.receber_conta(uuid, public.payment_method, integer, integer, boolean) to authenticated;

-- O resumo do caixa conta contas recebidas no turno (um pagamento antigo pode ter só o pedido)
create or replace function public.resumo_do_caixa(p_sessao uuid)
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
    select method, amount_cents, coalesce(tab_id, order_id) as conta from public.payments where cash_session_id = p_sessao
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
      (select count(distinct conta) from p)::integer as pedidos,
      coalesce((select sum(amount_cents) from p), 0)::integer as vendido
  )
  select fundo, dinheiro, pix, credito, debito, outros, suprimentos, sangrias,
         fundo + dinheiro + suprimentos - sangrias, pedidos, vendido
  from n
  where fundo is not null;
$$;
