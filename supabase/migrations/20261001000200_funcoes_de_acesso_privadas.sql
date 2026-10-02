-- E03 · Tira as funções internas de permissão da API pública.
-- Elas só servem às políticas de RLS; no schema `private` o PostgREST não as expõe
-- em /rest/v1/rpc. As políticas continuam funcionando: referenciam a função pelo id,
-- não pelo nome. criar_restaurante continua pública de propósito (onboarding).

create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_platform_admin() set schema private;
alter function public.is_brand_member(uuid) set schema private;
alter function public.has_restaurant_role(uuid, public.restaurant_role[]) set schema private;
alter function public.restaurant_brand(uuid) set schema private;
