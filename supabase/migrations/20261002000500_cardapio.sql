-- E04 · Cardápio: praças, categorias, produtos, tamanhos e adicionais.
-- Dinheiro sempre em centavos (inteiro): R$ 14,00 = 1400. Nunca float.
-- Toda tabela carrega restaurant_id, e as FKs compostas garantem que um filho
-- nunca aponte para um pai de outra loja.

create type public.sales_channel as enum ('salao', 'balcao', 'delivery', 'marketplace');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Praças: para onde cada produto é impresso (Cozinha, Bar, Sobremesa…)
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, restaurant_id)
);
create index stations_restaurant_idx on public.stations (restaurant_id, position);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  description text check (length(description) <= 300),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id)
);
create index categories_restaurant_idx on public.categories (restaurant_id, position);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null,
  -- null = praça padrão da loja
  station_id uuid,
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 500),
  price_cents integer not null check (price_cents between 0 and 10000000),
  -- código curto para lançar rápido no PDV
  code text check (length(code) <= 20),
  -- caminho no bucket "cardapio": <restaurant_id>/<arquivo>
  photo_path text,
  available_channels public.sales_channel[] not null
    default array['salao', 'balcao', 'delivery', 'marketplace']::public.sales_channel[],
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  unique (restaurant_id, code),
  foreign key (category_id, restaurant_id)
    references public.categories (id, restaurant_id) on delete restrict,
  foreign key (station_id, restaurant_id)
    references public.stations (id, restaurant_id) on delete set null (station_id)
);
create index products_category_idx on public.products (category_id, position);
create index products_restaurant_idx on public.products (restaurant_id);

-- Tamanhos ou versões do produto (Pequena, Grande…); cada um com seu preço
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  product_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 40),
  price_cents integer not null check (price_cents between 0 and 10000000),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (product_id, restaurant_id)
    references public.products (id, restaurant_id) on delete cascade
);
create index product_variants_product_idx on public.product_variants (product_id, position);

-- Grupos de adicionais (Adicionais, Ponto da carne, Molhos…), reaproveitáveis entre produtos
create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  min_select integer not null default 0 check (min_select >= 0),
  -- null = sem limite
  max_select integer check (max_select is null or max_select >= greatest(min_select, 1)),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id)
);
create index modifier_groups_restaurant_idx on public.modifier_groups (restaurant_id, position);

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  group_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 60),
  price_cents integer not null default 0 check (price_cents between 0 and 10000000),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (group_id, restaurant_id)
    references public.modifier_groups (id, restaurant_id) on delete cascade
);
create index modifiers_group_idx on public.modifiers (group_id, position);

create table public.product_modifier_groups (
  restaurant_id uuid not null,
  product_id uuid not null,
  group_id uuid not null,
  position integer not null default 0,
  primary key (product_id, group_id),
  foreign key (product_id, restaurant_id)
    references public.products (id, restaurant_id) on delete cascade,
  foreign key (group_id, restaurant_id)
    references public.modifier_groups (id, restaurant_id) on delete cascade
);
create index product_modifier_groups_group_idx on public.product_modifier_groups (group_id);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger modifier_groups_updated_at before update on public.modifier_groups
  for each row execute function public.set_updated_at();

-- Toda loja nasce com a praça "Cozinha"
create function private.criar_praca_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stations (restaurant_id, name) values (new.id, 'Cozinha');
  return new;
end;
$$;
create trigger restaurants_praca_padrao after insert on public.restaurants
  for each row execute function private.criar_praca_padrao();

-- Lojas que já existiam também ganham a praça padrão
insert into public.stations (restaurant_id, name)
select r.id, 'Cozinha' from public.restaurants r
where not exists (select 1 from public.stations s where s.restaurant_id = r.id);

-- ---------------------------------------------------------------------------
-- Quem pode o quê
-- ---------------------------------------------------------------------------
create function private.pode_editar_cardapio(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_restaurant_role(p_restaurant_id, array['dono', 'gerente']::public.restaurant_role[])
      or private.is_platform_admin();
$$;

create function private.pode_ver_cardapio_interno(p_restaurant_id uuid)
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

create function private.loja_ativa(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.restaurants where id = p_restaurant_id and status = 'ativo');
$$;

-- Mesmas regras em todas as tabelas do cardápio:
--   equipe da loja (qualquer papel), franqueado e plataforma veem tudo;
--   só dono e gerente criam, editam e apagam.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'stations', 'categories', 'products', 'product_variants',
    'modifier_groups', 'modifiers', 'product_modifier_groups'
  ] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format(
      'create policy "equipe vê o cardápio" on public.%I for select to authenticated
         using (private.pode_ver_cardapio_interno(restaurant_id))', tabela);
    execute format(
      'create policy "dono e gerente editam o cardápio" on public.%I for all to authenticated
         using (private.pode_editar_cardapio(restaurant_id))
         with check (private.pode_editar_cardapio(restaurant_id))', tabela);
  end loop;
end;
$$;

-- Vitrine: qualquer pessoa vê o cardápio ativo de lojas ativas (praças ficam internas)
create policy "cardápio público de lojas ativas" on public.categories
  for select to anon, authenticated using (is_active and private.loja_ativa(restaurant_id));
create policy "cardápio público de lojas ativas" on public.products
  for select to anon, authenticated using (is_active and private.loja_ativa(restaurant_id));
create policy "cardápio público de lojas ativas" on public.product_variants
  for select to anon, authenticated using (is_active and private.loja_ativa(restaurant_id));
create policy "cardápio público de lojas ativas" on public.modifier_groups
  for select to anon, authenticated using (private.loja_ativa(restaurant_id));
create policy "cardápio público de lojas ativas" on public.modifiers
  for select to anon, authenticated using (is_active and private.loja_ativa(restaurant_id));
create policy "cardápio público de lojas ativas" on public.product_modifier_groups
  for select to anon, authenticated using (private.loja_ativa(restaurant_id));

-- ---------------------------------------------------------------------------
-- Fotos: bucket público "cardapio", uma pasta por loja (<restaurant_id>/arquivo)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardapio', 'cardapio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function private.pode_editar_arquivo_do_cardapio(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pasta text := split_part(p_nome, '/', 1);
begin
  if v_pasta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.pode_editar_cardapio(v_pasta::uuid);
end;
$$;

create policy "dono e gerente enviam fotos do cardápio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cardapio' and private.pode_editar_arquivo_do_cardapio(name));
create policy "dono e gerente trocam fotos do cardápio" on storage.objects
  for update to authenticated
  using (bucket_id = 'cardapio' and private.pode_editar_arquivo_do_cardapio(name))
  with check (bucket_id = 'cardapio' and private.pode_editar_arquivo_do_cardapio(name));
create policy "dono e gerente apagam fotos do cardápio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cardapio' and private.pode_editar_arquivo_do_cardapio(name));
