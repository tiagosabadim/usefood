-- Loja online, parte 3: a loja aceita ou recusa o pedido online, e o entregador
-- sai para a entrega e conclui com o código do cliente (4 últimos números do celular).

-- O papel 'entregador' é criado na migration anterior (20261004001750): valor novo de enum
-- só pode ser usado depois de gravado, e a regra pode_entregar já usa ele.

alter table public.orders
  add column courier_id uuid references auth.users (id) on delete set null,
  add column dispatched_at timestamptz;

-- Aceitar: vai para a cozinha e para a impressora
create function public.aceitar_pedido(p_pedido uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select o.id, o.restaurant_id, o.status into v from public.orders o where o.id = p_pedido for update;
  if not found or not private.pode_cobrar(v.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v.status <> 'aguardando' then
    raise exception 'Este pedido já foi respondido' using errcode = 'P0001';
  end if;
  update public.orders set status = 'em_preparo', accepted_at = now() where id = p_pedido;
  perform private.gerar_impressoes(p_pedido, 'pedido');
  return 'em_preparo'::public.order_status;
end;
$$;

-- Recusar: o cliente vê o motivo; a conta do pedido é cancelada
create function public.recusar_pedido(p_pedido uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select o.id, o.restaurant_id, o.status, o.tab_id into v from public.orders o where o.id = p_pedido for update;
  if not found or not private.pode_cobrar(v.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v.status <> 'aguardando' then
    raise exception 'Este pedido já foi respondido' using errcode = 'P0001';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Diga o motivo ao cliente' using errcode = '22023';
  end if;
  update public.orders set status = 'cancelado', cancel_reason = left(trim(p_motivo), 200) where id = p_pedido;
  perform private.recalcular_conta(v.tab_id);
  update public.tabs t set status = 'cancelada', closed_at = now()
  where t.id = v.tab_id and t.paid_cents = 0
    and not exists (select 1 from public.orders o where o.tab_id = t.id and o.status <> 'cancelado');
end;
$$;

-- Quem leva: o entregador, ou dono, gerente e caixa
create function private.pode_entregar(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_restaurant_role(
           p_restaurant_id, array['dono', 'gerente', 'caixa', 'entregador']::public.restaurant_role[])
      or private.is_platform_admin();
$$;

create function public.sair_para_entrega(p_pedido uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select o.id, o.restaurant_id, o.status, o.type into v from public.orders o where o.id = p_pedido for update;
  if not found or not private.pode_entregar(v.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v.type <> 'delivery' then
    raise exception 'Só pedidos de entrega saem com o entregador' using errcode = 'P0001';
  end if;
  if v.status <> 'pronto' then
    raise exception 'O pedido ainda não está pronto' using errcode = 'P0001';
  end if;
  update public.orders set status = 'em_entrega', courier_id = (select auth.uid()), dispatched_at = now() where id = p_pedido;
  return 'em_entrega'::public.order_status;
end;
$$;

-- Na porta: o código são os 4 últimos números do celular do cliente.
-- Pedido de entrega lançado no PDV sem celular conclui sem código.
create function public.confirmar_entrega(p_pedido uuid, p_codigo text default null)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select o.id, o.restaurant_id, o.status, t.customer_phone into v
  from public.orders o left join public.tabs t on t.id = o.tab_id
  where o.id = p_pedido for update of o;
  if not found or not private.pode_entregar(v.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v.status <> 'em_entrega' then
    raise exception 'Este pedido não está em entrega' using errcode = 'P0001';
  end if;
  if v.customer_phone is not null and coalesce(trim(p_codigo), '') <> right(v.customer_phone, 4) then
    raise exception 'O código não confere. Peça ao cliente os 4 últimos números do celular.' using errcode = 'P0001';
  end if;
  update public.orders set status = 'concluido', delivered_at = now() where id = p_pedido;
  return 'concluido'::public.order_status;
end;
$$;

revoke execute on function public.aceitar_pedido(uuid) from public, anon;
grant execute on function public.aceitar_pedido(uuid) to authenticated;
revoke execute on function public.recusar_pedido(uuid, text) from public, anon;
grant execute on function public.recusar_pedido(uuid, text) to authenticated;
revoke execute on function public.sair_para_entrega(uuid) from public, anon;
grant execute on function public.sair_para_entrega(uuid) to authenticated;
revoke execute on function public.confirmar_entrega(uuid, text) from public, anon;
grant execute on function public.confirmar_entrega(uuid, text) to authenticated;
