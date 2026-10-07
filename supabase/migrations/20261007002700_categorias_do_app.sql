-- Categorias do cardápio ligadas às categorias do app (tipo de cozinha), subcategorias (um nível)
-- e destaque no produto. A loja aparece em toda categoria do app que os produtos dela têm.

alter table public.categories
  add column cuisine public.cuisine_type,
  add column parent_id uuid,
  add constraint categories_parent_fk foreign key (parent_id, restaurant_id)
    references public.categories (id, restaurant_id) on delete cascade;
create index categories_parent_idx on public.categories (parent_id);

alter table public.products add column is_featured boolean not null default false;

-- Subcategoria: um nível só (a mãe não pode ser subcategoria, e quem tem filhas não vira filha)
create function private.validar_subcategoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'Uma categoria não pode ficar dentro dela mesma.' using errcode = '22023';
  end if;
  if exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
    raise exception 'Uma subcategoria não pode ter outra dentro dela.' using errcode = '22023';
  end if;
  if exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'Esta categoria tem subcategorias; ela não pode ficar dentro de outra.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger categories_subcategoria before insert or update of parent_id on public.categories
  for each row execute function private.validar_subcategoria();

-- Categoria do app de um produto: a da categoria dele ou, se não tiver, a da categoria-mãe
create function private.cozinha_da_categoria(p_category_id uuid)
returns public.cuisine_type
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.cuisine, m.cuisine)
  from public.categories c
  left join public.categories m on m.id = c.parent_id
  where c.id = p_category_id;
$$;

-- Categorias do app de uma loja: as marcadas na loja e as dos produtos ativos no delivery
create function private.cozinhas_da_loja(p_restaurant_id uuid)
returns public.cuisine_type[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x order by x), '{}')
  from (
    select unnest(r.cuisines) as x from public.restaurants r where r.id = p_restaurant_id
    union
    select private.cozinha_da_categoria(p.category_id)
    from public.products p
    where p.restaurant_id = p_restaurant_id and p.is_active and 'delivery' = any (p.available_channels)
  ) t
  where x is not null;
$$;

create or replace function public.vitrine_da_cidade(p_marca text, p_cidade text)
returns table (
  slug text, nome text, descricao text, logo_path text, capa_path text, cozinhas public.cuisine_type[], bairro text,
  aberta boolean, abre_em_dias integer, abre_as time, tempo_min integer, tempo_max integer,
  entrega boolean, retirada boolean, taxa_modo public.delivery_fee_mode, taxa_minima_cents integer,
  gratis_acima_cents integer, pedido_minimo_cents integer, latitude double precision, longitude double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.slug, r.name, r.description, r.logo_path, r.cover_path, private.cozinhas_da_loja(r.id), r.district,
         public.loja_aberta_agora(r.id), p.dias, p.hora, r.prep_minutes_min, r.prep_minutes_max,
         r.accepts_delivery, r.accepts_pickup, r.delivery_fee_mode,
         case r.delivery_fee_mode
           when 'gratis' then 0
           when 'bairro' then (select min(d.fee_cents) from public.delivery_districts d where d.restaurant_id = r.id)
           else (select min(f.fee_cents) from public.delivery_bands f where f.restaurant_id = r.id)
         end,
         r.free_delivery_above_cents, r.min_order_cents,
         extensions.st_y(r.location::extensions.geometry), extensions.st_x(r.location::extensions.geometry)
  from public.restaurants r
  join public.brands b on b.id = r.brand_id
  left join lateral private.proxima_abertura(r.id) p on true
  where b.slug = p_marca and r.status = 'ativo' and private.slug_da_cidade(r.city, r.state) = p_cidade
  order by public.loja_aberta_agora(r.id) desc, r.name;
$$;

-- Pratos de uma categoria do app nas lojas publicadas da cidade (destaques e promoções primeiro)
create function public.vitrine_por_categoria(p_marca text, p_cidade text, p_cozinha public.cuisine_type)
returns table (loja_slug text, loja_nome text, loja_aberta boolean, produto_id uuid, produto text, descricao text,
               preco_cents integer, preco_original_cents integer, foto_path text, destaque boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.slug, r.name, public.loja_aberta_agora(r.id), pr.id, pr.name, pr.description,
         private.preco_vigente(pr.price_cents, pr.promo_price_cents, pr.promo_ends_at),
         case when private.preco_vigente(pr.price_cents, pr.promo_price_cents, pr.promo_ends_at) < pr.price_cents
              then pr.price_cents end,
         pr.photo_path, pr.is_featured
  from public.products pr
  join public.restaurants r on r.id = pr.restaurant_id
  join public.brands b on b.id = r.brand_id
  where b.slug = p_marca and r.status = 'ativo' and private.slug_da_cidade(r.city, r.state) = p_cidade
    and pr.is_active and 'delivery' = any (pr.available_channels)
    and private.cozinha_da_categoria(pr.category_id) = p_cozinha
  order by public.loja_aberta_agora(r.id) desc, pr.is_featured desc,
           (private.preco_vigente(pr.price_cents, pr.promo_price_cents, pr.promo_ends_at) < pr.price_cents) desc,
           r.name, pr.name
  limit 60;
$$;
revoke execute on function public.vitrine_por_categoria(text, text, public.cuisine_type) from public;
grant execute on function public.vitrine_por_categoria(text, text, public.cuisine_type) to anon, authenticated;
