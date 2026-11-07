-- Un vendeur, une boutique. La création refuse déjà au-delà du réglage (message « shop_limit_reached ») ;
-- l'index garantit la règle par tous les chemins, y compris un transfert de propriété.
-- Aucune donnée n'est supprimée : la migration échoue si un compte possède déjà plusieurs boutiques.

update public.platform_settings
set value = '1'::jsonb,
    description = 'Nombre maximal de boutiques par compte : une seule'
where key = 'max_shops_per_user';

create unique index if not exists shop_members_one_owned_shop
  on public.shop_members (user_id)
  where role = 'owner';
