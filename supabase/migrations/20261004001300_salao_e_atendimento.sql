-- Salão e jeito de atender: configurações da loja, mesas cadastradas e chamada por senha ou nome.

create type public.call_mode as enum ('senha', 'nome');
create type public.counter_service as enum ('cliente_busca', 'garcom_leva');

alter table public.restaurants
  -- Para viagem e balcão com retirada: chamar o cliente pela senha ou pelo nome
  add column call_by public.call_mode not null default 'senha',
  -- Comer no local pedindo no balcão: o cliente busca ou o garçom leva até a mesa
  add column counter_dine_in public.counter_service not null default 'cliente_busca';

-- Correção da E01: pela API, a equipe só altera colunas seguras da loja.
-- Status, endereço (slug), marca e organização mudam só por funções do sistema.
revoke update on public.restaurants from authenticated;
grant update (name, timezone, call_by, counter_dine_in) on public.restaurants to authenticated;

-- Mesas do salão
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 20),
  area text not null default 'Salão' check (length(trim(area)) between 1 and 40),
  seats integer check (seats between 1 and 50),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index dining_tables_label_unico on public.dining_tables (restaurant_id, lower(label));
create index dining_tables_restaurant_idx on public.dining_tables (restaurant_id, area, position);

alter table public.dining_tables enable row level security;
create policy "equipe vê as mesas" on public.dining_tables
  for select to authenticated using (private.pode_ver_loja(restaurant_id));
create policy "dono e gerente cadastram mesas" on public.dining_tables
  for all to authenticated
  using (private.pode_editar_cardapio(restaurant_id))
  with check (private.pode_editar_cardapio(restaurant_id));

-- Cria várias mesas de uma vez (da 1 à 20); as que já existem são mantidas
create function public.criar_mesas(p_restaurant_id uuid, p_de integer, p_ate integer, p_area text default 'Salão')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_criadas integer;
  v_inicio integer;
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente cadastram mesas' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_de < 1 or p_ate < p_de or p_ate - p_de > 199 then
    raise exception 'Escolha um intervalo de até 200 mesas, como da 1 à 20' using errcode = '22023';
  end if;
  select coalesce(max(position), -1) + 1 into v_inicio from public.dining_tables where restaurant_id = p_restaurant_id;

  insert into public.dining_tables (restaurant_id, label, area, position)
  select p_restaurant_id, n::text, coalesce(nullif(trim(p_area), ''), 'Salão'), v_inicio + n - p_de
  from generate_series(p_de, p_ate) n
  on conflict (restaurant_id, lower(label)) do nothing;
  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;
revoke execute on function public.criar_mesas(uuid, integer, integer, text) from public, anon;
grant execute on function public.criar_mesas(uuid, integer, integer, text) to authenticated;
