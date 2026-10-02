-- E05 · Pedidos e pagamentos do PDV.
-- Regra de ouro: pedidos e pagamentos só nascem pelas funções criar_pedido e
-- registrar_pagamento. O preço vem do cardápio no banco, nunca da tela.

create type public.order_type as enum ('balcao', 'mesa', 'retirada', 'delivery');
create type public.order_status as enum ('aberto', 'em_preparo', 'pronto', 'concluido', 'cancelado');
create type public.identifier_type as enum ('senha', 'nome', 'mesa', 'comanda');
create type public.payment_method as enum ('dinheiro', 'pix', 'credito', 'debito', 'vale_refeicao', 'outro');

-- Número do pedido por loja e por dia (#001, #002…), que também serve de senha
create table public.ticket_sequences (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  day date not null,
  last_number integer not null,
  primary key (restaurant_id, day)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  day date not null,
  number integer not null,
  type public.order_type not null,
  identifier_type public.identifier_type not null default 'senha',
  -- o que a cozinha e o cliente veem: "047", "João", "12"
  identifier text not null check (length(identifier) between 1 and 40),
  status public.order_status not null default 'em_preparo',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  service_fee_cents integer not null default 0 check (service_fee_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  notes text check (length(notes) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, day, number),
  unique (id, restaurant_id)
);
create index orders_restaurant_day_idx on public.orders (restaurant_id, day desc, number desc);
create index orders_status_idx on public.orders (restaurant_id, status);

-- Item guarda nome e preço do momento da venda: mudar o cardápio depois não muda o pedido
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 999),
  total_cents integer not null check (total_cents >= 0),
  notes text check (length(notes) <= 200),
  -- praça para onde o item vai (impressão na E07)
  station_id uuid references public.stations (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (order_id, restaurant_id)
    references public.orders (id, restaurant_id) on delete cascade
);
create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  change_cents integer not null default 0 check (change_cents >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (order_id, restaurant_id)
    references public.orders (id, restaurant_id) on delete cascade
);
create index payments_order_idx on public.payments (order_id);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quem pode o quê
-- ---------------------------------------------------------------------------
create function private.pode_ver_loja(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_restaurant_role(p_restaurant_id)
      or private.is_brand_member(private.restaurant_brand(p_restaurant_id))
      or private.is_platform_admin();
$$;

-- Lançar pedido: quem atende (dono, gerente, caixa, garçom). Cozinha não lança.
create function private.pode_lancar_pedido(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_restaurant_role(
           p_restaurant_id, array['dono', 'gerente', 'caixa', 'garcom']::public.restaurant_role[])
      or private.is_platform_admin();
$$;

-- Receber dinheiro: dono, gerente e caixa.
create function private.pode_cobrar(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_restaurant_role(
           p_restaurant_id, array['dono', 'gerente', 'caixa']::public.restaurant_role[])
      or private.is_platform_admin();
$$;

alter table public.ticket_sequences enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- Leitura para a equipe; escrita só pelas funções abaixo (nenhuma política de escrita)
create policy "equipe vê os pedidos" on public.orders
  for select to authenticated using (private.pode_ver_loja(restaurant_id));
create policy "equipe vê os itens" on public.order_items
  for select to authenticated using (private.pode_ver_loja(restaurant_id));
create policy "equipe vê os pagamentos" on public.payments
  for select to authenticated using (private.pode_ver_loja(restaurant_id));

-- ---------------------------------------------------------------------------
-- criar_pedido: valida, numera, busca preços no cardápio e soma tudo numa transação
--   p_itens: [{"product_id": "...", "quantidade": 2, "observacao": "sem cebola"}]
-- ---------------------------------------------------------------------------
create function public.criar_pedido(
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

  -- Dia no fuso da loja: o pedido das 23h59 conta no dia certo
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

    insert into public.order_items
      (restaurant_id, order_id, product_id, product_name, unit_price_cents, quantity, total_cents, notes, station_id)
    values
      (p_restaurant_id, v_pedido, v_produto.id, v_produto.name, v_produto.price_cents, v_qtd,
       v_produto.price_cents * v_qtd, nullif(trim(v_item ->> 'observacao'), ''),
       coalesce(v_produto.station_id, v_praca_padrao));
    v_subtotal := v_subtotal + v_produto.price_cents * v_qtd;
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

-- ---------------------------------------------------------------------------
-- registrar_pagamento: aceita pagamento parcial; dinheiro pode passar do valor (troco)
-- ---------------------------------------------------------------------------
create function public.registrar_pagamento(
  p_pedido uuid,
  p_metodo public.payment_method,
  p_valor_cents integer
)
returns table (pago_cents integer, falta_cents integer, troco_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_falta integer;
  v_valor integer;
  v_troco integer := 0;
begin
  select o.id, o.restaurant_id, o.status, o.total_cents, o.paid_cents into v_pedido
  from public.orders o where o.id = p_pedido
  for update;
  if not found or not private.pode_cobrar(v_pedido.restaurant_id) then
    raise exception 'Pedido não encontrado ou você não pode cobrar nesta loja' using errcode = '42501';
  end if;
  if v_pedido.status = 'cancelado' then
    raise exception 'Este pedido foi cancelado' using errcode = 'P0001';
  end if;
  if p_valor_cents is null or p_valor_cents <= 0 then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;

  v_falta := v_pedido.total_cents - v_pedido.paid_cents;
  if v_falta <= 0 then
    raise exception 'Este pedido já está pago' using errcode = 'P0001';
  end if;

  if p_valor_cents > v_falta then
    if p_metodo <> 'dinheiro' then
      raise exception 'Valor maior que o que falta pagar' using errcode = '22023';
    end if;
    v_troco := p_valor_cents - v_falta;
    v_valor := v_falta;
  else
    v_valor := p_valor_cents;
  end if;

  insert into public.payments (restaurant_id, order_id, method, amount_cents, change_cents, created_by)
  values (v_pedido.restaurant_id, v_pedido.id, p_metodo, v_valor, v_troco, (select auth.uid()));

  update public.orders o set paid_cents = o.paid_cents + v_valor where o.id = v_pedido.id;

  return query select v_pedido.paid_cents + v_valor, v_falta - v_valor, v_troco;
end;
$$;

revoke execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text) from public, anon;
grant execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text) to authenticated;
revoke execute on function public.registrar_pagamento(uuid, public.payment_method, integer) from public, anon;
grant execute on function public.registrar_pagamento(uuid, public.payment_method, integer) to authenticated;
