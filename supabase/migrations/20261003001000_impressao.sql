-- E07 · Impressão na cozinha.
-- Cada pedido gera uma ordem de impressão por impressora de cada praça (print_jobs).
-- Um agente instalado no computador da loja recebe as ordens, imprime e confirma.

create extension if not exists pgcrypto with schema extensions;

create type public.print_job_status as enum ('pendente', 'imprimindo', 'impresso', 'falhou');

-- Impressoras térmicas de rede (TCP, porta 9100), uma ou mais por praça
create table public.printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  station_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 40),
  host text not null check (host ~ '^[A-Za-z0-9.-]{1,253}$'),
  port integer not null default 9100 check (port between 1 and 65535),
  paper_width integer not null default 80 check (paper_width in (58, 80)),
  codepage text not null default 'cp850' check (codepage in ('cp850', 'ascii')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, restaurant_id),
  foreign key (station_id, restaurant_id)
    references public.stations (id, restaurant_id) on delete cascade
);
create index printers_station_idx on public.printers (station_id);

-- Computadores da loja que imprimem; cada um entra com um usuário próprio
create table public.print_agents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  version text check (length(version) <= 40),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index print_agents_restaurant_idx on public.print_agents (restaurant_id);

-- Códigos de pareamento (guardados só como hash), válidos por 10 minutos
create table public.print_agent_pairings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid,
  station_id uuid,
  printer_id uuid references public.printers (id) on delete set null,
  kind text not null default 'pedido' check (kind in ('pedido', 'reimpressao', 'teste')),
  status public.print_job_status not null default 'pendente',
  attempts integer not null default 0,
  payload jsonb not null,
  agent_id uuid references public.print_agents (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printed_at timestamptz,
  foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete cascade,
  foreign key (station_id, restaurant_id)
    references public.stations (id, restaurant_id) on delete set null (station_id)
);
create index print_jobs_fila_idx on public.print_jobs (restaurant_id, status, created_at);
create index print_jobs_order_idx on public.print_jobs (order_id);

-- ---------------------------------------------------------------------------
-- Quem pode o quê
-- ---------------------------------------------------------------------------
create function private.agente_atual()
returns table (id uuid, restaurant_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.restaurant_id from public.print_agents a
  where a.user_id = (select auth.uid()) and a.revoked_at is null;
$$;

create function private.e_agente_da_loja(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.agente_atual() a where a.restaurant_id = p_restaurant_id);
$$;

alter table public.printers enable row level security;
alter table public.print_agents enable row level security;
alter table public.print_agent_pairings enable row level security;
alter table public.print_jobs enable row level security;

create policy "equipe e agente veem as impressoras" on public.printers
  for select to authenticated
  using (private.pode_ver_loja(restaurant_id) or private.e_agente_da_loja(restaurant_id));
create policy "dono e gerente cadastram impressoras" on public.printers
  for all to authenticated
  using (private.pode_editar_cardapio(restaurant_id))
  with check (private.pode_editar_cardapio(restaurant_id));

create policy "equipe vê os computadores de impressão" on public.print_agents
  for select to authenticated
  using (private.pode_ver_loja(restaurant_id) or user_id = (select auth.uid()));

-- print_agent_pairings: sem políticas; só as funções e a Edge Function mexem

create policy "equipe e agente veem a fila de impressão" on public.print_jobs
  for select to authenticated
  using (private.pode_ver_loja(restaurant_id) or private.e_agente_da_loja(restaurant_id));

-- ---------------------------------------------------------------------------
-- Gerar as ordens de impressão de um pedido: uma por impressora de cada praça
-- ---------------------------------------------------------------------------
create function private.gerar_impressoes(p_pedido uuid, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_praca record;
  v_payload jsonb;
  v_impressora record;
  v_tem_impressora boolean;
  v_total integer := 0;
begin
  select o.id, o.restaurant_id, o.number, o.type, o.identifier_type, o.identifier, o.notes, o.created_at,
         r.name as loja, r.timezone
  into v_pedido
  from public.orders o join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_pedido;
  if not found then
    return 0;
  end if;

  for v_praca in
    select distinct s.id, s.name from public.order_items i
    join public.stations s on s.id = i.station_id
    where i.order_id = p_pedido
  loop
    v_payload := jsonb_build_object(
      'tipo', p_tipo,
      'loja', v_pedido.loja,
      'praca', v_praca.name,
      'numero', v_pedido.number,
      'pedido_tipo', v_pedido.type,
      'identificador_tipo', v_pedido.identifier_type,
      'identificador', v_pedido.identifier,
      'criado_em', to_char(v_pedido.created_at at time zone v_pedido.timezone, 'DD/MM HH24:MI'),
      'observacao', v_pedido.notes,
      'itens', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'quantidade', i.quantity,
          'nome', i.product_name,
          'tamanho', i.variant_name,
          'adicionais', (
            select coalesce(jsonb_agg(m.name order by m.group_name, m.name), '[]'::jsonb)
            from public.order_item_modifiers m where m.order_item_id = i.id),
          'observacao', i.notes
        ) order by i.created_at), '[]'::jsonb)
        from public.order_items i
        where i.order_id = p_pedido and i.station_id = v_praca.id)
    );

    v_tem_impressora := false;
    for v_impressora in
      select p.id from public.printers p where p.station_id = v_praca.id and p.is_active
    loop
      insert into public.print_jobs (restaurant_id, order_id, station_id, printer_id, kind, payload)
      values (v_pedido.restaurant_id, p_pedido, v_praca.id, v_impressora.id, p_tipo, v_payload);
      v_tem_impressora := true;
      v_total := v_total + 1;
    end loop;

    -- Praça sem impressora: a ordem já nasce com falha, para o PDV avisar
    if not v_tem_impressora then
      insert into public.print_jobs (restaurant_id, order_id, station_id, kind, payload, status, error)
      values (v_pedido.restaurant_id, p_pedido, v_praca.id, p_tipo, v_payload, 'falhou',
              'Praça ' || v_praca.name || ' sem impressora cadastrada');
    end if;
  end loop;

  return v_total;
end;
$$;

-- criar_pedido continua o mesmo por dentro; agora, ao terminar, gera as impressões.
alter function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text)
  rename to criar_pedido_sem_impressao;
alter function public.criar_pedido_sem_impressao(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text)
  set schema private;
revoke execute on function private.criar_pedido_sem_impressao(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text)
  from public, anon, authenticated;

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
  v record;
begin
  select * into v from private.criar_pedido_sem_impressao(
    p_restaurant_id, p_tipo, p_identificador_tipo, p_identificador, p_itens, p_taxa_servico, p_observacao);
  perform private.gerar_impressoes(v.id, 'pedido');
  return query select v.id, v.numero, v.identificador, v.total_cents;
end;
$$;
revoke execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text) from public, anon;
grant execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ações da equipe: reimprimir, imprimir teste, gerar código de pareamento, desligar agente
-- ---------------------------------------------------------------------------
create function public.reimprimir_pedido(p_pedido uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loja uuid;
begin
  select o.restaurant_id into v_loja from public.orders o where o.id = p_pedido;
  if v_loja is null or not private.pode_lancar_pedido(v_loja) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  return private.gerar_impressoes(p_pedido, 'reimpressao');
end;
$$;

create function public.imprimir_teste(p_impressora uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_impressora record;
  v_job uuid;
begin
  select p.id, p.restaurant_id, p.station_id, p.name, s.name as praca, r.name as loja
  into v_impressora
  from public.printers p
  join public.stations s on s.id = p.station_id
  join public.restaurants r on r.id = p.restaurant_id
  where p.id = p_impressora;
  if not found or not private.pode_editar_cardapio(v_impressora.restaurant_id) then
    raise exception 'Impressora não encontrada ou sem permissão' using errcode = '42501';
  end if;
  insert into public.print_jobs (restaurant_id, station_id, printer_id, kind, payload)
  values (v_impressora.restaurant_id, v_impressora.station_id, v_impressora.id, 'teste',
          jsonb_build_object('tipo', 'teste', 'loja', v_impressora.loja, 'praca', v_impressora.praca,
                             'impressora', v_impressora.name, 'itens', '[]'::jsonb))
  returning id into v_job;
  return v_job;
end;
$$;

-- Código de 8 caracteres sem letras ambíguas (sem 0/O, 1/I/L): 32^8 combinações, vale 10 minutos
create function public.criar_codigo_de_pareamento(p_restaurant_id uuid)
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
  if not private.pode_editar_cardapio(p_restaurant_id) then
    raise exception 'Só o dono ou o gerente conectam computadores de impressão' using errcode = '42501';
  end if;
  for i in 0..7 loop
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % length(v_alfabeto)) + 1, 1);
  end loop;
  insert into public.print_agent_pairings (restaurant_id, code_hash, expires_at, created_by)
  values (p_restaurant_id, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), v_expira, (select auth.uid()));
  return query select substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4), v_expira;
end;
$$;

create function public.desligar_agente(p_agente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loja uuid;
begin
  select a.restaurant_id into v_loja from public.print_agents a where a.id = p_agente;
  if v_loja is null or not private.pode_editar_cardapio(v_loja) then
    raise exception 'Computador não encontrado ou sem permissão' using errcode = '42501';
  end if;
  update public.print_agents set revoked_at = now() where id = p_agente;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ações do agente (usuário do computador de impressão)
-- ---------------------------------------------------------------------------
create function public.agente_presente(p_versao text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agente record;
begin
  select * into v_agente from private.agente_atual();
  if not found then
    raise exception 'Este computador não está conectado a nenhuma loja' using errcode = '42501';
  end if;
  update public.print_agents
  set last_seen_at = now(), version = coalesce(left(p_versao, 40), version)
  where id = v_agente.id;
  return v_agente.restaurant_id;
end;
$$;

-- Reserva a ordem para este agente (ninguém imprime duas vezes) e devolve o que imprimir
create function public.pegar_impressao(p_job uuid)
returns table (payload jsonb, kind text, host text, port integer, paper_width integer, codepage text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agente record;
  v_job uuid;
begin
  select * into v_agente from private.agente_atual();
  if not found then
    raise exception 'Este computador não está conectado a nenhuma loja' using errcode = '42501';
  end if;

  update public.print_jobs j
  set status = 'imprimindo', attempts = j.attempts + 1, agent_id = v_agente.id, claimed_at = now()
  where j.id = p_job and j.restaurant_id = v_agente.restaurant_id and j.printer_id is not null
    and (j.status = 'pendente' or (j.status = 'imprimindo' and j.claimed_at < now() - interval '60 seconds'))
  returning j.id into v_job;
  if v_job is null then
    return;
  end if;

  return query
  select j.payload, j.kind, p.host, p.port, p.paper_width, p.codepage
  from public.print_jobs j join public.printers p on p.id = j.printer_id
  where j.id = v_job;
end;
$$;

-- Resultado da impressão; com falha, tenta de novo até 3 vezes
create function public.concluir_impressao(p_job uuid, p_ok boolean, p_erro text default null)
returns public.print_job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agente record;
  v_status public.print_job_status;
begin
  select * into v_agente from private.agente_atual();
  if not found then
    raise exception 'Este computador não está conectado a nenhuma loja' using errcode = '42501';
  end if;

  update public.print_jobs j
  set status = case when p_ok then 'impresso'::public.print_job_status
                    when j.attempts >= 3 then 'falhou'::public.print_job_status
                    else 'pendente'::public.print_job_status end,
      printed_at = case when p_ok then now() else null end,
      error = case when p_ok then null else left(p_erro, 300) end
  where j.id = p_job and j.agent_id = v_agente.id and j.status = 'imprimindo'
  returning j.status into v_status;
  return v_status;
end;
$$;

revoke execute on function public.reimprimir_pedido(uuid) from public, anon;
grant execute on function public.reimprimir_pedido(uuid) to authenticated;
revoke execute on function public.imprimir_teste(uuid) from public, anon;
grant execute on function public.imprimir_teste(uuid) to authenticated;
revoke execute on function public.criar_codigo_de_pareamento(uuid) from public, anon;
grant execute on function public.criar_codigo_de_pareamento(uuid) to authenticated;
revoke execute on function public.desligar_agente(uuid) from public, anon;
grant execute on function public.desligar_agente(uuid) to authenticated;
revoke execute on function public.agente_presente(text) from public, anon;
grant execute on function public.agente_presente(text) to authenticated;
revoke execute on function public.pegar_impressao(uuid) from public, anon;
grant execute on function public.pegar_impressao(uuid) to authenticated;
revoke execute on function public.concluir_impressao(uuid, boolean, text) from public, anon;
grant execute on function public.concluir_impressao(uuid, boolean, text) to authenticated;

-- O agente recebe as ordens novas em tempo real (Supabase Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.print_jobs;
  end if;
end;
$$;
