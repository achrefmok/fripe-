begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(65);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11000000-0000-0000-0000-00000000000a', 'p3-seller-a@test.local', '{"display_name":"Vendeur A"}'),
  ('11000000-0000-0000-0000-00000000000b', 'p3-seller-b@test.local', '{"display_name":"Vendeur B"}'),
  ('11000000-0000-0000-0000-00000000000c', 'p3-client-c@test.local', '{"display_name":"Client C"}'),
  ('11000000-0000-0000-0000-00000000000d', 'p3-client-d@test.local', '{"display_name":"Client D"}'),
  ('11000000-0000-0000-0000-00000000000e', 'p3-admin@test.local', '{"display_name":"Admin"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), u.id, 'totp', 'verified', now(), now() from auth.users u;

insert into public.platform_admins (user_id) values ('11000000-0000-0000-0000-00000000000e');

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
  ('21000000-0000-0000-0000-00000000000a', 'p3-shop-a', 'Shop A'),
  ('21000000-0000-0000-0000-00000000000b', 'p3-shop-b', 'Shop B')
) as v (id, slug, name)
cross join (select id, governorate_id from public.cities where slug = 'la-marsa') c;

insert into public.shop_members (shop_id, user_id, role) values
  ('21000000-0000-0000-0000-00000000000a', '11000000-0000-0000-0000-00000000000a', 'owner'),
  ('21000000-0000-0000-0000-00000000000b', '11000000-0000-0000-0000-00000000000b', 'owner');

insert into public.products (id, shop_id, reference, category_id, title, brand, size, condition, price_millimes, publication_status, published_at)
values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-00000000000a', 'SECRET-REF',
   (select id from public.categories where slug = 'jeans'), 'Jean Levis', 'Levis', 'M', 'good', 30000, 'published', now()),
  ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-00000000000b', 'AUTRE-REF',
   (select id from public.categories where slug = 'jeans'), 'Jean B', 'Levis', 'M', 'good', 25000, 'published', now());

insert into public.products (id, shop_id, reference, category_id, title, brand, size, condition, price_millimes)
values ('31000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-00000000000a', 'DROP-REF',
  (select id from public.categories where slug = 'jeans'), 'Nouveau jean', 'Levis', 'M', 'good', 20000);

insert into public.product_images (product_id, path) values
  ('31000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-00000000000a/drop.jpg');

-- Corrections de la phase 2.
set local role anon;

select throws_ok(
  $$select reference from public.products limit 1$$,
  '42501', null, 'un anonyme ne lit pas les références internes'
);

select lives_ok($$select id, title from public.products limit 1$$, 'un anonyme lit le reste de la fiche');

select throws_ok($$select * from public.product_references$$, '42501', null, 'un anonyme ne lit pas la vue des références');

select is(public.reservation_ttl_minutes(), 120, 'la durée de réservation est lisible publiquement');

reset role;

select pg_temp.login('11000000-0000-0000-0000-00000000000c');

select throws_ok($$select reference from public.products limit 1$$, '42501', null, 'un client ne lit pas les références');
select is_empty($$select * from public.product_references$$, 'la vue ne renvoie rien à un client');
select is(
  (select count(*)::int from public.products where search_text like '%secret-ref%'),
  0,
  'la recherche ne révèle pas une référence'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000a');

select is(
  (select reference from public.product_references where product_id = '31000000-0000-0000-0000-000000000001'),
  'SECRET-REF',
  'le vendeur lit sa référence'
);

select is(
  (select count(*)::int from public.product_references where product_id = '31000000-0000-0000-0000-000000000002'),
  0,
  'le vendeur ne lit pas la référence d''une autre boutique'
);

select pg_temp.logout();

-- Statuts de commande et de pièce.
insert into public.products (id, shop_id, category_id, title, condition, price_millimes, publication_status, published_at)
values ('31000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-00000000000a',
  (select id from public.categories where slug = 'jeans'), 'Commandée', 'good', 15000, 'published', now());

select pg_temp.login('11000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$select public.place_order(array['31000000-0000-0000-0000-000000000004']::uuid[],
      array['21000000-0000-0000-0000-00000000000a']::uuid[], 'Client C', '+21622123456', null, null, null)$$,
  'le client commande'
);
select pg_temp.logout();

select is(
  (select status::text from public.products where id = '31000000-0000-0000-0000-000000000004'),
  'reserved', 'une pièce commandée est réservée, pas vendue'
);

select pg_temp.login('11000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.update_order_status((select id from public.orders where shop_id = '21000000-0000-0000-0000-00000000000a'), 'confirmed')$$, 'confirmée');
select lives_ok($$select public.update_order_status((select id from public.orders where shop_id = '21000000-0000-0000-0000-00000000000a'), 'preparing')$$, 'préparée');
select lives_ok($$select public.update_order_status((select id from public.orders where shop_id = '21000000-0000-0000-0000-00000000000a'), 'delivered')$$, 'retirée');
select pg_temp.logout();

select is(
  (select status::text from public.products where id = '31000000-0000-0000-0000-000000000004'),
  'sold', 'la pièce est vendue à la livraison'
);

-- Vidéos.
select pg_temp.login('11000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.create_video_draft('21000000-0000-0000-0000-00000000000a', 'x')$$,
  'P0001', 'forbidden', 'B ne crée pas de vidéo chez A'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$select public.create_video_draft('21000000-0000-0000-0000-00000000000a', 'Arrivage')$$,
  'A crée un brouillon vidéo'
);

select throws_ok(
  $$select public.finalize_video((select id from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), 'autre/chemin.webm', 'autre/x.jpg', 10, 720, 1280)$$,
  'P0001', 'forbidden', 'un chemin hors du dossier de la vidéo est refusé'
);

select throws_ok(
  format(
    $$select public.finalize_video('%1$s', '%2$s/%1$s/v.webm', '%2$s/%1$s/t.jpg', 10, 720, 1280)$$,
    (select id from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), '21000000-0000-0000-0000-00000000000a'
  ),
  'P0001', 'video_missing', 'un fichier absent du Storage est refusé'
);

select pg_temp.logout();

insert into storage.objects (bucket_id, name, metadata)
select 'shop-videos', v.shop_id || '/' || v.id || '/' || f.name, f.meta::jsonb
from (select * from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a') v
cross join (values ('v.webm', '{"size": 1000}'), ('t.jpg', '{"size": 10}'), ('big.webm', '{"size": 99999999}')) as f (name, meta);

select pg_temp.login('11000000-0000-0000-0000-00000000000a');

select throws_ok(
  format(
    $$select public.finalize_video('%1$s', '%2$s/%1$s/big.webm', '%2$s/%1$s/t.jpg', 10, 720, 1280)$$,
    (select id from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), '21000000-0000-0000-0000-00000000000a'
  ),
  'P0001', 'video_too_large', 'la taille réelle du fichier est contrôlée'
);

select throws_ok(
  format(
    $$select public.finalize_video('%1$s', '%2$s/%1$s/v.webm', '%2$s/%1$s/t.jpg', 300, 720, 1280)$$,
    (select id from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), '21000000-0000-0000-0000-00000000000a'
  ),
  'P0001', 'video_too_long', 'une vidéo trop longue est refusée'
);

select lives_ok(
  format(
    $$select public.finalize_video('%1$s', '%2$s/%1$s/v.webm', '%2$s/%1$s/t.jpg', 10, 720, 1280)$$,
    (select id from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), '21000000-0000-0000-0000-00000000000a'
  ),
  'une vidéo valide est publiée'
);

select throws_ok(
  $$select public.set_video_products((select id from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), array['31000000-0000-0000-0000-000000000002']::uuid[])$$,
  'P0001', 'forbidden', 'une vidéo ne s''associe pas à la pièce d''une autre boutique'
);

select lives_ok(
  $$select public.set_video_products((select id from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), array['31000000-0000-0000-0000-000000000001']::uuid[])$$,
  'une vidéo s''associe à une pièce de la boutique'
);

select pg_temp.logout();

set local role anon;
select is((select count(*)::int from public.videos where shop_id = '21000000-0000-0000-0000-00000000000a'), 1, 'un anonyme voit la vidéo publiée');
select is(
  (select count(*)::int from public.video_products where product_id = '31000000-0000-0000-0000-000000000001'),
  1, 'et ses pièces'
);
reset role;

select pg_temp.login('11000000-0000-0000-0000-00000000000b');
select is_empty($$update public.videos set description = 'pirate' returning id$$, 'B ne modifie pas la vidéo de A');
select is_empty($$delete from public.videos returning id$$, 'B ne supprime pas la vidéo de A');
select pg_temp.logout();

-- Suivi et alertes.
select pg_temp.login('11000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$insert into public.shop_followers (user_id, shop_id) values (auth.uid(), '21000000-0000-0000-0000-00000000000a')$$,
  'C suit la boutique A'
);

select throws_ok(
  $$insert into public.shop_followers (user_id, shop_id) values ('11000000-0000-0000-0000-00000000000d', '21000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'C ne fait pas suivre une boutique à D'
);

select is(
  (select follower_count from public.shops where id = '21000000-0000-0000-0000-00000000000a'),
  1, 'le compteur d''abonnés est public'
);

insert into public.drop_alerts (user_id, name, sizes, brands, max_price_millimes, followed_only)
values (auth.uid(), 'Mes jeans', '{" m "}', '{"LEVIS"}', 25000, true);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000d');

select is_empty($$select shop_id from public.shop_followers$$, 'D ne voit pas les abonnements de C');
select is_empty($$select id from public.drop_alerts$$, 'D ne voit pas les alertes de C');

insert into public.drop_alerts (user_id, name, brands) values (auth.uid(), 'Ailleurs', '{"nike"}');

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000a');

select is_empty(
  $$select shop_id from public.shop_followers$$,
  'le vendeur ne voit pas l''identité de ses abonnés'
);

select is_empty(
  $$select * from public.set_products_publication(array['31000000-0000-0000-0000-000000000003']::uuid[], 'published')$$,
  'A publie une nouvelle pièce'
);

select pg_temp.logout();

select is(
  (select count(*)::int from public.notifications where product_id = '31000000-0000-0000-0000-000000000003'),
  1, 'seule l''alerte correspondante déclenche une notification'
);

select pg_temp.login('11000000-0000-0000-0000-00000000000a');
select is_empty(
  $$select * from public.set_products_publication(array['31000000-0000-0000-0000-000000000003']::uuid[], 'draft')$$,
  'A dépublie'
);
select is_empty(
  $$select * from public.set_products_publication(array['31000000-0000-0000-0000-000000000003']::uuid[], 'published')$$,
  'A republie'
);
select pg_temp.logout();

select is(
  (select count(*)::int from public.notifications where product_id = '31000000-0000-0000-0000-000000000003'),
  1, 'une republication ne renotifie pas'
);

select pg_temp.login('11000000-0000-0000-0000-00000000000d');
select is_empty($$select id from public.notifications$$, 'D ne voit pas les notifications de C');
select pg_temp.logout();

-- Plafond quotidien.
insert into public.notification_preferences (user_id, max_per_day)
values ('11000000-0000-0000-0000-00000000000c', 1)
on conflict (user_id) do update set max_per_day = 1;

select is(
  private.dispatch_drop_alerts(array['31000000-0000-0000-0000-000000000002']::uuid[]),
  0,
  'le plafond quotidien bloque les notifications excessives'
);

-- Messagerie.
select pg_temp.login('11000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$select public.start_conversation('21000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000001', null, 'Bonjour')$$,
  'C contacte la boutique depuis une pièce'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000d');

select is_empty($$select id from public.conversations$$, 'D ne voit pas la conversation de C');
select is_empty($$select id from public.messages$$, 'D ne lit pas les messages de C');
select is_empty($$select id from public.my_conversations()$$, 'D ne la voit pas dans sa liste');

select throws_ok(
  $$select public.send_message((select id from public.my_conversations() limit 1), 'x')$$,
  'P0001', 'forbidden', 'un envoi sans conversation est refusé'
);

select pg_temp.logout();

select throws_ok(
  format($$select pg_temp.login('11000000-0000-0000-0000-00000000000b'); select public.send_message('%s', 'intrus')$$,
    (select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a')),
  'P0001', 'forbidden', 'B n''écrit pas dans une conversation de A'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000a');

select is(
  (select unread from public.my_conversations() where shop_id = '21000000-0000-0000-0000-00000000000a'),
  1::bigint, 'le vendeur a un message non lu'
);

select lives_ok(
  $$select public.mark_conversation_read((select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'))$$,
  'le vendeur lit'
);

select is((select unread from public.my_conversations() where shop_id = '21000000-0000-0000-0000-00000000000a'), 0::bigint, 'le compteur revient à zéro');

select lives_ok(
  $$select public.send_message((select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'), 'Oui, disponible')$$,
  'le vendeur répond'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000c');

select is((select count(*)::int from public.messages), 2, 'le client lit l''historique');

select lives_ok(
  $$select public.block_conversation((select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'), true)$$,
  'le client bloque la boutique'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$select public.send_message((select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'), 'relance')$$,
  'P0001', 'blocked', 'une boutique bloquée ne peut plus écrire'
);

select pg_temp.logout();

-- Signalements et administration.
select pg_temp.login('11000000-0000-0000-0000-00000000000e');
select is_empty($$select id from public.messages$$, 'un administrateur ne lit pas les conversations privées');
select pg_temp.logout();

select pg_temp.login('11000000-0000-0000-0000-00000000000c');

select lives_ok(
  $$select public.create_report('conversation', (select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'), 'harassment', 'Insistant')$$,
  'le client signale la conversation'
);

select throws_ok(
  $$select public.create_report('conversation', (select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'), 'harassment', '')$$,
  'P0001', 'already_reported', 'un même signalement ouvert n''est pas doublé'
);

select throws_ok(
  $$select public.review_report((select r.id from public.reports r where r.reporter_id = '11000000-0000-0000-0000-00000000000c'), 'dismiss', 'motif')$$,
  'P0001', 'forbidden', 'un client ne traite pas un signalement'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000d');

select is_empty($$select id from public.reports$$, 'D ne voit pas les signalements de C');

select throws_ok(
  $$select public.create_report('conversation', (select id from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'), 'other', '')$$,
  'P0001', 'not_found', 'on ne signale que ses propres conversations'
);

select pg_temp.logout();
select pg_temp.login('11000000-0000-0000-0000-00000000000e');

select is(
  (select jsonb_array_length(snapshot -> 'messages') from public.reports r where r.reporter_id = '11000000-0000-0000-0000-00000000000c'),
  2, 'l''administrateur voit l''extrait figé'
);

select lives_ok(
  $$select public.review_report((select r.id from public.reports r where r.reporter_id = '11000000-0000-0000-0000-00000000000c'), 'remove_content', 'Harcèlement avéré')$$,
  'l''administrateur tranche'
);

select pg_temp.logout();

select ok(
  (select closed_at is not null from public.conversations where shop_id = '21000000-0000-0000-0000-00000000000a'),
  'la conversation signalée est fermée'
);

-- Limitation des créations de conversations.
insert into public.rate_limits (user_id, action, window_start, hits)
values (
  '11000000-0000-0000-0000-00000000000d',
  'start_conversation',
  to_timestamp(floor(extract(epoch from now()) / 86400) * 86400),
  10
);

select pg_temp.login('11000000-0000-0000-0000-00000000000d');

select throws_ok(
  $x$select public.start_conversation('21000000-0000-0000-0000-00000000000a', null, null, 'Spam')$x$,
  'P0001', 'rate_limited', 'les créations abusives de conversations sont bloquées'
);

select is(
  (select count(*)::int from public.conversations),
  0,
  'aucune conversation n''est créée au-delà de la limite'
);

select pg_temp.logout();

select * from finish();
rollback;
