-- Fermeture de la fenêtre d'enrôlement et révocation réelle. Le rôle n'est accordé qu'à un compte qui
-- possède déjà un facteur vérifié ; une réinitialisation retire le rôle et coupe les sessions.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins a
    join public.profiles p on p.id = a.user_id
    where a.user_id = (select auth.uid())
      and p.status = 'active'
      -- Un jeton émis avant l'attribution du rôle ne vaut pas : il peut dater d'une session révoquée.
      and (
        (select auth.jwt() ->> 'iat') is null
        or (select auth.jwt() ->> 'iat')::bigint >= floor(extract(epoch from a.created_at))
      )
  )
  and (select auth.jwt() ->> 'aal') = 'aal2';
$$;

create function private.require_admin_factor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from auth.mfa_factors f
    where f.user_id = new.user_id and f.status = 'verified' and f.factor_type = 'totp'
  ) then
    raise exception 'mfa_required';
  end if;

  return new;
end;
$$;

revoke all on function private.require_admin_factor() from public;

create trigger platform_admins_require_factor
  before insert on public.platform_admins
  for each row execute function private.require_admin_factor();

-- Dernier recours d'un opérateur : voir docs/administration-mfa.md. Les facteurs sont retirés ensuite
-- par l'API d'administration de Supabase Auth.
create function public.reset_admin_access(p_user_id uuid, p_operator text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessions integer;
begin
  if char_length(btrim(coalesce(p_operator, ''))) < 2 or char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'note_required';
  end if;

  delete from public.platform_admins a where a.user_id = p_user_id;

  if not found then
    raise exception 'not_found';
  end if;

  delete from auth.sessions s where s.user_id = p_user_id;
  get diagnostics v_sessions = row_count;

  perform private.log_audit(
    'mfa.reset', 'user', p_user_id::text,
    jsonb_build_object('operator', p_operator, 'reason', p_reason, 'sessions', v_sessions)
  );
end;
$$;

revoke all on function public.reset_admin_access(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reset_admin_access(uuid, text, text) to service_role;

-- Droits explicites : un projet neuf peut ne plus les accorder par défaut aux nouvelles tables.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
