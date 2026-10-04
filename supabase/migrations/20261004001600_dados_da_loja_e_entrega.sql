-- Loja online, parte 1: dados da loja, horários, entrega e publicação.
-- Taxa de entrega: grátis (padrão das cidades pequenas), por bairro ou por distância.

create type public.delivery_fee_mode as enum ('gratis', 'bairro', 'distancia');

alter table public.restaurants
  -- WhatsApp ou telefone, só números com DDD
  add column description text check (length(description) <= 300),
  add column phone text check (phone ~ '^[0-9]{10,11}$'),
  add column postal_code text check (postal_code ~ '^[0-9]{8}$'),
  add column street text check (length(street) <= 120),
  add column street_number text check (length(street_number) <= 20),
  add column complement text check (length(complement) <= 80),
  add column district text check (length(district) <= 80),
  add column city text check (length(city) <= 80),
  add column state text check (state ~ '^[A-Z]{2}$'),
  add column logo_path text,
  add column cover_path text,
  add column accepts_delivery boolean not null default false,
  add column accepts_pickup boolean not null default true,
  add column delivery_fee_mode public.delivery_fee_mode not null default 'gratis',
  -- Grátis: limite opcional em km (vazio = cidade toda). Distância: limite = última faixa.
  add column delivery_radius_km numeric(5, 2) check (delivery_radius_km > 0),
  add column min_order_cents integer not null default 0 check (min_order_cents >= 0),
  add column free_delivery_above_cents integer check (free_delivery_above_cents > 0),
  add column prep_minutes_min integer not null default 30 check (prep_minutes_min between 5 and 240),
  add column prep_minutes_max integer not null default 50 check (prep_minutes_max between 5 and 300),
  add constraint restaurants_tempo_valido check (prep_minutes_max >= prep_minutes_min);

-- A equipe (dono e gerente, pela política de update) só altera estas colunas pela API
grant update (
  name, timezone, call_by, counter_dine_in,
  description, phone, postal_code, street, street_number, complement, district, city, state,
  logo_path, cover_path, accepts_delivery, accepts_pickup, delivery_fee_mode, delivery_radius_km,
  min_order_cents, free_delivery_above_cents, prep_minutes_min, prep_minutes_max
) on public.restaurants to authenticated;

-- Bairros atendidos, cada um com a sua taxa (zero vale)
create table public.delivery_districts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  name_key text not null,
  fee_cents integer not null default 0 check (fee_cents between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name_key)
);

-- "Jardim São José" e "jardim sao jose" são o mesmo bairro
create function private.chave_do_bairro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := trim(new.name);
  new.name_key := lower(extensions.unaccent(new.name));
  return new;
end;
$$;
create trigger delivery_districts_chave before insert or update of name on public.delivery_districts
  for each row execute function private.chave_do_bairro();

-- Faixas de distância: até X km, taxa Y
create table public.delivery_bands (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  up_to_km numeric(5, 2) not null check (up_to_km > 0 and up_to_km <= 100),
  fee_cents integer not null check (fee_cents between 0 and 100000),
  unique (restaurant_id, up_to_km)
);

-- Horários de funcionamento (0 = domingo … 6 = sábado). Fechar antes de abrir = vira a madrugada.
create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  check (opens <> closes)
);
create index opening_hours_restaurant_idx on public.opening_hours (restaurant_id, weekday);

do $$
declare
  tabela text;
begin
  foreach tabela in array array['delivery_districts', 'delivery_bands', 'opening_hours'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format(
      'create policy "equipe vê" on public.%I for select to authenticated using (private.pode_ver_loja(restaurant_id))', tabela);
    execute format(
      'create policy "dono e gerente editam" on public.%I for all to authenticated
         using (private.pode_editar_cardapio(restaurant_id)) with check (private.pode_editar_cardapio(restaurant_id))', tabela);
    -- O cliente da loja online precisa ver horários e taxas
    execute format(
      'create policy "público vê nas lojas no ar" on public.%I for select to anon, authenticated using (private.loja_ativa(restaurant_id))', tabela);
  end loop;
end;
$$;

-- Localização da loja (latitude e longitude), para a entrega por distância e para a vitrine
create function public.definir_localizacao(p_restaurant_id uuid, p_latitude double precision, p_longitude double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente mudam a localização' using errcode = '42501';
  end if;
  if p_latitude not between -34 and 6 or p_longitude not between -74 and -28 then
    raise exception 'Localização fora do Brasil' using errcode = '22023';
  end if;
  update public.restaurants
  set location = extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
  where id = p_restaurant_id;
end;
$$;

-- Está aberta agora, no fuso da loja?
create function public.loja_aberta_agora(p_restaurant_id uuid, p_quando timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with agora as (
    select (p_quando at time zone r.timezone) as local from public.restaurants r where r.id = p_restaurant_id
  ), d as (
    select extract(dow from local)::smallint as hoje, ((extract(dow from local)::int + 6) % 7)::smallint as ontem,
           local::time as hora
    from agora
  )
  select exists (
    select 1 from public.opening_hours h, d
    where h.restaurant_id = p_restaurant_id and (
      (h.weekday = d.hoje and h.opens < h.closes and d.hora >= h.opens and d.hora < h.closes)
      -- passa da meia-noite: começa hoje…
      or (h.weekday = d.hoje and h.opens > h.closes and d.hora >= h.opens)
      -- …ou começou ontem e ainda não fechou
      or (h.weekday = d.ontem and h.opens > h.closes and d.hora < h.closes)
    )
  );
$$;

-- O que ainda falta para publicar a loja
create function public.pendencias_para_publicar(p_restaurant_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
  v_falta text[] := '{}';
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente publicam a loja' using errcode = '42501';
  end if;
  select * into v from public.restaurants where id = p_restaurant_id;
  if v.street is null or v.street_number is null or v.district is null or v.city is null or v.state is null then
    v_falta := array_append(v_falta, 'Preencher o endereço da loja');
  end if;
  if v.phone is null then
    v_falta := array_append(v_falta, 'Informar o WhatsApp ou telefone da loja');
  end if;
  if not exists (select 1 from public.opening_hours where restaurant_id = p_restaurant_id) then
    v_falta := array_append(v_falta, 'Cadastrar os horários de funcionamento');
  end if;
  if not exists (select 1 from public.products where restaurant_id = p_restaurant_id and is_active) then
    v_falta := array_append(v_falta, 'Ter pelo menos um produto ativo no cardápio');
  end if;
  if not v.accepts_delivery and not v.accepts_pickup then
    v_falta := array_append(v_falta, 'Aceitar delivery, retirada ou os dois');
  end if;
  if v.accepts_delivery and v.delivery_fee_mode = 'bairro'
     and not exists (select 1 from public.delivery_districts where restaurant_id = p_restaurant_id and is_active) then
    v_falta := array_append(v_falta, 'Cadastrar os bairros atendidos');
  end if;
  if v.accepts_delivery and v.delivery_fee_mode = 'distancia' then
    if v.location is null then
      v_falta := array_append(v_falta, 'Marcar a localização da loja');
    end if;
    if not exists (select 1 from public.delivery_bands where restaurant_id = p_restaurant_id) then
      v_falta := array_append(v_falta, 'Cadastrar as faixas de distância');
    end if;
  end if;
  return v_falta;
end;
$$;

create function public.publicar_loja(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_falta text[];
begin
  v_falta := public.pendencias_para_publicar(p_restaurant_id);
  if cardinality(v_falta) > 0 then
    raise exception 'Falta: %', array_to_string(v_falta, '; ') using errcode = 'P0001';
  end if;
  update public.restaurants set status = 'ativo' where id = p_restaurant_id;
end;
$$;

-- Tirar a loja do ar sem apagar nada (férias, reforma)
create function public.pausar_loja(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente tiram a loja do ar' using errcode = '42501';
  end if;
  update public.restaurants set status = 'pausado' where id = p_restaurant_id and status = 'ativo';
end;
$$;

revoke execute on function public.definir_localizacao(uuid, double precision, double precision) from public, anon;
grant execute on function public.definir_localizacao(uuid, double precision, double precision) to authenticated;
revoke execute on function public.pendencias_para_publicar(uuid) from public, anon;
grant execute on function public.pendencias_para_publicar(uuid) to authenticated;
revoke execute on function public.publicar_loja(uuid) from public, anon;
grant execute on function public.publicar_loja(uuid) to authenticated;
revoke execute on function public.pausar_loja(uuid) from public, anon;
grant execute on function public.pausar_loja(uuid) to authenticated;
grant execute on function public.loja_aberta_agora(uuid, timestamptz) to anon, authenticated;
