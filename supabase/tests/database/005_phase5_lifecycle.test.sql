begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(102);

insert into auth.users (id, email, raw_user_meta_data) values
  ('15000000-0000-0000-0000-00000000000a', 'p5-seller-a@test.local', '{"display_name":"Vendeur A"}'),
  ('15000000-0000-0000-0000-00000000000b', 'p5-seller-b@test.local', '{"display_name":"Vendeur B"}'),
  ('15000000-0000-0000-0000-00000000000c', 'p5-client-c@test.local', '{"display_name":"Cyrine Client"}'),
  ('15000000-0000-0000-0000-00000000000d', 'p5-client-d@test.local', '{"display_name":"Client D"}'),
  ('15000000-0000-0000-0000-00000000000e', 'p5-admin@test.local', '{"display_name":"Admin Un"}'),
  ('15000000-0000-0000-0000-00000000000f', 'p5-admin2@test.local', '{"display_name":"Admin Deux"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), u.id, 'totp', 'verified', now(), now() from auth.users u;

insert into public.platform_admins (user_id) values
  ('15000000-0000-0000-0000-00000000000e'), ('15000000-0000-0000-0000-00000000000f');

create function pg_temp.login(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

insert into public.shops (id, slug, name, governorate_id, city_id, status)
select v.id::uuid, v.slug, v.name, c.governorate_id, c.id, 'approved'
from (values
  ('25000000-0000-0000-0000-00000000000a', 'p5-shop-a', 'Shop A'),
  ('25000000-0000-0000-0000-00000000000b', 'p5-shop-b', 'Shop B')
) as v (id, slug, name)
cross join (select id, governorate_id from public.cities where slug = 'la-marsa') c;

insert into public.shop_members (shop_id, user_id, role) values
  ('25000000-0000-0000-0000-00000000000a', '15000000-0000-0000-0000-00000000000a', 'owner'),
  ('25000000-0000-0000-0000-00000000000b', '15000000-0000-0000-0000-00000000000b', 'owner');

create function pg_temp.seed_product(p_id text, p_shop text) returns void language sql as $$
  insert into public.products (id, shop_id, reference, category_id, title, condition, price_millimes, publication_status, published_at)
  values (p_id::uuid, p_shop::uuid, 'R-' || right(p_id, 4), (select id from public.categories where slug = 'jeans'),
    'Jean ' || right(p_id, 4), 'good', 20000, 'published', now());
  insert into public.product_images (product_id, path) values (p_id::uuid, p_shop || '/' || p_id || '/1.jpg');
$$;

select pg_temp.seed_product('35000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-00000000000a');
select pg_temp.seed_product('35000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-00000000000a');
select pg_temp.seed_product('35000000-0000-0000-0000-000000000003', '25000000-0000-0000-0000-00000000000b');
select pg_temp.seed_product('35000000-0000-0000-0000-000000000004', '25000000-0000-0000-0000-00000000000b');
select pg_temp.seed_product('35000000-0000-0000-0000-000000000005', '25000000-0000-0000-0000-00000000000b');

-- Suspension d'une boutique.
select pg_temp.login('15000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.review_shop('25000000-0000-0000-0000-00000000000a', 'suspended', 'Je veux')$$,
  'P0001', 'forbidden', 'une boutique ne suspend pas une autre boutique'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000e');

select throws_ok(
  $$select public.review_shop('25000000-0000-0000-0000-00000000000a', 'suspended', '')$$,
  'P0001', 'note_required', 'une suspension exige un motif'
);

select lives_ok(
  $$select public.review_shop('25000000-0000-0000-0000-00000000000a', 'suspended', 'Contrôle en cours')$$,
  'l''administration suspend la boutique'
);

select is(
  (select metadata ->> 'note' from public.audit_logs
   where action = 'shop.suspended' and entity_id = '25000000-0000-0000-0000-00000000000a'),
  'Contrôle en cours', 'la suspension est journalisée avec son motif'
);

select is(
  (select actor_id from public.audit_logs
   where action = 'shop.suspended' and entity_id = '25000000-0000-0000-0000-00000000000a'),
  '15000000-0000-0000-0000-00000000000e'::uuid, 'la suspension désigne son auteur'
);

select pg_temp.logout();
set local role anon;

select is((select count(*)::integer from public.shops where id = '25000000-0000-0000-0000-00000000000a'), 0,
  'un anonyme ne voit plus la boutique suspendue');

select is((select count(*)::integer from public.products where shop_id = '25000000-0000-0000-0000-00000000000a'), 0,
  'un anonyme ne voit plus ses pièces');

reset role;

select pg_temp.login('15000000-0000-0000-0000-00000000000c');

select throws_ok(
  $$select public.reserve_product('35000000-0000-0000-0000-000000000001')$$,
  'P0001', 'product_unavailable', 'une pièce d''une boutique suspendue ne se réserve pas'
);

select throws_ok(
  $$select public.place_order(array['35000000-0000-0000-0000-000000000001']::uuid[], array['25000000-0000-0000-0000-00000000000a']::uuid[],
    'Cyrine', '+21622123456', null, null, null, null)$$,
  'P0001', 'product_unavailable', 'une pièce d''une boutique suspendue ne se commande pas'
);

select throws_ok(
  $$select public.start_conversation('25000000-0000-0000-0000-00000000000a', null, null, 'Bonjour')$$,
  'P0001', 'not_found', 'on ne contacte pas une boutique suspendue'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000a');

select is_empty(
  $$update public.products set price_millimes = 1 where shop_id = '25000000-0000-0000-0000-00000000000a' returning id$$,
  'une boutique suspendue ne modifie plus ses pièces'
);

select throws_ok(
  $$select * from public.set_products_publication(array['35000000-0000-0000-0000-000000000002']::uuid[], 'draft')$$,
  'P0001', 'forbidden', 'une boutique suspendue ne publie plus'
);

select throws_ok(
  $$select public.create_video_draft('25000000-0000-0000-0000-00000000000a', '')$$,
  'P0001', 'forbidden', 'une boutique suspendue n''ajoute plus de vidéo'
);

select throws_ok(
  $$select public.save_delivery_rates('25000000-0000-0000-0000-00000000000a', 1000, '{}')$$,
  'P0001', 'forbidden', 'une boutique suspendue ne change plus ses tarifs'
);

select is_empty(
  $$update public.shops set name = 'Autre nom' where id = '25000000-0000-0000-0000-00000000000a' returning id$$,
  'une boutique suspendue ne se renomme pas'
);

select throws_ok(
  $$update public.shops set status = 'approved' where id = '25000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'une boutique ne lève pas elle-même sa suspension'
);

select is(
  (select count(*)::integer from public.shops where id = '25000000-0000-0000-0000-00000000000a'), 1,
  'le vendeur voit encore sa boutique suspendue'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000e');

select lives_ok(
  $$select public.review_shop('25000000-0000-0000-0000-00000000000a', 'approved', '')$$,
  'l''administration rétablit la boutique'
);

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'shop.approved' and entity_id = '25000000-0000-0000-0000-00000000000a'),
  1, 'le rétablissement est journalisé'
);

-- Permissions d'administration.
select pg_temp.login('15000000-0000-0000-0000-00000000000d');

select is((select count(*)::integer from public.audit_logs), 0, 'un client ne lit pas le journal');
select is((select count(*)::integer from public.report_decisions), 0, 'un client ne lit pas les décisions');
select is((select count(*)::integer from public.platform_settings), 0, 'un client ne lit pas les réglages');

select throws_ok(
  $$select * from public.admin_list_users('', 10, 0)$$,
  'P0001', 'forbidden', 'un client ne liste pas les comptes'
);

select throws_ok(
  $$insert into public.platform_admins (user_id) values ('15000000-0000-0000-0000-00000000000d')$$,
  '42501', null, 'personne ne se déclare administrateur'
);

select throws_ok(
  $$select public.moderate_product('35000000-0000-0000-0000-000000000001', 'Je veux')$$,
  'P0001', 'forbidden', 'un client ne modère pas un produit'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000e');

select throws_ok(
  $$select public.set_user_status('15000000-0000-0000-0000-00000000000e', 'suspended', 'Moi')$$,
  'P0001', 'protected_account', 'un administrateur ne se suspend pas'
);

select throws_ok(
  $$select public.set_user_status('15000000-0000-0000-0000-00000000000f', 'suspended', 'Collègue')$$,
  'P0001', 'protected_account', 'un administrateur ne suspend pas un autre administrateur'
);

select throws_ok(
  $$delete from public.audit_logs$$,
  '42501', null, 'même un administrateur n''efface pas le journal'
);

select throws_ok(
  $$update public.audit_logs set action = 'x'$$,
  '42501', null, 'même un administrateur ne réécrit pas le journal'
);

select throws_ok(
  $$delete from public.platform_admins$$,
  '42501', null, 'un administrateur ne retire pas un rôle depuis l''application'
);

-- Traçabilité.
select pg_temp.logout();

select throws_ok($$delete from public.audit_logs$$, 'P0001', 'audit_logs is append-only', 'le journal résiste même au propriétaire');

insert into public.platform_admins (user_id) values ('15000000-0000-0000-0000-00000000000d');

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'platform_admins.insert' and entity_id = '15000000-0000-0000-0000-00000000000d'),
  1, 'attribuer le rôle d''administrateur est journalisé'
);

delete from public.platform_admins where user_id = '15000000-0000-0000-0000-00000000000d';

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'platform_admins.delete' and entity_id = '15000000-0000-0000-0000-00000000000d'),
  1, 'retirer le rôle est journalisé'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000e');

update public.platform_settings set value = '6' where key = 'max_shops_per_user';

select lives_ok($$select public.set_user_status('15000000-0000-0000-0000-00000000000b', 'suspended', 'Test')$$, 'suspension de compte');
select lives_ok($$select public.set_user_status('15000000-0000-0000-0000-00000000000b', 'active', '')$$, 'réactivation');

select pg_temp.logout();

select is(
  (select metadata ->> 'to' from public.audit_logs
   where action = 'platform_settings.update' and entity_id = 'max_shops_per_user'
   order by created_at desc limit 1),
  '6', 'changer un réglage journalise la nouvelle valeur'
);

select is(
  (select metadata ->> 'reason' from public.audit_logs
   where action = 'user.suspended' and entity_id = '15000000-0000-0000-0000-00000000000b'),
  'Test', 'une suspension de compte est journalisée avec son motif'
);

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'user.active' and entity_id = '15000000-0000-0000-0000-00000000000b'),
  1, 'une réactivation est journalisée'
);

-- Limites de débit et purge.
insert into public.rate_limits (user_id, action, window_start, hits) values
  ('15000000-0000-0000-0000-00000000000d', 'ancien', now() - interval '3 days', 5),
  ('15000000-0000-0000-0000-00000000000d', 'recent', now() - interval '1 hour', 5);

select is(private.purge_rate_limits(), 1, 'la purge retire une fenêtre expirée');

select is(
  (select count(*)::integer from public.rate_limits where action = 'ancien'),
  0, 'la fenêtre de plus de deux jours a disparu'
);

select is(
  (select count(*)::integer from public.rate_limits where action = 'recent'),
  1, 'une fenêtre récente reste en place'
);

select ok(
  exists (select 1 from cron.job where jobname = 'purge-rate-limits'),
  'la purge est planifiée'
);

insert into public.rate_limits (user_id, action, window_start, hits)
values (
  '15000000-0000-0000-0000-00000000000d', 'insert_favorite',
  to_timestamp(floor(extract(epoch from now()) / 3600) * 3600), 300
);

select pg_temp.login('15000000-0000-0000-0000-00000000000d');

select throws_ok(
  $$insert into public.favorites (user_id, product_id)
    values ('15000000-0000-0000-0000-00000000000d', '35000000-0000-0000-0000-000000000003')$$,
  'P0001', 'rate_limited', 'les écritures directes sont limitées en débit'
);

select pg_temp.logout();

insert into public.notifications (id, user_id, kind, product_id, read_at, created_at) values
  ('55000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-00000000000d', 'drop_alert', '35000000-0000-0000-0000-000000000003', now() - interval '100 days', now() - interval '100 days'),
  ('55000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-00000000000d', 'drop_alert', '35000000-0000-0000-0000-000000000004', null, now() - interval '100 days'),
  ('55000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-00000000000d', 'drop_alert', '35000000-0000-0000-0000-000000000005', null, now() - interval '200 days');

insert into public.storage_purge_queue (bucket, path, reason, done_at) values
  ('shop-videos', 'ancien/fichier', 'test', now() - interval '40 days'),
  ('shop-videos', 'recent/fichier', 'test', now() - interval '1 day');

select private.purge_expired_data();

select set_eq(
  $$select id from public.notifications where user_id = '15000000-0000-0000-0000-00000000000d'$$,
  array['55000000-0000-0000-0000-000000000002']::uuid[],
  'seules les notifications expirées sont purgées'
);

select is(
  (select count(*)::integer from public.storage_purge_queue where path = 'ancien/fichier'), 0,
  'la file oublie les suppressions anciennes'
);

select is(
  (select count(*)::integer from public.storage_purge_queue where path = 'recent/fichier'), 1,
  'la file garde les suppressions récentes'
);

-- Fichiers.
select pg_temp.login('15000000-0000-0000-0000-00000000000c');
select public.place_order(array['35000000-0000-0000-0000-000000000003']::uuid[], array['25000000-0000-0000-0000-00000000000b']::uuid[],
  'Cyrine', '+21622123456', null, null, null, null);
select pg_temp.logout();

select is(
  (select count(*)::integer from public.order_items where product_id = '35000000-0000-0000-0000-000000000003' and image_path is not null),
  1, 'la commande garde la photo de la pièce'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000e');
select public.moderate_product('35000000-0000-0000-0000-000000000003', 'Contrefaçon');
select pg_temp.logout();

select is(
  (select count(*)::integer from public.product_images where product_id = '35000000-0000-0000-0000-000000000003'),
  0, 'une pièce modérée perd ses photos'
);

select is(
  (select count(*)::integer from public.storage_purge_queue
   where bucket = 'product-images' and path like '%35000000-0000-0000-0000-000000000003%' and done_at is null),
  1, 'le fichier de la photo modérée part en suppression'
);

select is(
  (select image_path from public.order_items where product_id = '35000000-0000-0000-0000-000000000003'),
  null, 'la commande ne pointe plus vers un fichier retiré'
);

select is(
  (select price_millimes from public.order_items where product_id = '35000000-0000-0000-0000-000000000003'),
  20000, 'la commande garde son prix'
);

insert into public.videos (id, shop_id, status, created_at, video_path, thumbnail_path, duration_seconds, published_at) values
  ('45000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-00000000000b', 'draft', now() - interval '2 days', null, null, null, null),
  ('45000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-00000000000b', 'draft', now() - interval '1 hour', null, null, null, null),
  ('45000000-0000-0000-0000-000000000003', '25000000-0000-0000-0000-00000000000b', 'published', now() - interval '9 days', 'b/v3/video.webm', 'b/v3/thumbnail.jpg', 5, now());

insert into storage.objects (bucket_id, name, created_at) values
  ('shop-videos', '25000000-0000-0000-0000-00000000000b/45000000-0000-0000-0000-000000000001/video.webm', now() - interval '2 days'),
  ('shop-videos', '25000000-0000-0000-0000-00000000000b/45000000-0000-0000-0000-000000000002/video.webm', now() - interval '1 hour'),
  ('shop-videos', '25000000-0000-0000-0000-00000000000b/45000000-0000-0000-0000-000000000003/video.webm', now() - interval '9 days'),
  ('product-images', '25000000-0000-0000-0000-00000000000b/35000000-0000-0000-0000-000000000004/orphelin.jpg', now() - interval '2 days'),
  ('product-images', '25000000-0000-0000-0000-00000000000b/35000000-0000-0000-0000-000000000004/1.jpg', now() - interval '2 days');

select lives_ok($$select private.sweep_abandoned_files()$$, 'le balayage des fichiers abandonnés s''exécute');

select is(
  (select count(*)::integer from public.videos where id = '45000000-0000-0000-0000-000000000001'),
  0, 'un brouillon de plus de 24 heures est supprimé'
);

select is(
  (select count(*)::integer from public.videos where id in ('45000000-0000-0000-0000-000000000002', '45000000-0000-0000-0000-000000000003')),
  2, 'un brouillon récent et une vidéo publiée restent en place'
);

select set_eq(
  $$select path from public.storage_purge_queue where done_at is null and reason = 'orphan'$$,
  array[
    '25000000-0000-0000-0000-00000000000b/45000000-0000-0000-0000-000000000001/video.webm',
    '25000000-0000-0000-0000-00000000000b/35000000-0000-0000-0000-000000000004/orphelin.jpg'
  ],
  'seuls les fichiers réellement abandonnés sont retirés'
);

delete from public.videos where id = '45000000-0000-0000-0000-000000000003';

select is(
  (select count(*)::integer from public.storage_purge_queue where path = 'b/v3/video.webm' and done_at is null),
  1, 'supprimer une vidéo, par n''importe quelle route, retire son fichier'
);

select throws_ok(
  $$select public.delete_my_account()$$,
  'P0001', 'forbidden', 'un anonyme ne supprime aucun compte'
);

-- Suppression de compte : données de départ.
select pg_temp.login('15000000-0000-0000-0000-00000000000c');

select public.place_order(array['35000000-0000-0000-0000-000000000001']::uuid[], array['25000000-0000-0000-0000-00000000000a']::uuid[],
  'Cyrine Client', '+21622123456', null, null, null, null);

select public.start_conversation('25000000-0000-0000-0000-00000000000a', null, null, 'Mon adresse est secrète');
select public.create_stock_request('25000000-0000-0000-0000-00000000000a', null, 'M', '', '', 0, 'Je cherche un manteau');

insert into public.favorites (user_id, product_id) values ('15000000-0000-0000-0000-00000000000c', '35000000-0000-0000-0000-000000000002');
insert into public.shop_followers (user_id, shop_id) values ('15000000-0000-0000-0000-00000000000c', '25000000-0000-0000-0000-00000000000a');
insert into public.drop_alerts (user_id, name) values ('15000000-0000-0000-0000-00000000000c', 'Alerte');

select public.reserve_product('35000000-0000-0000-0000-000000000002');

select throws_ok(
  $$select public.delete_my_account()$$,
  'P0001', 'account_has_active_orders', 'une commande en cours bloque la suppression'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.delete_my_account()$$,
  'P0001', 'account_has_active_orders', 'une commande en cours de sa boutique bloque aussi le vendeur'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000e');

select throws_ok($$select public.delete_my_account()$$, 'P0001', 'protected_account', 'un administrateur ne supprime pas son compte');

select pg_temp.login('15000000-0000-0000-0000-00000000000a');

select public.send_message((select id from public.conversations where shop_id = '25000000-0000-0000-0000-00000000000a'), 'Réponse boutique');
select public.update_order_status((select id from public.orders where shop_id = '25000000-0000-0000-0000-00000000000a'), 'confirmed');
select public.update_order_status((select id from public.orders where shop_id = '25000000-0000-0000-0000-00000000000a'), 'preparing');
select public.update_order_status((select id from public.orders where shop_id = '25000000-0000-0000-0000-00000000000a'), 'delivered');

select pg_temp.login('15000000-0000-0000-0000-00000000000c');

select public.create_review(
  (select i.id from public.order_items i where i.product_id = '35000000-0000-0000-0000-000000000001'),
  4, 'Ma remarque personnelle'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000b');
select public.update_order_status((select id from public.orders where shop_id = '25000000-0000-0000-0000-00000000000b'), 'confirmed');
select public.update_order_status((select id from public.orders where shop_id = '25000000-0000-0000-0000-00000000000b'), 'preparing');
select public.update_order_status((select id from public.orders where shop_id = '25000000-0000-0000-0000-00000000000b'), 'delivered');

select pg_temp.login('15000000-0000-0000-0000-00000000000d');

select lives_ok(
  $$select public.create_report('shop', '25000000-0000-0000-0000-00000000000a', 'scam', 'À vérifier')$$,
  'un signalement existe avant la suppression'
);

select pg_temp.login('15000000-0000-0000-0000-00000000000e');

select public.review_report((select id from public.reports where details = 'À vérifier'), 'dismiss', 'Rien à signaler');

select pg_temp.logout();

create temporary table before_deletion as
  select (select count(*) from public.orders) as orders,
         (select count(*) from public.order_items) as items,
         (select count(*) from public.audit_logs) as logs;

select pg_temp.login('15000000-0000-0000-0000-00000000000c');

select lives_ok($$select public.delete_my_account()$$, 'le client supprime son compte');

select throws_ok($$select public.delete_my_account()$$, 'P0001', 'forbidden', 'une suppression ne se rejoue pas');

select throws_ok(
  $$select public.start_conversation('25000000-0000-0000-0000-00000000000b', null, null, 'Encore là')$$,
  'P0001', 'forbidden', 'la session encore valide ne peut plus agir'
);

select pg_temp.logout();

select is(
  (select display_name || '/' || status::text || '/' || coalesce(phone, 'sans') from public.profiles where id = '15000000-0000-0000-0000-00000000000c'),
  'Compte supprimé/deleted/sans', 'le profil est anonymisé'
);

select is((select count(*)::integer from public.favorites where user_id = '15000000-0000-0000-0000-00000000000c'), 0, 'favoris supprimés');
select is((select count(*)::integer from public.shop_followers where user_id = '15000000-0000-0000-0000-00000000000c'), 0, 'suivis supprimés');
select is((select follower_count from public.shops where id = '25000000-0000-0000-0000-00000000000a'), 0, 'le compteur d''abonnés suit');
select is((select count(*)::integer from public.drop_alerts where user_id = '15000000-0000-0000-0000-00000000000c'), 0, 'alertes supprimées');

select is(
  (select status::text from public.products where id = '35000000-0000-0000-0000-000000000002'),
  'available', 'une réservation active libère la pièce'
);

select is(
  (select count(*)::integer from public.messages where body = 'Mon adresse est secrète'),
  0, 'les messages du client sont effacés'
);

select is(
  (select count(*)::integer from public.messages where body = 'Réponse boutique'),
  1, 'les messages de la boutique restent'
);

select is(
  (select client_name || '/' || (closed_at is not null)::text from public.conversations where shop_id = '25000000-0000-0000-0000-00000000000a'),
  'Compte supprimé/true', 'la conversation est anonymisée et fermée'
);

select is(
  (select client_name || '/' || message || '/' || status::text from public.stock_requests where shop_id = '25000000-0000-0000-0000-00000000000a'),
  'Compte supprimé/[demande supprimée]/closed', 'les demandes sont anonymisées'
);

select is(
  (select author_name || '/' || coalesce(comment, 'sans') || '/' || rating::text from public.reviews where shop_id = '25000000-0000-0000-0000-00000000000a'),
  'Client/sans/4', 'l''avis perd son auteur et son texte, sa note reste'
);

select is(
  (select rating_count from public.shops where id = '25000000-0000-0000-0000-00000000000a'),
  1, 'la note de la boutique reste cohérente'
);

select is((select count(*)::integer from public.account_deletions where completed_at is null), 1, 'la fin de suppression est en file');

-- Retrait de la fiche d'authentification, comme le fait la maintenance.
select lives_ok(
  $$delete from auth.users where id = '15000000-0000-0000-0000-00000000000c'$$,
  'la fiche d''authentification se retire malgré les commandes'
);

select is((select count(*)::integer from public.profiles where id = '15000000-0000-0000-0000-00000000000c'), 0, 'le profil a disparu');

select is((select count(*)::bigint from public.orders), (select orders from before_deletion), 'aucune commande n''est perdue');
select is((select count(*)::bigint from public.order_items), (select items from before_deletion), 'aucune ligne de commande n''est perdue');

select is(
  (select sum(total_millimes)::integer from public.orders),
  40000, 'les montants de l''historique sont intacts'
);

select is(
  (select count(*)::integer from public.orders where client_id is null),
  2, 'les commandes ne sont plus reliées au compte'
);

select is(
  (select count(*)::integer from public.order_groups where phone = '+21622123456'),
  2, 'les coordonnées de commande restent tant qu''aucune durée n''est fixée'
);

select cmp_ok(
  (select count(*) from public.audit_logs), '>', (select logs from before_deletion),
  'le journal d''audit conserve tout et trace la suppression'
);

select is(
  (select count(*)::integer from public.audit_logs where action = 'order.placed' and actor_id = '15000000-0000-0000-0000-00000000000c'),
  2, 'les entrées anciennes du journal restent attribuées'
);

select is(
  (select count(*)::integer from public.audit_logs where action = 'account.deleted' and entity_id = '15000000-0000-0000-0000-00000000000c'),
  1, 'la suppression elle-même est journalisée'
);

select is(private.anonymize_expired_orders(), 0, 'sans durée décidée, rien n''est anonymisé');

update public.platform_settings set value = '30' where key = 'order_personal_data_retention_days';
update public.order_groups set created_at = now() - interval '31 days';

select is(private.anonymize_expired_orders(), 2, 'une durée fixée anonymise les coordonnées');

select is(
  (select count(*)::integer from public.order_groups where phone is null and address_line is null and recipient_name = 'Compte supprimé'),
  2, 'les coordonnées ont disparu, la commande reste'
);

-- Signalement et décision survivent à la suppression du compte qui a signalé.
delete from auth.users where id = '15000000-0000-0000-0000-00000000000d';

select is(
  (select count(*)::integer from public.reports where details = 'À vérifier' and reporter_id is null),
  1, 'le signalement survit à la suppression de son auteur'
);

select is(
  (select count(*)::integer from public.report_decisions d join public.reports r on r.id = d.report_id where r.details = 'À vérifier'),
  1, 'la décision de modération survit aussi'
);

-- Vendeur : la boutique ferme, l'historique de ses ventes reste.
select pg_temp.login('15000000-0000-0000-0000-00000000000a');

select lives_ok($$select public.delete_my_account()$$, 'un vendeur sans commande en cours supprime son compte');

select pg_temp.logout();

select is((select status::text from public.shops where id = '25000000-0000-0000-0000-00000000000a'), 'closed', 'sa boutique est fermée');
select is((select count(*)::integer from public.shop_members where shop_id = '25000000-0000-0000-0000-00000000000a'), 0, 'elle n''a plus de membre');
select is((select count(*)::integer from public.products where shop_id = '25000000-0000-0000-0000-00000000000a' and publication_status = 'published'), 0, 'ses pièces sont retirées');
select is((select count(*)::integer from public.product_images i join public.products p on p.id = i.product_id where p.shop_id = '25000000-0000-0000-0000-00000000000a'), 0, 'ses photos sont retirées');
select is((select count(*)::integer from public.storage_purge_queue where path like '25000000-0000-0000-0000-00000000000a/%' and done_at is null), 2, 'ses fichiers partent en suppression');
select is((select count(*)::integer from public.orders where shop_id = '25000000-0000-0000-0000-00000000000a'), 1, 'ses ventes restent dans l''historique');

set local role anon;

select is((select count(*)::integer from public.shops where id = '25000000-0000-0000-0000-00000000000a'), 0, 'une boutique fermée n''est plus publique');

reset role;

select pg_temp.login('15000000-0000-0000-0000-00000000000e');

select throws_ok(
  $$select public.review_shop('25000000-0000-0000-0000-00000000000a', 'approved', '')$$,
  'P0001', 'invalid_transition', 'une boutique fermée ne se rétablit pas'
);

select throws_ok(
  $$select public.set_user_status('15000000-0000-0000-0000-00000000000a', 'active', '')$$,
  'P0001', 'invalid_transition', 'un compte supprimé ne se réactive pas'
);

select pg_temp.logout();
select * from finish();
rollback;
