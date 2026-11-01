-- Suivi de boutiques, notifications internes et alertes Drop Alert.

alter table public.shops add column follower_count integer not null default 0;

create table public.shop_followers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create index shop_followers_shop_idx on public.shop_followers (shop_id);

create function private.count_followers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shops
  set follower_count = follower_count + case when tg_op = 'INSERT' then 1 else -1 end
  where id = coalesce(new.shop_id, old.shop_id);

  return null;
end;
$$;

revoke all on function private.count_followers() from public;

create trigger shop_followers_count
  after insert or delete on public.shop_followers
  for each row execute function private.count_followers();

-- push_enabled est préparé : aucun envoi Web Push n'existe encore.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  max_per_day smallint not null default 10 check (max_per_day between 1 and 50),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function private.set_updated_at();

create table public.drop_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  sizes text[] not null default '{}',
  brands text[] not null default '{}',
  category_ids uuid[] not null default '{}',
  shop_ids uuid[] not null default '{}',
  followed_only boolean not null default false,
  max_price_millimes integer check (max_price_millimes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    cardinality(sizes) <= 10 and cardinality(brands) <= 10
    and cardinality(category_ids) <= 10 and cardinality(shop_ids) <= 10
  )
);

create index drop_alerts_user_idx on public.drop_alerts (user_id);
create index drop_alerts_active_idx on public.drop_alerts (is_active) where is_active;

create trigger drop_alerts_set_updated_at
  before update on public.drop_alerts
  for each row execute function private.set_updated_at();

-- Tailles et marques normalisées pour une comparaison sans casse.
create function private.prepare_drop_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (
    select count(*) from public.drop_alerts a where a.user_id = new.user_id
  ) >= 10 then
    raise exception 'too_many_alerts';
  end if;

  new.sizes := (select coalesce(array_agg(lower(btrim(s))), '{}') from unnest(new.sizes) s);
  new.brands := (select coalesce(array_agg(lower(btrim(b))), '{}') from unnest(new.brands) b);

  return new;
end;
$$;

revoke all on function private.prepare_drop_alert() from public;

create trigger drop_alerts_prepare
  before insert or update on public.drop_alerts
  for each row execute function private.prepare_drop_alert();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('drop_alert')),
  product_id uuid references public.products (id) on delete cascade,
  alert_id uuid references public.drop_alerts (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, kind)
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Une seule notification par personne et par pièce, dans la limite quotidienne de chacun.
create function private.dispatch_drop_alerts(p_product_ids uuid[])
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

revoke all on function private.dispatch_drop_alerts(uuid[]) from public;

-- Publication : envoie les alertes à la première mise en ligne seulement.
create or replace function public.set_products_publication(
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
  v_first uuid[] := '{}';
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

    if p_status = 'published' and v_product.published_at is null then
      v_first := v_first || v_product.id;
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

  if cardinality(v_first) > 0 then
    perform private.dispatch_drop_alerts(v_first);
  end if;

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

alter table public.shop_followers enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.drop_alerts enable row level security;
alter table public.notifications enable row level security;

revoke all on public.shop_followers, public.notification_preferences, public.drop_alerts,
  public.notifications from anon, authenticated;

grant select, insert, delete on public.shop_followers to authenticated;
grant select, insert on public.notification_preferences to authenticated;
-- user_id est requis par ON CONFLICT DO UPDATE ; la politique interdit de le changer.
grant update (user_id, in_app_enabled, push_enabled, max_per_day) on public.notification_preferences to authenticated;
grant select, insert, delete on public.drop_alerts to authenticated;
grant update (name, sizes, brands, category_ids, shop_ids, followed_only, max_price_millimes, is_active)
  on public.drop_alerts to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- L'identité des abonnés reste privée : la boutique ne voit que le compteur.
create policy shop_followers_select_own on public.shop_followers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy shop_followers_insert_own on public.shop_followers
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy shop_followers_delete_own on public.shop_followers
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy drop_alerts_select_own on public.drop_alerts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy drop_alerts_insert_own on public.drop_alerts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy drop_alerts_update_own on public.drop_alerts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy drop_alerts_delete_own on public.drop_alerts
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
