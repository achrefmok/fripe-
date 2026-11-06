begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(8);

-- Caractéristiques des pièces de mode : genre, coupe, matière, contrôlées par la base.

select is(
  (select count(*)::int from public.category_attributes a join public.categories c on c.id = a.category_id
   where c.slug in ('hauts', 'bas', 'vestes-manteaux', 'robes') and a.key in ('genre', 'coupe', 'matiere')),
  12,
  'les quatre rayons de vêtements ont genre, coupe et matière'
);

select is(
  (select count(*)::int from public.category_attributes a join public.categories c on c.id = a.category_id
   where c.slug in ('chaussures', 'accessoires')),
  4,
  'chaussures et accessoires ont genre et matière'
);

select ok(
  not exists (select 1 from public.category_attributes a join public.categories c on c.id = a.category_id
              where c.section = 'mode' and a.kind <> 'choice'),
  'les caractéristiques de mode sont toutes des choix'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-0000-0000-00000000000a', 'boutique-attributs@test.local', '{"display_name":"Boutique"}');

insert into public.shops (id, slug, name, governorate_id, city_id, status)
select 'a1000000-0000-0000-0000-00000000000a', 'attributs-t', 'Boutique Attributs', c.governorate_id, c.id, 'approved'
from public.cities c where c.slug = 'la-marsa';

insert into public.shop_members (shop_id, user_id, role)
values ('a1000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner');

create function pg_temp.login(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.login('a0000000-0000-0000-0000-00000000000a');

-- Une sous-catégorie hérite des caractéristiques de son rayon.
select lives_ok(
  $$insert into public.products (shop_id, reference, title, category_id, size, color, attributes)
    values ('a1000000-0000-0000-0000-00000000000a', 'A-1', 'Jean droit', (select id from public.categories where slug = 'jeans'),
            'M', 'Bleu', '{"genre":"femme","coupe":"droite","matiere":"jean"}')$$,
  'un jean enregistre genre, coupe et matière'
);

select is(
  (select attributes ->> 'coupe' from public.products where shop_id = 'a1000000-0000-0000-0000-00000000000a' and title = 'Jean droit'),
  'droite',
  'la coupe est enregistrée'
);

select throws_ok(
  $$insert into public.products (shop_id, reference, title, category_id, attributes)
    values ('a1000000-0000-0000-0000-00000000000a', 'A-2', 'Jean', (select id from public.categories where slug = 'jeans'), '{"coupe":"tube"}')$$,
  'P0001', 'invalid_attributes', 'une valeur hors liste est refusée'
);

select throws_ok(
  $$insert into public.products (shop_id, reference, title, category_id, attributes)
    values ('a1000000-0000-0000-0000-00000000000a', 'A-3', 'Baskets', (select id from public.categories where slug = 'baskets'), '{"coupe":"droite"}')$$,
  'P0001', 'invalid_attributes', 'une caractéristique d''un autre rayon est refusée'
);

select throws_ok(
  $$insert into public.category_attributes (category_id, key, label_fr, label_ar, kind)
    values ((select id from public.categories where slug = 'hauts'), 'pirate', 'Pirate', 'قرصان', 'text')$$,
  '42501', null, 'une boutique ne peut pas ajouter de caractéristique'
);

select * from finish();
rollback;
