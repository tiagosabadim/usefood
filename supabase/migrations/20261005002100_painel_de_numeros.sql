-- Dashboard do restaurante: os números de um período e do período anterior, numa consulta só.
-- Vendas = pedidos lançados (sem cancelados e sem online ainda não aceito).
-- Recebido = pagamentos menos o troco. Ticket médio = vendas por conta.

create function private.numeros_do_periodo(p_loja uuid, p_inicio timestamptz, p_fim timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select id, tab_id, total_cents from public.orders
    where restaurant_id = p_loja and created_at >= p_inicio and created_at < p_fim
      and status not in ('cancelado', 'aguardando')
  )
  select jsonb_build_object(
    'vendas', coalesce((select sum(total_cents) from o), 0),
    'pedidos', (select count(*) from o),
    'contas', (select count(distinct coalesce(tab_id, id)) from o),
    'recebido', coalesce((
      select sum(amount_cents - change_cents) from public.payments
      where restaurant_id = p_loja and created_at >= p_inicio and created_at < p_fim), 0)
  );
$$;

create function public.painel_da_loja(p_restaurant_id uuid, p_inicio timestamptz, p_fim timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_duracao interval := p_fim - p_inicio;
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente veem os números da loja' using errcode = '42501';
  end if;
  if p_fim <= p_inicio or v_duracao > interval '400 days' then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  select timezone into v_tz from public.restaurants where id = p_restaurant_id;

  return jsonb_build_object(
    'atual', private.numeros_do_periodo(p_restaurant_id, p_inicio, p_fim),
    'anterior', private.numeros_do_periodo(p_restaurant_id, p_inicio - v_duracao, p_inicio),

    'canais', (
      select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'pedidos', n, 'vendas', v) order by v desc), '[]')
      from (
        select case when o.channel = 'online' then 'online' else o.type::text end as canal, count(*) as n, sum(o.total_cents) as v
        from public.orders o
        where o.restaurant_id = p_restaurant_id and o.created_at >= p_inicio and o.created_at < p_fim
          and o.status not in ('cancelado', 'aguardando')
        group by 1) c),

    'pagamentos', (
      select coalesce(jsonb_agg(jsonb_build_object('metodo', metodo, 'quantidade', n, 'valor', v) order by v desc), '[]')
      from (
        select p.method::text as metodo, count(*) as n, sum(p.amount_cents - p.change_cents) as v
        from public.payments p
        where p.restaurant_id = p_restaurant_id and p.created_at >= p_inicio and p.created_at < p_fim
        group by 1) x),

    'produtos', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', qtd, 'total', total) order by qtd desc, total desc), '[]')
      from (
        select i.product_name as nome, sum(i.quantity) as qtd, sum(i.total_cents) as total
        from public.order_items i join public.orders o on o.id = i.order_id
        where o.restaurant_id = p_restaurant_id and o.created_at >= p_inicio and o.created_at < p_fim
          and o.status not in ('cancelado', 'aguardando')
        group by 1 order by 2 desc, 3 desc limit 10) x),

    'por_hora', (
      select coalesce(jsonb_agg(jsonb_build_object('hora', h, 'pedidos', n, 'vendas', v) order by h), '[]')
      from (
        select extract(hour from o.created_at at time zone v_tz)::integer as h, count(*) as n, sum(o.total_cents) as v
        from public.orders o
        where o.restaurant_id = p_restaurant_id and o.created_at >= p_inicio and o.created_at < p_fim
          and o.status not in ('cancelado', 'aguardando')
        group by 1) x),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'pedidos', n, 'vendas', v) order by d), '[]')
      from (
        select (o.created_at at time zone v_tz)::date as d, count(*) as n, sum(o.total_cents) as v
        from public.orders o
        where o.restaurant_id = p_restaurant_id and o.created_at >= p_inicio and o.created_at < p_fim
          and o.status not in ('cancelado', 'aguardando')
        group by 1) x),

    'cozinha', (
      select jsonb_build_object(
        'prontos', count(*),
        'media_min', round((avg(extract(epoch from o.ready_at - coalesce(o.accepted_at, o.created_at))) / 60)::numeric, 1),
        'atrasados', count(*) filter (where o.ready_at - coalesce(o.accepted_at, o.created_at) > interval '15 minutes'))
      from public.orders o
      where o.restaurant_id = p_restaurant_id and o.created_at >= p_inicio and o.created_at < p_fim and o.ready_at is not null),

    'online', (
      select jsonb_build_object(
        'aceitos', count(*) filter (where o.accepted_at is not null),
        'recusados', count(*) filter (where o.status = 'cancelado' and o.accepted_at is null),
        'resposta_min', round((avg(extract(epoch from o.accepted_at - o.created_at)) / 60)::numeric, 1),
        'motivos', (
          select coalesce(jsonb_agg(jsonb_build_object('motivo', m, 'quantidade', n) order by n desc), '[]')
          from (
            select x.cancel_reason as m, count(*) as n from public.orders x
            where x.restaurant_id = p_restaurant_id and x.channel = 'online' and x.status = 'cancelado'
              and x.created_at >= p_inicio and x.created_at < p_fim and x.cancel_reason is not null
            group by 1) mm))
      from public.orders o
      where o.restaurant_id = p_restaurant_id and o.channel = 'online' and o.created_at >= p_inicio and o.created_at < p_fim),

    'caixas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', c.register_name, 'situacao', c.status, 'aberto_em', c.opened_at, 'fechado_em', c.closed_at,
        'fundo', c.opening_cents, 'esperado', c.expected_cents, 'contado', c.counted_cents, 'diferenca', c.difference_cents,
        'aberto_por', coalesce(pin.display_name, u.email::text)) order by c.opened_at desc), '[]')
      from (select * from public.cash_sessions where restaurant_id = p_restaurant_id
              and opened_at >= p_inicio and opened_at < p_fim order by opened_at desc limit 30) c
      left join auth.users u on u.id = c.opened_by
      left join public.staff_pins pin on pin.user_id = c.opened_by and pin.restaurant_id = c.restaurant_id),

    'clientes', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'telefone', tel, 'pedidos', n, 'total', total) order by total desc), '[]')
      from (
        select max(t.customer_name) as nome, t.customer_phone as tel, count(distinct o.id) as n, sum(o.total_cents) as total
        from public.orders o join public.tabs t on t.id = o.tab_id
        where o.restaurant_id = p_restaurant_id and o.created_at >= p_inicio and o.created_at < p_fim
          and o.status not in ('cancelado', 'aguardando') and t.customer_phone is not null
        group by t.customer_phone order by 4 desc limit 10) x)
  );
end;
$$;

revoke execute on function private.numeros_do_periodo(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.painel_da_loja(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.painel_da_loja(uuid, timestamptz, timestamptz) to authenticated;
