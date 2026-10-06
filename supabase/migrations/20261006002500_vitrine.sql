-- Vitrine do app de delivery: cidades com lojas, lojas da cidade e busca por prato.
-- Sem login; cada marca (usefood, guapifood…) vê só as próprias lojas publicadas.

-- Tipo de cozinha (as categorias da vitrine), até 3 por loja
create type public.cuisine_type as enum (
  'lanches', 'pizza', 'brasileira', 'marmita', 'japonesa', 'arabe', 'acai', 'sorvetes',
  'doces', 'padaria', 'saudavel', 'porcoes', 'bebidas', 'outros'
);
alter table public.restaurants
  add column cuisines public.cuisine_type[] not null default '{}' check (cardinality(cuisines) <= 3);
grant update (cuisines) on public.restaurants to authenticated;

-- "Mirassol" + "SP" → "mirassol-sp" (endereço da vitrine)
create function private.slug_da_cidade(p_cidade text, p_uf text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_cidade, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g')) || '-' || lower(coalesce(p_uf, ''));
$$;

-- Quando a loja abre de novo: dias a partir de hoje (0 = hoje) e a hora, no fuso da loja
create function private.proxima_abertura(p_restaurant_id uuid, p_quando timestamptz default now())
returns table (dias integer, hora time)
language sql
stable
security definer
set search_path = ''
as $$
  with agora as (
    select (p_quando at time zone r.timezone) as local from public.restaurants r where r.id = p_restaurant_id
  )
  select ((h.weekday - extract(dow from a.local)::int + 7) % 7
          + case when h.weekday = extract(dow from a.local)::int and h.opens <= a.local::time then 7 else 0 end)::int as dias,
         h.opens as hora
  from public.opening_hours h, agora a
  where h.restaurant_id = p_restaurant_id
  order by 1, 2
  limit 1;
$$;

-- Cidades com lojas publicadas da marca (para escolher a cidade e para "usar minha localização")
create function public.vitrine_cidades(p_marca text)
returns table (slug text, cidade text, uf text, lojas integer, latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select private.slug_da_cidade(r.city, r.state), min(r.city), r.state, count(*)::int,
         avg(extensions.st_y(r.location::extensions.geometry)), avg(extensions.st_x(r.location::extensions.geometry))
  from public.restaurants r
  join public.brands b on b.id = r.brand_id
  where b.slug = p_marca and r.status = 'ativo' and r.city is not null and r.state is not null
  group by private.slug_da_cidade(r.city, r.state), r.state
  order by 4 desc, 2;
$$;

-- Lojas publicadas da marca numa cidade, com o que a vitrine mostra no cartão
create function public.vitrine_da_cidade(p_marca text, p_cidade text)
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
  select r.slug, r.name, r.description, r.logo_path, r.cover_path, r.cuisines, r.district,
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

-- Busca por prato nas lojas publicadas da cidade (sem acento, no nome e na descrição)
create function public.vitrine_buscar(p_marca text, p_cidade text, p_termo text)
returns table (loja_slug text, loja_nome text, loja_aberta boolean, produto_id uuid, produto text, descricao text,
               preco_cents integer, foto_path text)
language sql
stable
security definer
set search_path = ''
as $$
  with termo as (
    select '%' || translate(lower(trim(coalesce(p_termo, ''))), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') || '%' as t
  )
  select r.slug, r.name, public.loja_aberta_agora(r.id), pr.id, pr.name, pr.description, pr.price_cents, pr.photo_path
  from public.products pr
  join public.restaurants r on r.id = pr.restaurant_id
  join public.brands b on b.id = r.brand_id, termo
  where length(trim(coalesce(p_termo, ''))) >= 2
    and b.slug = p_marca and r.status = 'ativo' and private.slug_da_cidade(r.city, r.state) = p_cidade
    and pr.is_active and 'delivery' = any (pr.available_channels)
    and (translate(lower(pr.name), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') like termo.t
         or translate(lower(coalesce(pr.description, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') like termo.t)
  order by public.loja_aberta_agora(r.id) desc, r.name, pr.name
  limit 60;
$$;

revoke execute on function public.vitrine_cidades(text) from public;
revoke execute on function public.vitrine_da_cidade(text, text) from public;
revoke execute on function public.vitrine_buscar(text, text, text) from public;
grant execute on function public.vitrine_cidades(text) to anon, authenticated;
grant execute on function public.vitrine_da_cidade(text, text) to anon, authenticated;
grant execute on function public.vitrine_buscar(text, text, text) to anon, authenticated;
