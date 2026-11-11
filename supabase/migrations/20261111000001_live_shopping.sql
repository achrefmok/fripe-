-- Live Shopping : une boutique validée programme un Live, le démarre depuis son studio, présente ses
-- pièces en ligne, en met une en avant, et les clients commentent en direct.
-- La vidéo elle-même va directement du téléphone de la boutique aux spectateurs (voir la migration
-- suivante) ; cette migration ne porte que les
-- données : le Live, ses pièces, ses commentaires. Rien n'est modifié dans l'existant.

create type public.live_status as enum ('scheduled', 'live', 'ended', 'cancelled');

create table public.lives (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  status public.live_status not null default 'scheduled',
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  -- La couverture est la photo d'une des pièces du Live ; la pièce mise en avant change pendant le direct.
  cover_product_id uuid references public.products (id) on delete set null,
  pinned_product_id uuid references public.products (id) on delete set null,
  viewer_peak integer not null default 0 check (viewer_peak >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lives_shop_idx on public.lives (shop_id, created_at desc);
create index lives_public_idx on public.lives (status, scheduled_at);
-- Une boutique ne diffuse qu'un Live à la fois.
create unique index lives_one_running_per_shop on public.lives (shop_id) where status = 'live';

create trigger lives_set_updated_at
  before update on public.lives
  for each row execute function private.set_updated_at();

create table public.live_products (
  live_id uuid not null references public.lives (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position smallint not null default 0,
  primary key (live_id, product_id)
);

create index live_products_product_idx on public.live_products (product_id);

create table public.live_comments (
  id bigint generated always as identity primary key,
  live_id uuid not null references public.lives (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Copie du nom affiché : les profils ne sont pas lisibles publiquement.
  author_name text not null check (char_length(author_name) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 300),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

create index live_comments_live_idx on public.live_comments (live_id, id);

-- Lecture : le Live d'une boutique validée est public tant qu'il n'est pas annulé ; la boutique voit
-- les siens, l'administration voit tout. Aucune écriture directe : tout passe par les fonctions.
alter table public.lives enable row level security;
alter table public.live_products enable row level security;
alter table public.live_comments enable row level security;

revoke all on public.lives, public.live_products, public.live_comments from anon, authenticated;
grant select on public.lives, public.live_products to anon, authenticated;
-- L'identifiant de l'auteur d'un commentaire n'est pas exposé : seul son nom affiché l'est.
grant select (id, live_id, author_name, body, hidden_at, created_at) on public.live_comments to anon, authenticated;
grant all on public.lives, public.live_products, public.live_comments to service_role;

create policy lives_select on public.lives
  for select to anon, authenticated
  using (
    (status <> 'cancelled' and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved'))
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy live_products_select on public.live_products
  for select to anon, authenticated
  using (live_id in (select l.id from public.lives l));

create policy live_comments_select on public.live_comments
  for select to anon, authenticated
  using (
    (hidden_at is null and live_id in (select l.id from public.lives l))
    or live_id in (select l.id from public.lives l where l.shop_id in (select private.my_shop_ids()))
    or (select private.is_platform_admin())
  );

-- Vérifie que les pièces appartiennent à la boutique et sont en ligne, puis remplace la liste.
create function private.set_live_products(p_live_id uuid, p_shop_id uuid, p_product_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := coalesce(array_length(p_product_ids, 1), 0);
begin
  if v_count > 30 or (select count(distinct x) from unnest(p_product_ids) x) <> v_count then
    raise exception 'live_pieces';
  end if;

  if v_count > 0 and (
    select count(*) from public.products p
    where p.id = any (p_product_ids)
      and p.shop_id = p_shop_id
      and p.publication_status = 'published'
      and p.status in ('available', 'reserved')
  ) <> v_count then
    raise exception 'live_pieces';
  end if;

  delete from public.live_products lp
  where lp.live_id = p_live_id and not (lp.product_id = any (coalesce(p_product_ids, '{}'::uuid[])));

  insert into public.live_products (live_id, product_id, position)
  select p_live_id, x.id, x.ord - 1
  from unnest(p_product_ids) with ordinality as x (id, ord)
  on conflict (live_id, product_id) do update set position = excluded.position;
end;
$$;

revoke all on function private.set_live_products(uuid, uuid, uuid[]) from public;

-- Créer ou modifier un Live : titre, description, date, pièces et couverture. Pendant le direct,
-- seules la description et les pièces changent encore.
create function public.save_live(
  p_live_id uuid,
  p_shop_id uuid,
  p_title text,
  p_description text,
  p_scheduled_at timestamptz,
  p_product_ids uuid[],
  p_cover_product_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_live_id;
  v_shop uuid := p_shop_id;
  v_status public.live_status;
  v_ids uuid[] := coalesce(p_product_ids, '{}'::uuid[]);
begin
  if p_live_id is not null then
    select shop_id, status into v_shop, v_status from public.lives where id = p_live_id for update;
    if v_shop is null then
      raise exception 'not_found';
    end if;
  end if;

  if not private.has_shop_role(v_shop, array['owner', 'manager']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.shops s where s.id = v_shop and s.status = 'approved') then
    raise exception 'shop_not_approved';
  end if;

  if v_status in ('ended', 'cancelled') then
    raise exception 'invalid_transition';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 80 then
    raise exception 'live_title';
  end if;

  if char_length(coalesce(p_description, '')) > 500 then
    raise exception 'live_title';
  end if;

  if p_scheduled_at is not null and v_status is distinct from 'live'
     and (p_scheduled_at < now() - interval '5 minutes' or p_scheduled_at > now() + interval '60 days') then
    raise exception 'live_schedule';
  end if;

  if p_cover_product_id is not null and not (p_cover_product_id = any (v_ids)) then
    raise exception 'live_pieces';
  end if;

  if p_live_id is null then
    perform private.enforce_rate_limit('save_live', 12, 86400);

    insert into public.lives (shop_id, title, description, scheduled_at)
    values (v_shop, btrim(p_title), btrim(coalesce(p_description, '')), p_scheduled_at)
    returning id into v_id;

    perform private.log_audit('live.created', 'live', v_id::text, jsonb_build_object('shop_id', v_shop));
  else
    update public.lives
    set title = case when v_status = 'live' then title else btrim(p_title) end,
        description = btrim(coalesce(p_description, '')),
        scheduled_at = case when v_status = 'live' then scheduled_at else p_scheduled_at end
    where id = v_id;
  end if;

  perform private.set_live_products(v_id, v_shop, v_ids);

  update public.lives
  set cover_product_id = coalesce(p_cover_product_id, v_ids[1]),
      pinned_product_id = case when pinned_product_id = any (v_ids) then pinned_product_id else null end
  where id = v_id;

  return v_id;
end;
$$;

-- Démarrer le direct : un seul Live en cours par boutique.
create function public.start_live(p_live_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_status public.live_status;
begin
  select shop_id, status into v_shop, v_status from public.lives where id = p_live_id for update;

  if v_shop is null or not private.has_shop_role(v_shop, array['owner', 'manager']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.shops s where s.id = v_shop and s.status = 'approved') then
    raise exception 'shop_not_approved';
  end if;

  if v_status <> 'scheduled' then
    raise exception 'invalid_transition';
  end if;

  if exists (select 1 from public.lives l where l.shop_id = v_shop and l.status = 'live') then
    raise exception 'live_running';
  end if;

  update public.lives set status = 'live', started_at = now() where id = p_live_id;
  perform private.log_audit('live.started', 'live', p_live_id::text, jsonb_build_object('shop_id', v_shop));
end;
$$;

-- Terminer le direct.
create function public.end_live(p_live_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_status public.live_status;
begin
  select shop_id, status into v_shop, v_status from public.lives where id = p_live_id for update;

  if v_shop is null or not (
    private.has_shop_role(v_shop, array['owner', 'manager']::public.shop_role[]) or private.is_platform_admin()
  ) then
    raise exception 'forbidden';
  end if;

  if v_status <> 'live' then
    raise exception 'invalid_transition';
  end if;

  update public.lives set status = 'ended', ended_at = now(), pinned_product_id = null where id = p_live_id;
  perform private.log_audit('live.ended', 'live', p_live_id::text, jsonb_build_object('shop_id', v_shop));
end;
$$;

-- Retirer un Live qui n'est pas en cours : programmé, terminé ou annulé.
create function public.withdraw_live(p_live_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_status public.live_status;
begin
  select shop_id, status into v_shop, v_status from public.lives where id = p_live_id for update;

  if v_shop is null or not private.has_shop_role(v_shop, array['owner', 'manager']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  if v_status = 'live' then
    raise exception 'invalid_transition';
  end if;

  delete from public.lives where id = p_live_id;
  perform private.log_audit('live.withdrawn', 'live', p_live_id::text, jsonb_build_object('shop_id', v_shop));
end;
$$;

-- Mettre une pièce en avant pendant le direct, ou n'en mettre aucune.
create function public.pin_live_product(p_live_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_status public.live_status;
begin
  select shop_id, status into v_shop, v_status from public.lives where id = p_live_id for update;

  if v_shop is null or not private.has_shop_role(v_shop, array['owner', 'manager', 'staff']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  if v_status <> 'live' then
    raise exception 'live_not_live';
  end if;

  if p_product_id is not null and not exists (
    select 1 from public.live_products lp where lp.live_id = p_live_id and lp.product_id = p_product_id
  ) then
    raise exception 'live_pieces';
  end if;

  update public.lives set pinned_product_id = p_product_id where id = p_live_id;
end;
$$;

-- Le studio remonte le nombre de spectateurs : on ne garde que le pic.
create function public.report_live_viewers(p_live_id uuid, p_count integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select shop_id into v_shop from public.lives where id = p_live_id and status = 'live';

  if v_shop is null or not private.has_shop_role(v_shop, array['owner', 'manager', 'staff']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  update public.lives
  set viewer_peak = greatest(viewer_peak, least(greatest(coalesce(p_count, 0), 0), 100000))
  where id = p_live_id and viewer_peak < least(greatest(coalesce(p_count, 0), 0), 100000);
end;
$$;

-- Commenter pendant le direct : compte actif, non bloqué par la boutique, débit limité.
create function public.post_live_comment(p_live_id uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_shop uuid;
  v_status public.live_status;
  v_name text;
  v_body text := btrim(coalesce(p_body, ''));
  v_id bigint;
begin
  if v_user is null or not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  select l.shop_id, l.status into v_shop, v_status
  from public.lives l
  join public.shops s on s.id = l.shop_id and s.status = 'approved'
  where l.id = p_live_id;

  if v_shop is null then
    raise exception 'not_found';
  end if;

  if v_status <> 'live' then
    raise exception 'live_not_live';
  end if;

  if private.is_blocked(v_user, v_shop) then
    raise exception 'blocked';
  end if;

  if char_length(v_body) not between 1 and 300 then
    raise exception 'message_invalid';
  end if;

  perform private.enforce_rate_limit('live_comment', 12, 60);

  select display_name into v_name from public.profiles where id = v_user;

  insert into public.live_comments (live_id, user_id, author_name, body)
  values (p_live_id, v_user, v_name, v_body)
  returning id into v_id;

  update public.lives set comment_count = comment_count + 1 where id = p_live_id;
  return v_id;
end;
$$;

-- Modération du fil : la boutique masque ou rétablit un commentaire.
create function public.moderate_live_comment(p_comment_id bigint, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select l.shop_id into v_shop
  from public.live_comments c
  join public.lives l on l.id = c.live_id
  where c.id = p_comment_id;

  if v_shop is null or not (
    private.has_shop_role(v_shop, array['owner', 'manager', 'staff']::public.shop_role[]) or private.is_platform_admin()
  ) then
    raise exception 'forbidden';
  end if;

  update public.live_comments
  set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end
  where id = p_comment_id;
end;
$$;

revoke all on function public.save_live(uuid, uuid, text, text, timestamptz, uuid[], uuid) from public, anon;
revoke all on function public.start_live(uuid) from public, anon;
revoke all on function public.end_live(uuid) from public, anon;
revoke all on function public.withdraw_live(uuid) from public, anon;
revoke all on function public.pin_live_product(uuid, uuid) from public, anon;
revoke all on function public.report_live_viewers(uuid, integer) from public, anon;
revoke all on function public.post_live_comment(uuid, text) from public, anon;
revoke all on function public.moderate_live_comment(bigint, boolean) from public, anon;
grant execute on function public.save_live(uuid, uuid, text, text, timestamptz, uuid[], uuid) to authenticated;
grant execute on function public.start_live(uuid) to authenticated;
grant execute on function public.end_live(uuid) to authenticated;
grant execute on function public.withdraw_live(uuid) to authenticated;
grant execute on function public.pin_live_product(uuid, uuid) to authenticated;
grant execute on function public.report_live_viewers(uuid, integer) to authenticated;
grant execute on function public.post_live_comment(uuid, text) to authenticated;
grant execute on function public.moderate_live_comment(bigint, boolean) to authenticated;

-- Le fil et l'état du Live se mettent à jour en direct ; la RLS s'applique aussi au temps réel.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lives, public.live_comments;
  end if;
end;
$$;
