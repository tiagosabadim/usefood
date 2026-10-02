-- E03 · Base multi-marca: marcas, domínios, territórios, restaurantes e acesso
-- Regra central: toda linha pertence a uma marca; o RLS decide quem vê o quê.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.brand_status as enum ('rascunho', 'ativa', 'suspensa');
create type public.restaurant_status as enum ('rascunho', 'ativo', 'pausado', 'encerrado');
create type public.restaurant_role as enum ('dono', 'gerente', 'caixa', 'garcom', 'cozinha');
create type public.brand_role as enum ('franqueado', 'suporte');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Equipe da plataforma (painel master)
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status public.brand_status not null default 'rascunho',
  is_franchise boolean not null default false,
  -- tokens visuais da marca (cores, logo); lidos pelo design system
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_slug_formato
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug not like '%--%')
);

create table public.brand_domains (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  hostname text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint brand_domains_hostname_minusculo check (hostname = lower(hostname))
);
create unique index brand_domains_um_primario on public.brand_domains (brand_id) where is_primary;

create table public.brand_members (
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.brand_role not null,
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index brand_members_user_idx on public.brand_members (user_id);

create table public.territories (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  ibge_code text,
  area extensions.geography(MultiPolygon, 4326),
  is_exclusive boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index territories_ibge_exclusivo
  on public.territories (ibge_code) where is_exclusive and ibge_code is not null;
create index territories_brand_idx on public.territories (brand_id);
create index territories_area_idx on public.territories using gist (area);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- permite a FK composta abaixo: restaurante sempre na mesma marca da organização
  unique (id, brand_id)
);
create index organizations_brand_idx on public.organizations (brand_id);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null references public.brands (id),
  slug text not null,
  name text not null,
  status public.restaurant_status not null default 'rascunho',
  location extensions.geography(Point, 4326),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, brand_id)
    references public.organizations (id, brand_id) on delete cascade,
  unique (brand_id, slug),
  constraint restaurants_slug_formato
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug not like '%--%')
);
create index restaurants_organization_idx on public.restaurants (organization_id);
create index restaurants_location_idx on public.restaurants using gist (location);

create table public.memberships (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.restaurant_role not null,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Endereços que nenhuma loja pode usar. Manter em sincronia com packages/core/src/slug.ts
create table public.reserved_slugs (
  slug text primary key
);
insert into public.reserved_slugs (slug) values
  ('admin'), ('ajuda'), ('api'), ('app'), ('apps'), ('assets'), ('blog'), ('busca'), ('buscar'),
  ('cadastro'), ('carrinho'), ('checkout'), ('cidade'), ('cidades'), ('console'), ('conta'),
  ('dashboard'), ('entrar'), ('login'), ('loja'), ('lojas'), ('minha-conta'), ('painel'),
  ('pedido'), ('pedidos'), ('privacidade'), ('restaurante'), ('restaurantes'), ('sair'),
  ('static'), ('status'), ('suporte'), ('termos'), ('www');

create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
create trigger territories_updated_at before update on public.territories
  for each row execute function public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções de acesso
-- security definer: leem as tabelas de vínculo sem passar pelo RLS, o que evita
-- recursão entre políticas e mantém as consultas rápidas.
-- ---------------------------------------------------------------------------
create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

create function public.is_brand_member(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brand_members
    where brand_id = p_brand_id and user_id = (select auth.uid())
  );
$$;

create function public.has_restaurant_role(
  p_restaurant_id uuid,
  p_roles public.restaurant_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where restaurant_id = p_restaurant_id
      and user_id = (select auth.uid())
      and (p_roles is null or role = any (p_roles))
  );
$$;

create function public.restaurant_brand(p_restaurant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select brand_id from public.restaurants where id = p_restaurant_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.platform_admins enable row level security;
alter table public.brands enable row level security;
alter table public.brand_domains enable row level security;
alter table public.brand_members enable row level security;
alter table public.territories enable row level security;
alter table public.organizations enable row level security;
alter table public.restaurants enable row level security;
alter table public.memberships enable row level security;
alter table public.reserved_slugs enable row level security;

-- platform_admins: cada um vê o próprio vínculo; só SQL/service role altera
create policy "admin vê o próprio vínculo" on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

-- brands: marcas ativas são públicas (o app precisa resolver a marca antes do login)
create policy "marcas ativas são públicas" on public.brands
  for select to anon, authenticated
  using (status = 'ativa' or (select public.is_platform_admin()) or public.is_brand_member(id));
create policy "plataforma gerencia marcas" on public.brands
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- brand_domains: públicos para marcas ativas
create policy "domínios de marcas ativas são públicos" on public.brand_domains
  for select to anon, authenticated
  using (
    exists (select 1 from public.brands b where b.id = brand_id and b.status = 'ativa')
    or (select public.is_platform_admin())
    or public.is_brand_member(brand_id)
  );
create policy "plataforma gerencia domínios" on public.brand_domains
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- brand_members: cada um vê o próprio vínculo; a plataforma gerencia
create policy "membro vê o próprio vínculo" on public.brand_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));
create policy "plataforma gerencia franqueados" on public.brand_members
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- territories: franqueado vê os da sua marca; a plataforma gerencia
create policy "franqueado vê seus territórios" on public.territories
  for select to authenticated
  using ((select public.is_platform_admin()) or public.is_brand_member(brand_id));
create policy "plataforma gerencia territórios" on public.territories
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- organizations: criadas só pela função criar_restaurante
create policy "equipe vê a própria organização" on public.organizations
  for select to authenticated
  using (
    (select public.is_platform_admin())
    or public.is_brand_member(brand_id)
    or exists (
      select 1 from public.restaurants r
      where r.organization_id = organizations.id and public.has_restaurant_role(r.id)
    )
  );
create policy "dono edita a própria organização" on public.organizations
  for update to authenticated
  using (
    (select public.is_platform_admin())
    or exists (
      select 1 from public.restaurants r
      where r.organization_id = organizations.id
        and public.has_restaurant_role(r.id, array['dono']::public.restaurant_role[])
    )
  )
  with check (
    (select public.is_platform_admin())
    or exists (
      select 1 from public.restaurants r
      where r.organization_id = organizations.id
        and public.has_restaurant_role(r.id, array['dono']::public.restaurant_role[])
    )
  );

-- restaurants: lojas ativas são públicas (vitrine e link da loja)
create policy "lojas ativas são públicas" on public.restaurants
  for select to anon, authenticated
  using (status = 'ativo');
create policy "equipe, franqueado e plataforma veem a loja" on public.restaurants
  for select to authenticated
  using (
    public.has_restaurant_role(id)
    or public.is_brand_member(brand_id)
    or (select public.is_platform_admin())
  );
create policy "dono e gerente editam a loja" on public.restaurants
  for update to authenticated
  using (
    public.has_restaurant_role(id, array['dono', 'gerente']::public.restaurant_role[])
    or public.is_brand_member(brand_id)
    or (select public.is_platform_admin())
  )
  with check (
    public.has_restaurant_role(id, array['dono', 'gerente']::public.restaurant_role[])
    or public.is_brand_member(brand_id)
    or (select public.is_platform_admin())
  );
create policy "plataforma remove lojas" on public.restaurants
  for delete to authenticated
  using ((select public.is_platform_admin()));

-- Quem edita a loja não troca a marca nem a organização dela
revoke update on public.restaurants from anon, authenticated;
grant update (name, slug, status, location, timezone) on public.restaurants to authenticated;

-- memberships: o dono monta a equipe
create policy "equipe vê a equipe" on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_restaurant_role(restaurant_id, array['dono', 'gerente']::public.restaurant_role[])
    or public.is_brand_member(public.restaurant_brand(restaurant_id))
    or (select public.is_platform_admin())
  );
create policy "dono adiciona à equipe" on public.memberships
  for insert to authenticated
  with check (
    public.has_restaurant_role(restaurant_id, array['dono']::public.restaurant_role[])
    or (select public.is_platform_admin())
  );
create policy "dono altera a equipe" on public.memberships
  for update to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['dono']::public.restaurant_role[])
    or (select public.is_platform_admin())
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['dono']::public.restaurant_role[])
    or (select public.is_platform_admin())
  );
create policy "dono remove da equipe" on public.memberships
  for delete to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['dono']::public.restaurant_role[])
    or (select public.is_platform_admin())
  );

-- reserved_slugs: leitura pública para validar o endereço no cadastro
create policy "endereços reservados são públicos" on public.reserved_slugs
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Criação de restaurante (onboarding): organização + loja + dono, numa transação
-- ---------------------------------------------------------------------------
create function public.criar_restaurante(p_marca text, p_nome text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_slug text := lower(trim(p_slug));
  v_brand uuid;
  v_org uuid;
  v_restaurant uuid;
begin
  if v_user is null then
    raise exception 'É preciso estar logado para criar um restaurante' using errcode = '42501';
  end if;

  select id into v_brand from public.brands where slug = lower(p_marca) and status = 'ativa';
  if v_brand is null then
    raise exception 'Marca "%" não encontrada ou inativa', p_marca using errcode = 'P0002';
  end if;

  if exists (select 1 from public.reserved_slugs where slug = v_slug) then
    raise exception 'O endereço "%" é reservado; escolha outro', v_slug using errcode = '23514';
  end if;

  insert into public.organizations (brand_id, name, created_by)
  values (v_brand, trim(p_nome), v_user)
  returning id into v_org;

  insert into public.restaurants (organization_id, brand_id, slug, name)
  values (v_org, v_brand, v_slug, trim(p_nome))
  returning id into v_restaurant;

  insert into public.memberships (restaurant_id, user_id, role)
  values (v_restaurant, v_user, 'dono');

  return v_restaurant;
end;
$$;

revoke execute on function public.criar_restaurante(text, text, text) from public, anon;
grant execute on function public.criar_restaurante(text, text, text) to authenticated;
