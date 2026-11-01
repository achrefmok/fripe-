begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('17000000-0000-0000-0000-00000000000a', 'p6-admin@test.local', '{"display_name":"Admin"}'),
  ('17000000-0000-0000-0000-00000000000b', 'p6-sans@test.local', '{"display_name":"Sans facteur"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values
  ('57000000-0000-0000-0000-00000000000b', '17000000-0000-0000-0000-00000000000b', 'totp', 'unverified', now(), now());

select throws_ok(
  $$insert into public.platform_admins (user_id) values ('17000000-0000-0000-0000-00000000000b')$$,
  'P0001', 'mfa_required', 'pas de rôle sans facteur vérifié, même depuis un accès direct à la base'
);

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values
  ('57000000-0000-0000-0000-00000000000a', '17000000-0000-0000-0000-00000000000a', 'totp', 'verified', now(), now());

select lives_ok(
  $$insert into public.platform_admins (user_id) values ('17000000-0000-0000-0000-00000000000a')$$,
  'un compte au facteur vérifié reçoit le rôle'
);

insert into auth.sessions (id, user_id, created_at, updated_at, aal) values
  ('67000000-0000-0000-0000-00000000000a', '17000000-0000-0000-0000-00000000000a', now(), now(), 'aal2');

create function pg_temp.claims(p_iat bigint) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', '17000000-0000-0000-0000-00000000000a', 'role', 'authenticated', 'aal', 'aal2', 'iat', p_iat
  )::text, true);
  set local role authenticated;
$$;

update public.platform_admins set created_at = now() - interval '1 hour';

select pg_temp.claims(extract(epoch from now())::bigint);
select ok(private.is_platform_admin(), 'un jeton récent en aal2 donne les droits');

select throws_ok(
  $$select public.reset_admin_access('17000000-0000-0000-0000-00000000000a', 'Moi', 'Tentative')$$,
  '42501', null, 'un administrateur ne lance pas la réinitialisation depuis l''application'
);

reset role;

select pg_temp.claims(extract(epoch from now() - interval '2 hours')::bigint);
select ok(not private.is_platform_admin(), 'un jeton antérieur à l''attribution du rôle ne vaut rien');
reset role;

set local role service_role;

select throws_ok(
  $$select public.reset_admin_access('17000000-0000-0000-0000-00000000000a', '', 'Motif')$$,
  'P0001', 'note_required', 'une réinitialisation désigne son opérateur'
);

select throws_ok(
  $$select public.reset_admin_access('17000000-0000-0000-0000-00000000000b', 'Opérateur', 'Motif')$$,
  'P0001', 'not_found', 'seul un administrateur se réinitialise'
);

select lives_ok(
  $$select public.reset_admin_access('17000000-0000-0000-0000-00000000000a', 'Opérateur', 'Téléphone perdu')$$,
  'l''opérateur réinitialise l''accès'
);

reset role;

select is((select count(*)::integer from public.platform_admins where user_id = '17000000-0000-0000-0000-00000000000a'), 0, 'le rôle est retiré');
select is((select count(*)::integer from auth.sessions where user_id = '17000000-0000-0000-0000-00000000000a'), 0, 'toutes ses sessions sont coupées');

select pg_temp.claims(extract(epoch from now())::bigint);
select ok(not private.is_platform_admin(), 'un jeton encore valide perd ses droits immédiatement');
reset role;

select is(
  (select metadata ->> 'operator' from public.audit_logs where action = 'mfa.reset' and entity_id = '17000000-0000-0000-0000-00000000000a'),
  'Opérateur', 'la réinitialisation désigne son opérateur dans le journal'
);

select is(
  (select metadata ->> 'sessions' from public.audit_logs where action = 'mfa.reset' and entity_id = '17000000-0000-0000-0000-00000000000a'),
  '1', 'le journal indique le nombre de sessions coupées'
);

select * from finish();
rollback;
