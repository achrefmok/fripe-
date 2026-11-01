-- Signalements et décisions de modération.
-- Un signalement de conversation fige un extrait : l'administrateur ne lit rien d'autre.

create type public.report_target as enum ('product', 'video', 'conversation');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.report_decision as enum ('dismiss', 'remove_content');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (reason in ('counterfeit', 'inappropriate', 'scam', 'harassment', 'other')),
  details text check (char_length(details) <= 500),
  snapshot jsonb not null default '{}'::jsonb,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);
create unique index reports_one_open
  on public.reports (reporter_id, target_type, target_id) where status = 'open';

-- Historique en ajout seul.
create table public.report_decisions (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  admin_id uuid,
  decision public.report_decision not null,
  note text not null check (char_length(note) between 3 and 500),
  created_at timestamptz not null default now()
);

create index report_decisions_report_idx on public.report_decisions (report_id);

create trigger report_decisions_append_only
  before update on public.report_decisions
  for each row execute function private.reject_audit_change();

create function public.create_report(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_snapshot jsonb;
  v_report uuid;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('create_report', 10, 86400);

  if p_target_type = 'product' then
    select jsonb_build_object('title', p.title, 'shop', s.name, 'shop_id', s.id) into v_snapshot
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = p_target_id and p.publication_status = 'published';
  elsif p_target_type = 'video' then
    select jsonb_build_object('title', v.description, 'shop', s.name, 'shop_id', s.id) into v_snapshot
    from public.videos v
    join public.shops s on s.id = v.shop_id
    where v.id = p_target_id and v.status = 'published';
  else
    select jsonb_build_object(
      'shop', s.name,
      'shop_id', s.id,
      'client', c.client_name,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object('side', x.sender_side, 'body', x.body, 'at', x.created_at) order by x.created_at)
        from (
          select m.sender_side, m.body, m.created_at from public.messages m
          where m.conversation_id = c.id order by m.created_at desc limit 20
        ) x
      ), '[]'::jsonb)
    ) into v_snapshot
    from public.conversations c
    join public.shops s on s.id = c.shop_id
    where c.id = p_target_id
      and (c.client_id = v_user or c.shop_id in (select private.my_shop_ids()));
  end if;

  if v_snapshot is null then
    raise exception 'not_found';
  end if;

  begin
    insert into public.reports (reporter_id, target_type, target_id, reason, details, snapshot)
    values (
      v_user, p_target_type, p_target_id, p_reason, nullif(btrim(coalesce(p_details, '')), ''),
      v_snapshot
    )
    returning id into v_report;
  exception when unique_violation then
    raise exception 'already_reported';
  end;

  return v_report;
end;
$$;

create function public.review_report(
  p_report_id uuid,
  p_decision public.report_decision,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'note_required';
  end if;

  select * into v_report from public.reports r where r.id = p_report_id for update;

  if v_report.id is null then
    raise exception 'not_found';
  end if;

  if v_report.status <> 'open' then
    raise exception 'invalid_transition';
  end if;

  if p_decision = 'remove_content' then
    if v_report.target_type = 'product' then
      update public.products p
      set publication_status = 'archived', moderated_at = now()
      where p.id = v_report.target_id;
    elsif v_report.target_type = 'video' then
      update public.videos v
      set status = 'archived', moderated_at = now()
      where v.id = v_report.target_id;
    else
      update public.conversations c set closed_at = now() where c.id = v_report.target_id;
    end if;
  end if;

  update public.reports r
  set status = case when p_decision = 'dismiss' then 'dismissed' else 'resolved' end::public.report_status
  where r.id = p_report_id;

  insert into public.report_decisions (report_id, admin_id, decision, note)
  values (p_report_id, (select auth.uid()), p_decision, p_note);

  perform private.log_audit(
    'report.' || p_decision::text,
    v_report.target_type::text,
    v_report.target_id::text,
    jsonb_build_object('report', p_report_id, 'note', p_note)
  );
end;
$$;

revoke all on function public.create_report(public.report_target, uuid, text, text) from public, anon;
revoke all on function public.review_report(uuid, public.report_decision, text) from public, anon;

grant execute on function public.create_report(public.report_target, uuid, text, text) to authenticated;
grant execute on function public.review_report(uuid, public.report_decision, text) to authenticated;

alter table public.reports enable row level security;
alter table public.report_decisions enable row level security;

revoke all on public.reports, public.report_decisions from anon, authenticated;

grant select on public.reports, public.report_decisions to authenticated;

create policy reports_select_scoped on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_platform_admin()));

create policy report_decisions_select_admin on public.report_decisions
  for select to authenticated
  using ((select private.is_platform_admin()));
