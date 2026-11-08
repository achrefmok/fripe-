-- Les arrivages : une boutique annonce un nouvel arrivage (un titre et des pièces déjà en ligne),
-- l'administration le valide, et seuls les arrivages validés paraissent en tête de l'accueil.
-- Les pièces elles-mêmes restent publiées comme avant : seule la mise en avant est validée.

create type public.arrival_status as enum ('pending', 'approved', 'rejected');

create table public.arrivals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  note text check (char_length(note) <= 300),
  status public.arrival_status not null default 'pending',
  review_note text check (char_length(review_note) <= 300),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index arrivals_shop_idx on public.arrivals (shop_id, created_at desc);
create index arrivals_public_idx on public.arrivals (reviewed_at desc) where status = 'approved';
create index arrivals_pending_idx on public.arrivals (created_at) where status = 'pending';

create table public.arrival_products (
  arrival_id uuid not null references public.arrivals (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position smallint not null default 0,
  primary key (arrival_id, product_id)
);

create index arrival_products_product_idx on public.arrival_products (product_id);

-- Lecture : un arrivage validé d'une boutique validée est public ; la boutique voit les siens,
-- l'administration voit tout. Aucune écriture directe : tout passe par les fonctions ci-dessous.
alter table public.arrivals enable row level security;
alter table public.arrival_products enable row level security;

revoke all on public.arrivals, public.arrival_products from anon, authenticated;
grant select on public.arrivals, public.arrival_products to anon, authenticated;
grant all on public.arrivals, public.arrival_products to service_role;

create policy arrivals_select on public.arrivals
  for select to anon, authenticated
  using (
    (status = 'approved' and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved'))
    or shop_id in (select private.my_shop_ids())
    or (select private.is_platform_admin())
  );

create policy arrival_products_select on public.arrival_products
  for select to anon, authenticated
  using (arrival_id in (select a.id from public.arrivals a));

-- La boutique annonce son arrivage : 1 à 12 de ses pièces en ligne, en attente de validation.
create function public.submit_arrival(p_shop_id uuid, p_title text, p_note text, p_product_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := coalesce(array_length(p_product_ids, 1), 0);
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'manager']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.shops s where s.id = p_shop_id and s.status = 'approved') then
    raise exception 'shop_not_approved';
  end if;

  perform private.enforce_rate_limit('submit_arrival', 10, 86400);

  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 80 then
    raise exception 'arrival_title';
  end if;

  if v_count not between 1 and 12 or (select count(distinct x) from unnest(p_product_ids) x) <> v_count then
    raise exception 'arrival_pieces';
  end if;

  if (
    select count(*) from public.products p
    where p.id = any (p_product_ids)
      and p.shop_id = p_shop_id
      and p.publication_status = 'published'
      and p.status in ('available', 'reserved')
  ) <> v_count then
    raise exception 'arrival_pieces';
  end if;

  insert into public.arrivals (shop_id, title, note)
  values (p_shop_id, btrim(p_title), nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  insert into public.arrival_products (arrival_id, product_id, position)
  select v_id, x.id, x.ord - 1
  from unnest(p_product_ids) with ordinality as x (id, ord);

  perform private.log_audit('arrival.submitted', 'arrival', v_id::text, jsonb_build_object('shop_id', p_shop_id, 'pieces', v_count));
  return v_id;
end;
$$;

-- L'administration valide ou refuse, avec un motif pour un refus.
create function public.review_arrival(p_arrival_id uuid, p_status public.arrival_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.arrival_status;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  select status into v_current from public.arrivals where id = p_arrival_id for update;

  if v_current is null then
    raise exception 'not_found';
  end if;

  if v_current <> 'pending' or p_status not in ('approved', 'rejected') then
    raise exception 'invalid_transition';
  end if;

  if p_status = 'rejected' and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'note_required';
  end if;

  update public.arrivals
  set status = p_status,
      review_note = case when p_status = 'rejected' then btrim(p_note) else null end,
      reviewed_at = now()
  where id = p_arrival_id;

  perform private.log_audit('arrival.' || p_status::text, 'arrival', p_arrival_id::text,
    case when p_status = 'rejected' then jsonb_build_object('reason', btrim(p_note)) else '{}'::jsonb end);
end;
$$;

-- La boutique retire son arrivage, validé ou non.
create function public.withdraw_arrival(p_arrival_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select shop_id into v_shop from public.arrivals where id = p_arrival_id;

  if v_shop is null or not private.has_shop_role(v_shop, array['owner', 'manager']::public.shop_role[]) then
    raise exception 'forbidden';
  end if;

  delete from public.arrivals where id = p_arrival_id;
  perform private.log_audit('arrival.withdrawn', 'arrival', p_arrival_id::text, jsonb_build_object('shop_id', v_shop));
end;
$$;

revoke all on function public.submit_arrival(uuid, text, text, uuid[]) from public, anon;
revoke all on function public.review_arrival(uuid, public.arrival_status, text) from public, anon;
revoke all on function public.withdraw_arrival(uuid) from public, anon;
grant execute on function public.submit_arrival(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.review_arrival(uuid, public.arrival_status, text) to authenticated;
grant execute on function public.withdraw_arrival(uuid) to authenticated;
