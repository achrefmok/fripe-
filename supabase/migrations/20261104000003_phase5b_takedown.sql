-- Retrait d'urgence. Suspendre une boutique est réversible et garde ses fichiers : ces deux fonctions
-- servent au contenu dangereux, sans attendre un signalement, et leur retrait de fichiers est définitif.

create function public.moderate_video(p_video_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'note_required';
  end if;

  update public.videos v
  set status = 'archived', moderated_at = coalesce(v.moderated_at, now())
  where v.id = p_video_id;

  if not found then
    raise exception 'not_found';
  end if;

  perform private.log_audit('video.moderated', 'video', p_video_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create function public.emergency_takedown(p_shop_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_products integer;
  v_videos integer;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'note_required';
  end if;

  if not exists (select 1 from public.shops s where s.id = p_shop_id) then
    raise exception 'not_found';
  end if;

  -- Les triggers de modération retirent photos et vidéos, et inscrivent leurs fichiers à purger.
  update public.products p
  set publication_status = 'archived', moderated_at = now()
  where p.shop_id = p_shop_id and p.moderated_at is null;

  get diagnostics v_products = row_count;

  update public.videos v
  set status = 'archived', moderated_at = now()
  where v.shop_id = p_shop_id and v.moderated_at is null;

  get diagnostics v_videos = row_count;

  perform private.enqueue_file('shop-assets', s.logo_path, 'takedown'),
          private.enqueue_file('shop-assets', s.cover_path, 'takedown')
  from public.shops s where s.id = p_shop_id;

  update public.shops s
  set status = case when s.status = 'closed' then s.status else 'suspended'::public.shop_status end,
      review_note = p_reason, logo_path = null, cover_path = null
  where s.id = p_shop_id;

  perform private.log_audit(
    'shop.emergency_takedown', 'shop', p_shop_id::text,
    jsonb_build_object('reason', p_reason, 'products', v_products, 'videos', v_videos)
  );
end;
$$;

revoke all on function public.moderate_video(uuid, text) from public, anon;
revoke all on function public.emergency_takedown(uuid, text) from public, anon;
grant execute on function public.moderate_video(uuid, text) to authenticated;
grant execute on function public.emergency_takedown(uuid, text) to authenticated;
