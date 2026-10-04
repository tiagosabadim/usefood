-- Equipe com PIN: pessoas sem e-mail entram num aparelho da loja digitando um PIN de 4 números.
-- O aparelho é conectado uma vez com código (como o computador de impressão). Só aparelho
-- conectado aceita PIN, e 5 erros travam o aparelho por 5 minutos.
-- O PIN é guardado com bcrypt e a coluna nunca é lida pela API.

-- Códigos de pareamento servem para impressora e para aparelho da equipe
alter table public.print_agent_pairings
  add column kind text not null default 'impressora' check (kind in ('impressora', 'equipe'));

drop function public.criar_codigo_de_pareamento(uuid);
create function public.criar_codigo_de_pareamento(p_restaurant_id uuid, p_tipo text default 'impressora')
returns table (codigo text, expira_em timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_codigo text := '';
  v_expira timestamptz := now() + interval '10 minutes';
begin
  if p_tipo not in ('impressora', 'equipe') then
    raise exception 'Tipo de pareamento inválido' using errcode = '22023';
  end if;
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente conectam aparelhos' using errcode = '42501';
  end if;
  for i in 0..7 loop
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % length(v_alfabeto)) + 1, 1);
  end loop;
  insert into public.print_agent_pairings (restaurant_id, code_hash, expires_at, created_by, kind)
  values (p_restaurant_id, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), v_expira, (select auth.uid()), p_tipo);
  return query select substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4), v_expira;
end;
$$;
revoke execute on function public.criar_codigo_de_pareamento(uuid, text) from public, anon;
grant execute on function public.criar_codigo_de_pareamento(uuid, text) to authenticated;

-- Aparelhos da equipe (celular do garçom, tablet do caixa)
create table public.staff_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  token_hash text not null unique,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index staff_devices_restaurant_idx on public.staff_devices (restaurant_id);
alter table public.staff_devices enable row level security;
create policy "equipe vê os aparelhos" on public.staff_devices
  for select to authenticated using (private.pode_ver_loja(restaurant_id));
revoke select on public.staff_devices from authenticated;
grant select (id, restaurant_id, name, last_used_at, revoked_at, created_at) on public.staff_devices to authenticated;

-- PIN de cada pessoa na loja (único dentro da loja)
create table public.staff_pins (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
alter table public.staff_pins enable row level security;
create policy "equipe vê os nomes" on public.staff_pins
  for select to authenticated using (private.pode_ver_loja(restaurant_id));
-- O hash do PIN nunca sai pela API (4 números se quebram em segundos se o hash vazar)
revoke select on public.staff_pins from authenticated, anon;
grant select (restaurant_id, user_id, display_name, created_at) on public.staff_pins to authenticated;
create trigger staff_pins_updated_at before update on public.staff_pins
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Gestão (dono e gerente)
-- ---------------------------------------------------------------------------
create function public.definir_pin(p_restaurant_id uuid, p_user_id uuid, p_pin text, p_nome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel public.restaurant_role;
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente definem PINs' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'O PIN tem 4 números' using errcode = '22023';
  end if;
  select m.role into v_papel from public.memberships m
  where m.restaurant_id = p_restaurant_id and m.user_id = p_user_id;
  if v_papel is null then
    raise exception 'Esta pessoa não é da equipe da loja' using errcode = 'P0002';
  end if;
  if v_papel = 'dono' and not private.has_restaurant_role(p_restaurant_id, array['dono']::public.restaurant_role[]) then
    raise exception 'Só o dono define o próprio PIN' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.staff_pins s
    where s.restaurant_id = p_restaurant_id and s.user_id <> p_user_id
      and s.pin_hash = extensions.crypt(p_pin, s.pin_hash)
  ) then
    raise exception 'Este PIN já é de outra pessoa da equipe. Escolha outro.' using errcode = '23505';
  end if;

  insert into public.staff_pins (restaurant_id, user_id, display_name, pin_hash)
  values (p_restaurant_id, p_user_id, trim(p_nome), extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (restaurant_id, user_id) do update
    set display_name = excluded.display_name, pin_hash = excluded.pin_hash;
end;
$$;

-- Pessoas da equipe com nome (PIN) ou e-mail, para a tela Equipe
create function public.membros_da_equipe(p_restaurant_id uuid)
returns table (user_id uuid, papel public.restaurant_role, nome text, tem_pin boolean, e_voce boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role, coalesce(s.display_name, u.email, 'Sem nome'), s.user_id is not null,
         m.user_id = (select auth.uid())
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.staff_pins s on s.restaurant_id = m.restaurant_id and s.user_id = m.user_id
  where m.restaurant_id = p_restaurant_id
    and private.pode_editar_cardapio(p_restaurant_id)
  order by array_position(array['dono', 'gerente', 'caixa', 'garcom', 'cozinha']::public.restaurant_role[], m.role),
           coalesce(s.display_name, u.email);
$$;

create function public.remover_da_equipe(p_restaurant_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel public.restaurant_role;
begin
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente mexem na equipe' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Você não pode remover a si mesmo' using errcode = 'P0001';
  end if;
  select m.role into v_papel from public.memberships m
  where m.restaurant_id = p_restaurant_id and m.user_id = p_user_id;
  if v_papel = 'dono' then
    raise exception 'O dono não pode ser removido por aqui' using errcode = 'P0001';
  end if;
  delete from public.staff_pins where restaurant_id = p_restaurant_id and user_id = p_user_id;
  delete from public.memberships where restaurant_id = p_restaurant_id and user_id = p_user_id;
end;
$$;

create function public.desconectar_aparelho(p_aparelho uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loja uuid;
begin
  select d.restaurant_id into v_loja from public.staff_devices d where d.id = p_aparelho;
  if v_loja is null or not private.pode_editar_cardapio(v_loja) then
    raise exception 'Aparelho não encontrado ou sem permissão' using errcode = '42501';
  end if;
  update public.staff_devices set revoked_at = now() where id = p_aparelho;
end;
$$;

revoke execute on function public.definir_pin(uuid, uuid, text, text) from public, anon;
grant execute on function public.definir_pin(uuid, uuid, text, text) to authenticated;
revoke execute on function public.membros_da_equipe(uuid) from public, anon;
grant execute on function public.membros_da_equipe(uuid) to authenticated;
revoke execute on function public.remover_da_equipe(uuid, uuid) from public, anon;
grant execute on function public.remover_da_equipe(uuid, uuid) to authenticated;
revoke execute on function public.desconectar_aparelho(uuid) from public, anon;
grant execute on function public.desconectar_aparelho(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Só a Edge Function (service_role) chama estas duas
-- ---------------------------------------------------------------------------
create function public.parear_aparelho(p_codigo text, p_nome text, p_token_hash text)
returns table (restaurant_id uuid, loja text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loja uuid;
begin
  update public.print_agent_pairings p
  set used_at = now()
  where p.code_hash = encode(extensions.digest(upper(regexp_replace(p_codigo, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
    and p.kind = 'equipe' and p.used_at is null and p.expires_at > now()
  returning p.restaurant_id into v_loja;
  if v_loja is null then
    return;
  end if;
  insert into public.staff_devices (restaurant_id, name, token_hash)
  values (v_loja, coalesce(nullif(left(trim(p_nome), 60), ''), 'Aparelho da equipe'), p_token_hash);
  return query select r.id, r.name from public.restaurants r where r.id = v_loja;
end;
$$;

-- Confere o PIN no aparelho. Não usa exceção para erro de PIN: a contagem de tentativas
-- precisa ficar gravada mesmo quando o PIN está errado.
create function public.entrar_com_pin(p_token_hash text, p_pin text)
returns table (ok boolean, mensagem text, user_id uuid, restaurant_id uuid, nome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aparelho record;
  v_pessoa record;
begin
  select d.* into v_aparelho from public.staff_devices d
  where d.token_hash = p_token_hash and d.revoked_at is null
  for update;
  if not found then
    return query select false, 'Este aparelho não está conectado a nenhuma loja.', null::uuid, null::uuid, null::text;
    return;
  end if;
  if v_aparelho.locked_until > now() then
    return query select false,
      'Muitas tentativas erradas. Tente de novo em ' || ceil(extract(epoch from v_aparelho.locked_until - now()) / 60)::int || ' min.',
      null::uuid, null::uuid, null::text;
    return;
  end if;

  if p_pin ~ '^[0-9]{4}$' then
    select s.user_id, s.display_name into v_pessoa
    from public.staff_pins s
    join public.memberships m on m.restaurant_id = s.restaurant_id and m.user_id = s.user_id
    where s.restaurant_id = v_aparelho.restaurant_id and s.pin_hash = extensions.crypt(p_pin, s.pin_hash)
    limit 1;
  end if;

  if v_pessoa.user_id is null then
    update public.staff_devices d
    set failed_attempts = case when d.failed_attempts + 1 >= 5 then 0 else d.failed_attempts + 1 end,
        locked_until = case when d.failed_attempts + 1 >= 5 then now() + interval '5 minutes' else d.locked_until end
    where d.id = v_aparelho.id;
    return query select false,
      case when v_aparelho.failed_attempts + 1 >= 5 then 'PIN incorreto. Aparelho travado por 5 minutos.'
           else 'PIN incorreto.' end,
      null::uuid, null::uuid, null::text;
    return;
  end if;

  update public.staff_devices d set failed_attempts = 0, locked_until = null, last_used_at = now()
  where d.id = v_aparelho.id;
  return query select true, null::text, v_pessoa.user_id, v_aparelho.restaurant_id, v_pessoa.display_name;
end;
$$;

revoke execute on function public.parear_aparelho(text, text, text) from public, anon, authenticated;
grant execute on function public.parear_aparelho(text, text, text) to service_role;
revoke execute on function public.entrar_com_pin(text, text) from public, anon, authenticated;
grant execute on function public.entrar_com_pin(text, text) to service_role;
