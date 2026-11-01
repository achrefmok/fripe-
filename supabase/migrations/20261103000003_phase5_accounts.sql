-- Suppression de compte. Règles et décisions à valider : docs/suppression-de-compte.md.
-- L'identité disparaît ; les faits commerciaux restent, sans lien vers la personne.

alter table public.orders alter column client_id drop not null;
alter table public.orders drop constraint orders_client_id_fkey;
alter table public.orders add constraint orders_client_id_fkey
  foreign key (client_id) references public.profiles (id) on delete set null;

alter table public.order_groups alter column client_id drop not null;
alter table public.order_groups alter column phone drop not null;
alter table public.order_groups drop constraint order_groups_client_id_fkey;
alter table public.order_groups add constraint order_groups_client_id_fkey
  foreign key (client_id) references public.profiles (id) on delete set null;

alter table public.reservations alter column client_id drop not null;
alter table public.reservations drop constraint reservations_client_id_fkey;
alter table public.reservations add constraint reservations_client_id_fkey
  foreign key (client_id) references public.profiles (id) on delete set null;

alter table public.conversations alter column client_id drop not null;
alter table public.conversations drop constraint conversations_client_id_fkey;
alter table public.conversations add constraint conversations_client_id_fkey
  foreign key (client_id) references public.profiles (id) on delete set null;

alter table public.stock_requests alter column client_id drop not null;
alter table public.stock_requests drop constraint stock_requests_client_id_fkey;
alter table public.stock_requests add constraint stock_requests_client_id_fkey
  foreign key (client_id) references public.profiles (id) on delete set null;

-- La fiche d'authentification est retirée ensuite, avec la clé secrète : cette ligne garantit la
-- reprise si cette seconde étape échoue. Elle ne contient aucune donnée personnelle.
create table if not exists public.account_deletions (
  user_id uuid primary key,
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  completed_at timestamptz
);

alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;

insert into public.platform_settings (key, value, description) values
  ('order_personal_data_retention_days', 'null',
   'Jours de conservation des coordonnées de commande après suppression du compte. Vide : conservées, durée à fixer')
on conflict (key) do nothing;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_shops uuid[];
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  if exists (select 1 from public.platform_admins a where a.user_id = v_user) then
    raise exception 'protected_account';
  end if;

  perform private.enforce_rate_limit('delete_account', 5, 86400);

  select coalesce(array_agg(m.shop_id), '{}') into v_shops
  from public.shop_members m where m.user_id = v_user and m.role = 'owner';

  if exists (
    select 1 from public.orders o
    where o.status in ('pending', 'confirmed', 'preparing', 'shipped')
      and (o.client_id = v_user or o.shop_id = any (v_shops))
  ) then
    raise exception 'account_has_active_orders';
  end if;

  update public.products p
  set status = 'available'
  from public.reservations r
  where r.product_id = p.id
    and r.status = 'active'
    and (r.client_id = v_user or r.shop_id = any (v_shops))
    and p.status = 'reserved';

  update public.reservations r
  set status = 'cancelled'
  where r.status = 'active' and (r.client_id = v_user or r.shop_id = any (v_shops));

  -- Boutiques possédées : fermées, sans contenu public. Commandes et avis gardent leur référence.
  delete from public.videos v where v.shop_id = any (v_shops);

  delete from public.product_images i
  where i.product_id in (select p.id from public.products p where p.shop_id = any (v_shops));

  update public.products p set publication_status = 'archived' where p.shop_id = any (v_shops);
  update public.collections c set is_published = false where c.shop_id = any (v_shops);
  update public.inventory_items i set is_visible = false where i.shop_id = any (v_shops);
  delete from public.shop_addresses a where a.shop_id = any (v_shops);
  update public.conversations c set closed_at = coalesce(c.closed_at, now()) where c.shop_id = any (v_shops);
  update public.stock_requests r set status = 'closed' where r.shop_id = any (v_shops);

  perform private.enqueue_file('shop-assets', s.logo_path, 'account_deleted'),
          private.enqueue_file('shop-assets', s.cover_path, 'account_deleted')
  from public.shops s where s.id = any (v_shops);

  update public.shops s
  set status = 'closed', description = null, phone = null, logo_path = null, cover_path = null,
      review_note = null
  where s.id = any (v_shops);

  delete from public.shop_members m where m.shop_id = any (v_shops) or m.user_id = v_user;

  -- Compte client : ce qu'il a écrit quitte le service, les faits de vente restent.
  update public.messages m
  set body = '[message supprimé]'
  where m.sender_side = 'client'
    and m.conversation_id in (select c.id from public.conversations c where c.client_id = v_user);

  update public.conversations c
  set client_name = 'Compte supprimé', closed_at = coalesce(c.closed_at, now()), client_id = null
  where c.client_id = v_user;

  update public.stock_requests r
  set status = 'closed', client_name = 'Compte supprimé', message = '[demande supprimée]',
      size = null, color = null, brand = null, budget_millimes = null, client_id = null
  where r.client_id = v_user;

  update public.reviews r
  set author_name = 'Client', comment = null, client_id = null
  where r.client_id = v_user;

  delete from public.favorites f where f.user_id = v_user;
  delete from public.video_favorites f where f.user_id = v_user;
  delete from public.shop_followers f where f.user_id = v_user;
  delete from public.cart_items c where c.user_id = v_user;
  delete from public.notifications n where n.user_id = v_user;
  delete from public.notification_preferences n where n.user_id = v_user;
  delete from public.drop_alerts a where a.user_id = v_user;
  delete from public.style_preferences s where s.user_id = v_user;
  delete from public.outfits o where o.user_id = v_user;
  delete from public.user_blocks b where b.client_id = v_user;

  update public.profiles p
  set display_name = 'Compte supprimé', phone = null, avatar_path = null, status = 'deleted'
  where p.id = v_user;

  insert into public.account_deletions (user_id) values (v_user);

  perform private.log_audit(
    'account.deleted', 'user', v_user::text, jsonb_build_object('shops', cardinality(v_shops))
  );
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Un compte supprimé ne revient pas, ni par une réactivation ni par une décision de modération.
create function private.guard_deleted_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'deleted' and new.status <> 'deleted' then
    raise exception 'invalid_transition';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_deleted_profile() from public;

create trigger profiles_guard_deleted
  before update of status on public.profiles
  for each row execute function private.guard_deleted_profile();

-- Coordonnées de commande : conservées tant que la durée n'est pas fixée par une décision humaine.
create function private.anonymize_expired_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_count integer;
begin
  select (s.value #>> '{}')::integer into v_days
  from public.platform_settings s where s.key = 'order_personal_data_retention_days';

  if v_days is null then
    return 0;
  end if;

  update public.order_groups g
  set recipient_name = 'Compte supprimé', phone = null, address_line = null
  where g.client_id is null
    and g.phone is not null
    and g.created_at < now() - make_interval(days => v_days);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.anonymize_expired_orders() from public;

-- Données qui expirent : notifications anciennes et file de suppression déjà traitée.
create function private.purge_expired_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notifications n
  where n.created_at < now() - interval '180 days'
     or (n.read_at is not null and n.read_at < now() - interval '90 days');

  delete from public.storage_purge_queue q where q.done_at < now() - interval '30 days';

  select private.anonymize_expired_orders();
$$;

revoke all on function private.purge_expired_data() from public;

select cron.schedule('purge-expired-data', '41 3 * * *', 'select private.purge_expired_data()');

-- Traçabilité : l'attribution du rôle d'administrateur et les réglages sont des actions sensibles.
create function private.audit_sensitive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  perform private.log_audit(
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'user_id', v_row ->> 'key'),
    case when tg_table_name = 'platform_settings'
      then jsonb_build_object('from', to_jsonb(old) -> 'value', 'to', to_jsonb(new) -> 'value')
      else '{}'::jsonb
    end
  );

  return null;
end;
$$;

revoke all on function private.audit_sensitive() from public;

create trigger platform_admins_audit
  after insert or delete on public.platform_admins
  for each row execute function private.audit_sensitive();

create trigger platform_settings_audit
  after update on public.platform_settings
  for each row execute function private.audit_sensitive();

-- Écritures directes : les autres écritures passent par des RPC déjà limitées en débit.
-- Les tâches serveur n'ont pas d'utilisateur et ne sont pas concernées.
create function private.limit_direct_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    perform private.enforce_rate_limit(tg_argv[0], tg_argv[1]::integer, tg_argv[2]::integer);
  end if;

  return new;
end;
$$;

revoke all on function private.limit_direct_insert() from public;

create trigger products_rate_limit
  before insert on public.products
  for each row execute function private.limit_direct_insert('insert_product', '5000', '86400');

create trigger favorites_rate_limit
  before insert on public.favorites
  for each row execute function private.limit_direct_insert('insert_favorite', '300', '3600');

create trigger video_favorites_rate_limit
  before insert on public.video_favorites
  for each row execute function private.limit_direct_insert('insert_favorite', '300', '3600');

create trigger shop_followers_rate_limit
  before insert on public.shop_followers
  for each row execute function private.limit_direct_insert('insert_follow', '200', '3600');

create trigger cart_items_rate_limit
  before insert on public.cart_items
  for each row execute function private.limit_direct_insert('insert_cart', '300', '3600');
