-- Site único: usefood.com.br/pdv, /garcom, /console e rotas da loja ficam reservados.
-- Manter em sincronia com packages/core/src/slug.ts
insert into public.reserved_slugs (slug) values
  ('cardapio'), ('cozinha'), ('delivery'), ('garcom'), ('kds'), ('mesa'), ('pdv')
on conflict (slug) do nothing;
