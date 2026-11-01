begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(71);

insert into auth.users (id, email, raw_user_meta_data) values
  ('14000000-0000-0000-0000-00000000000a', 'p4-seller-a@test.local', '{"display_name":"Vendeur A"}'),
  ('14000000-0000-0000-0000-00000000000b', 'p4-seller-b@test.local', '{"display_name":"Vendeur B"}'),
  ('14000000-0000-0000-0000-00000000000c', 'p4-client-c@test.local', '{"display_name":"Cyrine Ben Ali"}'),
  ('14000000-0000-0000-0000-00000000000d', 'p4-client-d@test.local', '{"display_name":"Client D"}'),
  ('14000000-0000-0000-0000-00000000000e', 'p4-admin@test.local', '{"display_name":"Admin"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), u.id, 'totp', 'verified', now(), now() from auth.users u;

insert into public.platform_admins (user_id) values ('14000000-0000-0000-0000-00000000000e');

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
  ('24000000-0000-0000-0000-00000000000a', 'p4-shop-a', 'Shop A'),
  ('24000000-0000-0000-0000-00000000000b', 'p4-shop-b', 'Shop B')
) as v (id, slug, name)
cross join (select id, governorate_id from public.cities where slug = 'la-marsa') c;

insert into public.shop_members (shop_id, user_id, role) values
  ('24000000-0000-0000-0000-00000000000a', '14000000-0000-0000-0000-00000000000a', 'owner'),
  ('24000000-0000-0000-0000-00000000000b', '14000000-0000-0000-0000-00000000000b', 'owner');

create function pg_temp.seed_product(p_id text, p_shop text, p_price integer) returns void language sql as $$
  insert into public.products (id, shop_id, reference, category_id, title, brand, size, condition, price_millimes, publication_status, published_at)
  values (p_id::uuid, p_shop::uuid, 'R-' || right(p_id, 4), (select id from public.categories where slug = 'jeans'),
    'Jean ' || right(p_id, 4), 'Levis', 'M', 'good', p_price, 'published', now());
  insert into public.product_images (product_id, path) values (p_id::uuid, p_shop || '/' || p_id || '/1.jpg');
$$;

select pg_temp.seed_product('34000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-00000000000a', 30000);
select pg_temp.seed_product('34000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-00000000000a', 20000);
select pg_temp.seed_product('34000000-0000-0000-0000-000000000003', '24000000-0000-0000-0000-00000000000b', 10000);
select pg_temp.seed_product('34000000-0000-0000-0000-000000000004', '24000000-0000-0000-0000-00000000000a', 15000);
select pg_temp.seed_product('34000000-0000-0000-0000-000000000005', '24000000-0000-0000-0000-00000000000a', 16000);

-- Privilèges du catalogue système : valables pour toute fonction ou table future.
select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'toutes les tables publiques ont RLS'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'toute fonction security definer fixe son search_path'
);

select set_eq(
  $$select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')$$,
  array['reservation_ttl_minutes', 'top_shops'],
  'un anonyme n''exécute que deux fonctions publiques'
);

-- Blocage par la boutique, depuis une demande d'article.
select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$select public.create_stock_request('24000000-0000-0000-0000-00000000000a', null, 'M', '', '', 0, 'Je cherche un jean')$$,
  'un client envoie une demande'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.block_client('24000000-0000-0000-0000-00000000000a', '14000000-0000-0000-0000-00000000000c', true)$$,
  'P0001', 'forbidden', 'une boutique tierce ne bloque pas pour une autre'
);

select throws_ok(
  $$select public.block_client('24000000-0000-0000-0000-00000000000b', '14000000-0000-0000-0000-00000000000c', true)$$,
  'P0001', 'forbidden', 'une boutique ne bloque pas un client sans relation'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$select public.block_client('24000000-0000-0000-0000-00000000000a', '14000000-0000-0000-0000-00000000000c', true)$$,
  'la boutique bloque le client de sa demande'
);

select is(
  (select count(*)::integer from public.stock_requests
   where shop_id = '24000000-0000-0000-0000-00000000000a' and status <> 'closed'),
  0, 'le blocage ferme les demandes en cours'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select throws_ok(
  $$select public.create_stock_request('24000000-0000-0000-0000-00000000000a', null, '', '', '', 0, 'Encore une demande')$$,
  'P0001', 'blocked', 'un client bloqué n''envoie plus de demande'
);

select throws_ok(
  $$select public.start_conversation('24000000-0000-0000-0000-00000000000a', null, null, 'Bonjour')$$,
  'P0001', 'blocked', 'un client bloqué n''ouvre pas de conversation'
);

select throws_ok(
  $$select public.block_conversation('00000000-0000-0000-0000-000000000000', true)$$,
  'P0001', 'forbidden', 'bloquer exige une conversation à laquelle on participe'
);

select throws_ok(
  $$insert into public.stock_requests (shop_id, client_id, client_name, message)
    values ('24000000-0000-0000-0000-00000000000a', '14000000-0000-0000-0000-00000000000c', 'X', 'Direct')$$,
  '42501', null, 'aucune écriture directe sur les demandes'
);

select throws_ok(
  $$insert into public.messages (conversation_id, sender_side, body)
    values ('00000000-0000-0000-0000-000000000000', 'client', 'Direct')$$,
  '42501', null, 'aucune écriture directe sur les messages'
);

select throws_ok(
  $$delete from public.user_blocks$$,
  '42501', null, 'un bloqué ne supprime pas lui-même le blocage'
);

select lives_ok(
  $$select public.block_shop('24000000-0000-0000-0000-00000000000a', false)$$,
  'lever son propre côté reste sans effet sur celui de la boutique'
);

select is(
  (select count(*)::integer from public.user_blocks where shop_id = '24000000-0000-0000-0000-00000000000a'),
  1, 'le blocage de la boutique reste en place'
);

select pg_temp.logout();

-- Défense en profondeur : même une écriture interne est refusée par le trigger.
select throws_ok(
  $$insert into public.stock_requests (shop_id, client_id, client_name, message)
    values ('24000000-0000-0000-0000-00000000000a', '14000000-0000-0000-0000-00000000000c', 'X', 'Par une autre route')$$,
  'P0001', 'blocked', 'le trigger refuse une demande, quelle que soit la route'
);

select throws_ok(
  $$insert into public.conversations (shop_id, client_id, client_name)
    values ('24000000-0000-0000-0000-00000000000a', '14000000-0000-0000-0000-00000000000c', 'X')$$,
  'P0001', 'blocked', 'le trigger refuse une conversation, quelle que soit la route'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$select public.block_client('24000000-0000-0000-0000-00000000000a', '14000000-0000-0000-0000-00000000000c', false)$$,
  'la boutique lève son blocage'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$select public.start_conversation('24000000-0000-0000-0000-00000000000a', null, null, 'Bonjour')$$,
  'les échanges reprennent une fois le blocage levé'
);

-- Offre sur une demande : le blocage côté client coupe aussi cette route.
select lives_ok(
  $$select public.create_stock_request('24000000-0000-0000-0000-00000000000a', null, '', '', '', 0, 'Une autre demande')$$,
  'nouvelle demande'
);

select pg_temp.logout();

create temporary table request_ref as
  select id from public.stock_requests
  where shop_id = '24000000-0000-0000-0000-00000000000a' and status = 'open';

grant select on request_ref to authenticated;

-- Une offre refusée doit l'être par le blocage, pas par la fermeture de la demande.
insert into public.user_blocks (client_id, shop_id, blocked_by)
values ('14000000-0000-0000-0000-00000000000c', '24000000-0000-0000-0000-00000000000a', 'client');

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select throws_ok(
  format($$select public.offer_product(%L, '34000000-0000-0000-0000-000000000001', '')$$, (select id from request_ref)),
  'P0001', 'blocked', 'une boutique bloquée ne propose plus de pièce'
);

select throws_ok(
  format($$select public.contact_request_client(%L, 'Bonjour')$$, (select id from request_ref)),
  'P0001', 'blocked', 'une boutique bloquée ne recontacte pas par la demande'
);

select pg_temp.logout();

-- Alerte : aucune notification d'une boutique bloquée.
insert into public.drop_alerts (user_id, name, sizes)
values ('14000000-0000-0000-0000-00000000000c', 'Mes jeans', '{m}');

insert into public.products (id, shop_id, reference, category_id, title, brand, size, condition, price_millimes)
values ('34000000-0000-0000-0000-000000000006', '24000000-0000-0000-0000-00000000000a', 'DROP-6',
  (select id from public.categories where slug = 'jeans'), 'Nouveau', 'Levis', 'M', 'good', 10000);

insert into public.product_images (product_id, path) values
  ('34000000-0000-0000-0000-000000000006', '24000000-0000-0000-0000-00000000000a/34000000-0000-0000-0000-000000000006/1.jpg');

select pg_temp.login('14000000-0000-0000-0000-00000000000a');
select * from public.set_products_publication(array['34000000-0000-0000-0000-000000000006']::uuid[], 'published');

select pg_temp.logout();

select is(
  (select count(*)::integer from public.notifications
   where user_id = '14000000-0000-0000-0000-00000000000c' and product_id = '34000000-0000-0000-0000-000000000006'),
  0, 'une boutique bloquée n''envoie plus d''alerte'
);

delete from public.user_blocks where shop_id = '24000000-0000-0000-0000-00000000000a';

-- Chemins vidéo : toujours dans le dossier du brouillon, et réellement présents au Storage.
insert into public.videos (id, shop_id) values
  ('44000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-00000000000a');

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$select public.finalize_video('44000000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-00000000000b/44000000-0000-0000-0000-000000000001/video.webm',
    '24000000-0000-0000-0000-00000000000a/44000000-0000-0000-0000-000000000001/thumbnail.jpg', 5, 360, 640)$$,
  'P0001', 'forbidden', 'un chemin vidéo d''une autre boutique est refusé'
);

select throws_ok(
  $$select public.finalize_video('44000000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-00000000000a/44000000-0000-0000-0000-000000000001/../../b/video.webm',
    '24000000-0000-0000-0000-00000000000a/44000000-0000-0000-0000-000000000001/thumbnail.jpg', 5, 360, 640)$$,
  'P0001', 'video_missing', 'un chemin avec remontée ne désigne aucun fichier'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.finalize_video('44000000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-00000000000a/44000000-0000-0000-0000-000000000001/video.webm',
    '24000000-0000-0000-0000-00000000000a/44000000-0000-0000-0000-000000000001/thumbnail.jpg', 5, 360, 640)$$,
  'P0001', 'forbidden', 'une autre boutique ne finalise pas la vidéo'
);

-- Prix.
select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select lives_ok($$select public.reserve_product('34000000-0000-0000-0000-000000000001')$$, 'réservation');

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$update public.products set price_millimes = 99000 where id = '34000000-0000-0000-0000-000000000001'$$,
  'P0001', 'product_locked', 'le prix d''une pièce réservée est figé'
);

select lives_ok(
  $$update public.products set price_millimes = 21000 where id = '34000000-0000-0000-0000-000000000002'$$,
  'le prix d''une pièce disponible reste modifiable'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000b');

select is_empty(
  $$update public.products set price_millimes = 1 where id = '34000000-0000-0000-0000-000000000002' returning id$$,
  'une autre boutique ne change pas le prix'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select is_empty(
  $$update public.products set price_millimes = 1 where id = '34000000-0000-0000-0000-000000000002' returning id$$,
  'un client ne change pas le prix'
);

select throws_ok(
  $$select public.place_order(array['34000000-0000-0000-0000-000000000002']::uuid[], array['24000000-0000-0000-0000-00000000000a']::uuid[],
    'Cyrine', '+21622123456', null, null, null, 20000)$$,
  'P0001', 'price_changed', 'une commande au total périmé est refusée'
);

select is(
  (select status::text from public.products where id = '34000000-0000-0000-0000-000000000002'),
  'available', 'le refus annule tout : la pièce reste disponible'
);

select lives_ok(
  $$select public.place_order(array['34000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000003']::uuid[],
    array['24000000-0000-0000-0000-00000000000a', '24000000-0000-0000-0000-00000000000b']::uuid[],
    'Cyrine', '+21622123456', null, null, null, 31000)$$,
  'une commande au bon total passe, le prix vient de la base'
);

-- Isolation inter-boutiques.
select pg_temp.logout();

create temporary table item_a as
  select i.id, o.id as order_id from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.shop_id = '24000000-0000-0000-0000-00000000000a';

grant select on item_a to authenticated;

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$select total_millimes from public.order_groups$$,
  '42501', null, 'une boutique ne lit pas le total multi-boutiques'
);

select is(
  (select count(*)::integer from public.orders),
  1, 'une boutique ne voit que sa part de la commande'
);

select is(
  (select count(*)::integer from public.order_items),
  1, 'une boutique ne voit que ses articles'
);

select lives_ok(
  $$select id, reference, recipient_name, phone from public.order_groups$$,
  'la boutique garde les coordonnées de livraison'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000d');

select is((select count(*)::integer from public.orders), 0, 'un autre client ne voit aucune commande');
select is((select count(*)::integer from public.order_groups), 0, 'un autre client ne voit aucun groupe');

select throws_ok(
  format($$select public.cancel_order(%L, 'IDOR')$$, (select order_id from item_a)),
  'P0001', 'forbidden', 'on ne peut pas annuler la commande d''un autre'
);

select pg_temp.logout();

-- Avis.
select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select throws_ok(
  format($$select public.create_review(%L, 5, 'Trop tôt')$$, (select id from item_a)),
  'P0001', 'review_not_allowed', 'pas d''avis avant la livraison'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select public.update_order_status((select order_id from item_a), 'confirmed');
select public.update_order_status((select order_id from item_a), 'preparing');
select public.update_order_status((select order_id from item_a), 'delivered');

select pg_temp.login('14000000-0000-0000-0000-00000000000d');

select throws_ok(
  format($$select public.create_review(%L, 1, 'Jamais acheté')$$, (select id from item_a)),
  'P0001', 'forbidden', 'pas d''avis sans achat'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select throws_ok(
  format($$select public.create_review(%L, 5, 'Mon avis sur moi')$$, (select id from item_a)),
  'P0001', 'forbidden', 'une boutique ne note pas sa propre vente'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select throws_ok(
  format($$select public.create_review(%L, 6, '')$$, (select id from item_a)),
  'P0001', 'invalid_rating', 'la note reste entre 1 et 5'
);

select lives_ok(
  format($$select public.create_review(%L, 4, 'Très bien')$$, (select id from item_a)),
  'le client qui a reçu sa pièce publie un avis'
);

select throws_ok(
  format($$select public.create_review(%L, 5, 'Encore')$$, (select id from item_a)),
  'P0001', 'already_reviewed', 'un seul avis par article'
);

select throws_ok(
  $$update public.reviews set rating = 5$$,
  '42501', null, 'un avis n''est pas modifiable directement'
);

select throws_ok($$delete from public.reviews$$, '42501', null, 'un avis n''est pas supprimable directement');

select is(
  (select author_name from public.reviews where shop_id = '24000000-0000-0000-0000-00000000000a'),
  'Cyrine', 'seul le prénom est public'
);

select is((select count(*)::integer from public.my_reviews), 1, 'le client retrouve son avis');

select pg_temp.login('14000000-0000-0000-0000-00000000000d');

select is((select count(*)::integer from public.my_reviews), 0, 'la vue ne montre pas les avis d''autrui');

set local role anon;

select throws_ok($$select client_id from public.reviews$$, '42501', null, 'l''auteur d''un avis reste privé');

select is(
  (select rating_count from public.shops where id = '24000000-0000-0000-0000-00000000000a'),
  1, 'la note de la boutique est à jour'
);

reset role;

create temporary table review_ref as
  select id from public.reviews where shop_id = '24000000-0000-0000-0000-00000000000a';

grant select on review_ref to authenticated;

select pg_temp.login('14000000-0000-0000-0000-00000000000b');

select throws_ok(
  format($$select public.reply_review(%L, 'Pas ma boutique')$$, (select id from review_ref)),
  'P0001', 'forbidden', 'une autre boutique ne répond pas'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select lives_ok(format($$select public.reply_review(%L, 'Merci')$$, (select id from review_ref)), 'la boutique répond');

select throws_ok(
  format($$select public.reply_review(%L, 'Encore')$$, (select id from review_ref)),
  'P0001', 'already_replied', 'une seule réponse'
);

select throws_ok(
  format($$select public.moderate_review(%L, 'hidden', 'Je cache')$$, (select id from review_ref)),
  'P0001', 'forbidden', 'une boutique ne masque pas un avis'
);

-- Signalements et suspension.
select pg_temp.login('14000000-0000-0000-0000-00000000000d');

select lives_ok(
  $$select public.create_report('shop', '24000000-0000-0000-0000-00000000000b', 'scam', '')$$,
  'on peut signaler une boutique'
);

select lives_ok(
  format($$select public.create_report('review', %L, 'other', '')$$, (select id from review_ref)),
  'on peut signaler un avis'
);

select throws_ok(
  $$select public.create_report('account', '14000000-0000-0000-0000-00000000000c', 'harassment', '')$$,
  'P0001', 'not_found', 'un compte sans relation ne se signale pas : pas d''énumération'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$select public.create_report('account', '14000000-0000-0000-0000-00000000000c', 'harassment', 'Insultes')$$,
  'une boutique signale un client en relation avec elle'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000d');

select throws_ok(
  $$select public.set_user_status('14000000-0000-0000-0000-00000000000c', 'suspended', 'Je veux')$$,
  'P0001', 'forbidden', 'un utilisateur ordinaire ne suspend pas un compte'
);

select throws_ok(
  $$select public.review_report((select id from public.reports limit 1), 'suspend', 'Je veux')$$,
  'P0001', 'forbidden', 'un utilisateur ordinaire ne décide pas d''un signalement'
);

select throws_ok(
  $$update public.profiles set status = 'suspended' where id = '14000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'le statut d''un compte n''est pas modifiable directement'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000e');

select throws_ok(
  $$select public.review_report(
    (select id from public.reports where target_type = 'shop' and target_id = '24000000-0000-0000-0000-00000000000b'),
    'remove_content', 'Sans objet')$$,
  'P0001', 'invalid_decision', 'une boutique n''a pas de contenu à retirer'
);

select lives_ok(
  $$select public.review_report(
    (select id from public.reports where target_type = 'account'), 'suspend', 'Insultes répétées')$$,
  'l''administration suspend un compte depuis un signalement'
);

select is(
  (select status::text from public.profiles where id = '14000000-0000-0000-0000-00000000000c'),
  'suspended', 'le compte est suspendu'
);

select is(
  (select count(*)::integer from public.report_decisions d
   join public.reports r on r.id = d.report_id
   where r.target_type = 'account' and d.decision = 'suspend'),
  1, 'la décision est historisée'
);

select pg_temp.login('14000000-0000-0000-0000-00000000000c');

select throws_ok(
  $$insert into public.favorites (user_id, product_id)
    values ('14000000-0000-0000-0000-00000000000c', '34000000-0000-0000-0000-000000000004')$$,
  '42501', null, 'un compte suspendu n''écrit plus, même directement'
);

select pg_temp.logout();
select * from finish();
rollback;
