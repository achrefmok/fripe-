begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(62);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-00000000000a', 'seller-a@test.local', '{"display_name":"Vendeur A"}'),
  ('10000000-0000-0000-0000-00000000000b', 'seller-b@test.local', '{"display_name":"Vendeur B"}'),
  ('10000000-0000-0000-0000-00000000000c', 'client-c@test.local', '{"display_name":"Client C"}'),
  ('10000000-0000-0000-0000-00000000000d', 'client-d@test.local', '{"display_name":"Client D"}'),
  ('10000000-0000-0000-0000-00000000000e', 'admin@test.local', '{"display_name":"Admin"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), u.id, 'totp', 'verified', now(), now() from auth.users u;

insert into public.platform_admins (user_id) values ('10000000-0000-0000-0000-00000000000e');

create function pg_temp.login(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

insert into public.shops (id, slug, name, governorate_id, city_id, status)
select v.id::uuid, v.slug, v.name, c.governorate_id, c.id, v.status::public.shop_status
from (values
  ('20000000-0000-0000-0000-00000000000a', 'shop-a-t', 'Shop A', 'approved'),
  ('20000000-0000-0000-0000-00000000000b', 'shop-b-t', 'Shop B', 'approved'),
  ('20000000-0000-0000-0000-00000000000f', 'shop-f-t', 'Shop en attente', 'pending')
) as v (id, slug, name, status)
cross join (select id, governorate_id from public.cities where slug = 'la-marsa') c;

insert into public.shop_members (shop_id, user_id, role) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'owner'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'owner'),
  ('20000000-0000-0000-0000-00000000000f', '10000000-0000-0000-0000-00000000000a', 'owner');

create function pg_temp.seed_product(p_id text, p_shop text, p_title text, p_price integer)
returns void language sql as $$
  insert into public.products (
    id, shop_id, category_id, title, condition, price_millimes, publication_status, published_at
  )
  values (
    p_id::uuid, p_shop::uuid, (select id from public.categories where slug = 'jeans'),
    p_title, 'good', p_price, 'published', now()
  );
  insert into public.product_images (product_id, path) values (p_id::uuid, p_shop || '/' || p_id || '/1.jpg');
$$;

select pg_temp.seed_product('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', 'Jean Levis été', 30000);
select pg_temp.seed_product('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a', 'Veste Nike', 45000);
select pg_temp.seed_product('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000b', 'Chemise', 20000);
select pg_temp.seed_product('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-00000000000a', 'Pull', 25000);
select pg_temp.seed_product('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-00000000000a', 'Short', 15000);

-- Structure.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'RLS activée sur toutes les tables de public, phase 2 comprise'
);

select is(
  (select count(*)::int from cron.job where jobname = 'release-expired-reservations'),
  1,
  'le cron de libération est planifié'
);

select ok(
  (select search_text like '%jean levis ete%' from public.products
   where id = '30000000-0000-0000-0000-000000000001'),
  'la recherche ignore les accents'
);

select ok(
  (select search_text like '%جينز%' from public.products
   where id = '30000000-0000-0000-0000-000000000001'),
  'le nom arabe de la catégorie est cherchable'
);

select matches(
  (select reference from public.products where id = '30000000-0000-0000-0000-000000000001'),
  '^P-[0-9A-F]{10}$',
  'une référence interne est attribuée automatiquement'
);

-- Brouillons et isolation.
select pg_temp.login('10000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$insert into public.products (id, shop_id) values
    ('30000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-00000000000a')$$,
  'un vendeur crée un brouillon incomplet'
);

select is(
  (select count(*)::int from public.products where id = '30000000-0000-0000-0000-0000000000d1'),
  1,
  'le vendeur voit son brouillon'
);

select throws_ok(
  $$update public.products set status = 'sold' where id = '30000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'le statut d''une pièce ne se modifie pas directement'
);

select throws_ok(
  $$update public.products set publication_status = 'published'
    where id = '30000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'la publication ne se fait pas directement'
);

select results_eq(
  $$select problem from public.set_products_publication(
      array['30000000-0000-0000-0000-0000000000d1']::uuid[], 'published')$$,
  array['missing_title'],
  'un brouillon incomplet n''est pas publié et la raison est renvoyée'
);

update public.products
set title = 'Sans photo', category_id = (select id from public.categories where slug = 'jeans'),
    condition = 'good', price_millimes = 10000
where id = '30000000-0000-0000-0000-0000000000d1';

select results_eq(
  $$select problem from public.set_products_publication(
      array['30000000-0000-0000-0000-0000000000d1']::uuid[], 'published')$$,
  array['missing_photo'],
  'une photo est exigée pour publier'
);

select throws_ok(
  $$insert into public.products (shop_id, title) values ('20000000-0000-0000-0000-00000000000b', 'Pirate')$$,
  '42501', null, 'A ne crée pas de produit chez B'
);

select is_empty(
  $$update public.products set title = 'Pirate' where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  'A ne modifie pas un produit de B'
);

select throws_ok(
  $$select * from public.set_products_publication(
      array['30000000-0000-0000-0000-000000000003']::uuid[], 'archived')$$,
  'P0001', 'forbidden', 'A n''archive pas un produit de B'
);

select throws_ok(
  $$select public.set_product_availability('30000000-0000-0000-0000-000000000003', 'sold')$$,
  'P0001', 'forbidden', 'A ne marque pas vendu un produit de B'
);

select throws_ok(
  $$select public.shop_stats('20000000-0000-0000-0000-00000000000b')$$,
  'P0001', 'forbidden', 'A ne lit pas les statistiques de B'
);

insert into public.products (id, shop_id, title)
values ('30000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-00000000000f', 'Boutique en attente');

select results_eq(
  $$select problem from public.set_products_publication(
      array['30000000-0000-0000-0000-0000000000d2']::uuid[], 'published')$$,
  array['shop_not_approved'],
  'une boutique non validée ne publie pas'
);

-- Collections et stock.
insert into public.collections (id, shop_id, name, is_published)
values ('40000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'Jeans vintage', true);

select lives_ok(
  $$insert into public.collection_products (collection_id, product_id)
    values ('40000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001')$$,
  'A ajoute sa pièce à sa collection'
);

select throws_ok(
  $$insert into public.collection_products (collection_id, product_id)
    values ('40000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000003')$$,
  'P0001', 'forbidden', 'une collection ne contient pas la pièce d''une autre boutique'
);

insert into public.inventory_items (id, shop_id, category_id, approx_quantity)
values (
  '50000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
  (select id from public.categories where slug = 'jeans'), 250
);

update public.inventory_items set approx_quantity = 240 where id = '50000000-0000-0000-0000-00000000000a';

select is(
  (select count(*)::int from public.inventory_movements where item_id = '50000000-0000-0000-0000-00000000000a'),
  2,
  'chaque changement de stock est historisé'
);

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$insert into public.inventory_items (shop_id, category_id, approx_quantity)
    values ('20000000-0000-0000-0000-00000000000a', (select id from public.categories where slug = 'jeans'), 1)$$,
  '42501', null, 'B ne déclare pas de stock chez A'
);

select is_empty(
  $$update public.inventory_items set approx_quantity = 0 returning id$$,
  'B ne modifie pas le stock de A'
);

select is_empty(
  $$select id from public.inventory_movements$$,
  'B ne lit pas les mouvements de A'
);

select is_empty(
  $$delete from public.collections returning id$$,
  'B ne supprime pas la collection de A'
);

select pg_temp.logout();

-- Visibilité publique.
set local role anon;

select is(
  (select count(*)::int from public.products where shop_id = '20000000-0000-0000-0000-00000000000a'),
  4,
  'un anonyme voit les pièces publiées, pas les brouillons'
);

select is(
  (select count(*)::int from public.inventory_items where shop_id = '20000000-0000-0000-0000-00000000000a'),
  1,
  'un anonyme voit le stock indicatif'
);

select throws_ok(
  $$select public.reserve_product('30000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'un anonyme ne réserve pas'
);

select throws_ok(
  $$select id from public.order_groups$$,
  '42501', null, 'un anonyme ne lit pas les commandes'
);

reset role;

-- Demandes de client.
select pg_temp.login('10000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$select public.create_stock_request(
      '20000000-0000-0000-0000-00000000000a', null, 'L', 'noir', 'Nike', 50000, 'Une veste noire')$$,
  'un client envoie une demande'
);

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000b');

select is_empty($$select id from public.stock_requests$$, 'B ne voit pas les demandes reçues par A');

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$select public.offer_product(
      (select id from public.stock_requests limit 1),
      '30000000-0000-0000-0000-000000000002', 'Celle-ci')$$,
  'A répond avec une pièce réelle'
);

select is((select status::text from public.stock_requests limit 1), 'answered', 'la demande passe à répondue');

select throws_ok(
  $$select public.offer_product(
      (select id from public.stock_requests limit 1),
      '30000000-0000-0000-0000-000000000003', null)$$,
  'P0001', 'product_unavailable', 'A ne propose pas la pièce d''une autre boutique'
);

select throws_ok(
  $$select public.create_stock_request(
      '20000000-0000-0000-0000-00000000000a', null, '', '', '', 0, 'Ma propre boutique')$$,
  'P0001', 'own_shop', 'un vendeur ne s''écrit pas à lui-même'
);

-- Réservations.
select throws_ok(
  $$select public.reserve_product('30000000-0000-0000-0000-000000000001')$$,
  'P0001', 'own_product', 'un vendeur ne réserve pas sa propre pièce'
);

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$select public.reserve_product('30000000-0000-0000-0000-000000000001')$$,
  'le client C réserve une pièce'
);

select is(
  (select status::text from public.products where id = '30000000-0000-0000-0000-000000000001'),
  'reserved',
  'la pièce passe à réservée'
);

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000d');

select throws_ok(
  $$select public.reserve_product('30000000-0000-0000-0000-000000000001')$$,
  'P0001', 'product_unavailable', 'une double réservation est refusée'
);

select is_empty($$select id from public.reservations$$, 'D ne voit pas la réservation de C');

select pg_temp.logout();

-- Expiration : la pièce est libérée même si le cron n'est pas passé.
update public.reservations set expires_at = now() - interval '1 minute';

select pg_temp.login('10000000-0000-0000-0000-00000000000d');

select lives_ok(
  $$select public.reserve_product('30000000-0000-0000-0000-000000000001')$$,
  'une réservation expirée n''empêche pas une nouvelle réservation'
);

select pg_temp.logout();

select is(
  (select count(*)::int from public.reservations
   where product_id = '30000000-0000-0000-0000-000000000001' and status = 'expired'),
  1,
  'l''ancienne réservation est marquée expirée'
);

update public.reservations set expires_at = now() - interval '1 minute' where status = 'active';

select is(
  private.release_expired_reservations('30000000-0000-0000-0000-000000000001'),
  1,
  'le cron libère les réservations échues'
);

select is(
  (select status::text from public.products where id = '30000000-0000-0000-0000-000000000001'),
  'available',
  'la pièce redevient disponible'
);

-- Commandes.
select pg_temp.login('10000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$select public.reserve_product('30000000-0000-0000-0000-000000000001')$$,
  'C réserve avant de commander'
);

select throws_ok(
  $$select public.place_order(
      array['30000000-0000-0000-0000-000000000002']::uuid[], '{}', 'Client C', '+21622123456',
      1::smallint, 1, 'x')$$,
  'P0001', 'address_required', 'une livraison exige une adresse complète'
);

select lives_ok(
  $$select public.place_order(
      array['30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
            '30000000-0000-0000-0000-000000000003']::uuid[],
      array['20000000-0000-0000-0000-00000000000b']::uuid[],
      'Client C', '+21622123456',
      (select governorate_id from public.cities where slug = 'la-marsa'),
      (select id from public.cities where slug = 'la-marsa'),
      '12 rue de test')$$,
  'C commande chez deux boutiques, dont une pièce réservée'
);

select is((select count(*)::int from public.orders), 2, 'une commande par boutique');

select is(
  (select fulfillment::text from public.orders where shop_id = '20000000-0000-0000-0000-00000000000b'),
  'pickup',
  'le retrait en boutique est gratuit et propre à la boutique'
);

select is(
  (select sum(total_millimes)::integer from public.orders),
  103000,
  'le total inclut les frais de livraison d''une seule boutique'
);

select is(
  (select count(*)::int from public.reservations where client_id = auth.uid() and status = 'converted'),
  1,
  'la réservation est convertie'
);

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000d');

select throws_ok(
  $$select public.place_order(
      array['30000000-0000-0000-0000-000000000003']::uuid[],
      array['20000000-0000-0000-0000-00000000000b']::uuid[],
      'Client D', '+21622123456', null, null, null)$$,
  'P0001', 'product_unavailable', 'une pièce vendue ne se revend pas'
);

select is_empty($$select id from public.orders$$, 'D ne voit pas les commandes de C');

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000b');

select is((select count(*)::int from public.orders), 1, 'B ne voit que sa propre commande');

select is(
  (select count(*)::int from public.order_items),
  1,
  'B ne voit pas les articles commandés chez A'
);

select throws_ok(
  $$select public.update_order_status(
      (select id from public.orders limit 1), 'shipped')$$,
  'P0001', 'invalid_transition', 'on ne saute pas d''étape'
);

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$select public.update_order_status((select id from public.orders limit 1), 'confirmed')$$,
  'A confirme sa commande'
);

select throws_ok(
  $$select public.set_product_availability('30000000-0000-0000-0000-000000000001', 'available')$$,
  'P0001', 'invalid_transition', 'une pièce commandée ne se remet pas en rayon'
);

select throws_ok(
  $$update public.products set price_millimes = null where id = '30000000-0000-0000-0000-000000000004'$$,
  '23514', null, 'une pièce publiée garde son prix'
);

select throws_ok(
  $$select public.reserve_product('30000000-0000-0000-0000-000000000001')$$,
  'P0001', 'product_unavailable', 'une pièce vendue ne se réserve pas'
);

select pg_temp.logout();
select pg_temp.login('10000000-0000-0000-0000-00000000000c');

select throws_ok(
  $$select public.cancel_order(
      (select id from public.orders where shop_id = '20000000-0000-0000-0000-00000000000a'), 'trop tard')$$,
  'P0001', 'invalid_transition', 'un client n''annule plus une commande confirmée'
);

select lives_ok(
  $$select public.cancel_order(
      (select id from public.orders where shop_id = '20000000-0000-0000-0000-00000000000b'), 'erreur')$$,
  'un client annule une commande en attente'
);

select pg_temp.logout();

select is(
  (select status::text from public.products where id = '30000000-0000-0000-0000-000000000003'),
  'available',
  'la pièce d''une commande annulée revient en rayon'
);

select * from finish();
rollback;
