-- Socle : extensions, schéma privé (non exposé par l'API), helpers génériques.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Conversion sans erreur : un chemin Storage arbitraire ne doit pas faire planter une politique.
create function private.safe_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.safe_uuid(text) from public;
grant execute on function private.safe_uuid(text) to anon, authenticated, service_role;
