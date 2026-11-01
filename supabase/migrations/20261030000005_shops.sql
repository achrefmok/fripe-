-- Boutiques, membres, adresses. Toute écriture sensible passe par une RPC transactionnelle.

create type public.shop_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.shop_plan as enum ('standard', 'pro');
create type public.shop_role as enum ('owner', 'manager', 'staff');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 1000),
  phone text check (phone ~ '^\+216[2-9][0-9]{7}$'),
  governorate_id smallint not null,
  city_id integer not null,
  logo_path text,
  cover_path text,
  status public.shop_status not null default 'pending',
  plan public.shop_plan not null default 'standard',
  review_note text check (char_length(review_note) <= 500),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (governorate_id) references public.governorates (id) on delete restrict,
  foreign key (governorate_id, city_id) references public.cities (governorate_id, id)
    on delete restrict
);

create index shops_status_idx on public.shops (status);
create index shops_location_idx on public.shops (governorate_id, city_id);

create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function private.set_updated_at();

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.shop_role not null,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index shop_members_user_idx on public.shop_members (user_id);

create unique index shop_members_one_owner
  on public.shop_members (shop_id) where role = 'owner';

create table public.shop_addresses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),
  address_line text not null check (char_length(address_line) between 3 and 200),
  governorate_id smallint not null,
  city_id integer not null,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (governorate_id) references public.governorates (id) on delete restrict,
  foreign key (governorate_id, city_id) references public.cities (governorate_id, id)
    on delete restrict
);

create index shop_addresses_shop_idx on public.shop_addresses (shop_id);

create unique index shop_addresses_one_primary
  on public.shop_addresses (shop_id) where is_primary;

create trigger shop_addresses_set_updated_at
  before update on public.shop_addresses
  for each row execute function private.set_updated_at();

create function private.has_shop_role(p_shop uuid, p_roles public.shop_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_members m
    join public.profiles p on p.id = m.user_id
    where m.shop_id = p_shop
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
      and p.status = 'active'
  );
$$;

revoke all on function private.has_shop_role(uuid, public.shop_role[]) from public;
grant execute on function private.has_shop_role(uuid, public.shop_role[])
  to anon, authenticated, service_role;

create function public.create_shop(
  p_name text,
  p_slug text,
  p_description text,
  p_phone text,
  p_governorate_id smallint,
  p_city_id integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit integer;
  v_owned integer;
  v_shop uuid;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('create_shop', 5, 86400);

  select (value #>> '{}')::integer into v_limit
  from public.platform_settings where key = 'max_shops_per_user';

  select count(*) into v_owned
  from public.shop_members where user_id = v_user and role = 'owner';

  if v_owned >= coalesce(v_limit, 3) then
    raise exception 'shop_limit_reached';
  end if;

  if not exists (
    select 1 from public.cities c
    where c.id = p_city_id and c.governorate_id = p_governorate_id
  ) then
    raise exception 'invalid_location';
  end if;

  begin
    insert into public.shops (name, slug, description, phone, governorate_id, city_id)
    values (
      p_name, p_slug, nullif(p_description, ''), nullif(p_phone, ''), p_governorate_id, p_city_id
    )
    returning id into v_shop;
  exception when unique_violation then
    raise exception 'slug_taken';
  end;

  insert into public.shop_members (shop_id, user_id, role)
  values (v_shop, v_user, 'owner');

  perform private.log_audit('shop.created', 'shop', v_shop::text, jsonb_build_object('slug', p_slug));

  return v_shop;
end;
$$;

create function public.resubmit_shop(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_shop_role(p_shop_id, array['owner']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  update public.shops
  set status = 'pending', review_note = null
  where id = p_shop_id and status = 'rejected';

  if not found then
    raise exception 'invalid_transition';
  end if;

  perform private.log_audit('shop.resubmitted', 'shop', p_shop_id::text);
end;
$$;

create function public.review_shop(p_shop_id uuid, p_status public.shop_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.shop_status;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  select status into v_current from public.shops where id = p_shop_id for update;

  if v_current is null then
    raise exception 'not_found';
  end if;

  if not (
    (v_current = 'pending' and p_status in ('approved', 'rejected'))
    or (v_current = 'approved' and p_status = 'suspended')
    or (v_current = 'suspended' and p_status = 'approved')
  ) then
    raise exception 'invalid_transition';
  end if;

  if p_status in ('rejected', 'suspended') and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'note_required';
  end if;

  update public.shops
  set status = p_status,
      review_note = case when p_status = 'approved' then null else p_note end,
      approved_at = case when p_status = 'approved' then now() else approved_at end
  where id = p_shop_id;

  perform private.log_audit(
    'shop.' || p_status::text,
    'shop',
    p_shop_id::text,
    jsonb_build_object('from', v_current, 'note', p_note)
  );
end;
$$;

create function public.set_user_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if p_user_id = (select auth.uid())
    or exists (select 1 from public.platform_admins a where a.user_id = p_user_id) then
    raise exception 'protected_account';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  if not found then
    raise exception 'not_found';
  end if;

  perform private.log_audit(
    'user.' || p_status::text,
    'user',
    p_user_id::text,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

-- L'e-mail vit dans auth.users : cette RPC évite d'utiliser la clé secrète pour l'administration.
create function public.admin_list_users(p_search text, p_limit integer, p_offset integer)
returns table (
  id uuid,
  email text,
  display_name text,
  phone text,
  status public.account_status,
  created_at timestamptz,
  is_admin boolean,
  shop_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pattern text := '%' || replace(replace(replace(coalesce(p_search, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.display_name,
    p.phone,
    p.status,
    p.created_at,
    exists (select 1 from public.platform_admins a where a.user_id = p.id),
    (select count(*) from public.shop_members m where m.user_id = p.id),
    count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.display_name ilike v_pattern or u.email ilike v_pattern
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.create_shop(text, text, text, text, smallint, integer) from public, anon;
revoke all on function public.resubmit_shop(uuid) from public, anon;
revoke all on function public.review_shop(uuid, public.shop_status, text) from public, anon;
revoke all on function public.set_user_status(uuid, public.account_status, text) from public, anon;
revoke all on function public.admin_list_users(text, integer, integer) from public, anon;

grant execute on function public.create_shop(text, text, text, text, smallint, integer) to authenticated;
grant execute on function public.resubmit_shop(uuid) to authenticated;
grant execute on function public.review_shop(uuid, public.shop_status, text) to authenticated;
grant execute on function public.set_user_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_addresses enable row level security;

revoke all on public.shops, public.shop_members, public.shop_addresses from anon, authenticated;

grant select on public.shops to anon, authenticated;
grant update (name, description, phone, governorate_id, city_id, logo_path, cover_path)
  on public.shops to authenticated;
grant select on public.shop_members to authenticated;
grant select on public.shop_addresses to anon, authenticated;
grant insert, update, delete on public.shop_addresses to authenticated;

create policy shops_select_visible on public.shops
  for select to anon, authenticated
  using (
    status = 'approved'
    or (select private.has_shop_role(id, array['owner', 'manager', 'staff']::public.shop_role[]))
    or (select private.is_platform_admin())
  );

create policy shops_update_managers on public.shops
  for update to authenticated
  using (
    status <> 'suspended'
    and (select private.has_shop_role(id, array['owner', 'manager']::public.shop_role[]))
  )
  with check (
    (select private.has_shop_role(id, array['owner', 'manager']::public.shop_role[]))
  );

create policy shop_members_select_scoped on public.shop_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_shop_role(shop_id, array['owner', 'manager', 'staff']::public.shop_role[]))
    or (select private.is_platform_admin())
  );

create policy shop_addresses_select_visible on public.shop_addresses
  for select to anon, authenticated
  using (
    exists (select 1 from public.shops s where s.id = shop_id)
  );

create policy shop_addresses_insert_managers on public.shop_addresses
  for insert to authenticated
  with check (
    (select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[]))
  );

create policy shop_addresses_update_managers on public.shop_addresses
  for update to authenticated
  using ((select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[])))
  with check ((select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[])));

create policy shop_addresses_delete_managers on public.shop_addresses
  for delete to authenticated
  using ((select private.has_shop_role(shop_id, array['owner', 'manager']::public.shop_role[])));
