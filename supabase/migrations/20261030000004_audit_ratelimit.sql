-- Journal d'audit append-only et limitation de débit côté base.

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create function private.reject_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

revoke all on function private.reject_audit_change() from public;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.reject_audit_change();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.reject_audit_change();

create function private.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, p_metadata);
$$;

revoke all on function private.log_audit(text, text, text, jsonb) from public;

create table public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (user_id, action, window_start)
);

create function private.enforce_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into public.rate_limits (user_id, action, window_start)
  values ((select auth.uid()), p_action, v_window)
  on conflict (user_id, action, window_start)
  do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  if v_hits > p_max then
    raise exception 'rate_limited';
  end if;
end;
$$;

revoke all on function private.enforce_rate_limit(text, integer, integer) from public;

alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.audit_logs, public.rate_limits from anon, authenticated;

grant select on public.audit_logs to authenticated;

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select private.is_platform_admin()));
