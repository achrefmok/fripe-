begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-0000-0000-00000000000a', 'critique-media@test.local', '{"display_name":"Critique"}'),
  ('c0000000-0000-0000-0000-00000000000b', 'erotique-media@test.local', '{"display_name":"Erotique"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'explicite-media@test.local', '{"display_name":"Explicite"}'),
  ('c0000000-0000-0000-0000-00000000000d', 'admin-media@test.local', '{"display_name":"Admin"}'),
  ('c0000000-0000-0000-0000-00000000000e', 'ia-media@test.local', '{"display_name":"IA"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), 'c0000000-0000-0000-0000-00000000000d', 'totp', 'verified', now(), now());
insert into public.platform_admins (user_id) values ('c0000000-0000-0000-0000-00000000000d');

create function pg_temp.login(p_id text, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

create function pg_temp.record(p_user text, p_decision text, p_category text, p_severity text) returns jsonb language sql as $$
  select public.record_media_moderation(
    p_user::uuid, 'image', 'product_image', p_decision, p_category, p_severity,
    'Motif de test', '{"parts":[]}'::jsonb, '[]'::jsonb, 'fixture', repeat('a', 64)
  );
$$;
grant execute on function pg_temp.record(text, text, text, text) to service_role, authenticated;

-- Une session ne peut ni écrire un rapport ni s'éviter la sanction : la fonction est réservée au serveur.
select pg_temp.login('c0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select pg_temp.record('c0000000-0000-0000-0000-00000000000a', 'block', 'sexual_explicit', 'critical')$$,
  '42501', null, 'un compte connecté ne peut pas appeler record_media_moderation'
);
select throws_ok(
  $$insert into public.media_moderation_events (user_id, media_kind, context, decision, category, severity, reason, provider)
    values ('c0000000-0000-0000-0000-00000000000a', 'image', 'product_image', 'flag', 'ai_generated', 'low', 'faux', 'moi')$$,
  '42501', null, 'un compte connecté ne peut pas écrire dans le journal des médias'
);
select pg_temp.logout();

set local role service_role;

-- Gravité critique : suspension dès la première tentative, rapport aux administrateurs.
select is(
  (pg_temp.record('c0000000-0000-0000-0000-00000000000a', 'block', 'sexual_explicit', 'critical') ->> 'sanction'),
  'suspended', 'contenu explicite critique : suspension immédiate'
);

-- Gravité moyenne (+18) : suspension à la troisième tentative en 30 jours.
select is((pg_temp.record('c0000000-0000-0000-0000-00000000000b', 'block', 'sexual_erotica', 'medium') ->> 'sanction'), 'none', 'érotique, 1re tentative : bloqué sans suspension');
select is((pg_temp.record('c0000000-0000-0000-0000-00000000000b', 'block', 'sexual_erotica', 'medium') ->> 'sanction'), 'none', 'érotique, 2e tentative : bloqué sans suspension');
select is((pg_temp.record('c0000000-0000-0000-0000-00000000000b', 'block', 'sexual_erotica', 'medium') ->> 'sanction'), 'suspended', 'érotique, 3e tentative : suspension');

-- Gravité élevée : suspension à la deuxième tentative.
select is((pg_temp.record('c0000000-0000-0000-0000-00000000000c', 'block', 'sexual_explicit', 'high') ->> 'sanction'), 'none', 'explicite, 1re tentative : bloqué sans suspension');
select is((pg_temp.record('c0000000-0000-0000-0000-00000000000c', 'block', 'sexual_explicit', 'high') ->> 'attempts')::int, 2, 'les tentatives sur 30 jours sont comptées');

-- Un administrateur n'est jamais suspendu automatiquement, mais le rapport existe.
select is((pg_temp.record('c0000000-0000-0000-0000-00000000000d', 'block', 'sexual_explicit', 'critical') ->> 'sanction'), 'protected_account', 'compte administrateur protégé');

-- Un indice d'IA est consigné, sans sanction ni notification.
select is((pg_temp.record('c0000000-0000-0000-0000-00000000000e', 'flag', 'ai_generated', 'low') ->> 'sanction'), 'none', 'indice IA : aucune sanction');

reset role;

select results_eq(
  $$select id::text, status::text from public.profiles where id::text like 'c0000000-%' order by id$$,
  $$values
    ('c0000000-0000-0000-0000-00000000000a', 'suspended'),
    ('c0000000-0000-0000-0000-00000000000b', 'suspended'),
    ('c0000000-0000-0000-0000-00000000000c', 'suspended'),
    ('c0000000-0000-0000-0000-00000000000d', 'active'),
    ('c0000000-0000-0000-0000-00000000000e', 'active')$$,
  'les comptes sont suspendus selon la gravité, jamais l''administrateur ni pour un indice IA'
);

select is(
  (select count(*)::int from public.notifications where user_id = 'c0000000-0000-0000-0000-00000000000d' and kind = 'media_blocked'),
  7, 'chaque média bloqué est notifié aux administrateurs, pas les simples indices'
);

select ok(
  (select bool_and(e.reason <> '' and e.created_at is not null and e.category is not null and e.user_id is not null)
   from public.notifications n join public.media_moderation_events e on e.id = n.media_event_id
   where n.user_id = 'c0000000-0000-0000-0000-00000000000d'),
  'le rapport porte le compte, le type de contenu, la date et le motif'
);

select is(
  (select count(*)::int from public.audit_logs where action = 'user.auto_suspended' and entity_id like 'c0000000-%'),
  3, 'chaque suspension automatique est inscrite au journal d''audit'
);

-- Lecture : les administrateurs voient les rapports, les autres comptes rien.
select pg_temp.login('c0000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.media_moderation_events), 0, 'un compte ordinaire ne voit aucun rapport');
select pg_temp.logout();

select pg_temp.login('c0000000-0000-0000-0000-00000000000d', 'aal2');
select is((select count(*)::int from public.media_moderation_events where user_id::text like 'c0000000-%'), 8, 'un administrateur voit tous les rapports');
select pg_temp.logout();

-- Le journal est en ajout seul.
select throws_ok(
  $$update public.media_moderation_events set reason = 'effacé' where user_id = 'c0000000-0000-0000-0000-00000000000a'$$,
  'P0001', null, 'un rapport ne se modifie pas'
);
select throws_ok(
  $$delete from public.media_moderation_events where user_id = 'c0000000-0000-0000-0000-00000000000a'$$,
  'P0001', null, 'un rapport ne s''efface pas'
);

select * from finish();
rollback;
