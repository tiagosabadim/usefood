-- Leads das landing pages: restaurantes interessados e candidatos a franqueado ou parceiro.
-- Qualquer visitante envia (enviar_lead); só a equipe da plataforma vê e trabalha os leads.

insert into public.reserved_slugs (slug) values ('restaurantes'), ('franquia'), ('parceiros'), ('leads')
on conflict (slug) do nothing;

create type public.lead_kind as enum ('restaurante', 'franquia');
create type public.lead_status as enum ('novo', 'em_contato', 'convertido', 'descartado');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  kind public.lead_kind not null,
  name text not null check (length(trim(name)) between 2 and 80),
  phone text not null check (phone ~ '^[0-9]{10,11}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 120),
  city text not null check (length(trim(city)) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  -- Restaurante: nome da loja, tipo e quantos pedidos por dia. Franquia: perfil e investimento.
  business_name text check (length(business_name) <= 80),
  segment text check (length(segment) <= 40),
  size text check (length(size) <= 40),
  message text check (length(message) <= 1000),
  -- De onde veio: parâmetros de campanha (utm_*) e a página
  source jsonb not null default '{}',
  consent_at timestamptz not null,
  status public.lead_status not null default 'novo',
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_created_idx on public.leads (created_at desc);
create index leads_phone_idx on public.leads (phone, created_at desc);

alter table public.leads enable row level security;
create policy "equipe da plataforma vê" on public.leads for select to authenticated using (private.is_platform_admin());
create policy "equipe da plataforma trabalha" on public.leads for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
-- Pela API, a equipe só muda a situação e as anotações
revoke update on public.leads from authenticated;
grant update (status, notes) on public.leads to authenticated;

create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- Formulário das landing pages (sem login)
create function public.enviar_lead(
  p_tipo public.lead_kind,
  p_nome text,
  p_celular text,
  p_cidade text,
  p_uf text,
  p_aceite boolean,
  p_email text default null,
  p_negocio text default null,
  p_segmento text default null,
  p_porte text default null,
  p_mensagem text default null,
  p_origem jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_celular text := regexp_replace(coalesce(p_celular, ''), '[^0-9]', '', 'g');
  v_id uuid;
begin
  if p_aceite is not true then
    raise exception 'Para enviar, aceite ser contatado pela equipe usefood.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe seu nome.' using errcode = '22023';
  end if;
  if v_celular !~ '^[0-9]{10,11}$' then
    raise exception 'Informe o WhatsApp com DDD.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_cidade, ''))) < 2 or upper(trim(coalesce(p_uf, ''))) !~ '^[A-Z]{2}$' then
    raise exception 'Informe a cidade e o estado.' using errcode = '22023';
  end if;
  -- Proteção contra envio repetido: no máximo 3 por celular a cada 24 horas
  if (select count(*) from public.leads where phone = v_celular and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Já recebemos seus dados. Nossa equipe vai falar com você pelo WhatsApp.' using errcode = 'P0001';
  end if;

  insert into public.leads (kind, name, phone, email, city, state, business_name, segment, size, message, source, consent_at)
  values (p_tipo, trim(p_nome), v_celular, nullif(lower(trim(p_email)), ''), trim(p_cidade), upper(trim(p_uf)),
          nullif(trim(p_negocio), ''), nullif(trim(p_segmento), ''), nullif(trim(p_porte), ''), nullif(trim(p_mensagem), ''),
          coalesce(p_origem, '{}'), now())
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.enviar_lead(public.lead_kind, text, text, text, text, boolean, text, text, text, text, text, jsonb) from public;
grant execute on function public.enviar_lead(public.lead_kind, text, text, text, text, boolean, text, text, text, text, text, jsonb) to anon, authenticated;
