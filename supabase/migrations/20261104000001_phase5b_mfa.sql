-- MFA obligatoire pour l'administration. Le contrôle vit dans is_platform_admin() : il couvre toutes
-- les RPC et politiques, y compris un appel direct à l'API. Un mot de passe seul (aal1) n'y suffit plus.

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
    where a.user_id = (select auth.uid()) and p.status = 'active'
  )
  and (select auth.jwt() ->> 'aal') = 'aal2';
$$;

-- Déclaré par le serveur après l'action : Supabase Auth ne journalise pas dans audit_logs.
create function public.log_mfa_event(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action not in ('mfa.enrolled', 'mfa.removed') then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())) then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('log_mfa_event', 20, 3600);
  perform private.log_audit(p_action, 'user', (select auth.uid())::text);
end;
$$;

revoke all on function public.log_mfa_event(text) from public, anon;
grant execute on function public.log_mfa_event(text) to authenticated;
