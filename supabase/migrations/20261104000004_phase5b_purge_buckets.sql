-- Storage répond sans erreur pour un bucket inconnu : une telle ligne serait marquée retirée sans
-- qu'aucun fichier ne le soit. Seuls les buckets du projet sont acceptés.
alter table public.storage_purge_queue
  add constraint storage_purge_queue_known_bucket
  check (bucket in ('avatars', 'shop-assets', 'product-images', 'shop-videos'));
