-- Panier, réservations, commandes multi-boutiques.
-- Une pièce est unique : trois verrous empêchent de la vendre deux fois (voir docs/conception-phase-1.md).

create extension if not exists pg_cron;

create type public.reservation_status as enum ('active', 'converted', 'expired', 'cancelled');
create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'
);
create type public.fulfillment_method as enum ('delivery', 'pickup');

insert into public.platform_settings (key, value, description) values
  ('default_delivery_fee_millimes', '8000', 'Frais de livraison par défaut, en millimes'),
  ('max_pending_orders', '5', 'Commandes en attente autorisées par client'),
  ('max_active_reservations', '3', 'Réservations actives autorisées par client');

create table public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index cart_items_product_idx on public.cart_items (product_id);

create table public.delivery_rates (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  governorate_id smallint references public.governorates (id) on delete cascade,
  fee_millimes integer not null check (fee_millimes between 0 and 100000),
  unique nulls not distinct (shop_id, governorate_id)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reservations_one_active
  on public.reservations (product_id) where status = 'active';
create index reservations_client_idx on public.reservations (client_id, created_at desc);
create index reservations_shop_idx on public.reservations (shop_id, status);
create index reservations_expiry_idx on public.reservations (expires_at) where status = 'active';

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function private.set_updated_at();

create sequence public.order_reference_seq;

create table public.order_groups (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  client_id uuid not null references public.profiles (id) on delete restrict,
  recipient_name text not null check (char_length(recipient_name) between 2 and 80),
  phone text not null check (phone ~ '^\+216[2-9][0-9]{7}$'),
  governorate_id smallint references public.governorates (id) on delete restrict,
  city_id integer references public.cities (id) on delete restrict,
  address_line text check (char_length(address_line) <= 200),
  payment_method text not null default 'cash_on_delivery'
    check (payment_method = 'cash_on_delivery'),
  total_millimes integer not null default 0,
  created_at timestamptz not null default now()
);

create index order_groups_client_idx on public.order_groups (client_id, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.order_groups (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'pending',
  fulfillment public.fulfillment_method not null,
  subtotal_millimes integer not null,
  delivery_fee_millimes integer not null default 0,
  total_millimes integer not null,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  cancelled_by uuid,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, shop_id)
);

create index orders_shop_idx on public.orders (shop_id, status, created_at desc);
create index orders_client_idx on public.orders (client_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

-- Instantané : le titre et le prix restent ceux de l'achat, même si la fiche change ensuite.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  title text not null,
  brand text,
  size text,
  condition public.product_condition,
  reference text not null,
  image_path text,
  price_millimes integer not null,
  is_live boolean not null default true,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);
create unique index order_items_one_live on public.order_items (product_id) where is_live;

-- Libère les réservations échues. Appelée par le cron chaque minute et avant chaque opération
-- sur une pièce : une vente reste correcte même si le cron est en retard.
create function private.release_expired_reservations(p_product_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.reservations r
    set status = 'expired'
    where r.status = 'active'
      and r.expires_at <= now()
      and (p_product_id is null or r.product_id = p_product_id)
    returning r.product_id
  ),
  released as (
    update public.products p
    set status = 'available'
    from expired e
    where p.id = e.product_id and p.status = 'reserved'
    returning p.id
  )
  select count(*) into v_count from released;

  return v_count;
end;
$$;

revoke all on function private.release_expired_reservations(uuid) from public;

select cron.schedule(
  'release-expired-reservations',
  '* * * * *',
  'select private.release_expired_reservations()'
);

create function private.delivery_fee(p_shop_id uuid, p_governorate_id smallint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.fee_millimes from public.delivery_rates r
     where r.shop_id = p_shop_id and r.governorate_id = p_governorate_id),
    (select r.fee_millimes from public.delivery_rates r
     where r.shop_id = p_shop_id and r.governorate_id is null),
    (select (s.value #>> '{}')::integer from public.platform_settings s
     where s.key = 'default_delivery_fee_millimes'),
    0
  );
$$;

revoke all on function private.delivery_fee(uuid, smallint) from public;

create function public.delivery_quote(p_shop_ids uuid[], p_governorate_id smallint)
returns table (shop_id uuid, fee_millimes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, private.delivery_fee(s.id, p_governorate_id)
  from public.shops s
  where s.id = any (p_shop_ids) and s.status = 'approved';
$$;

create function public.reserve_product(p_product_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_shop uuid;
  v_ttl integer;
  v_limit integer;
  v_reservation uuid;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('reserve_product', 20, 86400);
  perform private.release_expired_reservations(p_product_id);

  select (s.value #>> '{}')::integer into v_limit
  from public.platform_settings s where s.key = 'max_active_reservations';

  if (
    select count(*) from public.reservations r
    where r.client_id = v_user and r.status = 'active' and r.expires_at > now()
  ) >= coalesce(v_limit, 3) then
    raise exception 'too_many_reservations';
  end if;

  update public.products p
  set status = 'reserved'
  where p.id = p_product_id
    and p.status = 'available'
    and p.publication_status = 'published'
    and p.shop_id in (select s.id from public.shops s where s.status = 'approved')
  returning p.shop_id into v_shop;

  if v_shop is null then
    raise exception 'product_unavailable';
  end if;

  if v_shop in (select private.my_shop_ids()) then
    raise exception 'own_product';
  end if;

  select (s.value #>> '{}')::integer into v_ttl
  from public.platform_settings s where s.key = 'reservation_ttl_minutes';

  begin
    insert into public.reservations (product_id, shop_id, client_id, expires_at)
    values (
      p_product_id,
      v_shop,
      v_user,
      now() + make_interval(mins => coalesce(v_ttl, 120))
    )
    returning id into v_reservation;
  exception when unique_violation then
    raise exception 'product_unavailable';
  end;

  return v_reservation;
end;
$$;

create function public.cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.reservations%rowtype;
begin
  select * into v_reservation from public.reservations r where r.id = p_reservation_id for update;

  if v_reservation.id is null
    or not (
      v_reservation.client_id = (select auth.uid())
      or v_reservation.shop_id in (select private.my_writable_shop_ids())
    ) then
    raise exception 'forbidden';
  end if;

  if v_reservation.status <> 'active' then
    raise exception 'invalid_transition';
  end if;

  update public.reservations r set status = 'cancelled' where r.id = p_reservation_id;

  update public.products p
  set status = 'available'
  where p.id = v_reservation.product_id and p.status = 'reserved';
end;
$$;

create function public.place_order(
  p_product_ids uuid[],
  p_pickup_shop_ids uuid[],
  p_recipient_name text,
  p_phone text,
  p_governorate_id smallint,
  p_city_id integer,
  p_address_line text
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

  update public.order_groups g set total_millimes = v_total where g.id = v_group;
  update public.products p set status = 'sold' where p.id = any (v_ids);

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

create function public.update_order_status(p_order_id uuid, p_status public.order_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;

  if v_order.id is null or v_order.shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if not (
    (v_order.status = 'pending' and p_status = 'confirmed')
    or (v_order.status = 'confirmed' and p_status = 'preparing')
    or (v_order.status = 'preparing' and v_order.fulfillment = 'delivery' and p_status = 'shipped')
    or (v_order.status = 'preparing' and v_order.fulfillment = 'pickup' and p_status = 'delivered')
    or (v_order.status = 'shipped' and p_status = 'delivered')
  ) then
    raise exception 'invalid_transition';
  end if;

  update public.orders o
  set status = p_status,
      confirmed_at = case when p_status = 'confirmed' then now() else o.confirmed_at end,
      shipped_at = case when p_status = 'shipped' then now() else o.shipped_at end,
      delivered_at = case when p_status = 'delivered' then now() else o.delivered_at end
  where o.id = p_order_id;

  perform private.log_audit(
    'order.' || p_status::text,
    'order',
    p_order_id::text,
    jsonb_build_object('from', v_order.status)
  );
end;
$$;

create function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_is_client boolean;
  v_is_seller boolean;
  v_is_admin boolean;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;

  if v_order.id is null then
    raise exception 'forbidden';
  end if;

  v_is_client := v_order.client_id = v_user and private.is_active_user();
  v_is_seller := v_order.shop_id in (select private.my_writable_shop_ids());
  v_is_admin := private.is_platform_admin();

  if not (v_is_client or v_is_seller or v_is_admin) then
    raise exception 'forbidden';
  end if;

  if v_order.status in ('delivered', 'cancelled')
    or (v_is_client and not v_is_seller and not v_is_admin and v_order.status <> 'pending')
    or (v_is_seller and not v_is_admin and v_order.status = 'shipped') then
    raise exception 'invalid_transition';
  end if;

  update public.orders o
  set status = 'cancelled',
      cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      cancelled_by = v_user,
      cancelled_at = now()
  where o.id = p_order_id;

  update public.order_items i set is_live = false where i.order_id = p_order_id;

  -- Les pièces reviennent en rayon, dans l'ordre des identifiants.
  perform 1 from public.products p
  where p.id in (select i.product_id from public.order_items i where i.order_id = p_order_id)
  order by p.id
  for update;

  update public.products p
  set status = 'available'
  where p.status = 'sold'
    and p.id in (select i.product_id from public.order_items i where i.order_id = p_order_id);

  perform private.log_audit(
    'order.cancelled',
    'order',
    p_order_id::text,
    jsonb_build_object('reason', p_reason, 'from', v_order.status)
  );
end;
$$;

create function public.shop_stats(p_shop_id uuid)
returns table (
  published bigint,
  drafts bigint,
  available bigint,
  reserved bigint,
  sold bigint,
  pending_orders bigint,
  active_orders bigint,
  open_requests bigint,
  delivered_revenue_millimes bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_shop_id not in (select private.my_shop_ids()) and not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    count(*) filter (where p.publication_status = 'published'),
    count(*) filter (where p.publication_status = 'draft'),
    count(*) filter (where p.publication_status = 'published' and p.status = 'available'),
    count(*) filter (where p.status = 'reserved'),
    count(*) filter (where p.status = 'sold'),
    (select count(*) from public.orders o where o.shop_id = p_shop_id and o.status = 'pending'),
    (select count(*) from public.orders o
     where o.shop_id = p_shop_id and o.status in ('confirmed', 'preparing', 'shipped')),
    (select count(*) from public.stock_requests r where r.shop_id = p_shop_id and r.status = 'open'),
    (select coalesce(sum(o.subtotal_millimes), 0)::bigint from public.orders o
     where o.shop_id = p_shop_id and o.status = 'delivered')
  from public.products p
  where p.shop_id = p_shop_id;
end;
$$;

revoke all on function public.delivery_quote(uuid[], smallint) from public, anon;
revoke all on function public.reserve_product(uuid) from public, anon;
revoke all on function public.cancel_reservation(uuid) from public, anon;
revoke all on function public.place_order(uuid[], uuid[], text, text, smallint, integer, text) from public, anon;
revoke all on function public.update_order_status(uuid, public.order_status) from public, anon;
revoke all on function public.cancel_order(uuid, text) from public, anon;
revoke all on function public.shop_stats(uuid) from public, anon;

grant execute on function public.delivery_quote(uuid[], smallint) to authenticated;
grant execute on function public.reserve_product(uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.place_order(uuid[], uuid[], text, text, smallint, integer, text) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.shop_stats(uuid) to authenticated;

alter table public.cart_items enable row level security;
alter table public.delivery_rates enable row level security;
alter table public.reservations enable row level security;
alter table public.order_groups enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.cart_items, public.delivery_rates, public.reservations, public.order_groups,
  public.orders, public.order_items from anon, authenticated;
revoke all on sequence public.order_reference_seq from anon, authenticated;

grant select, insert, delete on public.cart_items to authenticated;
grant select, insert, update, delete on public.delivery_rates to authenticated;
grant select on public.reservations, public.order_groups, public.orders, public.order_items
  to authenticated;

create policy cart_items_select_own on public.cart_items
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy cart_items_insert_own on public.cart_items
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy cart_items_delete_own on public.cart_items
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy delivery_rates_select_members on public.delivery_rates
  for select to authenticated
  using (
    shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy delivery_rates_insert_managers on public.delivery_rates
  for insert to authenticated
  with check ((select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[])));

create policy delivery_rates_update_managers on public.delivery_rates
  for update to authenticated
  using ((select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[])))
  with check ((select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[])));

create policy delivery_rates_delete_managers on public.delivery_rates
  for delete to authenticated
  using ((select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[])));

create policy reservations_select_scoped on public.reservations
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy orders_select_scoped on public.orders
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

-- La boutique ne voit l'adresse que pour les groupes qui contiennent une de ses commandes.
create policy order_groups_select_scoped on public.order_groups
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or id in (
      select o.group_id from public.orders o where o.shop_id in (select private.my_shop_ids())
    )
    or (select private.is_platform_admin())
  );

create policy order_items_select_scoped on public.order_items
  for select to authenticated
  using (order_id in (select o.id from public.orders o));
