-- Corrections de la phase 2 : références privées, statuts cohérents, durée de réservation lisible.

-- Références internes : invisibles du public, lisibles par la boutique via une vue filtrée.
revoke select on public.products from anon, authenticated;

grant select (
  id, shop_id, category_id, title, description, brand, size, color, condition, defects,
  price_millimes, status, publication_status, published_at, moderated_at, favorite_count,
  search_text, created_at, updated_at
) on public.products to anon, authenticated;

revoke select on public.order_items from authenticated;

grant select (
  id, order_id, product_id, title, brand, size, condition, image_path, price_millimes, is_live,
  created_at
) on public.order_items to authenticated;

create view public.product_references with (security_barrier) as
  select p.id as product_id, p.shop_id, p.reference
  from public.products p
  where p.shop_id in (select private.my_shop_ids()) or (select private.is_platform_admin());

revoke all on public.product_references from public, anon, authenticated;
grant select on public.product_references to authenticated;

-- La référence ne doit plus être devinable par la recherche publique.
create or replace function private.prepare_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category text;
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := 'P-' || upper(substr(md5(new.id::text), 1, 10));
  end if;

  select concat_ws(' ', c.name_fr, c.name_ar) into v_category
  from public.categories c where c.id = new.category_id;

  new.search_text := lower(extensions.unaccent(concat_ws(
    ' ', new.title, new.brand, new.color, new.size, v_category
  )));

  return new;
end;
$$;

update public.products set title = title;

-- Durée de réservation lisible sans ouvrir platform_settings au public.
create function public.reservation_ttl_minutes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.value #>> '{}')::integer from public.platform_settings s
     where s.key = 'reservation_ttl_minutes'),
    120
  );
$$;

revoke all on function public.reservation_ttl_minutes() from public;
grant execute on function public.reservation_ttl_minutes() to anon, authenticated;

-- Statuts : available, reserved (réservation ou commande en cours), sold (remise au client).
update public.products p
set status = 'reserved'
where p.status = 'sold'
  and exists (
    select 1
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.product_id = p.id and i.is_live and o.status <> 'delivered'
  );

create or replace function public.place_order(
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

create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status)
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

  if p_status = 'delivered' then
    update public.products p
    set status = 'sold'
    where p.id in (select i.product_id from public.order_items i where i.order_id = p_order_id);
  end if;

  perform private.log_audit(
    'order.' || p_status::text,
    'order',
    p_order_id::text,
    jsonb_build_object('from', v_order.status)
  );
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
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
  where p.status in ('reserved', 'sold')
    and p.id in (select i.product_id from public.order_items i where i.order_id = p_order_id);

  perform private.log_audit(
    'order.cancelled',
    'order',
    p_order_id::text,
    jsonb_build_object('reason', p_reason, 'from', v_order.status)
  );
end;
$$;

-- Le comptage direct exigerait un droit de lecture sur toute la table products.
create function public.top_shops(p_limit integer)
returns table (
  id uuid,
  name text,
  slug text,
  city_fr text,
  city_ar text,
  product_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.slug, c.name_fr, c.name_ar, count(p.id)
  from public.shops s
  join public.cities c on c.id = s.city_id
  join public.products p on p.shop_id = s.id and p.publication_status = 'published'
  where s.status = 'approved'
  group by s.id, c.id
  order by count(p.id) desc, s.name
  limit least(greatest(coalesce(p_limit, 6), 1), 24);
$$;

revoke all on function public.top_shops(integer) from public;
grant execute on function public.top_shops(integer) to anon, authenticated;
