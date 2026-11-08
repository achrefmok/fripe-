begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-0000-0000-00000000000a', 'boutique-arrivage@test.local', '{"display_name":"Boutique"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'autre-arrivage@test.local', '{"display_name":"Autre"}'),
  ('b0000000-0000-0000-0000-00000000000c', 'admin-arrivage@test.local', '{"display_name":"Admin"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000c', 'totp', 'verified', now(), now());
insert into public.platform_admins (user_id) values ('b0000000-0000-0000-0000-00000000000c');

insert into public.shops (id, slug, name, governorate_id, city_id, status)
select v.id::uuid, v.slug, v.name, c.governorate_id, c.id, 'approved'
from (values
  ('b1000000-0000-0000-0000-00000000000a', 'arrivage-a', 'Boutique Arrivage A'),
  ('b1000000-0000-0000-0000-00000000000b', 'arrivage-b', 'Boutique Arrivage B')
) as v (id, slug, name)
cross join (select id, governorate_id from public.cities where slug = 'la-marsa') c;

insert into public.shop_members (shop_id, user_id, role) values
  ('b1000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000a', 'owner'),
  ('b1000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');

insert into public.products (id, shop_id, reference, title, category_id, condition, price_millimes, publication_status, published_at)
select v.id::uuid, v.shop::uuid, v.ref, v.title, (select id from public.categories where slug = 'jeans'), 'good', 30000, v.pub::public.publication_status,
       case when v.pub = 'published' then now() end
from (values
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000a', 'AR-1', 'Jean A1', 'published'),
  ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-00000000000a', 'AR-2', 'Jean A2', 'published'),
  ('b2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-00000000000a', 'AR-3', 'Brouillon A', 'draft'),
  ('b2000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-00000000000b', 'AR-4', 'Jean B', 'published')
) as v (id, shop, ref, title, pub);

create function pg_temp.login(p_id text, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

create temporary table arrival as select null::uuid as id;
grant all on arrival to authenticated, anon;

-- La boutique annonce : seulement ses pièces en ligne, entre 1 et 12.
select pg_temp.login('b0000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$select public.submit_arrival('b1000000-0000-0000-0000-00000000000a', 'Arrivage', null, array['b2000000-0000-0000-0000-000000000004']::uuid[])$$,
  'P0001', 'arrival_pieces', 'une pièce d''une autre boutique est refusée'
);

select throws_ok(
  $$select public.submit_arrival('b1000000-0000-0000-0000-00000000000a', 'Arrivage', null, array['b2000000-0000-0000-0000-000000000003']::uuid[])$$,
  'P0001', 'arrival_pieces', 'un brouillon est refusé'
);

select throws_ok(
  $$select public.submit_arrival('b1000000-0000-0000-0000-00000000000a', 'Ar', null, array['b2000000-0000-0000-0000-000000000001']::uuid[])$$,
  'P0001', 'arrival_title', 'un titre trop court est refusé'
);

select throws_ok(
  $$select public.submit_arrival('b1000000-0000-0000-0000-00000000000b', 'Arrivage volé', null, array['b2000000-0000-0000-0000-000000000004']::uuid[])$$,
  'P0001', 'forbidden', 'une boutique n''annonce pas pour une autre'
);

select lives_ok(
  $$update arrival set id = public.submit_arrival('b1000000-0000-0000-0000-00000000000a', '  Vestes de printemps  ', 'Arrivé ce matin',
      array['b2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001']::uuid[])$$,
  'la boutique annonce un arrivage'
);

select is((select status::text from public.arrivals where id = (select id from arrival)), 'pending', 'l''arrivage attend la validation');

select results_eq(
  $$select product_id from public.arrival_products where arrival_id = (select id from arrival) order by position$$,
  $$values ('b2000000-0000-0000-0000-000000000002'::uuid), ('b2000000-0000-0000-0000-000000000001'::uuid)$$,
  'les pièces gardent l''ordre choisi'
);

select throws_ok(
  $$insert into public.arrivals (shop_id, title, status) values ('b1000000-0000-0000-0000-00000000000a', 'Direct', 'approved')$$,
  '42501', null, 'aucune écriture directe, même par la boutique'
);

select throws_ok(
  $$select public.review_arrival((select id from arrival), 'approved', null)$$,
  'P0001', 'forbidden', 'la boutique ne valide pas son propre arrivage'
);

-- En attente, il n'est visible ni des visiteurs ni des autres boutiques.
select pg_temp.logout();
set local role anon;
select is((select count(*)::int from public.arrivals), 0, 'un visiteur ne voit pas un arrivage en attente');
reset role;

-- L'administration valide (second facteur exigé).
select pg_temp.login('b0000000-0000-0000-0000-00000000000c', 'aal2');
select lives_ok($$select public.review_arrival((select id from arrival), 'approved', null)$$, 'l''administration valide');
select throws_ok(
  $$select public.review_arrival((select id from arrival), 'rejected', 'Trop tard')$$,
  'P0001', 'invalid_transition', 'une décision ne se rejoue pas'
);
select pg_temp.logout();

-- Validé, il devient public avec ses pièces.
set local role anon;
select is((select count(*)::int from public.arrivals where id = (select id from arrival)), 1, 'un visiteur voit l''arrivage validé');
select is((select count(*)::int from public.arrival_products where arrival_id = (select id from arrival)), 2, 'et ses pièces');
reset role;

select * from finish();
rollback;
