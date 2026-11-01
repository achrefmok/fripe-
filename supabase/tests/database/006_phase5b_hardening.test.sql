begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(29);

insert into auth.users (id, email, raw_user_meta_data) values
  ('16000000-0000-0000-0000-00000000000a', 'p5b-seller@test.local', '{"display_name":"Vendeur"}'),
  ('16000000-0000-0000-0000-00000000000e', 'p5b-admin@test.local', '{"display_name":"Admin"}'),
  ('16000000-0000-0000-0000-00000000000c', 'p5b-client@test.local', '{"display_name":"Client"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), u.id, 'totp', 'verified', now(), now() from auth.users u;

insert into public.platform_admins (user_id) values ('16000000-0000-0000-0000-00000000000e');

create function pg_temp.login(p_id text, p_aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

insert into public.shops (id, slug, name, governorate_id, city_id, status, logo_path)
select '26000000-0000-0000-0000-00000000000a', 'p5b-shop', 'Shop', c.governorate_id, c.id, 'approved',
       '26000000-0000-0000-0000-00000000000a/logo.png'
from public.cities c where c.slug = 'la-marsa';

insert into public.shop_members (shop_id, user_id, role) values
  ('26000000-0000-0000-0000-00000000000a', '16000000-0000-0000-0000-00000000000a', 'owner');

insert into public.products (id, shop_id, reference, category_id, title, condition, price_millimes, publication_status, published_at)
values ('36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-00000000000a', 'R-1',
  (select id from public.categories where slug = 'jeans'), 'Jean', 'good', 20000, 'published', now());

insert into public.product_images (product_id, path) values
  ('36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-00000000000a/36000000-0000-0000-0000-000000000001/1.jpg');

insert into public.videos (id, shop_id, status, video_path, thumbnail_path, duration_seconds, published_at) values
  ('46000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-00000000000a', 'published', 's/v1/video.webm', 's/v1/thumb.jpg', 5, now());

-- MFA : le mot de passe seul ne donne plus aucun pouvoir d'administration.
select pg_temp.login('16000000-0000-0000-0000-00000000000e', 'aal1');

select ok(not private.is_platform_admin(), 'un administrateur en aal1 n''est pas administrateur');

select throws_ok(
  $$select public.review_shop('26000000-0000-0000-0000-00000000000a', 'suspended', 'Motif')$$,
  'P0001', 'forbidden', 'aal1 : pas de suspension de boutique'
);

select throws_ok(
  $$select public.set_user_status('16000000-0000-0000-0000-00000000000c', 'suspended', 'Motif')$$,
  'P0001', 'forbidden', 'aal1 : pas de suspension de compte'
);

select throws_ok(
  $$select public.moderate_product('36000000-0000-0000-0000-000000000001', 'Motif')$$,
  'P0001', 'forbidden', 'aal1 : pas de modération'
);

select throws_ok(
  $$select public.emergency_takedown('26000000-0000-0000-0000-00000000000a', 'Motif')$$,
  'P0001', 'forbidden', 'aal1 : pas de retrait d''urgence'
);

select throws_ok(
  $$select * from public.admin_list_users('', 10, 0)$$,
  'P0001', 'forbidden', 'aal1 : pas de liste des comptes'
);

select is((select count(*)::integer from public.audit_logs), 0, 'aal1 : journal illisible');

select is_empty(
  $$update public.platform_settings set value = '9' where key = 'max_shops_per_user' returning key$$,
  'aal1 : réglages non modifiables'
);

select lives_ok(
  $$select public.log_mfa_event('mfa.enrolled')$$,
  'un administrateur journalise son inscription au second facteur'
);

select throws_ok($$select public.log_mfa_event('admin.pirate')$$, 'P0001', 'forbidden', 'seuls les événements prévus sont acceptés');

select pg_temp.login('16000000-0000-0000-0000-00000000000e');

select ok(private.is_platform_admin(), 'en aal2, l''administrateur retrouve ses droits');

select pg_temp.login('16000000-0000-0000-0000-00000000000c');

select ok(not private.is_platform_admin(), 'un client en aal2 reste un client');

select throws_ok($$select public.log_mfa_event('mfa.enrolled')$$, 'P0001', 'forbidden', 'un client ne journalise rien');

-- Fonctions de maintenance : jamais accessibles depuis l'application.
select throws_ok($$select public.begin_maintenance_run()$$, '42501', null, 'un compte ne lance pas la maintenance');
select throws_ok($$select * from public.next_storage_purge(10)$$, '42501', null, 'un compte ne lit pas la file');
select throws_ok($$insert into public.maintenance_runs default values$$, '42501', null, 'un compte n''écrit pas l''historique');

set local role anon;
select throws_ok($$select public.begin_maintenance_run()$$, '42501', null, 'un anonyme ne lance pas la maintenance');
reset role;

select pg_temp.logout();

-- Verrou d'exécution.
set local role service_role;

select isnt(public.begin_maintenance_run(), null, 'un premier passage obtient le verrou');
select is(public.begin_maintenance_run(), null, 'un passage simultané est refusé');

reset role;

update public.maintenance_runs set started_at = now() - interval '20 minutes' where status = 'running';

set local role service_role;

select isnt(public.begin_maintenance_run(), null, 'un passage interrompu libère le verrou');

reset role;

select is(
  (select count(*)::integer from public.maintenance_runs where status = 'expired'),
  1, 'le passage interrompu reste dans l''historique'
);

-- Une ligne orpheline redevenue référencée n'est jamais purgée.
insert into public.storage_purge_queue (bucket, path, reason) values
  ('product-images', '26000000-0000-0000-0000-00000000000a/36000000-0000-0000-0000-000000000001/1.jpg', 'orphan'),
  ('product-images', 'vraiment/orphelin.jpg', 'orphan');

select set_eq(
  $$select path from public.next_storage_purge(10)$$,
  array['vraiment/orphelin.jpg'],
  'seul le fichier réellement abandonné part en purge'
);

select is(
  (select outcome from public.storage_purge_queue where reason = 'orphan' and path like '26000000%'),
  'kept', 'le fichier référencé est marqué conservé'
);

-- Retrait d'urgence.
select pg_temp.login('16000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$select public.emergency_takedown('26000000-0000-0000-0000-00000000000a', 'Motif')$$,
  'P0001', 'forbidden', 'une boutique ne déclenche pas de retrait d''urgence'
);

select pg_temp.login('16000000-0000-0000-0000-00000000000e');

select throws_ok(
  $$select public.emergency_takedown('26000000-0000-0000-0000-00000000000a', '')$$,
  'P0001', 'note_required', 'un retrait d''urgence exige un motif'
);

select lives_ok(
  $$select public.emergency_takedown('26000000-0000-0000-0000-00000000000a', 'Contenu illégal')$$,
  'l''administration retire tout le contenu de la boutique'
);

select pg_temp.logout();

select is(
  (select status::text || '/' || coalesce(logo_path, 'sans') from public.shops where id = '26000000-0000-0000-0000-00000000000a'),
  'suspended/sans', 'la boutique est suspendue et perd son logo'
);

select is(
  (select count(*)::integer from public.storage_purge_queue
   where done_at is null and reason <> 'orphan'
     and path in ('26000000-0000-0000-0000-00000000000a/36000000-0000-0000-0000-000000000001/1.jpg',
                  's/v1/video.webm', 's/v1/thumb.jpg', '26000000-0000-0000-0000-00000000000a/logo.png')),
  4, 'photo, vidéo, miniature et logo partent en suppression'
);

select is(
  (select (metadata ->> 'products') || '/' || (metadata ->> 'videos') from public.audit_logs where action = 'shop.emergency_takedown'),
  '1/1', 'le retrait d''urgence est journalisé avec son étendue'
);

select * from finish();
rollback;
