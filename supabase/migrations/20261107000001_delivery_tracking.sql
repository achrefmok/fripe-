-- Livraison : tarif fixé par la plateforme, adresse au profil, suivi des colis, et raccord prêt pour
-- l'application des livreurs. Le paiement reste à la livraison ou au retrait, sans paiement en ligne.

-- Tarifs ------------------------------------------------------------------------------------------

-- Une grille par gouvernorat, fixée par l'administration ; le tarif par défaut reste dans
-- platform_settings. Les tarifs des boutiques (delivery_rates) restent en base mais ne servent plus.
create table public.delivery_zone_rates (
  governorate_id smallint primary key references public.governorates (id) on delete cascade,
  fee_millimes integer not null check (fee_millimes between 0 and 100000),
  updated_at timestamptz not null default now()
);

alter table public.delivery_zone_rates enable row level security;
revoke all on public.delivery_zone_rates from anon, authenticated;
grant select on public.delivery_zone_rates to anon, authenticated;

-- Les prix de livraison sont publics : le client les voit avant de commander.
create policy delivery_zone_rates_select_all on public.delivery_zone_rates
  for select to anon, authenticated
  using (true);

create or replace function private.delivery_fee(p_shop_id uuid, p_governorate_id smallint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.fee_millimes from public.delivery_zone_rates r where r.governorate_id = p_governorate_id),
    (select (s.value #>> '{}')::integer from public.platform_settings s
     where s.key = 'default_delivery_fee_millimes'),
    0
  );
$$;

-- Le prix effectif de chaque gouvernorat, pour les comptes connectés : boutiques et clients voient la même grille.
create function public.delivery_price_list()
returns table (governorate_id smallint, fee_millimes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, private.delivery_fee(null, g.id) from public.governorates g order by g.name_fr;
$$;
revoke all on function public.delivery_price_list() from public, anon;
grant execute on function public.delivery_price_list() to authenticated;

-- L'administration remplace la grille d'un coup : un gouvernorat absent prend le tarif par défaut.
create function public.save_platform_delivery_rates(p_default_millimes integer, p_rates jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if p_default_millimes is null or p_default_millimes not between 0 and 100000
    or jsonb_typeof(coalesce(p_rates, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_rates';
  end if;

  for v_entry in select value from jsonb_array_elements(coalesce(p_rates, '[]'::jsonb)) loop
    if jsonb_typeof(v_entry -> 'fee_millimes') <> 'number'
      or (v_entry ->> 'fee_millimes')::integer not between 0 and 100000
      or not exists (select 1 from public.governorates g where g.id = (v_entry ->> 'governorate_id')::smallint) then
      raise exception 'invalid_rates';
    end if;
  end loop;

  update public.platform_settings s
  set value = to_jsonb(p_default_millimes), updated_at = now()
  where s.key = 'default_delivery_fee_millimes';

  delete from public.delivery_zone_rates r where true;

  insert into public.delivery_zone_rates (governorate_id, fee_millimes)
  select (value ->> 'governorate_id')::smallint, (value ->> 'fee_millimes')::integer
  from jsonb_array_elements(coalesce(p_rates, '[]'::jsonb));

  perform private.log_audit(
    'delivery.rates_updated', 'platform', 'delivery',
    jsonb_build_object('default', p_default_millimes, 'zones', jsonb_array_length(coalesce(p_rates, '[]'::jsonb)))
  );
end;
$$;
revoke all on function public.save_platform_delivery_rates(integer, jsonb) from public, anon;
grant execute on function public.save_platform_delivery_rates(integer, jsonb) to authenticated;

-- Profil : adresse de livraison ----------------------------------------------------------------------

alter table public.profiles
  add column governorate_id smallint references public.governorates (id) on delete set null,
  add column city_id integer references public.cities (id) on delete set null,
  add column address_line text check (char_length(address_line) <= 200);

grant update (governorate_id, city_id, address_line) on public.profiles to authenticated;

create function private.check_profile_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un compte supprimé n'emporte rien : l'adresse part avec le reste.
  if new.status = 'deleted' then
    new.governorate_id := null;
    new.city_id := null;
    new.address_line := null;
    return new;
  end if;

  new.address_line := nullif(btrim(new.address_line), '');

  if new.city_id is not null and not exists (
    select 1 from public.cities c where c.id = new.city_id and c.governorate_id = new.governorate_id
  ) then
    raise exception 'invalid_city';
  end if;

  return new;
end;
$$;
revoke all on function private.check_profile_address() from public;

create trigger profiles_check_address
  before insert or update of governorate_id, city_id, address_line, status on public.profiles
  for each row execute function private.check_profile_address();

-- L'inscription transmet téléphone et adresse ; une valeur invalide est ignorée, jamais bloquante.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80);
  v_locale text := new.raw_user_meta_data ->> 'locale';
  v_phone text := new.raw_user_meta_data ->> 'phone';
  v_governorate smallint := private.safe_smallint(new.raw_user_meta_data ->> 'governorate_id');
  v_city integer := private.safe_integer(new.raw_user_meta_data ->> 'city_id');
  v_address text := left(btrim(coalesce(new.raw_user_meta_data ->> 'address_line', '')), 200);
begin
  if char_length(v_name) < 2 then
    v_name := 'Membre';
  end if;

  if v_phone !~ '^\+216[2-9][0-9]{7}$' then
    v_phone := null;
  end if;

  if not exists (select 1 from public.governorates g where g.id = v_governorate) then
    v_governorate := null;
  end if;

  if not exists (select 1 from public.cities c where c.id = v_city and c.governorate_id = v_governorate) then
    v_city := null;
  end if;

  insert into public.profiles (id, display_name, locale, phone, governorate_id, city_id, address_line)
  values (
    new.id,
    v_name,
    case when v_locale = 'ar' then 'ar'::public.app_locale else 'fr'::public.app_locale end,
    v_phone,
    v_governorate,
    v_city,
    nullif(v_address, '')
  );
  return new;
end;
$$;

create function private.safe_smallint(p_value text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case when p_value ~ '^[0-9]{1,4}$' then p_value::smallint end;
$$;
revoke all on function private.safe_smallint(text) from public;

create function private.safe_integer(p_value text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_value ~ '^[0-9]{1,9}$' then p_value::integer end;
$$;
revoke all on function private.safe_integer(text) from public;

-- Suivi des colis ------------------------------------------------------------------------------------

-- Étapes du colis. Les premières suivent la commande ; les suivantes viendront du livreur.
create function private.shipment_status_valid(p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in (
    'ordered', 'confirmed', 'preparing', 'handed_over', 'in_transit', 'out_for_delivery',
    'delivered', 'failed', 'returned', 'cancelled'
  );
$$;

create table public.shipments (
  order_id uuid primary key references public.orders (id) on delete cascade,
  tracking_code text not null unique check (tracking_code ~ '^FRP-[A-Z0-9]{10}$'),
  status text not null default 'ordered' check (private.shipment_status_valid(status)),
  carrier text check (char_length(carrier) <= 60),
  courier_name text check (char_length(courier_name) <= 80),
  courier_phone text check (courier_phone ~ '^\+216[2-9][0-9]{7}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  position_at timestamptz,
  eta timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function private.set_updated_at();

create table public.shipment_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null check (private.shipment_status_valid(status)),
  source text not null check (source in ('system', 'shop', 'client', 'courier', 'admin')),
  note text check (char_length(note) <= 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create index shipment_events_order_idx on public.shipment_events (order_id, created_at);

create function private.new_tracking_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'FRP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

-- Qui a fait avancer la commande : la session le dit, le livreur le précise par la fonction dédiée.
create function private.event_source()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('fripe.event_source', true), ''),
    case
      when (select auth.uid()) is null then 'system'
      when private.is_platform_admin() then 'admin'
      else 'shop'
    end
  );
$$;
revoke all on function private.event_source() from public;

create function private.track_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := case new.status
    when 'pending' then 'ordered'
    when 'shipped' then 'handed_over'
    else new.status::text
  end;
  v_source text := private.event_source();
begin
  if tg_op = 'INSERT' then
    if new.fulfillment = 'delivery' then
      insert into public.shipments (order_id, tracking_code) values (new.id, private.new_tracking_code());
    end if;

    insert into public.shipment_events (order_id, status, source) values (new.id, 'ordered', 'client');
    return null;
  end if;

  if new.status is distinct from old.status then
    -- L'annulation par le client vient du client, quel que soit le chemin pris.
    if new.status = 'cancelled' and new.cancelled_by = new.client_id then
      v_source := 'client';
    end if;

    insert into public.shipment_events (order_id, status, source, note)
    values (new.id, v_status, v_source, case when new.status = 'cancelled' then new.cancel_reason end);

    update public.shipments s set status = v_status where s.order_id = new.id;
  end if;

  return null;
end;
$$;
revoke all on function private.track_order() from public;

create trigger orders_track
  after insert or update of status on public.orders
  for each row execute function private.track_order();

-- Les commandes passées avant ce suivi reçoivent leur numéro et leur étape actuelle.
insert into public.shipments (order_id, tracking_code, status)
select o.id, private.new_tracking_code(),
  case o.status when 'pending' then 'ordered' when 'shipped' then 'handed_over' else o.status::text end
from public.orders o
where o.fulfillment = 'delivery'
on conflict do nothing;

insert into public.shipment_events (order_id, status, source, created_at)
select o.id,
  case o.status when 'pending' then 'ordered' when 'shipped' then 'handed_over' else o.status::text end,
  'system',
  coalesce(o.delivered_at, o.cancelled_at, o.shipped_at, o.confirmed_at, o.created_at)
from public.orders o
where not exists (select 1 from public.shipment_events e where e.order_id = o.id);

alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
revoke all on public.shipments, public.shipment_events from anon, authenticated;
grant select on public.shipments, public.shipment_events to authenticated;

-- Visibles exactement comme la commande : le client, la boutique, l'administration.
create policy shipments_select_order on public.shipments
  for select to authenticated
  using (order_id in (select o.id from public.orders o));

create policy shipment_events_select_order on public.shipment_events
  for select to authenticated
  using (order_id in (select o.id from public.orders o));

-- Le suivi se met à jour en direct dans la page de la commande dès qu'un événement arrive.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shipments, public.shipment_events;
  end if;
end;
$$;

-- Raccord pour l'application des livreurs --------------------------------------------------------------
-- Appelé uniquement par le serveur de FRIPE (clé de service), derrière une route protégée par jeton.

-- Ce dont le livreur a besoin pour livrer : destinataire, adresse, somme à encaisser.
create function public.courier_shipment(p_tracking_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tracking_code', s.tracking_code,
    'status', s.status,
    'order_reference', g.reference,
    'shop', jsonb_build_object('name', sh.name, 'phone', sh.phone, 'city', pc.name_fr),
    'recipient', jsonb_build_object(
      'name', g.recipient_name,
      'phone', g.phone,
      'governorate', gv.name_fr,
      'city', c.name_fr,
      'address', g.address_line
    ),
    'cash_to_collect_millimes', o.total_millimes,
    'items', (select count(*) from public.order_items i where i.order_id = o.id),
    'eta', s.eta
  )
  from public.shipments s
  join public.orders o on o.id = s.order_id
  join public.order_groups g on g.id = o.group_id
  join public.shops sh on sh.id = o.shop_id
  left join public.cities pc on pc.id = sh.city_id
  left join public.governorates gv on gv.id = g.governorate_id
  left join public.cities c on c.id = g.city_id
  where s.tracking_code = upper(btrim(p_tracking_code))
    and o.status in ('confirmed', 'preparing', 'shipped');
$$;
revoke all on function public.courier_shipment(text) from public, anon, authenticated;
grant execute on function public.courier_shipment(text) to service_role;

create function public.courier_update(
  p_tracking_code text,
  p_status text default null,
  p_note text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_eta timestamptz default null,
  p_carrier text default null,
  p_courier_name text default null,
  p_courier_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_shipment from public.shipments s where s.tracking_code = upper(btrim(p_tracking_code)) for update;
  if v_shipment.order_id is null then
    raise exception 'not_found';
  end if;

  select * into v_order from public.orders o where o.id = v_shipment.order_id for update;

  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'invalid_position';
  end if;

  update public.shipments s
  set carrier = coalesce(nullif(btrim(p_carrier), ''), s.carrier),
      courier_name = coalesce(nullif(btrim(p_courier_name), ''), s.courier_name),
      courier_phone = coalesce(p_courier_phone, s.courier_phone),
      eta = coalesce(p_eta, s.eta),
      latitude = coalesce(p_latitude, s.latitude),
      longitude = coalesce(p_longitude, s.longitude),
      position_at = case when p_latitude is not null then now() else s.position_at end
  where s.order_id = v_shipment.order_id;

  if p_status is not null then
    -- Le livreur n'intervient qu'une fois le colis remis par la boutique.
    if p_status not in ('in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned')
      or v_order.status <> 'shipped' then
      raise exception 'invalid_transition';
    end if;

    perform set_config('fripe.event_source', 'courier', true);

    if p_status = 'delivered' then
      -- Remis et encaissé : la commande est livrée, comme si la boutique l'avait indiqué.
      update public.orders o set status = 'delivered', delivered_at = now() where o.id = v_order.id;
      update public.products p set status = 'sold'
      where p.id in (select i.product_id from public.order_items i where i.order_id = v_order.id);
      update public.shipment_events e set note = nullif(btrim(p_note), ''), latitude = p_latitude, longitude = p_longitude
      where e.id = (select max(x.id) from public.shipment_events x where x.order_id = v_order.id);
    else
      insert into public.shipment_events (order_id, status, source, note, latitude, longitude)
      values (v_order.id, p_status, 'courier', nullif(btrim(p_note), ''), p_latitude, p_longitude);
      update public.shipments s set status = p_status where s.order_id = v_order.id;
    end if;

    perform set_config('fripe.event_source', '', true);

    perform private.log_audit(
      'shipment.' || p_status, 'order', v_order.id::text,
      jsonb_build_object('tracking', v_shipment.tracking_code)
    );
  end if;

  return (select jsonb_build_object('tracking_code', s.tracking_code, 'status', s.status)
          from public.shipments s where s.order_id = v_shipment.order_id);
end;
$$;
revoke all on function public.courier_update(text, text, text, double precision, double precision, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.courier_update(text, text, text, double precision, double precision, timestamptz, text, text, text)
  to service_role;

-- Clé de service (serveur uniquement) : mêmes droits explicites que la phase 6, pour les tables créées depuis.
-- Un projet neuf peut ne plus les accorder par défaut ; la RLS des sessions n'en est pas changée.
grant all on table
  public.category_attributes, public.listings, public.listing_images, public.listing_favorites,
  public.person_blocks, public.listing_threads, public.listing_messages,
  public.delivery_zone_rates, public.shipments, public.shipment_events
  to service_role;
grant all on all sequences in schema public to service_role;
