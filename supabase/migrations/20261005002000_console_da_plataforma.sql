-- Console da plataforma (parte 1): a equipe usefood vê todas as lojas, cria uma loja
-- para um dono (pelo e-mail) e pausa, reativa ou encerra lojas.
-- Tudo exige administrador da plataforma (tabela platform_admins).

create function public.sou_admin_da_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin();
$$;

-- Todas as lojas, com o dono e os números dos últimos 30 dias
create function public.console_lojas()
returns table (
  id uuid,
  nome text,
  slug text,
  marca text,
  marca_slug text,
  situacao public.restaurant_status,
  cidade text,
  criada_em timestamptz,
  donos text[],
  pedidos_30d integer,
  vendas_30d_cents bigint,
  ultimo_pedido_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Só a equipe da plataforma vê todas as lojas' using errcode = '42501';
  end if;
  return query
  select r.id, r.name, r.slug, b.name, b.slug, r.status, r.city, r.created_at,
         coalesce((select array_agg(u.email::text order by u.email)
                   from public.memberships m join auth.users u on u.id = m.user_id
                   where m.restaurant_id = r.id and m.role = 'dono'), '{}'),
         (select count(*)::integer from public.orders o
           where o.restaurant_id = r.id and o.status <> 'cancelado' and o.created_at > now() - interval '30 days'),
         (select coalesce(sum(o.total_cents), 0)::bigint from public.orders o
           where o.restaurant_id = r.id and o.status <> 'cancelado' and o.created_at > now() - interval '30 days'),
         (select max(o.created_at) from public.orders o where o.restaurant_id = r.id)
  from public.restaurants r join public.brands b on b.id = r.brand_id
  order by r.created_at desc;
end;
$$;

-- Usada pela Edge Function do console (chave de serviço) para achar o dono pelo e-mail
create function public.console_usuario_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

-- Cria a loja para um dono: mesmas regras do "Criar restaurante" do painel
create function public.console_criar_loja(p_marca text, p_nome text, p_slug text, p_dono uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(trim(p_slug));
  v_brand uuid;
  v_org uuid;
  v_restaurant uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Só a equipe da plataforma cria lojas para outras pessoas' using errcode = '42501';
  end if;
  if nullif(trim(p_nome), '') is null then
    raise exception 'Digite o nome da loja' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$' then
    raise exception 'Endereço inválido: use letras minúsculas, números e hífen' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_dono) then
    raise exception 'Dono não encontrado' using errcode = 'P0002';
  end if;
  select id into v_brand from public.brands where slug = lower(p_marca) and status = 'ativa';
  if v_brand is null then
    raise exception 'Marca "%" não encontrada ou inativa', p_marca using errcode = 'P0002';
  end if;
  if exists (select 1 from public.reserved_slugs where slug = v_slug) then
    raise exception 'O endereço "%" é reservado; escolha outro', v_slug using errcode = '23514';
  end if;
  if exists (select 1 from public.restaurants where brand_id = v_brand and slug = v_slug) then
    raise exception 'Já existe uma loja com o endereço "%"', v_slug using errcode = '23505';
  end if;

  insert into public.organizations (brand_id, name, created_by)
  values (v_brand, trim(p_nome), (select auth.uid()))
  returning id into v_org;
  insert into public.restaurants (organization_id, brand_id, slug, name)
  values (v_org, v_brand, v_slug, trim(p_nome))
  returning id into v_restaurant;
  insert into public.memberships (restaurant_id, user_id, role)
  values (v_restaurant, p_dono, 'dono');
  return v_restaurant;
end;
$$;

-- Pausar (some da internet, dados ficam), reativar ou encerrar
create function public.console_mudar_situacao(p_restaurant_id uuid, p_situacao public.restaurant_status)
returns public.restaurant_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.restaurant_status;
begin
  if not private.is_platform_admin() then
    raise exception 'Só a equipe da plataforma muda a situação das lojas' using errcode = '42501';
  end if;
  select status into v_atual from public.restaurants where id = p_restaurant_id for update;
  if not found then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  if p_situacao = 'rascunho' or (p_situacao = 'ativo' and v_atual <> 'pausado') then
    raise exception 'Só dá para reativar uma loja pausada; a publicação é feita pelo dono' using errcode = 'P0001';
  end if;
  update public.restaurants set status = p_situacao where id = p_restaurant_id;
  return p_situacao;
end;
$$;

revoke execute on function public.sou_admin_da_plataforma() from public, anon;
grant execute on function public.sou_admin_da_plataforma() to authenticated;
revoke execute on function public.console_lojas() from public, anon;
grant execute on function public.console_lojas() to authenticated;
revoke execute on function public.console_usuario_por_email(text) from public, anon, authenticated;
grant execute on function public.console_usuario_por_email(text) to service_role;
revoke execute on function public.console_criar_loja(text, text, text, uuid) from public, anon;
grant execute on function public.console_criar_loja(text, text, text, uuid) to authenticated;
revoke execute on function public.console_mudar_situacao(uuid, public.restaurant_status) from public, anon;
grant execute on function public.console_mudar_situacao(uuid, public.restaurant_status) to authenticated;
