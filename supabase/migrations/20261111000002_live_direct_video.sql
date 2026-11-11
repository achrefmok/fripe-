-- Live Shopping, vidéo directe : la vidéo va du téléphone de la boutique à chaque spectateur
-- (WebRTC), sans service de diffusion. Pour s'établir, la liaison a besoin d'un échange de
-- « signaux ». Le spectateur envoie sa demande par un canal temps réel public ; la réponse de la
-- boutique passe par cette table, écrite uniquement par une fonction qui vérifie son rôle : un
-- spectateur ne peut donc recevoir que la vidéo de la vraie boutique.

create table public.live_signals (
  id bigint generated always as identity primary key,
  live_id uuid not null references public.lives (id) on delete cascade,
  -- Identifiant aléatoire choisi par le navigateur du spectateur pour cette visite.
  viewer_key text not null check (char_length(viewer_key) between 16 and 64),
  kind text not null check (kind in ('answer', 'full')),
  payload jsonb not null default '{}'::jsonb check (pg_column_size(payload) <= 16384),
  created_at timestamptz not null default now()
);

create index live_signals_live_idx on public.live_signals (live_id, id);

alter table public.live_signals enable row level security;

revoke all on public.live_signals from anon, authenticated;
grant select on public.live_signals to anon, authenticated;
grant all on public.live_signals to service_role;

-- Lisible par quiconque peut voir le Live : la réponse ne contient que la description technique
-- de la liaison vidéo de la boutique.
create policy live_signals_select on public.live_signals
  for select to anon, authenticated
  using (live_id in (select l.id from public.lives l));

-- La boutique répond à un spectateur. Les signaux de plus de dix minutes sont effacés au passage.
create function public.send_live_signal(p_live_id uuid, p_viewer_key text, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select shop_id into v_shop from public.lives where id = p_live_id and status = 'live';

  if v_shop is null or not private.has_shop_role(v_shop, array['owner', 'manager', 'staff']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  if p_kind not in ('answer', 'full') or char_length(coalesce(p_viewer_key, '')) not between 16 and 64 then
    raise exception 'message_invalid';
  end if;

  delete from public.live_signals where live_id = p_live_id and created_at < now() - interval '10 minutes';

  insert into public.live_signals (live_id, viewer_key, kind, payload)
  values (p_live_id, p_viewer_key, p_kind, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public.send_live_signal(uuid, text, text, jsonb) from public, anon;
grant execute on function public.send_live_signal(uuid, text, text, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_signals;
  end if;
end;
$$;
