-- Clientes da loja: quem pediu por delivery, retirada ou loja online (identificado pelo celular).
-- Os dados são do restaurante; só dono e gerente veem.

create function public.clientes_da_loja(p_restaurant_id uuid)
returns table (
  telefone text,
  nome text,
  bairro text,
  pedidos integer,
  total_cents bigint,
  primeiro_em timestamptz,
  ultimo_em timestamptz,
  canais text[],
  favorito text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente veem os clientes da loja' using errcode = '42501';
  end if;
  return query
  with pedidos as (
    select t.customer_phone as tel, t.customer_name, t.delivery_address, o.id, o.number, o.total_cents, o.created_at,
           case when o.channel = 'online' then 'online' else o.type::text end as canal
    from public.orders o join public.tabs t on t.id = o.tab_id
    where o.restaurant_id = p_restaurant_id and t.customer_phone is not null
      and o.status not in ('cancelado', 'aguardando')
  )
  select p.tel,
         (array_agg(p.customer_name order by p.created_at desc, p.number desc) filter (where p.customer_name is not null))[1],
         (array_agg(p.delivery_address ->> 'bairro' order by p.created_at desc, p.number desc) filter (where p.delivery_address ? 'bairro'))[1],
         count(distinct p.id)::integer,
         sum(p.total_cents)::bigint,
         min(p.created_at),
         max(p.created_at),
         array_agg(distinct p.canal),
         (select i.product_name from public.order_items i
           where i.order_id in (select x.id from pedidos x where x.tel = p.tel)
           group by i.product_name order by sum(i.quantity) desc, i.product_name limit 1)
  from pedidos p
  group by p.tel
  order by max(p.created_at) desc
  limit 5000;
end;
$$;

-- Ficha de um cliente: endereços, produtos que mais pede e os últimos pedidos
create function public.cliente_da_loja(p_restaurant_id uuid, p_telefone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente veem os clientes da loja' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'enderecos', (
      select coalesce(jsonb_agg(e.endereco order by e.ultimo desc), '[]')
      from (
        select t.delivery_address as endereco, max(t.opened_at) as ultimo
        from public.tabs t
        where t.restaurant_id = p_restaurant_id and t.customer_phone = p_telefone and t.delivery_address is not null
        group by t.delivery_address) e),
    'produtos', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', x.nome, 'quantidade', x.qtd) order by x.qtd desc), '[]')
      from (
        select i.product_name as nome, sum(i.quantity) as qtd
        from public.order_items i join public.orders o on o.id = i.order_id join public.tabs t on t.id = o.tab_id
        where o.restaurant_id = p_restaurant_id and t.customer_phone = p_telefone and o.status not in ('cancelado', 'aguardando')
        group by 1 order by 2 desc limit 5) x),
    'pedidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'numero', x.number, 'tipo', x.tipo, 'situacao', x.status, 'total', x.total_cents, 'em', x.created_at) order by x.created_at desc), '[]')
      from (
        select o.number, case when o.channel = 'online' then 'online' else o.type::text end as tipo, o.status, o.total_cents, o.created_at
        from public.orders o join public.tabs t on t.id = o.tab_id
        where o.restaurant_id = p_restaurant_id and t.customer_phone = p_telefone
        order by o.created_at desc limit 20) x)
  );
end;
$$;

revoke execute on function public.clientes_da_loja(uuid) from public, anon;
grant execute on function public.clientes_da_loja(uuid) to authenticated;
revoke execute on function public.cliente_da_loja(uuid, text) from public, anon;
grant execute on function public.cliente_da_loja(uuid, text) to authenticated;
