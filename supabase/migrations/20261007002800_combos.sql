-- Combos: um produto que reúne outros (com quantidade), por um preço próprio.
-- O pedido cobra o preço do combo e grava "Inclui: 1× X, 1× Y" na observação do item.

alter table public.products add column is_combo boolean not null default false;

create table public.product_combo_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  combo_id uuid not null,
  item_id uuid not null,
  quantity integer not null default 1 check (quantity between 1 and 20),
  position integer not null default 0,
  unique (combo_id, item_id),
  foreign key (combo_id, restaurant_id) references public.products (id, restaurant_id) on delete cascade,
  -- Produto que está num combo não pode ser excluído sem sair do combo
  foreign key (item_id, restaurant_id) references public.products (id, restaurant_id) on delete restrict,
  check (combo_id <> item_id)
);
create index product_combo_items_combo_idx on public.product_combo_items (combo_id, position);
create index product_combo_items_item_idx on public.product_combo_items (item_id);

-- O combo precisa estar marcado como combo, e o item não pode ser outro combo
create function private.validar_item_de_combo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.products p where p.id = new.combo_id and p.is_combo) then
    raise exception 'Marque o produto como combo antes de colocar itens nele.' using errcode = '22023';
  end if;
  if exists (select 1 from public.products p where p.id = new.item_id and p.is_combo) then
    raise exception 'Um combo não pode ter outro combo dentro.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger product_combo_items_validar before insert or update on public.product_combo_items
  for each row execute function private.validar_item_de_combo();

alter table public.product_combo_items enable row level security;
create policy "equipe vê o cardápio" on public.product_combo_items for select to authenticated
  using (private.pode_ver_cardapio_interno(restaurant_id));
create policy "dono e gerente editam o cardápio" on public.product_combo_items for all to authenticated
  using (private.pode_editar_cardapio(restaurant_id))
  with check (private.pode_editar_cardapio(restaurant_id));
create policy "cardápio público de lojas ativas" on public.product_combo_items
  for select to anon, authenticated using (private.loja_ativa(restaurant_id));
grant select on public.product_combo_items to anon, authenticated;
grant insert, update, delete on public.product_combo_items to authenticated;

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
  v_combo text;
  v_combo_pausados text;
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

    -- Combo: todos os itens precisam estar ativos; a lista vai na observação (cozinha e ticket)
    select string_agg(ci.quantity || '× ' || p2.name, ', ' order by ci.position),
           string_agg(case when not p2.is_active then p2.name end, ', ')
      into v_combo, v_combo_pausados
      from public.product_combo_items ci
      join public.products p2 on p2.id = ci.item_id
     where ci.combo_id = v_produto.id;
    if v_combo_pausados is not null then
      raise exception '% está indisponível agora (em falta: %)', v_produto.name, v_combo_pausados using errcode = 'P0001';
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
       v_unitario, v_qtd, v_unitario * v_qtd,
       nullif(concat_ws(' · ', 'Inclui: ' || v_combo, nullif(trim(v_item ->> 'observacao'), '')), ''),
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
