-- Stock physique indicatif et demandes de clients.
-- inventory_items n'est jamais commandable : une pièce ne s'achète qu'une fois publiée dans products.

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  label text check (char_length(label) <= 80),
  approx_quantity integer not null check (approx_quantity between 0 and 1000000),
  is_visible boolean not null default true,
  last_counted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_shop_idx on public.inventory_items (shop_id);

create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function private.set_updated_at();

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  previous_quantity integer,
  new_quantity integer not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index inventory_movements_item_idx on public.inventory_movements (item_id, created_at desc);

create function private.track_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory_movements (item_id, shop_id, previous_quantity, new_quantity, actor_id)
  values (
    new.id,
    new.shop_id,
    case when tg_op = 'UPDATE' then old.approx_quantity end,
    new.approx_quantity,
    (select auth.uid())
  );

  return null;
end;
$$;

revoke all on function private.track_inventory() from public;

create trigger inventory_items_track
  after insert or update of approx_quantity on public.inventory_items
  for each row execute function private.track_inventory();

create function private.touch_inventory_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.approx_quantity is distinct from old.approx_quantity then
    new.last_counted_at := now();
  end if;

  return new;
end;
$$;

revoke all on function private.touch_inventory_count() from public;

create trigger inventory_items_touch_count
  before update on public.inventory_items
  for each row execute function private.touch_inventory_count();

create type public.stock_request_status as enum ('open', 'answered', 'closed');

create table public.stock_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete cascade,
  client_name text not null,
  category_id uuid references public.categories (id) on delete set null,
  size text check (char_length(size) <= 20),
  color text check (char_length(color) <= 40),
  brand text check (char_length(brand) <= 60),
  budget_millimes integer check (budget_millimes > 0),
  message text not null check (char_length(message) between 3 and 500),
  status public.stock_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_requests_shop_idx on public.stock_requests (shop_id, status, created_at desc);
create index stock_requests_client_idx on public.stock_requests (client_id, created_at desc);

create trigger stock_requests_set_updated_at
  before update on public.stock_requests
  for each row execute function private.set_updated_at();

create table public.stock_request_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.stock_requests (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  message text check (char_length(message) <= 300),
  created_at timestamptz not null default now(),
  unique (request_id, product_id)
);

create index stock_request_offers_product_idx on public.stock_request_offers (product_id);

create function public.create_stock_request(
  p_shop_id uuid,
  p_category_id uuid,
  p_size text,
  p_color text,
  p_brand text,
  p_budget_millimes integer,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text;
  v_request uuid;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('stock_request', 10, 86400);

  if not exists (select 1 from public.shops s where s.id = p_shop_id and s.status = 'approved') then
    raise exception 'not_found';
  end if;

  if p_shop_id in (select private.my_shop_ids()) then
    raise exception 'own_shop';
  end if;

  select p.display_name into v_name from public.profiles p where p.id = v_user;

  insert into public.stock_requests (
    shop_id, client_id, client_name, category_id, size, color, brand, budget_millimes, message
  )
  values (
    p_shop_id, v_user, v_name, p_category_id, nullif(p_size, ''), nullif(p_color, ''),
    nullif(p_brand, ''), nullif(p_budget_millimes, 0), p_message
  )
  returning id into v_request;

  return v_request;
end;
$$;

create function public.offer_product(p_request_id uuid, p_product_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.stock_requests%rowtype;
begin
  select * into v_request from public.stock_requests r where r.id = p_request_id for update;

  if v_request.id is null or v_request.shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if v_request.status = 'closed' then
    raise exception 'invalid_transition';
  end if;

  if not exists (
    select 1 from public.products p
    where p.id = p_product_id
      and p.shop_id = v_request.shop_id
      and p.publication_status = 'published'
      and p.status = 'available'
  ) then
    raise exception 'product_unavailable';
  end if;

  insert into public.stock_request_offers (request_id, product_id, message)
  values (p_request_id, p_product_id, nullif(p_message, ''))
  on conflict (request_id, product_id) do nothing;

  update public.stock_requests r set status = 'answered' where r.id = p_request_id;
end;
$$;

create function public.close_stock_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.stock_requests%rowtype;
begin
  select * into v_request from public.stock_requests r where r.id = p_request_id for update;

  if v_request.id is null
    or not (
      v_request.client_id = (select auth.uid())
      or v_request.shop_id in (select private.my_writable_shop_ids())
    ) then
    raise exception 'forbidden';
  end if;

  update public.stock_requests r set status = 'closed' where r.id = p_request_id;
end;
$$;

revoke all on function public.create_stock_request(uuid, uuid, text, text, text, integer, text) from public, anon;
revoke all on function public.offer_product(uuid, uuid, text) from public, anon;
revoke all on function public.close_stock_request(uuid) from public, anon;

grant execute on function public.create_stock_request(uuid, uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.offer_product(uuid, uuid, text) to authenticated;
grant execute on function public.close_stock_request(uuid) to authenticated;

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.stock_requests enable row level security;
alter table public.stock_request_offers enable row level security;

revoke all on public.inventory_items, public.inventory_movements, public.stock_requests,
  public.stock_request_offers from anon, authenticated;

grant select on public.inventory_items to anon, authenticated;
grant insert (id, shop_id, category_id, label, approx_quantity, is_visible)
  on public.inventory_items to authenticated;
grant update (category_id, label, approx_quantity, is_visible)
  on public.inventory_items to authenticated;
grant delete on public.inventory_items to authenticated;
grant select on public.inventory_movements to authenticated;
grant select on public.stock_requests to authenticated;
grant select on public.stock_request_offers to authenticated;

create policy inventory_items_select_visible on public.inventory_items
  for select to anon, authenticated
  using (
    (is_visible and shop_id in (select s.id from public.shops s where s.status = 'approved'))
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy inventory_items_insert_members on public.inventory_items
  for insert to authenticated
  with check (shop_id in (select private.my_writable_shop_ids()));

create policy inventory_items_update_members on public.inventory_items
  for update to authenticated
  using (shop_id in (select private.my_writable_shop_ids()))
  with check (shop_id in (select private.my_writable_shop_ids()));

create policy inventory_items_delete_members on public.inventory_items
  for delete to authenticated
  using (shop_id in (select private.my_writable_shop_ids()));

create policy inventory_movements_select_members on public.inventory_movements
  for select to authenticated
  using (
    shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy stock_requests_select_scoped on public.stock_requests
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy stock_request_offers_select_scoped on public.stock_request_offers
  for select to authenticated
  using (request_id in (select r.id from public.stock_requests r));
