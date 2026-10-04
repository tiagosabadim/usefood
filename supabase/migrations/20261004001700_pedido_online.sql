-- Pedido online (loja online, parte 2a): o cliente pede sem login, com nome e celular.
-- O pedido nasce aguardando a loja aceitar; preço e taxa de entrega saem do banco.

-- Novas situações do pedido: aguardando aceite (online) e saiu para entrega
alter type public.order_status add value if not exists 'aguardando' before 'em_preparo';
alter type public.order_status add value if not exists 'em_entrega' after 'pronto';

alter table public.orders
  add column channel text not null default 'loja' check (channel in ('loja', 'online')),
  -- Link secreto do cliente para acompanhar o pedido
  add column tracking_token uuid not null default gen_random_uuid() unique,
  add column cancel_reason text check (length(cancel_reason) <= 200),
  add column accepted_at timestamptz;

alter table public.tabs
  add column customer_name text check (length(customer_name) <= 60),
  add column customer_phone text check (customer_phone ~ '^[0-9]{10,11}$'),
  -- Endereço de entrega como o cliente informou (rua, número, bairro, cidade, referência…)
  add column delivery_address jsonb,
  add column delivery_point extensions.geography(Point, 4326),
  add column delivery_distance_km numeric(6, 2),
  add column delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0);

-- Total da conta inclui a taxa de entrega
create or replace function private.recalcular_conta(p_conta uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tabs t
  set subtotal_cents = s.subtotal,
      total_cents = greatest(s.subtotal + t.service_fee_cents + t.delivery_fee_cents - t.discount_cents, 0)
  from (
    select coalesce(sum(o.subtotal_cents), 0)::integer as subtotal
    from public.orders o where o.tab_id = p_conta and o.status <> 'cancelado'
  ) s
  where t.id = p_conta;
$$;

-- Montagem do pedido sem conferir quem lança: usada pela equipe (que confere antes)
-- e pelo pedido online (que confere loja no ar, horário e celular).
create function private.montar_pedido(
  p_restaurant_id uuid,
  p_tipo public.order_type,
  p_identificador_tipo public.identifier_type,
  p_identificador text,
  p_itens jsonb,
  p_taxa_servico boolean default false,
  p_observacao text default null
)
returns table (id uuid, numero integer, identificador text, total_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia date;
  v_numero integer;
  v_pedido uuid;
  v_identificador text := nullif(trim(p_identificador), '');
  v_praca_padrao uuid;
  v_item jsonb;
  v_qtd integer;
  v_produto record;
  v_variante uuid;
  v_tamanho record;
  v_preco_base integer;
  v_nome_tamanho text;
  v_adicionais uuid[];
  v_validos integer;
  v_soma_adicionais integer;
  v_grupo record;
  v_unitario integer;
  v_item_id uuid;
  v_subtotal integer := 0;
  v_taxa integer := 0;
begin
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido precisa de pelo menos um item' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'Pedido com itens demais' using errcode = '22023';
  end if;
  if p_identificador_tipo <> 'senha' and v_identificador is null then
    raise exception 'Informe % do pedido', case p_identificador_tipo
      when 'nome' then 'o nome' when 'mesa' then 'a mesa' else 'a comanda' end
      using errcode = '22023';
  end if;

  select (now() at time zone r.timezone)::date into v_dia
  from public.restaurants r where r.id = p_restaurant_id;

  insert into public.ticket_sequences as s (restaurant_id, day, last_number)
  values (p_restaurant_id, v_dia, 1)
  on conflict (restaurant_id, day) do update set last_number = s.last_number + 1
  returning s.last_number into v_numero;

  if v_identificador is null then
    v_identificador := lpad(v_numero::text, 3, '0');
  end if;

  select st.id into v_praca_padrao from public.stations st
  where st.restaurant_id = p_restaurant_id order by st.position, st.created_at limit 1;

  insert into public.orders (restaurant_id, day, number, type, identifier_type, identifier, notes, created_by)
  values (p_restaurant_id, v_dia, v_numero, p_tipo, p_identificador_tipo, v_identificador,
          nullif(trim(p_observacao), ''), (select auth.uid()))
  returning orders.id into v_pedido;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    if v_qtd is null or v_qtd < 1 or v_qtd > 999 then
      raise exception 'Quantidade inválida' using errcode = '22023';
    end if;

    select p.id, p.name, p.price_cents, p.station_id, p.is_active into v_produto
    from public.products p
    where p.id = (v_item ->> 'product_id')::uuid and p.restaurant_id = p_restaurant_id;
    if not found then
      raise exception 'Produto não encontrado nesta loja' using errcode = 'P0002';
    end if;
    if not v_produto.is_active then
      raise exception '% está pausado', v_produto.name using errcode = 'P0001';
    end if;

    -- Tamanho
    v_variante := nullif(v_item ->> 'variant_id', '')::uuid;
    if exists (select 1 from public.product_variants pv where pv.product_id = v_produto.id and pv.is_active) then
      if v_variante is null then
        raise exception 'Escolha o tamanho de %', v_produto.name using errcode = '22023';
      end if;
      select pv.name, pv.price_cents into v_tamanho
      from public.product_variants pv
      where pv.id = v_variante and pv.product_id = v_produto.id and pv.is_active;
      if not found then
        raise exception 'Tamanho inválido para %', v_produto.name using errcode = '22023';
      end if;
      v_preco_base := v_tamanho.price_cents;
      v_nome_tamanho := v_tamanho.name;
    elsif v_variante is not null then
      raise exception '% não tem tamanhos', v_produto.name using errcode = '22023';
    else
      v_preco_base := v_produto.price_cents;
      v_nome_tamanho := null;
    end if;

    -- Adicionais: só itens ativos de grupos ligados ao produto, sem repetir
    v_adicionais := coalesce(
      array(select jsonb_array_elements_text(coalesce(v_item -> 'adicionais', '[]'::jsonb))::uuid),
      '{}');
    if cardinality(v_adicionais) <> (select count(distinct a) from unnest(v_adicionais) a) then
      raise exception 'Adicional repetido em %', v_produto.name using errcode = '22023';
    end if;
    select count(*), coalesce(sum(m.price_cents), 0) into v_validos, v_soma_adicionais
    from public.modifiers m
    join public.product_modifier_groups pmg on pmg.group_id = m.group_id and pmg.product_id = v_produto.id
    where m.id = any (v_adicionais) and m.is_active;
    if v_validos <> cardinality(v_adicionais) then
      raise exception 'Adicional inválido para %', v_produto.name using errcode = '22023';
    end if;

    for v_grupo in
      select g.name, g.min_select, g.max_select,
             (select count(*) from public.modifiers m where m.group_id = g.id and m.id = any (v_adicionais)) as escolhidos
      from public.modifier_groups g
      join public.product_modifier_groups pmg on pmg.group_id = g.id
      where pmg.product_id = v_produto.id
    loop
      if v_grupo.escolhidos < v_grupo.min_select then
        raise exception 'Em %, escolha pelo menos %', v_grupo.name, v_grupo.min_select using errcode = '22023';
      end if;
      if v_grupo.max_select is not null and v_grupo.escolhidos > v_grupo.max_select then
        raise exception 'Em %, escolha no máximo %', v_grupo.name, v_grupo.max_select using errcode = '22023';
      end if;
    end loop;

    v_unitario := v_preco_base + v_soma_adicionais;

    insert into public.order_items
      (restaurant_id, order_id, product_id, product_name, variant_id, variant_name,
       unit_price_cents, quantity, total_cents, notes, station_id, to_go)
    values
      (p_restaurant_id, v_pedido, v_produto.id, v_produto.name, v_variante, v_nome_tamanho,
       v_unitario, v_qtd, v_unitario * v_qtd, nullif(trim(v_item ->> 'observacao'), ''),
       coalesce(v_produto.station_id, v_praca_padrao),
       -- Para viagem e delivery saem sempre embalados; mesa e balcão escolhem por item
       p_tipo in ('retirada', 'delivery') or coalesce((v_item ->> 'para_viagem')::boolean, false))
    returning order_items.id into v_item_id;

    insert into public.order_item_modifiers (restaurant_id, order_item_id, modifier_id, group_name, name, price_cents)
    select p_restaurant_id, v_item_id, m.id, g.name, m.name, m.price_cents
    from public.modifiers m join public.modifier_groups g on g.id = m.group_id
    where m.id = any (v_adicionais);

    v_subtotal := v_subtotal + v_unitario * v_qtd;
  end loop;

  if p_taxa_servico then
    v_taxa := round(v_subtotal * 0.10);
  end if;

  update public.orders o
  set subtotal_cents = v_subtotal, service_fee_cents = v_taxa, total_cents = v_subtotal + v_taxa
  where o.id = v_pedido;

  return query select v_pedido, v_numero, v_identificador, v_subtotal + v_taxa;
end;
$$;

create or replace function private.criar_pedido_sem_impressao(
  p_restaurant_id uuid,
  p_tipo public.order_type,
  p_identificador_tipo public.identifier_type,
  p_identificador text,
  p_itens jsonb,
  p_taxa_servico boolean default false,
  p_observacao text default null
)
returns table (id uuid, numero integer, identificador text, total_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.pode_lancar_pedido(p_restaurant_id) then
    raise exception 'Você não pode lançar pedidos nesta loja' using errcode = '42501';
  end if;
  return query select * from private.montar_pedido(
    p_restaurant_id, p_tipo, p_identificador_tipo, p_identificador, p_itens, p_taxa_servico, p_observacao);
end;
$$;
revoke execute on function private.montar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Taxa de entrega: o checkout mostra antes, o pedido confere de novo
-- ---------------------------------------------------------------------------
create function public.calcular_entrega(
  p_restaurant_id uuid,
  p_bairro text,
  p_cidade text,
  p_latitude double precision,
  p_longitude double precision,
  p_subtotal_cents integer
)
returns table (atende boolean, taxa_cents integer, distancia_km numeric, motivo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_loja record;
  v_ponto extensions.geography;
  v_km numeric;
  v_taxa integer;
begin
  select r.* into v_loja from public.restaurants r where r.id = p_restaurant_id and r.status = 'ativo';
  if not found or not v_loja.accepts_delivery then
    return query select false, 0, null::numeric, 'Esta loja não faz entrega.';
    return;
  end if;
  if coalesce(p_subtotal_cents, 0) < v_loja.min_order_cents then
    return query select false, 0, null::numeric,
      'O pedido mínimo é de R$ ' || to_char(v_loja.min_order_cents / 100.0, 'FM999G990D00') || '.';
    return;
  end if;
  if p_latitude is not null and p_longitude is not null and v_loja.location is not null then
    v_ponto := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
    v_km := round((extensions.st_distance(v_loja.location, v_ponto) / 1000)::numeric, 2);
  end if;

  if v_loja.delivery_fee_mode = 'gratis' then
    if v_loja.delivery_radius_km is not null then
      if v_km is null then
        return query select false, 0, null::numeric, 'Use sua localização para conferirmos se entregamos aí.';
        return;
      end if;
      if v_km > v_loja.delivery_radius_km then
        return query select false, 0, v_km, 'Seu endereço está fora da área de entrega.';
        return;
      end if;
    elsif v_loja.city is not null and p_cidade is not null
          and lower(extensions.unaccent(trim(p_cidade))) <> lower(extensions.unaccent(trim(v_loja.city))) then
      return query select false, 0, v_km, 'Entregamos só em ' || v_loja.city || '.';
      return;
    end if;
    v_taxa := 0;
  elsif v_loja.delivery_fee_mode = 'bairro' then
    select d.fee_cents into v_taxa from public.delivery_districts d
    where d.restaurant_id = p_restaurant_id and d.is_active
      and d.name_key = lower(extensions.unaccent(trim(coalesce(p_bairro, ''))));
    if v_taxa is null then
      return query select false, 0, v_km, 'Ainda não entregamos neste bairro.';
      return;
    end if;
  else
    if v_km is null then
      return query select false, 0, null::numeric, 'Use sua localização para calcularmos a entrega.';
      return;
    end if;
    select b.fee_cents into v_taxa from public.delivery_bands b
    where b.restaurant_id = p_restaurant_id and b.up_to_km >= v_km
    order by b.up_to_km limit 1;
    if v_taxa is null then
      return query select false, 0, v_km, 'Seu endereço está fora da área de entrega.';
      return;
    end if;
  end if;

  if v_loja.free_delivery_above_cents is not null and p_subtotal_cents >= v_loja.free_delivery_above_cents then
    v_taxa := 0;
  end if;
  return query select true, v_taxa, v_km, null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- O cliente faz o pedido
--   p_endereco: {"cep","rua","numero","complemento","bairro","cidade","referencia"}
-- ---------------------------------------------------------------------------
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
  p_observacao text default null
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
  update public.orders o set status = 'aguardando', channel = 'online' where o.id = v_pedido.id
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

-- ---------------------------------------------------------------------------
-- Acompanhamento: tudo o que a página do cliente mostra, pelo link secreto
-- ---------------------------------------------------------------------------
create function public.acompanhar_pedido(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'loja', jsonb_build_object('nome', r.name, 'slug', r.slug, 'telefone', r.phone),
    'numero', o.number,
    'tipo', o.type,
    'situacao', o.status,
    'motivo', o.cancel_reason,
    'criado_em', o.created_at,
    'aceito_em', o.accepted_at,
    'pronto_em', o.ready_at,
    'entregue_em', o.delivered_at,
    'tempo', jsonb_build_object('min', r.prep_minutes_min, 'max', r.prep_minutes_max),
    'itens', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'quantidade', i.quantity, 'nome', i.product_name, 'tamanho', i.variant_name, 'total', i.total_cents,
        'adicionais', (select coalesce(jsonb_agg(m.name), '[]'::jsonb) from public.order_item_modifiers m where m.order_item_id = i.id)
      ) order by i.created_at), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id),
    'subtotal', t.subtotal_cents,
    'taxa_entrega', t.delivery_fee_cents,
    'total', t.total_cents,
    'pagamento', jsonb_build_object('metodo', t.expected_method, 'troco_para', t.change_for_cents),
    'endereco', t.delivery_address,
    -- Código que o cliente diz ao entregador: os 4 últimos números do celular
    'codigo_entrega', case when o.type = 'delivery' then right(t.customer_phone, 4) end
  )
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  join public.tabs t on t.id = o.tab_id
  where o.tracking_token = p_token and o.channel = 'online';
$$;

grant execute on function public.calcular_entrega(uuid, text, text, double precision, double precision, integer) to anon, authenticated;
grant execute on function public.fazer_pedido_online(uuid, public.order_type, jsonb, text, text, public.payment_method, integer, jsonb, double precision, double precision, text) to anon, authenticated;
grant execute on function public.acompanhar_pedido(uuid) to anon, authenticated;
