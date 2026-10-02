-- E01 · Extensões e utilitários compartilhados por todas as migrations

-- Localização de lojas e áreas de entrega (E11, E14)
create extension if not exists postgis with schema extensions;
-- Busca textual tolerante a acento e erro de digitação (E14)
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Mantém updated_at em dia em qualquer tabela que tenha a coluna
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
