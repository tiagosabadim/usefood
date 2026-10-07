-- Promoções: preço promocional no produto (com data de fim opcional), cobrado no pedido
-- e mostrado no app (seção Promoções e aba Ofertas). Vale para o preço do produto;
-- produtos com tamanhos usam o preço de cada tamanho (sem promoção, por enquanto).

alter table public.products
  add column promo_price_cents integer check (promo_price_cents > 0),
  add column promo_ends_at timestamptz,
  add constraint promo_menor_que_o_preco check (promo_price_cents is null or promo_price_cents < price_cents);

-- Preço que vale agora: o da promoção, se existir, for menor e não tiver vencido
create function private.preco_vigente(p_preco integer, p_promo integer, p_ate timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when p_promo is not null and p_promo < p_preco and (p_ate is null or p_ate > now())
              then p_promo else p_preco end;
$$;

create or replace function private.montar_pedido(
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

    -- Preço da promoção enquanto ela vale (calculado aqui, no servidor)
    select p.id, p.name, private.preco_vigente(p.price_cents, p.promo_price_cents, p.promo_ends_at) as price_cents,
           p.station_id, p.is_active into v_produto
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

-- Correção: pedido online de retirada dava erro (registro da entrega não preenchido)
create or replace function public.fazer_pedido_online(
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

-- Ofertas da cidade para o app (produtos em promoção nas lojas publicadas da marca)
create function public.vitrine_ofertas(p_marca text, p_cidade text)
returns table (loja_slug text, loja_nome text, loja_aberta boolean, produto_id uuid, produto text, descricao text,
               preco_cents integer, promo_cents integer, foto_path text, termina_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.slug, r.name, public.loja_aberta_agora(r.id), pr.id, pr.name, pr.description, pr.price_cents,
         pr.promo_price_cents, pr.photo_path, pr.promo_ends_at
  from public.products pr
  join public.restaurants r on r.id = pr.restaurant_id
  join public.brands b on b.id = r.brand_id
  where b.slug = p_marca and r.status = 'ativo' and private.slug_da_cidade(r.city, r.state) = p_cidade
    and pr.is_active and 'delivery' = any (pr.available_channels)
    and private.preco_vigente(pr.price_cents, pr.promo_price_cents, pr.promo_ends_at) < pr.price_cents
    and not exists (select 1 from public.product_variants v where v.product_id = pr.id and v.is_active)
  order by public.loja_aberta_agora(r.id) desc,
           (pr.price_cents - pr.promo_price_cents)::numeric / pr.price_cents desc, pr.name
  limit 40;
$$;
revoke execute on function public.vitrine_ofertas(text, text) from public;
grant execute on function public.vitrine_ofertas(text, text) to anon, authenticated;
