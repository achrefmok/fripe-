-- Avis clients. Une pièce est unique : un avis par article livré, jamais par commande fictive.
-- L'avis est publié immédiatement, puis modéré a posteriori. Il n'est pas modifiable par son auteur.

create type public.review_status as enum ('published', 'hidden');

alter table public.shops
  add column rating_count integer not null default 0,
  add column rating_sum integer not null default 0;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  client_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  product_title text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  status public.review_status not null default 'published',
  seller_reply text check (char_length(seller_reply) between 2 and 1000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index reviews_shop_idx on public.reviews (shop_id, created_at desc) where status = 'published';
create index reviews_client_idx on public.reviews (client_id);
create index reviews_status_idx on public.reviews (status, created_at desc);

-- Compteurs recalculés : la note d'une boutique ne dépend pas d'une somme incrémentale fragile.
create function private.refresh_shop_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid := coalesce(new.shop_id, old.shop_id);
begin
  update public.shops s
  set rating_count = x.total, rating_sum = x.points
  from (
    select count(*)::integer as total, coalesce(sum(r.rating), 0)::integer as points
    from public.reviews r
    where r.shop_id = v_shop and r.status = 'published'
  ) x
  where s.id = v_shop;

  return null;
end;
$$;

revoke all on function private.refresh_shop_rating() from public;

create trigger reviews_refresh_rating
  after insert or update of status or delete on public.reviews
  for each row execute function private.refresh_shop_rating();

create function public.create_review(p_order_item_id uuid, p_rating integer, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item record;
  v_author text;
  v_review uuid;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('create_review', 20, 86400);

  select i.id, i.title, o.shop_id, o.client_id, o.status into v_item
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where i.id = p_order_item_id;

  if v_item.id is null or v_item.client_id is distinct from v_user then
    raise exception 'forbidden';
  end if;

  if v_item.status <> 'delivered' then
    raise exception 'review_not_allowed';
  end if;

  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_rating';
  end if;

  select split_part(p.display_name, ' ', 1) into v_author from public.profiles p where p.id = v_user;

  begin
    insert into public.reviews (order_item_id, shop_id, client_id, author_name, product_title, rating, comment)
    values (
      p_order_item_id, v_item.shop_id, v_user, v_author, v_item.title, p_rating,
      nullif(btrim(coalesce(p_comment, '')), '')
    )
    returning id into v_review;
  exception when unique_violation then
    raise exception 'already_reviewed';
  end;

  return v_review;
end;
$$;

-- Une seule réponse par avis : elle reste publique telle qu'elle a été écrite.
create function public.reply_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews%rowtype;
begin
  select * into v_review from public.reviews r where r.id = p_review_id for update;

  if v_review.id is null or v_review.shop_id not in (select private.my_writable_shop_ids()) then
    raise exception 'forbidden';
  end if;

  if v_review.seller_reply is not null then
    raise exception 'already_replied';
  end if;

  if char_length(btrim(coalesce(p_reply, ''))) < 2 then
    raise exception 'note_required';
  end if;

  update public.reviews r
  set seller_reply = btrim(p_reply), replied_at = now()
  where r.id = p_review_id;
end;
$$;

create function public.moderate_review(
  p_review_id uuid,
  p_status public.review_status,
  p_note text
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

  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'note_required';
  end if;

  update public.reviews r set status = p_status where r.id = p_review_id;

  if not found then
    raise exception 'not_found';
  end if;

  perform private.log_audit(
    'review.' || p_status::text,
    'review',
    p_review_id::text,
    jsonb_build_object('note', p_note)
  );
end;
$$;

revoke all on function public.create_review(uuid, integer, text) from public, anon;
revoke all on function public.reply_review(uuid, text) from public, anon;
revoke all on function public.moderate_review(uuid, public.review_status, text) from public, anon;

grant execute on function public.create_review(uuid, integer, text) to authenticated;
grant execute on function public.reply_review(uuid, text) to authenticated;
grant execute on function public.moderate_review(uuid, public.review_status, text) to authenticated;

alter table public.reviews enable row level security;

revoke all on public.reviews from anon, authenticated;

-- Aucun droit d'écriture direct. L'auteur et la ligne de commande ne sont pas exposés : un avis
-- publié est public, son lien vers l'acheteur ne l'est pas.
grant select (
  id, shop_id, author_name, product_title, rating, comment, status, seller_reply, replied_at,
  created_at
) on public.reviews to anon, authenticated;

create policy reviews_select_visible on public.reviews
  for select to anon, authenticated
  using (
    status = 'published'
    or client_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

-- Le client retrouve ses propres avis par ligne de commande.
create view public.my_reviews with (security_barrier) as
  select r.id, r.order_item_id, r.rating, r.comment, r.status, r.seller_reply, r.created_at
  from public.reviews r
  where r.client_id = (select auth.uid());

revoke all on public.my_reviews from public, anon, authenticated;
grant select on public.my_reviews to authenticated;

-- Le signalement d'un avis fige sa note et son texte.
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
  elsif p_target_type = 'review' then
    select jsonb_build_object(
      'title', r.product_title,
      'shop', s.name,
      'shop_id', s.id,
      'client', r.author_name,
      'rating', r.rating,
      'comment', r.comment
    ) into v_snapshot
    from public.reviews r
    join public.shops s on s.id = r.shop_id
    where r.id = p_target_id and r.status = 'published';
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
