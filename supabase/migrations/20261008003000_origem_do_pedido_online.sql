-- Origem do pedido online: pelo app de delivery USE! ou pelo link próprio da loja.
-- Pedidos antigos ficam sem origem (desconhecida), para não inventar número.

alter table public.orders add column online_origin text check (online_origin in ('app', 'loja'));

drop function public.fazer_pedido_online(uuid, public.order_type, jsonb, text, text, public.payment_method, integer, jsonb, double precision, double precision, text);
create function public.fazer_pedido_online(
  p_restaurant_id uuid,
  p_tipo public.order_type,
  p_itens jsonb,
  p_nome text,
  p_celular text,
  p_pagamento public.payment_method,
  p_troco_para_cents integer default null,
  p_endereco jsonb default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_observacao text default null,
  -- Por onde veio: 'app' (app de delivery USE!) ou 'loja' (link próprio da loja)
  p_origem text default 'loja'
)
returns table (token uuid, numero integer, total_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loja record;
  v_nome text := nullif(left(trim(p_nome), 60), '');
  v_celular text := regexp_replace(coalesce(p_celular, ''), '[^0-9]', '', 'g');
  v_pedido record;
  v_entrega record;
  v_conta uuid;
  v_token uuid;
  v_total integer;
begin
  -- Retirada não calcula entrega: começa com distância vazia e taxa zero (antes, a retirada dava erro)
  select true as atende, null::text as motivo, 0 as taxa_cents, null::numeric as distancia_km into v_entrega;
  select r.* into v_loja from public.restaurants r where r.id = p_restaurant_id and r.status = 'ativo';
  if not found then
    raise exception 'Esta loja não está recebendo pedidos pela internet.' using errcode = 'P0001';
  end if;
  if not public.loja_aberta_agora(p_restaurant_id) then
    raise exception 'A loja está fechada agora. Confira os horários.' using errcode = 'P0001';
  end if;
  if p_tipo = 'delivery' and not v_loja.accepts_delivery then
    raise exception 'Esta loja não faz entrega.' using errcode = 'P0001';
  end if;
  if p_tipo = 'retirada' and not v_loja.accepts_pickup then
    raise exception 'Esta loja não aceita retirada.' using errcode = 'P0001';
  end if;
  if p_tipo not in ('delivery', 'retirada') then
    raise exception 'Escolha entrega ou retirada.' using errcode = '22023';
  end if;
  if v_nome is null then
    raise exception 'Informe seu nome.' using errcode = '22023';
  end if;
  if v_celular !~ '^[0-9]{10,11}$' then
    raise exception 'Informe o celular com DDD.' using errcode = '22023';
  end if;
  if p_pagamento is null then
    raise exception 'Escolha como vai pagar.' using errcode = '22023';
  end if;
  -- Proteção contra pedido falso: no máximo 3 aguardando por celular a cada 30 minutos
  if (select count(*) from public.orders o join public.tabs t on t.id = o.tab_id
      where o.restaurant_id = p_restaurant_id and t.customer_phone = v_celular and o.status = 'aguardando'
        and o.created_at > now() - interval '30 minutes') >= 3 then
    raise exception 'Você já tem pedidos aguardando a loja. Espere a confirmação.' using errcode = 'P0001';
  end if;

  select * into v_pedido from private.montar_pedido(
    p_restaurant_id, p_tipo, 'nome', v_nome, p_itens, false, p_observacao);
  update public.orders o
     set status = 'aguardando', channel = 'online',
         online_origin = case when p_origem = 'app' then 'app' else 'loja' end
   where o.id = v_pedido.id
  returning o.tracking_token into v_token;

  if p_tipo = 'delivery' then
    if p_endereco is null or coalesce(trim(p_endereco ->> 'rua'), '') = '' or coalesce(trim(p_endereco ->> 'numero'), '') = ''
       or coalesce(trim(p_endereco ->> 'bairro'), '') = '' then
      raise exception 'Informe rua, número e bairro.' using errcode = '22023';
    end if;
    select * into v_entrega from public.calcular_entrega(
      p_restaurant_id, p_endereco ->> 'bairro', p_endereco ->> 'cidade', p_latitude, p_longitude, v_pedido.total_cents);
    if not v_entrega.atende then
      raise exception '%', v_entrega.motivo using errcode = 'P0001';
    end if;
  elsif v_pedido.total_cents < v_loja.min_order_cents then
    raise exception 'O pedido mínimo é de R$ %.', to_char(v_loja.min_order_cents / 100.0, 'FM999G990D00') using errcode = 'P0001';
  end if;

  insert into public.tabs (restaurant_id, type, identifier_type, identifier, expected_method, change_for_cents,
                           customer_name, customer_phone, delivery_address, delivery_point, delivery_distance_km,
                           delivery_fee_cents)
  values (p_restaurant_id, p_tipo, 'nome', v_nome, p_pagamento,
          case when p_pagamento = 'dinheiro' then p_troco_para_cents end,
          v_nome, v_celular, case when p_tipo = 'delivery' then p_endereco end,
          case when p_tipo = 'delivery' and p_latitude is not null and p_longitude is not null
               then extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography end,
          case when p_tipo = 'delivery' then v_entrega.distancia_km end,
          case when p_tipo = 'delivery' then v_entrega.taxa_cents else 0 end)
  returning tabs.id into v_conta;

  update public.orders o set tab_id = v_conta where o.id = v_pedido.id;
  perform private.recalcular_conta(v_conta);
  select t.total_cents into v_total from public.tabs t where t.id = v_conta;

  return query select v_token, v_pedido.numero, v_total;
end;
$$;

revoke execute on function public.fazer_pedido_online(uuid, public.order_type, jsonb, text, text, public.payment_method, integer, jsonb, double precision, double precision, text, text) from public;
grant execute on function public.fazer_pedido_online(uuid, public.order_type, jsonb, text, text, public.payment_method, integer, jsonb, double precision, double precision, text, text) to anon, authenticated;

-- Console: vendas online por canal (últimos 30 dias)
drop function public.console_lojas();
create function public.console_lojas()
returns table (
  id uuid,
  nome text,
  slug text,
  marca text,
  marca_slug text,
  situacao public.restaurant_status,
  cidade text,
  criada_em timestamptz,
  donos text[],
  pedidos_30d integer,
  vendas_30d_cents bigint,
  ultimo_pedido_em timestamptz,
  -- Vendas online dos últimos 30 dias por canal: pelo app USE! e pelo link próprio da loja
  app_pedidos_30d integer,
  app_30d_cents bigint,
  link_pedidos_30d integer,
  link_30d_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Só a equipe da plataforma vê todas as lojas' using errcode = '42501';
  end if;
  return query
  select r.id, r.name, r.slug, b.name, b.slug, r.status, r.city, r.created_at,
         coalesce((select array_agg(u.email::text order by u.email)
                   from public.memberships m join auth.users u on u.id = m.user_id
                   where m.restaurant_id = r.id and m.role = 'dono'), '{}'),
         (select count(*)::integer from public.orders o
           where o.restaurant_id = r.id and o.status <> 'cancelado' and o.created_at > now() - interval '30 days'),
         (select coalesce(sum(o.total_cents), 0)::bigint from public.orders o
           where o.restaurant_id = r.id and o.status <> 'cancelado' and o.created_at > now() - interval '30 days'),
         (select max(o.created_at) from public.orders o where o.restaurant_id = r.id),
         (select count(*)::integer from public.orders o where o.restaurant_id = r.id and o.online_origin = 'app'
             and o.status <> 'cancelado' and o.created_at > now() - interval '30 days'),
         (select coalesce(sum(o.total_cents), 0)::bigint from public.orders o where o.restaurant_id = r.id and o.online_origin = 'app'
             and o.status <> 'cancelado' and o.created_at > now() - interval '30 days'),
         (select count(*)::integer from public.orders o where o.restaurant_id = r.id and o.online_origin = 'loja'
             and o.status <> 'cancelado' and o.created_at > now() - interval '30 days'),
         (select coalesce(sum(o.total_cents), 0)::bigint from public.orders o where o.restaurant_id = r.id and o.online_origin = 'loja'
             and o.status <> 'cancelado' and o.created_at > now() - interval '30 days')
  from public.restaurants r join public.brands b on b.id = r.brand_id
  order by r.created_at desc;
end;
$$;

revoke execute on function public.console_lojas() from public;
grant execute on function public.console_lojas() to authenticated;
