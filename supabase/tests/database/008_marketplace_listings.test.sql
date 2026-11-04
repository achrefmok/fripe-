begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(43);

insert into auth.users (id, email, raw_user_meta_data) values
  ('80000000-0000-0000-0000-00000000000a', 'vendeur-perso@test.local', '{"display_name":"Vendeuse Perso"}'),
  ('80000000-0000-0000-0000-00000000000b', 'acheteur@test.local', '{"display_name":"Acheteur"}'),
  ('80000000-0000-0000-0000-00000000000c', 'curieux@test.local', '{"display_name":"Curieux"}'),
  ('80000000-0000-0000-0000-00000000000d', 'admin-mp@test.local', '{"display_name":"Admin MP"}'),
  ('80000000-0000-0000-0000-00000000000e', 'pro@test.local', '{"display_name":"Pro"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), u.id, 'totp', 'verified', now(), now()
from auth.users u where u.id = '80000000-0000-0000-0000-00000000000d';

insert into public.platform_admins (user_id) values ('80000000-0000-0000-0000-00000000000d');

create function pg_temp.login(p_id text, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
$$;

create function pg_temp.anon() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

create function pg_temp.cat(p_slug text) returns uuid language sql as $$
  select id from public.categories where slug = p_slug;
$$;

create function pg_temp.gov() returns smallint language sql as $$
  select governorate_id from public.cities where slug = 'la-marsa';
$$;

-- Catégories ------------------------------------------------------------------------------------

select is(
  (select count(*)::int from public.categories where parent_id is null and section = 'marketplace'),
  10,
  'dix rubriques Marketplace'
);

select is(
  (select count(*)::int from public.categories where slug in ('hauts', 'jeans', 'chaussures') and section = 'mode'),
  3,
  'les catégories de vêtements restent dans la mode'
);

select is(
  (select section::text from public.categories where slug = 'refrigerateurs'),
  'marketplace',
  'une sous-catégorie hérite de la rubrique de sa racine'
);

-- Publication par un particulier ------------------------------------------------------------------

select pg_temp.login('80000000-0000-0000-0000-00000000000a');

insert into public.listings (id, section, category_id, title, condition, price_millimes, governorate_id, attributes)
values (
  '81000000-0000-0000-0000-000000000001', 'marketplace', pg_temp.cat('refrigerateurs'), 'Réfrigérateur 300 L',
  'good', 450000, pg_temp.gov(), '{"marque": "Samsung", "classe_energie": "a+"}'
);

select is(
  (select seller_id::text from public.listings where id = '81000000-0000-0000-0000-000000000001'),
  '80000000-0000-0000-0000-00000000000a',
  'le vendeur est toujours le compte connecté'
);

select is(
  (select seller_name from public.listings where id = '81000000-0000-0000-0000-000000000001'),
  'Vendeuse Perso',
  'le nom du vendeur accompagne l''annonce'
);

select isnt(
  (select published_at from public.listings where id = '81000000-0000-0000-0000-000000000001'),
  null,
  'une annonce publiée reçoit sa date'
);

select throws_ok(
  $$insert into public.listings (section, category_id, title, condition, price_millimes, governorate_id)
    values ('vide_dressing', pg_temp.cat('refrigerateurs'), 'Frigo en mode', 'good', 1000, pg_temp.gov())$$,
  'P0001', 'invalid_category', 'le Vide-Dressing refuse une catégorie Marketplace'
);

select throws_ok(
  $$insert into public.listings (section, category_id, title, condition, price_millimes, governorate_id)
    values ('marketplace', pg_temp.cat('jeans'), 'Jean en Marketplace', 'good', 1000, pg_temp.gov())$$,
  'P0001', 'invalid_category', 'la Marketplace refuse une catégorie de vêtements'
);

select throws_ok(
  $$insert into public.listings (section, category_id, title, condition, price_millimes, governorate_id, attributes)
    values ('marketplace', pg_temp.cat('velos'), 'Vélo', 'good', 1000, pg_temp.gov(), '{"pirate": "x"}')$$,
  'P0001', 'invalid_attributes', 'une caractéristique inconnue est refusée'
);

select throws_ok(
  $$insert into public.listings (section, category_id, title, condition, price_millimes, governorate_id, attributes)
    values ('marketplace', pg_temp.cat('velos'), 'Vélo', 'good', 1000, pg_temp.gov(), '{"type_velo": "fusée"}')$$,
  'P0001', 'invalid_attributes', 'une valeur hors liste est refusée'
);

insert into public.listings (id, section, category_id, title, condition, price_millimes, governorate_id)
values (
  '81000000-0000-0000-0000-000000000002', 'vide_dressing', pg_temp.cat('jeans'), 'Jean de ma sœur',
  'very_good', 20000, pg_temp.gov()
);

insert into public.listings (id, section, category_id, title, condition, price_millimes, governorate_id, publication_status)
values (
  '81000000-0000-0000-0000-000000000003', 'marketplace', pg_temp.cat('chaises'), 'Brouillon de chaise',
  'fair', 5000, pg_temp.gov(), 'draft'
);

select throws_ok(
  $$update public.listings set moderated_at = null, favorite_count = 999 where id = '81000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'le vendeur ne touche ni à la modération ni au compteur'
);

select throws_ok(
  $$insert into public.listing_images (listing_id, path)
    values ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000b/81000000-0000-0000-0000-000000000001/a.jpg')$$,
  'P0001', 'forbidden', 'une photo doit être rangée dans le dossier de son vendeur'
);

insert into public.listing_images (listing_id, path)
select '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000a/81000000-0000-0000-0000-000000000001/' || n || '.jpg'
from generate_series(1, 10) n;

select throws_ok(
  $$insert into public.listing_images (listing_id, path)
    values ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000a/81000000-0000-0000-0000-000000000001/11.jpg')$$,
  'P0001', 'too_many_images', 'dix photos au plus'
);

-- Lecture ---------------------------------------------------------------------------------------

select pg_temp.anon();

select is(
  (select count(*)::int from public.listings where seller_id = '80000000-0000-0000-0000-00000000000a'),
  2,
  'un visiteur voit les annonces publiées, pas le brouillon'
);

select is(
  (select count(*)::int from public.listing_images where listing_id = '81000000-0000-0000-0000-000000000001'),
  10,
  'un visiteur voit les photos d''une annonce publiée'
);

select is(
  (select count(*)::int from public.marketplace_items where id = '81000000-0000-0000-0000-000000000001' and seller_type = 'particulier'),
  1,
  'l''annonce Marketplace figure dans la vue Marketplace'
);

select is(
  (select count(*)::int from public.marketplace_items where id = '81000000-0000-0000-0000-000000000002'),
  0,
  'une annonce du Vide-Dressing reste hors de la Marketplace'
);

select throws_ok(
  $$select public.contact_listing('81000000-0000-0000-0000-000000000001', 'Bonjour')$$,
  '42501', null, 'un visiteur ne peut pas contacter un vendeur'
);

-- Un autre compte ne modifie rien ---------------------------------------------------------------

select pg_temp.login('80000000-0000-0000-0000-00000000000c');

update public.listings set price_millimes = 1 where id = '81000000-0000-0000-0000-000000000001';
delete from public.listings where id = '81000000-0000-0000-0000-000000000001';
delete from public.listing_images where listing_id = '81000000-0000-0000-0000-000000000001';

select pg_temp.logout();

select is(
  (select price_millimes from public.listings where id = '81000000-0000-0000-0000-000000000001'),
  450000,
  'un autre compte ne change pas le prix'
);

select is(
  (select count(*)::int from public.listing_images where listing_id = '81000000-0000-0000-0000-000000000001'),
  10,
  'un autre compte ne retire pas les photos'
);

-- Échanges --------------------------------------------------------------------------------------

select pg_temp.login('80000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$select public.contact_listing('81000000-0000-0000-0000-000000000001', 'Moi-même')$$,
  'P0001', 'own_listing', 'on ne se contacte pas soi-même'
);

select pg_temp.login('80000000-0000-0000-0000-00000000000b');

select lives_ok(
  $$select public.contact_listing('81000000-0000-0000-0000-000000000001', 'Toujours disponible ?')$$,
  'un acheteur contacte le vendeur'
);

select is((select count(*)::int from public.listing_threads), 1, 'l''acheteur voit son échange');

select pg_temp.login('80000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.listing_messages), 1, 'le vendeur lit le message');

select is(
  (select count(*)::int from public.notifications where kind = 'listing_message' and read_at is null),
  1,
  'le vendeur est notifié'
);

select lives_ok(
  $$select public.send_listing_message((select id from public.listing_threads limit 1), 'Oui, encore là.')$$,
  'le vendeur répond'
);

select pg_temp.login('80000000-0000-0000-0000-00000000000c');

select is((select count(*)::int from public.listing_threads), 0, 'un tiers ne voit pas l''échange');
select is((select count(*)::int from public.listing_messages), 0, 'un tiers ne lit pas les messages');

select throws_ok(
  $$insert into public.listing_messages (thread_id, body) select id, 'intrus' from public.listing_threads$$,
  '42501', null, 'aucun message ne s''écrit directement'
);

-- Blocage : plus aucun message dans les deux sens.
select pg_temp.login('80000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$select public.block_person('80000000-0000-0000-0000-00000000000b')$$,
  'le vendeur bloque l''acheteur'
);

select pg_temp.login('80000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.contact_listing('81000000-0000-0000-0000-000000000002', 'Et ce jean ?')$$,
  'P0001', 'blocked', 'une personne bloquée ne peut plus écrire'
);

select throws_ok(
  $$select public.block_person('80000000-0000-0000-0000-00000000000c')$$,
  'P0001', 'not_found', 'on ne bloque que quelqu''un avec qui on a échangé'
);

-- Signalement et modération ---------------------------------------------------------------------

select lives_ok(
  $$select public.create_report('listing', '81000000-0000-0000-0000-000000000002', 'scam', 'Prix suspect')$$,
  'une annonce se signale'
);

select pg_temp.login('80000000-0000-0000-0000-00000000000d', 'aal2');

select lives_ok(
  $$select public.review_report(
      (select id from public.reports where target_id = '81000000-0000-0000-0000-000000000002'),
      'remove_content', 'Annonce frauduleuse')$$,
  'l''administration retire l''annonce signalée'
);

select lives_ok(
  $$select public.moderate_listing('81000000-0000-0000-0000-000000000001', 'Photos non conformes')$$,
  'l''administration retire une annonce directement'
);

select pg_temp.logout();

select is(
  (select count(*)::int from public.listing_images where listing_id = '81000000-0000-0000-0000-000000000001'),
  0,
  'les photos d''une annonce retirée quittent le service'
);

select is(
  (select count(*)::int from public.storage_purge_queue where bucket = 'listing-images'),
  10,
  'leurs fichiers partent à la purge'
);

select pg_temp.login('80000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$update public.listings set publication_status = 'published' where id = '81000000-0000-0000-0000-000000000001'$$,
  'P0001', 'moderated', 'une annonce retirée ne revient pas'
);

-- Produit de boutique dans la Marketplace -------------------------------------------------------

select pg_temp.logout();

insert into public.shops (id, slug, name, governorate_id, city_id, status)
select '82000000-0000-0000-0000-00000000000a', 'pro-mp-t', 'Boutique MP', c.governorate_id, c.id, 'approved'
from public.cities c where c.slug = 'la-marsa';

insert into public.products (id, shop_id, reference, title, category_id, condition, price_millimes, publication_status, published_at)
values
  ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-00000000000a', 'MP-1', 'Télé 55 pouces',
    pg_temp.cat('televisions'), 'like_new', 800000, 'published', now()),
  ('83000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-00000000000a', 'MP-2', 'Jean de boutique',
    pg_temp.cat('jeans'), 'good', 30000, 'published', now());

select pg_temp.anon();

select is(
  (select seller_type from public.marketplace_items where id = '83000000-0000-0000-0000-000000000001'),
  'pro',
  'un produit de boutique en catégorie Marketplace y figure comme vendeur pro'
);

select is(
  (select count(*)::int from public.marketplace_items where id = '83000000-0000-0000-0000-000000000002'),
  0,
  'un vêtement de boutique reste dans le catalogue mode'
);

-- Compte suspendu puis supprimé -------------------------------------------------------------------

select pg_temp.logout();

select pg_temp.login('80000000-0000-0000-0000-00000000000c');

insert into public.listings (id, section, category_id, title, condition, price_millimes, governorate_id)
values ('81000000-0000-0000-0000-000000000009', 'marketplace', pg_temp.cat('tables'), 'Table basse', 'good', 15000, pg_temp.gov());

select pg_temp.logout();

update public.profiles set status = 'suspended' where id = '80000000-0000-0000-0000-00000000000c';

select pg_temp.anon();

select is(
  (select count(*)::int from public.listings where id = '81000000-0000-0000-0000-000000000009'),
  0,
  'l''annonce d''un compte suspendu disparaît'
);

select pg_temp.logout();

update public.profiles set status = 'deleted' where id = '80000000-0000-0000-0000-00000000000a';

select is(
  (select count(*)::int from public.listings where seller_id = '80000000-0000-0000-0000-00000000000a'),
  0,
  'les annonces d''un compte supprimé sont effacées'
);

select is(
  (select count(*)::int from public.listing_messages where body = '[message supprimé]'),
  1,
  'ses messages sont effacés'
);

select * from finish();
rollback;
