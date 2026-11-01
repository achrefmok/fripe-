-- Fripe Walk : vidéos verticales des boutiques.
-- Les fichiers vont directement du navigateur au Storage ; la limite de taille est celle du bucket.

insert into public.platform_settings (key, value, description) values
  ('max_videos_per_shop', '30', 'Vidéos conservées par boutique'),
  ('max_video_seconds', '60', 'Durée maximale d''une vidéo'),
  ('max_video_bytes', '52428800', 'Taille maximale d''une vidéo, en octets');

create type public.video_status as enum ('draft', 'published', 'archived');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  description text check (char_length(description) <= 300),
  video_path text unique,
  thumbnail_path text,
  duration_seconds integer check (duration_seconds between 1 and 60),
  size_bytes bigint check (size_bytes > 0),
  width integer,
  height integer,
  status public.video_status not null default 'draft',
  moderated_at timestamptz,
  favorite_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_publishable check (
    status <> 'published'
    or (video_path is not null and thumbnail_path is not null and duration_seconds is not null)
  )
);

create index videos_feed_idx on public.videos (published_at desc, id) where status = 'published';
create index videos_shop_idx on public.videos (shop_id, created_at desc);

create trigger videos_set_updated_at
  before update on public.videos
  for each row execute function private.set_updated_at();

create table public.video_products (
  video_id uuid not null references public.videos (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 0,
  primary key (video_id, product_id)
);

create index video_products_product_idx on public.video_products (product_id);

create table public.video_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index video_favorites_video_idx on public.video_favorites (video_id);

create function private.count_video_favorites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.videos
  set favorite_count = favorite_count + case when tg_op = 'INSERT' then 1 else -1 end
  where id = coalesce(new.video_id, old.video_id);

  return null;
end;
$$;

revoke all on function private.count_video_favorites() from public;

create trigger video_favorites_count
  after insert or delete on public.video_favorites
  for each row execute function private.count_video_favorites();

create function public.create_video_draft(p_shop_id uuid, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_video uuid;
begin
  if p_shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('create_video', 20, 86400);

  select (s.value #>> '{}')::integer into v_limit
  from public.platform_settings s where s.key = 'max_videos_per_shop';

  if (
    select count(*) from public.videos v
    where v.shop_id = p_shop_id and v.status <> 'archived'
  ) >= coalesce(v_limit, 30) then
    raise exception 'video_quota_reached';
  end if;

  insert into public.videos (shop_id, description)
  values (p_shop_id, nullif(btrim(coalesce(p_description, '')), ''))
  returning id into v_video;

  return v_video;
end;
$$;

-- La taille vient des métadonnées réelles du Storage, jamais du navigateur.
create function public.finalize_video(
  p_video_id uuid,
  p_video_path text,
  p_thumbnail_path text,
  p_duration_seconds integer,
  p_width integer,
  p_height integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_video public.videos%rowtype;
  v_size bigint;
  v_max_size bigint;
  v_max_seconds integer;
  v_prefix text;
begin
  select * into v_video from public.videos v where v.id = p_video_id for update;

  if v_video.id is null or v_video.shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.shops s where s.id = v_video.shop_id and s.status = 'approved') then
    raise exception 'shop_not_approved';
  end if;

  v_prefix := v_video.shop_id::text || '/' || v_video.id::text || '/';

  if not starts_with(p_video_path, v_prefix) or not starts_with(p_thumbnail_path, v_prefix) then
    raise exception 'forbidden';
  end if;

  select (o.metadata ->> 'size')::bigint into v_size
  from storage.objects o
  where o.bucket_id = 'shop-videos' and o.name = p_video_path;

  if v_size is null
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'shop-videos' and o.name = p_thumbnail_path
    ) then
    raise exception 'video_missing';
  end if;

  select (s.value #>> '{}')::bigint into v_max_size
  from public.platform_settings s where s.key = 'max_video_bytes';

  select (s.value #>> '{}')::integer into v_max_seconds
  from public.platform_settings s where s.key = 'max_video_seconds';

  if v_size > coalesce(v_max_size, 52428800) then
    raise exception 'video_too_large';
  end if;

  if p_duration_seconds < 1 or p_duration_seconds > coalesce(v_max_seconds, 60) then
    raise exception 'video_too_long';
  end if;

  update public.videos v
  set video_path = p_video_path,
      thumbnail_path = p_thumbnail_path,
      duration_seconds = p_duration_seconds,
      size_bytes = v_size,
      width = p_width,
      height = p_height,
      status = 'published',
      published_at = coalesce(v.published_at, now())
  where v.id = p_video_id;
end;
$$;

create function public.set_video_status(p_video_id uuid, p_status public.video_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_video public.videos%rowtype;
begin
  select * into v_video from public.videos v where v.id = p_video_id for update;

  if v_video.id is null or v_video.shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if p_status = 'published' and v_video.moderated_at is not null then
    raise exception 'moderated';
  end if;

  if p_status = 'published' and v_video.video_path is null then
    raise exception 'video_missing';
  end if;

  update public.videos v
  set status = p_status,
      published_at = case when p_status = 'published' then coalesce(v.published_at, now()) else v.published_at end
  where v.id = p_video_id;
end;
$$;

create function public.set_video_products(p_video_id uuid, p_product_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select v.shop_id into v_shop from public.videos v where v.id = p_video_id for update;

  if v_shop is null or v_shop not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if cardinality(p_product_ids) > 8 then
    raise exception 'too_many_items';
  end if;

  if exists (
    select 1 from unnest(p_product_ids) i
    where not exists (select 1 from public.products p where p.id = i and p.shop_id = v_shop)
  ) then
    raise exception 'forbidden';
  end if;

  delete from public.video_products vp where vp.video_id = p_video_id;

  insert into public.video_products (video_id, product_id, position)
  select p_video_id, i.id, i.position::integer
  from unnest(p_product_ids) with ordinality as i (id, position);
end;
$$;

revoke all on function public.create_video_draft(uuid, text) from public, anon;
revoke all on function public.finalize_video(uuid, text, text, integer, integer, integer) from public, anon;
revoke all on function public.set_video_status(uuid, public.video_status) from public, anon;
revoke all on function public.set_video_products(uuid, uuid[]) from public, anon;

grant execute on function public.create_video_draft(uuid, text) to authenticated;
grant execute on function public.finalize_video(uuid, text, text, integer, integer, integer) to authenticated;
grant execute on function public.set_video_status(uuid, public.video_status) to authenticated;
grant execute on function public.set_video_products(uuid, uuid[]) to authenticated;

alter table public.videos enable row level security;
alter table public.video_products enable row level security;
alter table public.video_favorites enable row level security;

revoke all on public.videos, public.video_products, public.video_favorites from anon, authenticated;

grant select on public.videos, public.video_products to anon, authenticated;
grant update (description) on public.videos to authenticated;
grant delete on public.videos to authenticated;
grant select, insert, delete on public.video_favorites to authenticated;

create policy videos_select_visible on public.videos
  for select to anon, authenticated
  using (
    (
      status = 'published'
      and moderated_at is null
      and shop_id in (select s.id from public.shops s where s.status = 'approved')
    )
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy videos_update_members on public.videos
  for update to authenticated
  using (shop_id in (select private.my_writable_shop_ids()))
  with check (shop_id in (select private.my_writable_shop_ids()));

create policy videos_delete_members on public.videos
  for delete to authenticated
  using (shop_id in (select private.my_writable_shop_ids()));

create policy video_products_select_visible on public.video_products
  for select to anon, authenticated
  using (video_id in (select v.id from public.videos v));

create policy video_favorites_select_own on public.video_favorites
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy video_favorites_insert_own on public.video_favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy video_favorites_delete_own on public.video_favorites
  for delete to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-videos', 'shop-videos', true, 52428800,
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/webp']
);

create policy shop_videos_select_members on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shop-videos'
    and private.safe_uuid((storage.foldername(name))[1]) in (select private.my_shop_ids())
  );

create policy shop_videos_insert_members on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-videos'
    and private.safe_uuid((storage.foldername(name))[1]) in (select private.my_writable_shop_ids())
  );

create policy shop_videos_delete_members on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-videos'
    and private.safe_uuid((storage.foldername(name))[1]) in (select private.my_writable_shop_ids())
  );
