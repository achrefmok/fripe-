-- Audit de sécurité de la phase 4 : blocage appliqué partout, prix figés, fichiers et
-- opérations encadrés. Les règles métier du blocage sont décrites dans docs/securite-phase-4.md.

-- Blocage ------------------------------------------------------------------------------------

alter table public.user_blocks add column client_name text;

update public.user_blocks b
set client_name = c.client_name
from public.conversations c
where c.client_id = b.client_id and c.shop_id = b.shop_id;

-- Le contrôle vit sur les tables : une nouvelle route ne peut pas l'oublier.
create function private.enforce_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_shop uuid;
begin
  if tg_table_name = 'messages' then
    select c.client_id, c.shop_id into v_client, v_shop
    from public.conversations c where c.id = new.conversation_id;
  elsif tg_table_name = 'stock_request_offers' then
    select r.client_id, r.shop_id into v_client, v_shop
    from public.stock_requests r where r.id = new.request_id;
  else
    v_client := new.client_id;
    v_shop := new.shop_id;
  end if;

  if private.is_blocked(v_client, v_shop) then
    raise exception 'blocked';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_not_blocked() from public;

create trigger conversations_not_blocked
  before insert on public.conversations
  for each row execute function private.enforce_not_blocked();

create trigger messages_not_blocked
  before insert on public.messages
  for each row execute function private.enforce_not_blocked();

create trigger stock_requests_not_blocked
  before insert on public.stock_requests
  for each row execute function private.enforce_not_blocked();

create trigger stock_request_offers_not_blocked
  before insert on public.stock_request_offers
  for each row execute function private.enforce_not_blocked();

-- Un vendeur ne peut bloquer qu'un client qui l'a réellement contacté ou lui a acheté une pièce.
create function private.has_client_relation(p_client uuid, p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.conversations c where c.client_id = p_client and c.shop_id = p_shop)
    or exists (select 1 from public.stock_requests r where r.client_id = p_client and r.shop_id = p_shop)
    or exists (select 1 from public.orders o where o.client_id = p_client and o.shop_id = p_shop);
$$;

revoke all on function private.has_client_relation(uuid, uuid) from public;

create function private.apply_block(
  p_client uuid,
  p_shop uuid,
  p_side public.block_side,
  p_block boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('block', 30, 3600);

  if p_block then
    insert into public.user_blocks (client_id, shop_id, blocked_by, client_name)
    select p_client, p_shop, p_side, p.display_name
    from public.profiles p where p.id = p_client
    on conflict do nothing;

    update public.stock_requests r
    set status = 'closed'
    where r.client_id = p_client and r.shop_id = p_shop and r.status <> 'closed';
  else
    delete from public.user_blocks b
    where b.client_id = p_client and b.shop_id = p_shop and b.blocked_by = p_side;
  end if;

  perform private.log_audit(
    case when p_block then 'block.created' else 'block.lifted' end,
    'shop',
    p_shop::text,
    jsonb_build_object('client', p_client, 'side', p_side)
  );
end;
$$;

revoke all on function private.apply_block(uuid, uuid, public.block_side, boolean) from public;

create or replace function public.block_conversation(p_conversation_id uuid, p_block boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_side public.block_side;
begin
  select * into v_conversation from public.conversations c where c.id = p_conversation_id;

  if v_conversation.id is null then
    raise exception 'forbidden';
  end if;

  if v_conversation.client_id = (select auth.uid()) then
    v_side := 'client';
  elsif v_conversation.shop_id in (select private.my_writable_shop_ids()) then
    v_side := 'shop';
  else
    raise exception 'forbidden';
  end if;

  perform private.apply_block(v_conversation.client_id, v_conversation.shop_id, v_side, p_block);
end;
$$;

-- Côté client : bloquer une boutique, même sans conversation ouverte.
create function public.block_shop(p_shop_id uuid, p_block boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.shops s where s.id = p_shop_id) then
    raise exception 'not_found';
  end if;

  if p_shop_id in (select private.my_shop_ids()) then
    raise exception 'own_shop';
  end if;

  perform private.apply_block((select auth.uid()), p_shop_id, 'client', p_block);
end;
$$;

-- Côté boutique : bloquer un client à partir d'une relation existante.
create function public.block_client(p_shop_id uuid, p_client_id uuid, p_block boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_shop_id not in (select private.my_writable_shop_ids())
    or not private.has_client_relation(p_client_id, p_shop_id) then
    raise exception 'forbidden';
  end if;

  perform private.apply_block(p_client_id, p_shop_id, 'shop', p_block);
end;
$$;

revoke all on function public.block_shop(uuid, boolean) from public, anon;
revoke all on function public.block_client(uuid, uuid, boolean) from public, anon;
grant execute on function public.block_shop(uuid, boolean) to authenticated;
grant execute on function public.block_client(uuid, uuid, boolean) to authenticated;

-- Une boutique bloquée n'envoie plus d'alerte, dans un sens comme dans l'autre.
create or replace function private.dispatch_drop_alerts(p_product_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with fresh as (
    select p.id, p.shop_id, p.category_id, p.brand, p.size, p.price_millimes, p.published_at,
           c.parent_id
    from public.products p
    join public.shops s on s.id = p.shop_id and s.status = 'approved'
    left join public.categories c on c.id = p.category_id
    where p.id = any (p_product_ids) and p.publication_status = 'published'
  ),
  matches as (
    select distinct on (a.user_id, f.id)
      a.user_id, a.id as alert_id, f.id as product_id, f.published_at
    from public.drop_alerts a
    join fresh f on
      (cardinality(a.sizes) = 0 or lower(f.size) = any (a.sizes))
      and (cardinality(a.brands) = 0 or lower(f.brand) = any (a.brands))
      and (
        cardinality(a.category_ids) = 0
        or f.category_id = any (a.category_ids)
        or f.parent_id = any (a.category_ids)
      )
      and (cardinality(a.shop_ids) = 0 or f.shop_id = any (a.shop_ids))
      and (a.max_price_millimes is null or f.price_millimes <= a.max_price_millimes)
      and (
        not a.followed_only
        or exists (
          select 1 from public.shop_followers sf
          where sf.user_id = a.user_id and sf.shop_id = f.shop_id
        )
      )
    join public.profiles u on u.id = a.user_id and u.status = 'active'
    left join public.notification_preferences np on np.user_id = a.user_id
    where a.is_active
      and coalesce(np.in_app_enabled, true)
      and not exists (
        select 1 from public.shop_members m
        where m.shop_id = f.shop_id and m.user_id = a.user_id
      )
      and not private.is_blocked(a.user_id, f.shop_id)
    order by a.user_id, f.id, a.created_at
  ),
  ranked as (
    select m.*,
      row_number() over (partition by m.user_id order by m.published_at desc, m.product_id) as rank,
      coalesce(np.max_per_day, 10) - (
        select count(*) from public.notifications n
        where n.user_id = m.user_id
          and n.kind = 'drop_alert'
          and n.created_at > now() - interval '1 day'
      ) as remaining
    from matches m
    left join public.notification_preferences np on np.user_id = m.user_id
  ),
  inserted as (
    insert into public.notifications (user_id, kind, product_id, alert_id)
    select r.user_id, 'drop_alert', r.product_id, r.alert_id
    from ranked r
    where r.rank <= r.remaining
    on conflict (user_id, product_id, kind) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

-- Signalements --------------------------------------------------------------------------------

-- L'historique des décisions survit à la disparition du compte qui a signalé.
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;

alter table public.report_decisions drop constraint report_decisions_report_id_fkey;
alter table public.report_decisions
  add constraint report_decisions_report_id_fkey
  foreign key (report_id) references public.reports (id) on delete restrict;

create trigger report_decisions_no_delete
  before delete on public.report_decisions
  for each row execute function private.reject_audit_change();

-- Le snapshot des avis lit la table créée par la migration des avis : voir create_report
-- complété dans 20261102000004_phase4_reviews.sql.
create or replace function public.create_report(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_snapshot jsonb;
  v_report uuid;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('create_report', 10, 86400);

  if p_target_type = 'product' then
    select jsonb_build_object('title', p.title, 'shop', s.name, 'shop_id', s.id) into v_snapshot
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = p_target_id and p.publication_status = 'published';
  elsif p_target_type = 'video' then
    select jsonb_build_object('title', v.description, 'shop', s.name, 'shop_id', s.id) into v_snapshot
    from public.videos v
    join public.shops s on s.id = v.shop_id
    where v.id = p_target_id and v.status = 'published';
  elsif p_target_type = 'shop' then
    if p_target_id in (select private.my_shop_ids()) then
      raise exception 'own_shop';
    end if;

    select jsonb_build_object('title', s.slug, 'shop', s.name, 'shop_id', s.id) into v_snapshot
    from public.shops s
    where s.id = p_target_id and s.status = 'approved';
  elsif p_target_type = 'account' then
    -- Seule une boutique en relation avec ce client peut le signaler : pas d'énumération de comptes.
    select jsonb_build_object('client', p.display_name, 'shop', s.name, 'shop_id', s.id) into v_snapshot
    from public.profiles p
    join public.shops s on s.id in (select private.my_shop_ids())
    where p.id = p_target_id
      and p.id <> v_user
      and private.has_client_relation(p.id, s.id)
    limit 1;
  else
    select jsonb_build_object(
      'shop', s.name,
      'shop_id', s.id,
      'client', c.client_name,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object('side', x.sender_side, 'body', x.body, 'at', x.created_at) order by x.created_at)
        from (
          select m.sender_side, m.body, m.created_at from public.messages m
          where m.conversation_id = c.id order by m.created_at desc limit 20
        ) x
      ), '[]'::jsonb)
    ) into v_snapshot
    from public.conversations c
    join public.shops s on s.id = c.shop_id
    where c.id = p_target_id
      and (c.client_id = v_user or c.shop_id in (select private.my_shop_ids()));
  end if;

  if v_snapshot is null then
    raise exception 'not_found';
  end if;

  begin
    insert into public.reports (reporter_id, target_type, target_id, reason, details, snapshot)
    values (
      v_user, p_target_type, p_target_id, p_reason, nullif(btrim(coalesce(p_details, '')), ''),
      v_snapshot
    )
    returning id into v_report;
  exception when unique_violation then
    raise exception 'already_reported';
  end;

  perform private.log_audit(
    'report.created',
    p_target_type::text,
    p_target_id::text,
    jsonb_build_object('report', v_report, 'reason', p_reason)
  );

  return v_report;
end;
$$;

-- Fichiers -----------------------------------------------------------------------------------

-- Dépôt direct depuis le navigateur : uniquement vers un brouillon existant, ce qui soumet
-- chaque fichier au quota et à la limite de débit de create_video_draft.
create function private.video_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.videos v
    where v.id = private.safe_uuid(split_part(p_name, '/', 2))
      and v.shop_id = private.safe_uuid(split_part(p_name, '/', 1))
      and v.status = 'draft'
      and v.moderated_at is null
      and v.shop_id in (select private.my_writable_shop_ids())
  )
  and (
    select count(*) from storage.objects o
    where o.bucket_id = 'shop-videos' and starts_with(o.name, split_part(p_name, '/', 1) || '/' || split_part(p_name, '/', 2) || '/')
  ) < 4;
$$;

revoke all on function private.video_upload_allowed(text) from public;
grant execute on function private.video_upload_allowed(text) to authenticated;

drop policy shop_videos_insert_members on storage.objects;

create policy shop_videos_insert_members on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-videos' and private.video_upload_allowed(name));

create or replace function public.finalize_video(
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

  if v_video.moderated_at is not null then
    raise exception 'moderated';
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

-- Une vidéo modérée reste en base : la boutique ne peut pas effacer la trace de la décision.
drop policy videos_delete_members on public.videos;

create policy videos_delete_members on public.videos
  for delete to authenticated
  using (moderated_at is null and shop_id in (select private.my_writable_shop_ids()));

-- Un chemin d'image désigne toujours le dossier de sa boutique.
create function private.check_product_image_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = new.product_id and starts_with(new.path, p.shop_id::text || '/')
  ) then
    raise exception 'forbidden';
  end if;

  return new;
end;
$$;

revoke all on function private.check_product_image_path() from public;

create trigger product_images_own_folder
  before insert or update of path, product_id on public.product_images
  for each row execute function private.check_product_image_path();

alter table public.shops
  add constraint shops_logo_own_folder
    check (logo_path is null or starts_with(logo_path, id::text || '/')),
  add constraint shops_cover_own_folder
    check (cover_path is null or starts_with(cover_path, id::text || '/'));

alter table public.profiles
  add constraint profiles_avatar_own_folder
    check (avatar_path is null or starts_with(avatar_path, id::text || '/'));

-- Prix et commandes --------------------------------------------------------------------------

-- Une pièce réservée ou en commande garde le prix annoncé au client.
create function private.lock_reserved_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'reserved' and new.price_millimes is distinct from old.price_millimes then
    raise exception 'product_locked';
  end if;

  return new;
end;
$$;

revoke all on function private.lock_reserved_price() from public;

create trigger products_lock_reserved_price
  before update of price_millimes on public.products
  for each row execute function private.lock_reserved_price();

-- Le client s'engage sur un total : s'il a changé depuis l'affichage, la commande est refusée.
drop function public.place_order(uuid[], uuid[], text, text, smallint, integer, text);

create function public.place_order(
  p_product_ids uuid[],
  p_pickup_shop_ids uuid[],
  p_recipient_name text,
  p_phone text,
  p_governorate_id smallint,
  p_city_id integer,
  p_address_line text,
  p_expected_total integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_ids uuid[];
  v_locked integer;
  v_product public.products%rowtype;
  v_limit integer;
  v_group uuid;
  v_shop uuid;
  v_order uuid;
  v_subtotal integer;
  v_fee integer;
  v_fulfillment public.fulfillment_method;
  v_total integer := 0;
  v_needs_address boolean := false;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  select coalesce(array_agg(distinct i), '{}') into v_ids from unnest(p_product_ids) i;

  if cardinality(v_ids) = 0 or cardinality(v_ids) > 50 then
    raise exception 'empty_order';
  end if;

  perform private.enforce_rate_limit('place_order', 10, 3600);

  select (s.value #>> '{}')::integer into v_limit
  from public.platform_settings s where s.key = 'max_pending_orders';

  if (
    select count(*) from public.orders o where o.client_id = v_user and o.status = 'pending'
  ) >= coalesce(v_limit, 5) then
    raise exception 'too_many_pending_orders';
  end if;

  perform private.release_expired_reservations(i) from unnest(v_ids) i;

  -- Verrouillage dans l'ordre des identifiants : deux paniers croisés ne peuvent pas s'interbloquer.
  v_locked := 0;

  for v_product in
    select * from public.products p where p.id = any (v_ids) order by p.id for update
  loop
    v_locked := v_locked + 1;

    if v_product.publication_status <> 'published'
      or not exists (
        select 1 from public.shops s where s.id = v_product.shop_id and s.status = 'approved'
      ) then
      raise exception 'product_unavailable';
    end if;

    if v_product.shop_id in (select private.my_shop_ids()) then
      raise exception 'own_product';
    end if;

    if not (
      v_product.status = 'available'
      or (
        v_product.status = 'reserved'
        and exists (
          select 1 from public.reservations r
          where r.product_id = v_product.id
            and r.client_id = v_user
            and r.status = 'active'
            and r.expires_at > now()
        )
      )
    ) then
      raise exception 'product_unavailable';
    end if;
  end loop;

  if v_locked <> cardinality(v_ids) then
    raise exception 'product_unavailable';
  end if;

  select exists (
    select 1 from public.products p
    where p.id = any (v_ids) and not p.shop_id = any (coalesce(p_pickup_shop_ids, '{}'))
  ) into v_needs_address;

  if v_needs_address and (
    char_length(btrim(coalesce(p_address_line, ''))) < 5
    or not exists (
      select 1 from public.cities c
      where c.id = p_city_id and c.governorate_id = p_governorate_id
    )
  ) then
    raise exception 'address_required';
  end if;

  insert into public.order_groups (
    reference, client_id, recipient_name, phone, governorate_id, city_id, address_line
  )
  values (
    'FR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.order_reference_seq')::text, 6, '0'),
    v_user, p_recipient_name, p_phone,
    case when v_needs_address then p_governorate_id end,
    case when v_needs_address then p_city_id end,
    case when v_needs_address then btrim(p_address_line) end
  )
  returning id into v_group;

  for v_shop in
    select distinct p.shop_id from public.products p where p.id = any (v_ids)
  loop
    v_fulfillment := case
      when v_shop = any (coalesce(p_pickup_shop_ids, '{}')) then 'pickup'::public.fulfillment_method
      else 'delivery'::public.fulfillment_method
    end;

    v_fee := case
      when v_fulfillment = 'delivery' then private.delivery_fee(v_shop, p_governorate_id)
      else 0
    end;

    select sum(p.price_millimes) into v_subtotal
    from public.products p where p.id = any (v_ids) and p.shop_id = v_shop;

    insert into public.orders (
      group_id, shop_id, client_id, fulfillment, subtotal_millimes, delivery_fee_millimes,
      total_millimes
    )
    values (v_group, v_shop, v_user, v_fulfillment, v_subtotal, v_fee, v_subtotal + v_fee)
    returning id into v_order;

    insert into public.order_items (
      order_id, product_id, title, brand, size, condition, reference, image_path, price_millimes
    )
    select
      v_order, p.id, p.title, p.brand, p.size, p.condition, p.reference,
      (select i.path from public.product_images i
       where i.product_id = p.id order by i.position, i.created_at limit 1),
      p.price_millimes
    from public.products p
    where p.id = any (v_ids) and p.shop_id = v_shop;

    v_total := v_total + v_subtotal + v_fee;
  end loop;

  if p_expected_total is not null and p_expected_total <> v_total then
    raise exception 'price_changed';
  end if;

  update public.order_groups g set total_millimes = v_total where g.id = v_group;
  -- La pièce reste réservée jusqu'à la livraison : `sold` signifie remise au client.
  update public.products p set status = 'reserved' where p.id = any (v_ids);

  update public.reservations r
  set status = 'converted'
  where r.product_id = any (v_ids) and r.status = 'active' and r.client_id = v_user;

  delete from public.cart_items c where c.user_id = v_user and c.product_id = any (v_ids);

  perform private.log_audit(
    'order.placed',
    'order_group',
    v_group::text,
    jsonb_build_object('items', cardinality(v_ids), 'total_millimes', v_total)
  );

  return v_group;
exception when unique_violation then
  raise exception 'product_unavailable';
end;
$$;

revoke all on function public.place_order(uuid[], uuid[], text, text, smallint, integer, text, integer) from public, anon;
grant execute on function public.place_order(uuid[], uuid[], text, text, smallint, integer, text, integer) to authenticated;

-- Le total d'un groupe additionne les achats dans d'autres boutiques : hors de portée d'un vendeur.
revoke select on public.order_groups from authenticated;

grant select (
  id, reference, client_id, recipient_name, phone, governorate_id, city_id, address_line,
  payment_method, created_at
) on public.order_groups to authenticated;

-- Écritures directes ---------------------------------------------------------------------------

drop policy favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_user()));

drop policy video_favorites_insert_own on public.video_favorites;
create policy video_favorites_insert_own on public.video_favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_user()));

drop policy shop_followers_insert_own on public.shop_followers;
create policy shop_followers_insert_own on public.shop_followers
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_user()));

drop policy cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own on public.cart_items
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_user()));

-- Une boutique suspendue ne modifie plus ses adresses ni ses tarifs.
drop policy shop_addresses_insert_managers on public.shop_addresses;
create policy shop_addresses_insert_managers on public.shop_addresses
  for insert to authenticated
  with check (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  );

drop policy shop_addresses_update_managers on public.shop_addresses;
create policy shop_addresses_update_managers on public.shop_addresses
  for update to authenticated
  using (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  )
  with check (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  );

drop policy shop_addresses_delete_managers on public.shop_addresses;
create policy shop_addresses_delete_managers on public.shop_addresses
  for delete to authenticated
  using (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  );

drop policy delivery_rates_insert_managers on public.delivery_rates;
create policy delivery_rates_insert_managers on public.delivery_rates
  for insert to authenticated
  with check (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  );

drop policy delivery_rates_update_managers on public.delivery_rates;
create policy delivery_rates_update_managers on public.delivery_rates
  for update to authenticated
  using (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  )
  with check (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  );

drop policy delivery_rates_delete_managers on public.delivery_rates;
create policy delivery_rates_delete_managers on public.delivery_rates
  for delete to authenticated
  using (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
    and shop_id in (select private.my_writable_shop_ids())
  );

-- Enregistrement atomique : un échec ne laisse jamais une boutique sans tarif.
create function public.save_delivery_rates(p_shop_id uuid, p_default_fee integer, p_overrides jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'manager']::public.shop_role[])
    or p_shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  delete from public.delivery_rates r where r.shop_id = p_shop_id;

  insert into public.delivery_rates (shop_id, governorate_id, fee_millimes)
  values (p_shop_id, null, p_default_fee);

  insert into public.delivery_rates (shop_id, governorate_id, fee_millimes)
  select p_shop_id, (o.key)::smallint, (o.value #>> '{}')::integer
  from jsonb_each(coalesce(p_overrides, '{}'::jsonb)) o;

  perform private.log_audit('shop.delivery_rates', 'shop', p_shop_id::text);
end;
$$;

revoke all on function public.save_delivery_rates(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_delivery_rates(uuid, integer, jsonb) to authenticated;

-- Limitation de débit : aucune fenêtre ne dépasse 24 heures, le reste est inutile.
create function private.purge_rate_limits()
returns integer
language sql
security definer
set search_path = ''
as $$
  with removed as (
    delete from public.rate_limits l
    where l.window_start < now() - interval '2 days'
    returning 1
  )
  select count(*)::integer from removed;
$$;

revoke all on function private.purge_rate_limits() from public;

select cron.schedule('purge-rate-limits', '17 3 * * *', 'select private.purge_rate_limits()');
