-- Modération automatique des médias envoyés (photos de produits et d'annonces, logos, vidéos Walk).
-- L'analyse se fait côté serveur (src/features/media-moderation) ; cette migration garde la trace de
-- chaque blocage ou signalement, applique la sanction et prévient les administrateurs.
--
-- Additif : aucune donnée existante n'est modifiée.

create table public.media_moderation_events (
  id uuid primary key default gen_random_uuid(),
  -- Sans clé étrangère : le rapport survit à la suppression du compte (preuve d'abus).
  user_id uuid not null,
  media_kind text not null check (media_kind in ('image', 'video')),
  context text not null check (context in ('product_image', 'listing_image', 'shop_logo', 'shop_video', 'video_thumbnail')),
  decision text not null check (decision in ('block', 'flag')),
  category text not null check (category in ('sexual_explicit', 'sexual_erotica', 'sexual_suggestive', 'ai_generated')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  reason text not null check (char_length(reason) between 3 and 1000),
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  ai_signals jsonb not null default '[]'::jsonb check (jsonb_typeof(ai_signals) = 'array'),
  provider text not null check (char_length(provider) between 1 and 40),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  sanction text not null default 'none' check (sanction in ('none', 'suspended', 'already_suspended', 'protected_account')),
  attempts_30d integer not null default 0 check (attempts_30d >= 0),
  created_at timestamptz not null default now()
);

create index media_moderation_events_created_idx on public.media_moderation_events (created_at desc);
create index media_moderation_events_user_idx on public.media_moderation_events (user_id, created_at desc);

-- Historique en ajout seul, comme le journal d'audit.
create trigger media_moderation_events_no_update
  before update or delete on public.media_moderation_events
  for each row execute function private.reject_audit_change();

alter table public.media_moderation_events enable row level security;
revoke all on public.media_moderation_events from anon, authenticated;
grant select on public.media_moderation_events to authenticated;
-- Clé de service : droits explicites, comme pour les tables précédentes (20261107000001).
grant select, insert on public.media_moderation_events to service_role;

create policy media_moderation_events_select_admin on public.media_moderation_events
  for select to authenticated
  using ((select private.is_platform_admin()));

-- Les administrateurs reçoivent une notification par média bloqué.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('drop_alert', 'listing_message', 'media_blocked'));
alter table public.notifications
  add column media_event_id uuid references public.media_moderation_events (id) on delete cascade;

-- Enregistre un verdict et applique la sanction selon la gravité (tentatives sur 30 jours glissants,
-- la tentative en cours comprise) :
--   critique (sexuel explicite, score très haut) : suspension immédiate ;
--   élevée   (sexuel explicite)                  : suspension à la 2e tentative ;
--   moyenne  (érotique, +18)                     : suspension à la 3e tentative ;
--   faible   (simple signalement)                : jamais de sanction.
-- Un compte administrateur n'est jamais suspendu automatiquement (règle de set_user_status).
-- Réservée au serveur (clé secrète) : le navigateur ne peut ni l'appeler ni écrire dans la table.
create function public.record_media_moderation(
  p_user_id uuid,
  p_media_kind text,
  p_context text,
  p_decision text,
  p_category text,
  p_severity text,
  p_reason text,
  p_scores jsonb,
  p_ai_signals jsonb,
  p_provider text,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.account_status;
  v_event uuid;
  v_attempts integer := 0;
  v_threshold integer;
  v_sanction text := 'none';
begin
  select p.status into v_status from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if p_decision = 'block' and p_category in ('sexual_explicit', 'sexual_erotica') then
    select count(*)::integer + 1 into v_attempts
    from public.media_moderation_events e
    where e.user_id = p_user_id
      and e.decision = 'block'
      and e.category in ('sexual_explicit', 'sexual_erotica')
      and e.created_at > now() - interval '30 days';

    v_threshold := case p_severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 end;

    if v_threshold is not null and v_attempts >= v_threshold then
      if exists (select 1 from public.platform_admins a where a.user_id = p_user_id) then
        v_sanction := 'protected_account';
      elsif v_status = 'active' then
        update public.profiles p set status = 'suspended' where p.id = p_user_id;
        v_sanction := 'suspended';
      else
        v_sanction := 'already_suspended';
      end if;
    end if;
  end if;

  insert into public.media_moderation_events (
    user_id, media_kind, context, decision, category, severity, reason,
    scores, ai_signals, provider, sha256, sanction, attempts_30d
  ) values (
    p_user_id, p_media_kind, p_context, p_decision, p_category, p_severity, left(p_reason, 1000),
    coalesce(p_scores, '{}'::jsonb), coalesce(p_ai_signals, '[]'::jsonb), p_provider, p_sha256, v_sanction, v_attempts
  )
  returning id into v_event;

  perform private.log_audit(
    'media.' || p_decision, 'user', p_user_id::text,
    jsonb_build_object('event', v_event, 'context', p_context, 'category', p_category, 'severity', p_severity, 'sanction', v_sanction)
  );

  if v_sanction = 'suspended' then
    perform private.log_audit(
      'user.auto_suspended', 'user', p_user_id::text,
      jsonb_build_object('event', v_event, 'category', p_category, 'severity', p_severity, 'attempts', v_attempts)
    );
  end if;

  if p_decision = 'block' then
    insert into public.notifications (user_id, kind, media_event_id)
    select a.user_id, 'media_blocked', v_event
    from public.platform_admins a
    join public.profiles p on p.id = a.user_id and p.status = 'active';
  end if;

  return jsonb_build_object('event_id', v_event, 'suspended', v_sanction = 'suspended', 'sanction', v_sanction, 'attempts', v_attempts);
end;
$$;

revoke all on function public.record_media_moderation(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.record_media_moderation(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text) to service_role;
