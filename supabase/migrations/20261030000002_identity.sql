-- Identité : profils, administrateurs, statut de compte.
-- Être client = avoir un compte. Être vendeur = être membre d'une boutique.
-- Être admin = figurer dans platform_admins, qui n'est jamais modifiable par un client.

create type public.account_status as enum ('active', 'suspended');
create type public.app_locale as enum ('fr', 'ar');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  phone text check (phone ~ '^\+216[2-9][0-9]{7}$'),
  locale public.app_locale not null default 'fr',
  avatar_path text,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins a
    join public.profiles p on p.id = a.user_id
    where a.user_id = (select auth.uid()) and p.status = 'active'
  );
$$;

revoke all on function private.is_active_user() from public;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_active_user() to anon, authenticated, service_role;
grant execute on function private.is_platform_admin() to anon, authenticated, service_role;

-- Création automatique du profil à l'inscription. Les métadonnées viennent du client :
-- elles sont bornées ici, jamais utilisées telles quelles.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80);
  v_locale text := new.raw_user_meta_data ->> 'locale';
begin
  if char_length(v_name) < 2 then
    v_name := 'Membre';
  end if;

  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    v_name,
    case when v_locale = 'ar' then 'ar'::public.app_locale else 'fr'::public.app_locale end
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.platform_admins from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, phone, locale, avatar_path) on public.profiles to authenticated;
grant select on public.platform_admins to authenticated;

create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and status = 'active')
  with check (id = (select auth.uid()));

create policy platform_admins_select_self on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));
