-- Domínio próprio para marcas (vitrines) e para lojas.
--   guapifood.com.br     → vitrine da marca guapifood
--   ranchopasteis.com.br → direto na loja, sem vitrine
-- O provedor que liga o domínio ao site (hoje Netlify) fica registrado por linha,
-- para a troca de parceiro acontecer domínio a domínio, sem migração de dados.

create type public.domain_kind as enum ('marca', 'loja');
create type public.domain_status as enum ('pendente', 'verificando', 'ativo', 'erro');

alter table public.brand_domains rename to domains;
alter index public.brand_domains_um_primario rename to domains_um_primario_por_marca;

alter table public.domains
  add column kind public.domain_kind not null default 'marca',
  add column restaurant_id uuid references public.restaurants (id) on delete cascade,
  add column status public.domain_status not null default 'pendente',
  add column provider text not null default 'netlify',
  add column last_error text,
  add column verified_at timestamptz,
  add column updated_at timestamptz not null default now(),
  -- guardamos sempre o domínio sem www; o www é ligado junto
  add constraint domains_sem_www check (hostname !~ '^www\.'),
  add constraint domains_formato check (hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  add constraint domains_loja_tem_restaurante check ((kind = 'loja') = (restaurant_id is not null));

-- Domínios que já existiam eram de marca e estavam em uso
update public.domains set status = 'ativo', verified_at = now();

-- "Domínio principal" só faz sentido entre os domínios da vitrine de uma marca
drop index public.domains_um_primario_por_marca;
create unique index domains_um_primario_por_marca on public.domains (brand_id)
  where is_primary and kind = 'marca';
create index domains_restaurant_idx on public.domains (restaurant_id);

create trigger domains_updated_at before update on public.domains
  for each row execute function public.set_updated_at();

-- Domínio de loja sempre na marca da própria loja
create function private.domains_marca_da_loja()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.restaurant_id is not null then
    new.brand_id := (select brand_id from public.restaurants where id = new.restaurant_id);
  end if;
  return new;
end;
$$;
create trigger domains_marca_da_loja before insert or update on public.domains
  for each row execute function private.domains_marca_da_loja();

-- Leitura pública só de domínios ativos de marcas ativas (resolver a marca antes do login)
drop policy "domínios de marcas ativas são públicos" on public.domains;
create policy "domínios ativos são públicos" on public.domains
  for select to anon, authenticated
  using (
    status = 'ativo'
    and exists (select 1 from public.brands b where b.id = brand_id and b.status = 'ativa')
  );
-- Quem cuida da marca ou da loja acompanha o status da conexão
create policy "responsáveis acompanham seus domínios" on public.domains
  for select to authenticated
  using (
    private.is_brand_member(brand_id)
    or (restaurant_id is not null
        and private.has_restaurant_role(restaurant_id, array['dono', 'gerente']::public.restaurant_role[]))
  );
-- Escrita: a política "plataforma gerencia domínios" (migration anterior) segue valendo.
-- Donos e franqueados conectam domínios pela Edge Function `dominios`, que confere a
-- permissão e conversa com o provedor.

-- O que o app precisa saber ao abrir: é vitrine de marca ou loja direta?
create function public.resolver_dominio(p_hostname text)
returns table (kind public.domain_kind, brand_slug text, restaurant_slug text)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.kind, b.slug, r.slug
  from public.domains d
  join public.brands b on b.id = d.brand_id
  left join public.restaurants r on r.id = d.restaurant_id
  where d.hostname = regexp_replace(lower(trim(p_hostname)), '^www\.', '')
    and d.status = 'ativo'
  limit 1;
$$;
grant execute on function public.resolver_dominio(text) to anon, authenticated;
