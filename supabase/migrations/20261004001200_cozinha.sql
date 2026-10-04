-- Tela da cozinha (KDS): cada praça marca a sua parte do pedido como pronta.
-- Quando todas as praças terminam, o pedido fica "pronto"; depois de entregue, "concluido".

alter table public.order_items add column prepared_at timestamptz;
alter table public.orders
  add column ready_at timestamptz,
  add column delivered_at timestamptz;
create index orders_cozinha_idx on public.orders (restaurant_id, created_at)
  where status in ('em_preparo', 'pronto');

-- Qualquer pessoa da equipe da loja (cozinha marca pronto, garçom e caixa marcam entregue)
create function private.e_da_equipe(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_restaurant_role(p_restaurant_id) or private.is_platform_admin();
$$;

-- Marca como prontos os itens do pedido naquela praça (ou todos, sem praça).
create function public.marcar_pronto(p_pedido uuid, p_praca uuid default null)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_status public.order_status;
begin
  select o.id, o.restaurant_id, o.status into v_pedido from public.orders o where o.id = p_pedido for update;
  if not found or not private.e_da_equipe(v_pedido.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v_pedido.status not in ('em_preparo', 'pronto') then
    raise exception 'Este pedido não está em preparo' using errcode = 'P0001';
  end if;

  update public.order_items i set prepared_at = now()
  where i.order_id = p_pedido and i.prepared_at is null and (p_praca is null or i.station_id = p_praca);

  update public.orders o set status = 'pronto', ready_at = now()
  where o.id = p_pedido and o.status = 'em_preparo'
    and not exists (select 1 from public.order_items i where i.order_id = p_pedido and i.prepared_at is null);

  select o.status into v_status from public.orders o where o.id = p_pedido;
  return v_status;
end;
$$;

-- Desfaz um "pronto" tocado por engano
create function public.desfazer_pronto(p_pedido uuid, p_praca uuid default null)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
begin
  select o.id, o.restaurant_id, o.status into v_pedido from public.orders o where o.id = p_pedido for update;
  if not found or not private.e_da_equipe(v_pedido.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v_pedido.status not in ('em_preparo', 'pronto') then
    raise exception 'Este pedido já foi entregue ou cancelado' using errcode = 'P0001';
  end if;

  update public.order_items i set prepared_at = null
  where i.order_id = p_pedido and (p_praca is null or i.station_id = p_praca);
  update public.orders o set status = 'em_preparo', ready_at = null
  where o.id = p_pedido and o.status = 'pronto';
  return 'em_preparo'::public.order_status;
end;
$$;

-- Pedido saiu da cozinha para o cliente
create function public.marcar_entregue(p_pedido uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
begin
  select o.id, o.restaurant_id, o.status into v_pedido from public.orders o where o.id = p_pedido for update;
  if not found or not private.e_da_equipe(v_pedido.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v_pedido.status = 'em_preparo' then
    raise exception 'O pedido ainda está em preparo' using errcode = 'P0001';
  end if;
  if v_pedido.status <> 'pronto' then
    raise exception 'Este pedido já foi entregue ou cancelado' using errcode = 'P0001';
  end if;
  update public.orders o set status = 'concluido', delivered_at = now() where o.id = p_pedido;
  return 'concluido'::public.order_status;
end;
$$;

revoke execute on function public.marcar_pronto(uuid, uuid) from public, anon;
grant execute on function public.marcar_pronto(uuid, uuid) to authenticated;
revoke execute on function public.desfazer_pronto(uuid, uuid) from public, anon;
grant execute on function public.desfazer_pronto(uuid, uuid) to authenticated;
revoke execute on function public.marcar_entregue(uuid) from public, anon;
grant execute on function public.marcar_entregue(uuid) to authenticated;

-- A tela da cozinha recebe pedidos novos e mudanças em tempo real
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
