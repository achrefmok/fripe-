-- Buckets de la phase 1. Les chemins commencent par l'identifiant du propriétaire :
-- {user_id}/… pour les avatars, {shop_id}/… pour les ressources de boutique.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('shop-assets', 'shop-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy shop_assets_select_managers on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.has_shop_role(
      private.safe_uuid((storage.foldername(name))[1]),
      array['owner', 'manager']::public.shop_role[]
    )
  );

create policy shop_assets_insert_managers on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-assets'
    and private.has_shop_role(
      private.safe_uuid((storage.foldername(name))[1]),
      array['owner', 'manager']::public.shop_role[]
    )
  );

create policy shop_assets_update_managers on storage.objects
  for update to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.has_shop_role(
      private.safe_uuid((storage.foldername(name))[1]),
      array['owner', 'manager']::public.shop_role[]
    )
  )
  with check (
    bucket_id = 'shop-assets'
    and private.has_shop_role(
      private.safe_uuid((storage.foldername(name))[1]),
      array['owner', 'manager']::public.shop_role[]
    )
  );

create policy shop_assets_delete_managers on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.has_shop_role(
      private.safe_uuid((storage.foldername(name))[1]),
      array['owner', 'manager']::public.shop_role[]
    )
  );
