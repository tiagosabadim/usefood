-- Para viagem por item: na mesa ou no balcão, cada item pode ir embalado para viagem
-- (comer um lanche e levar outro). Para viagem e delivery saem sempre embalados.
-- A cozinha vê a marca no cartão e no ticket impresso.

alter table public.order_items add column to_go boolean not null default false;

-- O item guarda se vai para viagem (campo "para_viagem" de cada item em p_itens)
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
  if not private.pode_lancar_pedido(p_restaurant_id) then
    raise exception 'Você não pode lançar pedidos nesta loja' using errcode = '42501';
  end if;
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

-- O ticket leva a marca de cada item
create or replace function private.gerar_impressoes(p_pedido uuid, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_praca record;
  v_payload jsonb;
  v_impressora record;
  v_tem_impressora boolean;
  v_total integer := 0;
begin
  select o.id, o.restaurant_id, o.number, o.type, o.identifier_type, o.identifier, o.notes, o.created_at,
         r.name as loja, r.timezone
  into v_pedido
  from public.orders o join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_pedido;
  if not found then
    return 0;
  end if;

  for v_praca in
    select distinct s.id, s.name from public.order_items i
    join public.stations s on s.id = i.station_id
    where i.order_id = p_pedido
  loop
    v_payload := jsonb_build_object(
      'tipo', p_tipo,
      'loja', v_pedido.loja,
      'praca', v_praca.name,
      'numero', v_pedido.number,
      'pedido_tipo', v_pedido.type,
      'identificador_tipo', v_pedido.identifier_type,
      'identificador', v_pedido.identifier,
      'criado_em', to_char(v_pedido.created_at at time zone v_pedido.timezone, 'DD/MM HH24:MI'),
      'observacao', v_pedido.notes,
      'itens', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'quantidade', i.quantity,
          'nome', i.product_name,
          'tamanho', i.variant_name,
          'adicionais', (
            select coalesce(jsonb_agg(m.name order by m.group_name, m.name), '[]'::jsonb)
            from public.order_item_modifiers m where m.order_item_id = i.id),
          'observacao', i.notes,
          'para_viagem', i.to_go
        ) order by i.created_at), '[]'::jsonb)
        from public.order_items i
        where i.order_id = p_pedido and i.station_id = v_praca.id)
    );

    v_tem_impressora := false;
    for v_impressora in
      select p.id from public.printers p where p.station_id = v_praca.id and p.is_active
    loop
      insert into public.print_jobs (restaurant_id, order_id, station_id, printer_id, kind, payload)
      values (v_pedido.restaurant_id, p_pedido, v_praca.id, v_impressora.id, p_tipo, v_payload);
      v_tem_impressora := true;
      v_total := v_total + 1;
    end loop;

    -- Praça sem impressora: a ordem já nasce com falha, para o PDV avisar
    if not v_tem_impressora then
      insert into public.print_jobs (restaurant_id, order_id, station_id, kind, payload, status, error)
      values (v_pedido.restaurant_id, p_pedido, v_praca.id, p_tipo, v_payload, 'falhou',
              'Praça ' || v_praca.name || ' sem impressora cadastrada');
    end if;
  end loop;

  return v_total;
end;
$$;
