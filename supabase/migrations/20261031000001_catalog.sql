-- Catalogue : pièces uniques, photos, collections, favoris.
-- Une ligne de products = une pièce physique, jamais une quantité.

create type public.product_status as enum ('available', 'reserved', 'sold');
create type public.publication_status as enum ('draft', 'published', 'archived');
create type public.product_condition as enum ('new_with_tags', 'like_new', 'very_good', 'good', 'fair');

create function private.my_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.shop_id
  from public.shop_members m
  join public.profiles p on p.id = m.user_id
  where m.user_id = (select auth.uid()) and p.status = 'active';
$$;

create function private.my_writable_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.shop_id
  from public.shop_members m
  join public.profiles p on p.id = m.user_id
  join public.shops s on s.id = m.shop_id
  where m.user_id = (select auth.uid()) and p.status = 'active' and s.status <> 'suspended';
$$;

revoke all on function private.my_shop_ids() from public;
revoke all on function private.my_writable_shop_ids() from public;
grant execute on function private.my_shop_ids() to anon, authenticated, service_role;
grant execute on function private.my_writable_shop_ids() to anon, authenticated, service_role;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  reference text not null check (char_length(reference) between 1 and 40),
  title text check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 2000),
  brand text check (char_length(brand) <= 60),
  size text check (char_length(size) <= 20),
  color text check (char_length(color) <= 40),
  condition public.product_condition,
  defects text check (char_length(defects) <= 500),
  price_millimes integer check (price_millimes > 0 and price_millimes <= 100000000),
  status public.product_status not null default 'available',
  publication_status public.publication_status not null default 'draft',
  published_at timestamptz,
  moderated_at timestamptz,
  favorite_count integer not null default 0,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, reference),
  -- Un brouillon peut être incomplet ; une pièce publiée, jamais.
  constraint products_publishable check (
    publication_status <> 'published'
    or (
      title is not null
      and category_id is not null
      and condition is not null
      and price_millimes is not null
      and published_at is not null
    )
  )
);

create index products_shop_idx on public.products (shop_id, created_at desc);
create index products_category_idx on public.products (category_id);
create index products_feed_idx on public.products (published_at desc, id)
  where publication_status = 'published';
create index products_price_idx on public.products (price_millimes)
  where publication_status = 'published';
create index products_popular_idx on public.products (favorite_count desc)
  where publication_status = 'published';
create index products_brand_idx on public.products (lower(brand));
create index products_size_idx on public.products (size);
create index products_search_idx on public.products
  using gin (search_text extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

-- Référence interne automatique et texte de recherche normalisé (accents, catégorie fr/ar).
create function private.prepare_product()
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
    ' ', new.title, new.brand, new.color, new.size, new.reference, v_category
  )));

  return new;
end;
$$;

revoke all on function private.prepare_product() from public;

create trigger products_prepare
  before insert or update of title, brand, color, size, reference, category_id on public.products
  for each row execute function private.prepare_product();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null unique,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, position);

create function private.limit_product_images()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.product_images i where i.product_id = new.product_id) >= 8 then
    raise exception 'too_many_images';
  end if;

  return new;
end;
$$;

revoke all on function private.limit_product_images() from public;

create trigger product_images_limit
  before insert on public.product_images
  for each row execute function private.limit_product_images();

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 500),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index collections_shop_idx on public.collections (shop_id);

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function private.set_updated_at();

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, product_id)
);

create index collection_products_product_idx on public.collection_products (product_id);

create function private.check_collection_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select c.shop_id from public.collections c where c.id = new.collection_id)
    is distinct from (select p.shop_id from public.products p where p.id = new.product_id) then
    raise exception 'forbidden';
  end if;

  return new;
end;
$$;

revoke all on function private.check_collection_product() from public;

create trigger collection_products_same_shop
  before insert or update on public.collection_products
  for each row execute function private.check_collection_product();

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index favorites_product_idx on public.favorites (product_id);

create function private.count_favorites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products
  set favorite_count = favorite_count + case when tg_op = 'INSERT' then 1 else -1 end
  where id = coalesce(new.product_id, old.product_id);

  return null;
end;
$$;

revoke all on function private.count_favorites() from public;

create trigger favorites_count
  after insert or delete on public.favorites
  for each row execute function private.count_favorites();

-- Publication, dépublication et archivage groupés. Chaque pièce refusée est renvoyée avec sa raison.
create function public.set_products_publication(
  p_product_ids uuid[],
  p_status public.publication_status
)
returns table (product_id uuid, problem text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_shop_status public.shop_status;
  v_problem text;
  v_done integer := 0;
begin
  if coalesce(array_length(p_product_ids, 1), 0) > 500 then
    raise exception 'too_many_items';
  end if;

  for v_product in
    select * from public.products p where p.id = any (p_product_ids) order by p.id for update
  loop
    if v_product.shop_id not in (select private.my_writable_shop_ids()) then
      raise exception 'forbidden';
    end if;

    select s.status into v_shop_status from public.shops s where s.id = v_product.shop_id;
    v_problem := null;

    if p_status = 'published' then
      v_problem := case
        when v_shop_status <> 'approved' then 'shop_not_approved'
        when v_product.moderated_at is not null then 'moderated'
        when v_product.title is null then 'missing_title'
        when v_product.category_id is null then 'missing_category'
        when v_product.condition is null then 'missing_condition'
        when v_product.price_millimes is null then 'missing_price'
        when not exists (
          select 1 from public.product_images i where i.product_id = v_product.id
        ) then 'missing_photo'
      end;
    elsif v_product.status = 'reserved' then
      v_problem := 'reserved';
    end if;

    if v_problem is not null then
      product_id := v_product.id;
      problem := v_problem;
      return next;
      continue;
    end if;

    update public.products p
    set publication_status = p_status,
        published_at = case
          when p_status = 'published' then coalesce(p.published_at, now())
          else p.published_at
        end
    where p.id = v_product.id;

    v_done := v_done + 1;
  end loop;

  if v_done > 0 then
    perform private.log_audit(
      'products.' || p_status::text,
      'product',
      null,
      jsonb_build_object('count', v_done)
    );
  end if;
end;
$$;

-- Vente hors plateforme (en magasin) ou remise en rayon.
create function public.set_product_availability(p_product_id uuid, p_status public.product_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  select * into v_product from public.products p where p.id = p_product_id for update;

  if v_product.id is null or v_product.shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if not (
    (v_product.status = 'available' and p_status = 'sold')
    or (v_product.status = 'sold' and p_status = 'available')
  ) then
    raise exception 'invalid_transition';
  end if;

  -- Une pièce liée à une commande en cours ne se remet pas en rayon : seule l'annulation la libère.
  if exists (
    select 1 from public.order_items i where i.product_id = p_product_id and i.is_live
  ) then
    raise exception 'invalid_transition';
  end if;

  update public.products p set status = p_status where p.id = p_product_id;
end;
$$;

create function public.moderate_product(p_product_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'note_required';
  end if;

  update public.products p
  set publication_status = 'archived', moderated_at = now()
  where p.id = p_product_id;

  if not found then
    raise exception 'not_found';
  end if;

  perform private.log_audit(
    'product.moderated',
    'product',
    p_product_id::text,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

revoke all on function public.set_products_publication(uuid[], public.publication_status) from public, anon;
revoke all on function public.set_product_availability(uuid, public.product_status) from public, anon;
revoke all on function public.moderate_product(uuid, text) from public, anon;

grant execute on function public.set_products_publication(uuid[], public.publication_status) to authenticated;
grant execute on function public.set_product_availability(uuid, public.product_status) to authenticated;
grant execute on function public.moderate_product(uuid, text) to authenticated;

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.favorites enable row level security;

revoke all on public.products, public.product_images, public.collections,
  public.collection_products, public.favorites from anon, authenticated;

grant select on public.products, public.product_images, public.collections,
  public.collection_products to anon, authenticated;

grant insert (
  id, shop_id, category_id, reference, title, description, brand, size, color, condition, defects,
  price_millimes
) on public.products to authenticated;

grant update (
  category_id, reference, title, description, brand, size, color, condition, defects,
  price_millimes
) on public.products to authenticated;

grant insert, update, delete on public.product_images to authenticated;
grant insert, update, delete on public.collections to authenticated;
grant insert, update, delete on public.collection_products to authenticated;
grant select, insert, delete on public.favorites to authenticated;

-- Sous-requêtes en IN : évaluées une seule fois, même sur des milliers de pièces.
create policy products_select_visible on public.products
  for select to anon, authenticated
  using (
    (
      publication_status = 'published'
      and shop_id in (select s.id from public.shops s where s.status = 'approved')
    )
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy products_insert_members on public.products
  for insert to authenticated
  with check (shop_id in (select private.my_writable_shop_ids()));

create policy products_update_members on public.products
  for update to authenticated
  using (shop_id in (select private.my_writable_shop_ids()))
  with check (shop_id in (select private.my_writable_shop_ids()));

create policy product_images_select_visible on public.product_images
  for select to anon, authenticated
  using (product_id in (select p.id from public.products p));

create policy product_images_insert_members on public.product_images
  for insert to authenticated
  with check (
    product_id in (
      select p.id from public.products p
      where p.shop_id in (select private.my_writable_shop_ids())
    )
  );

create policy product_images_update_members on public.product_images
  for update to authenticated
  using (
    product_id in (
      select p.id from public.products p
      where p.shop_id in (select private.my_writable_shop_ids())
    )
  );

create policy product_images_delete_members on public.product_images
  for delete to authenticated
  using (
    product_id in (
      select p.id from public.products p
      where p.shop_id in (select private.my_writable_shop_ids())
    )
  );

create policy collections_select_visible on public.collections
  for select to anon, authenticated
  using (
    (is_published and shop_id in (select s.id from public.shops s where s.status = 'approved'))
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy collections_insert_members on public.collections
  for insert to authenticated
  with check (shop_id in (select private.my_writable_shop_ids()));

create policy collections_update_members on public.collections
  for update to authenticated
  using (shop_id in (select private.my_writable_shop_ids()))
  with check (shop_id in (select private.my_writable_shop_ids()));

create policy collections_delete_members on public.collections
  for delete to authenticated
  using (shop_id in (select private.my_writable_shop_ids()));

create policy collection_products_select_visible on public.collection_products
  for select to anon, authenticated
  using (collection_id in (select c.id from public.collections c));

create policy collection_products_insert_members on public.collection_products
  for insert to authenticated
  with check (
    collection_id in (
      select c.id from public.collections c
      where c.shop_id in (select private.my_writable_shop_ids())
    )
  );

create policy collection_products_update_members on public.collection_products
  for update to authenticated
  using (
    collection_id in (
      select c.id from public.collections c
      where c.shop_id in (select private.my_writable_shop_ids())
    )
  );

create policy collection_products_delete_members on public.collection_products
  for delete to authenticated
  using (
    collection_id in (
      select c.id from public.collections c
      where c.shop_id in (select private.my_writable_shop_ids())
    )
  );

create policy favorites_select_own on public.favorites
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy product_images_select_members on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-images'
    and private.safe_uuid((storage.foldername(name))[1]) in (select private.my_shop_ids())
  );

create policy product_images_insert_members on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and private.safe_uuid((storage.foldername(name))[1]) in (select private.my_writable_shop_ids())
  );

create policy product_images_update_members on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and private.safe_uuid((storage.foldername(name))[1]) in (select private.my_writable_shop_ids())
  );

create policy product_images_delete_members on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and private.safe_uuid((storage.foldername(name))[1]) in (select private.my_writable_shop_ids())
  );
