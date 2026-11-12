-- Live Shopping, signalisation par Supabase Realtime : la mise en relation WebRTC passe désormais
-- entièrement par le canal `broadcast` du Live, sans table intermédiaire. Chaque Live a deux sujets
-- privés, contrôlés par les règles ci-dessous :
--   live-video:<id>        les demandes des spectateurs. Lecture et écriture pour tout spectateur.
--   live-video:<id>:shop   les réponses et le compteur de la boutique. Lecture pour tous, écriture
--                          réservée à l'équipe de la boutique : un spectateur ne peut donc recevoir
--                          que la vidéo de la vraie boutique.
-- Les deux sujets ne sont ouverts que pendant que le Live est en direct (`start_live` / `end_live`).

drop function public.send_live_signal(uuid, text, text, jsonb);
drop table public.live_signals;

create function private.live_video_access(p_topic text, p_write boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_shop uuid;
begin
  v_parts := regexp_match(
    coalesce(p_topic, ''),
    '^live-video:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(:shop)?$',
    'i'
  );

  if v_parts is null then
    return false;
  end if;

  select shop_id into v_shop from public.lives where id = v_parts[1]::uuid and status = 'live';

  if v_shop is null then
    return false;
  end if;

  -- Le sujet des demandes est ouvert à tous les spectateurs.
  if v_parts[2] is null or not p_write then
    return true;
  end if;

  return private.has_shop_role(v_shop, array['owner', 'manager', 'staff']::public.shop_role[]);
end;
$$;

revoke all on function private.live_video_access(text, boolean) from public;
grant execute on function private.live_video_access(text, boolean) to anon, authenticated, service_role;

-- Realtime vérifie ces règles quand un appareil rejoint un canal privé, puis les garde en mémoire
-- le temps de la connexion.
create policy live_video_read on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.live_video_access((select realtime.topic()), false)
  );

create policy live_video_write on realtime.messages
  for insert to anon, authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and private.live_video_access((select realtime.topic()), true)
  );
