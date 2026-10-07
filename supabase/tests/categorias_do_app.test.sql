-- Categorias do cardápio ligadas às do app, subcategorias e a loja em várias categorias.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.brands (id, slug, name, status) values ('1e000000-0000-4000-8000-000000000001', 'marca-cat', 'Marca', 'ativa');
insert into public.organizations (id, brand_id, name) values ('2e000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000001', 'Org');
insert into public.restaurants (id, organization_id, brand_id, slug, name, status, city, state, accepts_delivery, delivery_fee_mode, cuisines) values
  ('3e000000-0000-4000-8000-000000000001', '2e000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000001',
   'casa-mista', 'Casa Mista', 'ativo', 'Mirassol', 'SP', true, 'gratis', '{}');
insert into public.categories (id, restaurant_id, name, cuisine) values
  ('4e000000-0000-4000-8000-000000000001', '3e000000-0000-4000-8000-000000000001', 'Lanches', 'lanches'),
  ('4e000000-0000-4000-8000-000000000002', '3e000000-0000-4000-8000-000000000001', 'Pizzas', 'pizza'),
  ('4e000000-0000-4000-8000-000000000003', '3e000000-0000-4000-8000-000000000001', 'Açaí', 'acai');
-- Subcategoria sem categoria do app herda a da mãe
insert into public.categories (id, restaurant_id, name, parent_id) values
  ('4e000000-0000-4000-8000-000000000004', '3e000000-0000-4000-8000-000000000001', 'Artesanais', '4e000000-0000-4000-8000-000000000001');
insert into public.products (restaurant_id, category_id, name, price_cents, is_featured) values
  ('3e000000-0000-4000-8000-000000000001', '4e000000-0000-4000-8000-000000000004', 'Smash', 3000, true),
  ('3e000000-0000-4000-8000-000000000001', '4e000000-0000-4000-8000-000000000002', 'Calabresa', 4500, false);
insert into public.products (restaurant_id, category_id, name, price_cents, is_active) values
  ('3e000000-0000-4000-8000-000000000001', '4e000000-0000-4000-8000-000000000003', 'Açaí 500', 2000, false);

select is(private.cozinha_da_categoria('4e000000-0000-4000-8000-000000000004'), 'lanches'::public.cuisine_type,
  'subcategoria sem categoria do app herda a da mãe');
select throws_ok(
  $$ insert into public.categories (restaurant_id, name, parent_id) values
     ('3e000000-0000-4000-8000-000000000001', 'Neta', '4e000000-0000-4000-8000-000000000004') $$,
  '22023', null, 'subcategoria não pode ter outra dentro (um nível só)');
select throws_ok(
  $$ update public.categories set parent_id = '4e000000-0000-4000-8000-000000000002' where id = '4e000000-0000-4000-8000-000000000001' $$,
  '22023', null, 'categoria com subcategorias não vira subcategoria');

set local role anon;
select is(
  (select cozinhas from public.vitrine_da_cidade('marca-cat', 'mirassol-sp') where slug = 'casa-mista'),
  '{lanches,pizza}'::public.cuisine_type[], 'a loja aparece nas categorias dos produtos ativos (o açaí está pausado)');
select is(
  (select produto from public.vitrine_por_categoria('marca-cat', 'mirassol-sp', 'lanches')), 'Smash',
  'pratos da categoria Lanches, inclusive da subcategoria');
select ok(
  (select destaque from public.vitrine_por_categoria('marca-cat', 'mirassol-sp', 'lanches')), 'destaque vem marcado');
select is(
  (select count(*)::int from public.vitrine_por_categoria('marca-cat', 'mirassol-sp', 'pizza')), 1, 'pratos da categoria Pizza');
select is(
  (select count(*)::int from public.vitrine_por_categoria('marca-cat', 'mirassol-sp', 'acai')), 0, 'produto pausado não aparece');

select * from finish();
rollback;
