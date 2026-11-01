-- Fichiers : file de suppression durable, retrait réel des fichiers modérés, brouillons abandonnés.
-- Les buckets restent publics : toutes les pages lisent les images par URL publique. La base ne peut
-- pas effacer un objet Storage, elle inscrit donc le travail ici ; `/api/internal/maintenance` et les
-- décisions de modération l'exécutent avec la clé secrète, côté serveur.

create table public.storage_purge_queue (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  reason text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create unique index storage_purge_queue_pending
  on public.storage_purge_queue (bucket, path) where done_at is null;

alter table public.storage_purge_queue enable row level security;
revoke all on public.storage_purge_queue from anon, authenticated;

create function private.enqueue_file(p_bucket text, p_path text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.storage_purge_queue (bucket, path, reason)
  select p_bucket, p_path, p_reason
  where p_path is not null
  on conflict do nothing;
$$;

revoke all on function private.enqueue_file(text, text, text) from public;

-- Une image retirée disparaît aussi de l'historique : la commande garde titre et prix.
create function private.release_product_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_items i set image_path = null where i.image_path = old.path;
  perform private.enqueue_file('product-images', old.path, 'image_removed');
  return null;
end;
$$;

revoke all on function private.release_product_image() from public;

create trigger product_images_release
  after delete on public.product_images
  for each row execute function private.release_product_image();

create function private.purge_moderated_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.moderated_at is null and new.moderated_at is not null then
    delete from public.product_images i where i.product_id = new.id;
  end if;

  return null;
end;
$$;

revoke all on function private.purge_moderated_product() from public;

create trigger products_purge_moderated
  after update of moderated_at on public.products
  for each row execute function private.purge_moderated_product();

create function private.release_video_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.videos%rowtype := coalesce(new, old);
begin
  if tg_op = 'DELETE' or (old.moderated_at is null and new.moderated_at is not null) then
    perform private.enqueue_file('shop-videos', v_row.video_path, 'video_removed');
    perform private.enqueue_file('shop-videos', v_row.thumbnail_path, 'video_removed');
  end if;

  return null;
end;
$$;

revoke all on function private.release_video_files() from public;

create trigger videos_release_files
  after delete or update of moderated_at on public.videos
  for each row execute function private.release_video_files();

-- Brouillons abandonnés, puis fichiers qu'aucune ligne ne référence. Le délai laisse finir un envoi
-- en cours : un fichier récent n'est jamais touché.
create function private.sweep_abandoned_files()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit timestamptz := now() - interval '24 hours';
  v_count integer;
begin
  delete from public.videos v where v.status = 'draft' and v.created_at < v_limit;

  with orphans as (
    select o.bucket_id, o.name
    from storage.objects o
    where o.created_at < v_limit
      and (
        (o.bucket_id = 'shop-videos' and not exists (
          select 1 from public.videos v where v.id = private.safe_uuid(split_part(o.name, '/', 2))
        ))
        or (o.bucket_id = 'product-images' and not exists (
          select 1 from public.product_images i where i.path = o.name
        ))
        or (o.bucket_id = 'shop-assets' and not exists (
          select 1 from public.shops s where o.name in (s.logo_path, s.cover_path)
        ))
      )
  ),
  queued as (
    insert into public.storage_purge_queue (bucket, path, reason)
    select bucket_id, name, 'orphan' from orphans
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from queued;

  return v_count;
end;
$$;

revoke all on function private.sweep_abandoned_files() from public;

select cron.schedule('sweep-abandoned-files', '23 * * * *', 'select private.sweep_abandoned_files()');

-- Dépôts : un produit réel de sa boutique, dans la limite de ses 8 photos ; rien pour une pièce
-- modérée. Les logos sont bornés. Aucun écran n'envoie d'avatar : l'écriture est fermée.
create function private.product_image_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    where p.id = private.safe_uuid(split_part(p_name, '/', 2))
      and p.shop_id = private.safe_uuid(split_part(p_name, '/', 1))
      and p.moderated_at is null
      and p.shop_id in (select private.my_writable_shop_ids())
  )
  and (
    select count(*) from storage.objects o
    where o.bucket_id = 'product-images'
      and starts_with(o.name, split_part(p_name, '/', 1) || '/' || split_part(p_name, '/', 2) || '/')
  ) < 12;
$$;

create function private.shop_asset_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.safe_uuid(split_part(p_name, '/', 1)) in (select private.my_writable_shop_ids())
    and private.has_shop_role(
      private.safe_uuid(split_part(p_name, '/', 1)),
      array['owner', 'manager']::public.shop_role[]
    )
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'shop-assets' and starts_with(o.name, split_part(p_name, '/', 1) || '/')
    ) < 10;
$$;

revoke all on function private.product_image_upload_allowed(text) from public;
revoke all on function private.shop_asset_upload_allowed(text) from public;
grant execute on function private.product_image_upload_allowed(text) to authenticated;
grant execute on function private.shop_asset_upload_allowed(text) to authenticated;

drop policy product_images_insert_members on storage.objects;
create policy product_images_insert_members on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.product_image_upload_allowed(name));

drop policy shop_assets_insert_managers on storage.objects;
create policy shop_assets_insert_managers on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-assets' and private.shop_asset_upload_allowed(name));

-- Aucun envoi ne remplace un fichier : déplacer ou écraser contournerait les contrôles ci-dessus.
drop policy product_images_update_members on storage.objects;
drop policy shop_assets_update_managers on storage.objects;
drop policy avatars_insert_own on storage.objects;
drop policy avatars_update_own on storage.objects;
