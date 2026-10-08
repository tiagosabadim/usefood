-- Home do app: pratos mais pedidos da semana nas lojas da cidade. Sem vendas suficientes,
-- o app mostra "Sugestões da cidade" com o que existe (destaques e produtos com foto primeiro).

create function public.vitrine_mais_pedidos(p_marca text, p_cidade text)
returns table (loja_slug text, loja_nome text, loja_aberta boolean, produto_id uuid, produto text,
               preco_cents integer, preco_original_cents integer, foto_path text, destaque boolean,
               vendidos_semana integer)
language sql
stable
security definer
set search_path = ''
as $$
  with vendidos as (
    select oi.product_id, sum(oi.quantity)::integer as qtd
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.created_at > now() - interval '7 days' and o.status <> 'cancelado' and oi.product_id is not null
    group by oi.product_id
  )
  select r.slug, r.name, public.loja_aberta_agora(r.id), pr.id, pr.name,
         private.preco_vigente(pr.price_cents, pr.promo_price_cents, pr.promo_ends_at),
         case when private.preco_vigente(pr.price_cents, pr.promo_price_cents, pr.promo_ends_at) < pr.price_cents
              then pr.price_cents end,
         pr.photo_path, pr.is_featured, coalesce(v.qtd, 0)
  from public.products pr
  join public.restaurants r on r.id = pr.restaurant_id
  join public.brands b on b.id = r.brand_id
  left join vendidos v on v.product_id = pr.id
  where b.slug = p_marca and r.status = 'ativo' and private.slug_da_cidade(r.city, r.state) = p_cidade
    and pr.is_active and 'delivery' = any (pr.available_channels)
  order by coalesce(v.qtd, 0) desc, pr.is_featured desc, (pr.photo_path is not null) desc,
           public.loja_aberta_agora(r.id) desc, pr.created_at desc
  limit 12;
$$;
revoke execute on function public.vitrine_mais_pedidos(text, text) from public;
grant execute on function public.vitrine_mais_pedidos(text, text) to anon, authenticated;
