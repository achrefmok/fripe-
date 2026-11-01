-- Maintenance planifiée : une seule exécution à la fois, un historique consultable, et une purge
-- qui revérifie qu'un fichier est toujours abandonné avant de le retirer.

create table public.maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed', 'expired')),
  result jsonb,
  error text check (char_length(error) <= 300)
);

create unique index maintenance_runs_one_running on public.maintenance_runs ((true)) where status = 'running';
create index maintenance_runs_started_idx on public.maintenance_runs (started_at desc);

alter table public.maintenance_runs enable row level security;
revoke all on public.maintenance_runs from anon, authenticated;
grant select on public.maintenance_runs to authenticated;

create policy maintenance_runs_select_admin on public.maintenance_runs
  for select to authenticated
  using ((select private.is_platform_admin()));

alter table public.storage_purge_queue add column outcome text
  check (outcome in ('removed', 'kept'));

-- Renvoie null si une exécution tourne déjà. Un passage interrompu libère le verrou après 15 minutes.
create function public.begin_maintenance_run()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
begin
  update public.maintenance_runs r
  set status = 'expired', finished_at = now(), error = 'interrompu'
  where r.status = 'running' and r.started_at < now() - interval '15 minutes';

  insert into public.maintenance_runs default values returning id into v_run;

  return v_run;
exception when unique_violation then
  return null;
end;
$$;

create function public.finish_maintenance_run(
  p_run uuid,
  p_status text,
  p_result jsonb,
  p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.maintenance_runs r
  set status = p_status, finished_at = now(), result = p_result, error = left(p_error, 300)
  where r.id = p_run and r.status = 'running';
$$;

-- Un fichier dit « orphelin » redevenu référencé depuis son inscription n'est jamais retiré.
-- Les retraits de modération et de suppression restent dus, même si une ligne cite encore le chemin.
create function public.next_storage_purge(p_limit integer)
returns table (id bigint, bucket text, path text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.storage_purge_queue q
  set done_at = now(), outcome = 'kept'
  where q.done_at is null
    and q.reason = 'orphan'
    and (
      exists (select 1 from public.product_images i where q.bucket = 'product-images' and i.path = q.path)
      or exists (
        select 1 from public.videos v
        where q.bucket = 'shop-videos' and q.path in (v.video_path, v.thumbnail_path)
      )
      or exists (
        select 1 from public.videos v
        where q.bucket = 'shop-videos' and v.id = private.safe_uuid(split_part(q.path, '/', 2))
      )
      or exists (
        select 1 from public.shops s where q.bucket = 'shop-assets' and q.path in (s.logo_path, s.cover_path)
      )
    );

  return query
  select q.id, q.bucket, q.path, q.attempts
  from public.storage_purge_queue q
  where q.done_at is null and q.attempts < 10
  order by q.id
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

revoke all on function public.begin_maintenance_run() from public, anon, authenticated;
revoke all on function public.finish_maintenance_run(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.next_storage_purge(integer) from public, anon, authenticated;

grant execute on function public.begin_maintenance_run() to service_role;
grant execute on function public.finish_maintenance_run(uuid, text, jsonb, text) to service_role;
grant execute on function public.next_storage_purge(integer) to service_role;

create or replace function private.purge_expired_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notifications n
  where n.created_at < now() - interval '180 days'
     or (n.read_at is not null and n.read_at < now() - interval '90 days');

  delete from public.storage_purge_queue q where q.done_at < now() - interval '30 days';

  delete from public.maintenance_runs r where r.started_at < now() - interval '90 days';

  select private.anonymize_expired_orders();
$$;
