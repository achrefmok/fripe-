begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(37);

-- Comptes de test (le trigger crée les profils).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'seller-a@test.local', '{"display_name":"Vendeur A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'seller-b@test.local', '{"display_name":"Vendeur B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@test.local', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000d', 'client@test.local', '{"display_name":"x"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), u.id, 'totp', 'verified', now(), now() from auth.users u;

insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000c');

create function pg_temp.login(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

create function pg_temp.city(p_slug text) returns integer language sql as $$
  select id from public.cities where slug = p_slug;
$$;

create function pg_temp.gov(p_slug text) returns smallint language sql as $$
  select id from public.governorates where slug = p_slug;
$$;

-- Toutes les tables exposées ont RLS.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'RLS activée sur toutes les tables de public'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  'Membre',
  'un nom trop court dans les métadonnées est remplacé'
);

-- Profils.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.profiles), 1, 'un utilisateur ne voit que son profil');

select throws_ok(
  $$update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'un utilisateur ne peut pas modifier son statut'
);

select lives_ok(
  $$update public.profiles set display_name = 'Vendeur Alpha' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'un utilisateur modifie son nom'
);

select is_empty(
  $$update public.profiles set display_name = 'Pirate' where id = '00000000-0000-0000-0000-00000000000b' returning id$$,
  'un utilisateur ne modifie pas le profil d''un autre'
);

select throws_ok(
  $$insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'un utilisateur ne peut pas se nommer admin'
);

-- Création de boutique.
select lives_ok(
  format(
    $$select public.create_shop('Boutique A', 'boutique-a', null, null, %s::smallint, %s)$$,
    pg_temp.gov('tunis'), pg_temp.city('la-marsa')
  ),
  'un utilisateur crée une boutique via la RPC'
);

select throws_ok(
  format(
    $$select public.create_shop('Seconde', 'seconde-a', null, null, %s::smallint, %s)$$,
    pg_temp.gov('tunis'), pg_temp.city('la-marsa')
  ),
  'P0001', 'shop_limit_reached', 'un vendeur n''a qu''une boutique'
);

select throws_ok(
  $$insert into public.shops (name, slug, governorate_id, city_id) values ('X', 'direct', 1, 1)$$,
  '42501', null, 'insertion directe dans shops interdite'
);

select throws_ok(
  $$update public.shops set status = 'approved' where slug = 'boutique-a'$$,
  '42501', null, 'un vendeur ne peut pas approuver sa boutique'
);

select throws_ok(
  $$select public.review_shop((select id from public.shops where slug = 'boutique-a'), 'approved', null)$$,
  'P0001', 'forbidden', 'un vendeur ne peut pas appeler review_shop'
);

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

select throws_ok(
  format(
    $$select public.create_shop('Autre', 'boutique-a', null, null, %s::smallint, %s)$$,
    pg_temp.gov('tunis'), pg_temp.city('la-marsa')
  ),
  'P0001', 'slug_taken', 'un slug déjà pris est refusé'
);

select throws_ok(
  format(
    $$select public.create_shop('Mauvais lieu', 'mauvais-lieu', null, null, %s::smallint, %s)$$,
    pg_temp.gov('sfax'), pg_temp.city('la-marsa')
  ),
  'P0001', 'invalid_location', 'une ville hors gouvernorat est refusée'
);

select lives_ok(
  format(
    $$select public.create_shop('Boutique B', 'boutique-b', null, null, %s::smallint, %s)$$,
    pg_temp.gov('sousse'), pg_temp.city('sousse-ville')
  ),
  'le vendeur B crée sa boutique'
);

-- Isolation entre boutiques.
select is(
  (select count(*)::int from public.shops where slug = 'boutique-a'),
  0,
  'B ne voit pas la boutique en attente de A'
);

select is((select count(*)::int from public.shop_members), 1, 'B ne voit que sa propre appartenance');

select pg_temp.logout();

set local role anon;
select is((select count(*)::int from public.shops where slug in ('boutique-a', 'boutique-b')), 0, 'un anonyme ne voit aucune boutique non approuvée');
select throws_ok(
  $$select public.create_shop('Anon', 'anon-shop', null, null, 1::smallint, 1)$$,
  '42501', null, 'un anonyme ne peut pas créer de boutique'
);
reset role;

-- Validation admin.
select pg_temp.login('00000000-0000-0000-0000-00000000000c');

select is((select count(*)::int from public.shops where slug in ('boutique-a', 'boutique-b')), 2, 'l''admin voit toutes les boutiques');

select throws_ok(
  $$select public.review_shop((select id from public.shops where slug = 'boutique-b'), 'rejected', '')$$,
  'P0001', 'note_required', 'un refus exige un motif'
);

select lives_ok(
  $$select public.review_shop((select id from public.shops where slug = 'boutique-a'), 'approved', null)$$,
  'l''admin approuve une boutique'
);

select throws_ok(
  $$select public.review_shop((select id from public.shops where slug = 'boutique-a'), 'rejected', 'motif')$$,
  'P0001', 'invalid_transition', 'une transition invalide est refusée'
);

select is(
  (select count(*)::int from public.audit_logs
   where action = 'shop.approved'
     and entity_id = (select id::text from public.shops where slug = 'boutique-a')),
  1,
  'l''approbation est journalisée'
);

select throws_ok(
  $$select public.set_user_status('00000000-0000-0000-0000-00000000000c', 'suspended', 'test')$$,
  'P0001', 'protected_account', 'un admin ne peut pas se suspendre'
);

select pg_temp.logout();

set local role anon;
select is((select count(*)::int from public.shops where slug in ('boutique-a', 'boutique-b')), 1, 'un anonyme voit la boutique approuvée');
reset role;

-- Inter-boutiques après approbation.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

select is_empty(
  $$update public.shops set name = 'Pirate' where slug = 'boutique-a' returning id$$,
  'B ne peut pas modifier la boutique de A'
);

select throws_ok(
  $$insert into public.shop_addresses (shop_id, label, address_line, governorate_id, city_id)
    select id, 'Dépôt', 'Rue de test', governorate_id, city_id from public.shops where slug = 'boutique-a'$$,
  '42501', null, 'B ne peut pas ajouter une adresse à la boutique de A'
);

select is((select count(*)::int from public.audit_logs), 0, 'un vendeur ne lit pas le journal d''audit');

select throws_ok(
  $$select public.admin_list_users('', 10, 0)$$,
  'P0001', 'forbidden', 'un vendeur ne peut pas lister les utilisateurs'
);

select pg_temp.logout();

-- Storage inter-boutiques.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

select throws_ok(
  format(
    $$insert into storage.objects (bucket_id, name, owner_id) values ('shop-assets', '%s/logo.png', auth.uid()::text)$$,
    (select id from public.shops where slug = 'boutique-a' limit 1)
  ),
  '42501', null, 'B ne peut pas déposer de fichier chez A'
);

select lives_ok(
  format(
    $$insert into storage.objects (bucket_id, name, owner_id) values ('shop-assets', '%s/logo.png', auth.uid()::text)$$,
    (select id from public.shops where slug = 'boutique-b' limit 1)
  ),
  'B dépose un fichier dans sa boutique'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('shop-assets', 'pas-un-uuid/x.png', auth.uid()::text)$$,
  '42501', null, 'un chemin invalide est refusé sans erreur de conversion'
);

select pg_temp.logout();

-- Suspension.
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$select public.set_user_status('00000000-0000-0000-0000-00000000000b', 'suspended', 'test')$$,
  'l''admin suspend un compte'
);
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  format(
    $$select public.create_shop('Suspendu', 'suspendu', null, null, %s::smallint, %s)$$,
    pg_temp.gov('tunis'), pg_temp.city('la-marsa')
  ),
  'P0001', 'forbidden', 'un compte suspendu ne crée pas de boutique'
);
select pg_temp.logout();

-- Un seul propriétaire par compte, quel que soit le chemin.
select throws_ok(
  $$insert into public.shop_members (shop_id, user_id, role)
    values ((select id from public.shops where slug = 'boutique-b'), (select user_id from public.shop_members where role = 'owner' and shop_id = (select id from public.shops where slug = 'boutique-a')), 'owner')$$,
  '23505', null, 'un compte ne peut pas posséder deux boutiques'
);

select is(
  (select value #>> '{}' from public.platform_settings where key = 'max_shops_per_user'),
  '1',
  'le réglage annonce une boutique par compte'
);

select * from finish();
rollback;
