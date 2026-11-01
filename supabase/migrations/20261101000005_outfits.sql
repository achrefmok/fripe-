-- Préférences de style et tenues composées.

create table public.style_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  size text check (char_length(size) <= 20),
  shoe_size text check (char_length(shoe_size) <= 20),
  style text check (char_length(style) <= 30),
  occasion text check (char_length(occasion) <= 30),
  colors text[] not null default '{}' check (cardinality(colors) <= 6),
  budget_millimes integer check (budget_millimes > 0),
  updated_at timestamptz not null default now()
);

create trigger style_preferences_set_updated_at
  before update on public.style_preferences
  for each row execute function private.set_updated_at();

create type public.outfit_slot as enum ('top', 'bottom', 'shoes', 'accessory');

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  budget_millimes integer check (budget_millimes > 0),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outfits_user_idx on public.outfits (user_id, created_at desc);

create trigger outfits_set_updated_at
  before update on public.outfits
  for each row execute function private.set_updated_at();

create table public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  slot public.outfit_slot not null,
  product_id uuid not null references public.products (id) on delete cascade,
  primary key (outfit_id, slot)
);

create index outfit_items_product_idx on public.outfit_items (product_id);

-- Enregistrement atomique d'une tenue : création ou remplacement complet de ses articles.
create function public.save_outfit(
  p_outfit_id uuid,
  p_name text,
  p_budget_millimes integer,
  p_is_public boolean,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_outfit uuid := p_outfit_id;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'empty_outfit';
  end if;

  if v_outfit is null then
    perform private.enforce_rate_limit('save_outfit', 30, 86400);

    if (select count(*) from public.outfits o where o.user_id = v_user) >= 50 then
      raise exception 'too_many_outfits';
    end if;

    insert into public.outfits (user_id, name, budget_millimes, is_public)
    values (v_user, p_name, p_budget_millimes, p_is_public)
    returning id into v_outfit;
  else
    update public.outfits o
    set name = p_name, budget_millimes = p_budget_millimes, is_public = p_is_public
    where o.id = v_outfit and o.user_id = v_user;

    if not found then
      raise exception 'forbidden';
    end if;

    delete from public.outfit_items i where i.outfit_id = v_outfit;
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as x (slot text, product_id uuid)
    where not exists (
      select 1 from public.products p
      where p.id = x.product_id and p.publication_status = 'published'
    )
  ) then
    raise exception 'product_unavailable';
  end if;

  insert into public.outfit_items (outfit_id, slot, product_id)
  select v_outfit, x.slot::public.outfit_slot, x.product_id
  from jsonb_to_recordset(p_items) as x (slot text, product_id uuid);

  return v_outfit;
end;
$$;

revoke all on function public.save_outfit(uuid, text, integer, boolean, jsonb) from public, anon;
grant execute on function public.save_outfit(uuid, text, integer, boolean, jsonb) to authenticated;

alter table public.style_preferences enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

revoke all on public.style_preferences, public.outfits, public.outfit_items from anon, authenticated;

grant select, insert on public.style_preferences to authenticated;
-- user_id est requis par ON CONFLICT DO UPDATE ; la politique interdit de le changer.
grant update (user_id, size, shoe_size, style, occasion, colors, budget_millimes) on public.style_preferences to authenticated;
grant select on public.outfits, public.outfit_items to anon, authenticated;
grant delete on public.outfits to authenticated;

create policy style_preferences_select_own on public.style_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy style_preferences_insert_own on public.style_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy style_preferences_update_own on public.style_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy outfits_select_visible on public.outfits
  for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()));

create policy outfits_delete_own on public.outfits
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy outfit_items_select_visible on public.outfit_items
  for select to anon, authenticated
  using (outfit_id in (select o.id from public.outfits o));
