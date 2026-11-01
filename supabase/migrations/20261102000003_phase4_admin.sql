-- Administration : catégories, gouvernorats, délégations. Les écritures passent par les droits
-- d'administrateur vérifiés en RLS ; un trigger journalise toute modification, quelle qu'en soit
-- l'origine.

alter table public.cities add column is_active boolean not null default true;

create function private.audit_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  perform private.log_audit(
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    jsonb_build_object('name_fr', v_row ->> 'name_fr', 'name_ar', v_row ->> 'name_ar')
  );

  return null;
end;
$$;

revoke all on function private.audit_reference() from public;

create trigger categories_audit
  after insert or update or delete on public.categories
  for each row execute function private.audit_reference();

create trigger cities_audit
  after insert or update or delete on public.cities
  for each row execute function private.audit_reference();

create trigger governorates_audit
  after update on public.governorates
  for each row execute function private.audit_reference();

-- Deux niveaux seulement : catégorie, puis sous-catégorie. Désactiver un parent désactive ses
-- enfants, sans quoi une sous-catégorie resterait proposée sous un parent invisible.
create function private.guard_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id
      or exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null)
      or exists (select 1 from public.categories c where c.parent_id = new.id) then
      raise exception 'invalid_parent';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_category() from public;

create trigger categories_guard
  before insert or update of parent_id on public.categories
  for each row execute function private.guard_category();

create function private.cascade_category_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active then
    update public.categories c set is_active = false where c.parent_id = new.id and c.is_active;
  end if;

  return null;
end;
$$;

revoke all on function private.cascade_category_state() from public;

create trigger categories_cascade_state
  after update of is_active on public.categories
  for each row execute function private.cascade_category_state();

-- Une délégation désactivée n'est plus choisie pour une nouvelle boutique ou une livraison ;
-- les boutiques et les commandes existantes la conservent.
create function private.require_active_city()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.city_id is not null
    and (tg_op = 'INSERT' or new.city_id is distinct from old.city_id)
    and exists (select 1 from public.cities c where c.id = new.city_id and not c.is_active) then
    raise exception 'invalid_location';
  end if;

  return new;
end;
$$;

revoke all on function private.require_active_city() from public;

create trigger shops_active_city
  before insert or update of city_id on public.shops
  for each row execute function private.require_active_city();

create trigger order_groups_active_city
  before insert on public.order_groups
  for each row execute function private.require_active_city();

grant delete on public.categories to authenticated;
grant insert (governorate_id, slug, name_fr, name_ar, is_active) on public.cities to authenticated;
grant update (slug, name_fr, name_ar, is_active) on public.cities to authenticated;
grant delete on public.cities to authenticated;
grant update (name_fr, name_ar) on public.governorates to authenticated;

create policy categories_delete_admin on public.categories
  for delete to authenticated
  using ((select private.is_platform_admin()));

create policy cities_insert_admin on public.cities
  for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy cities_update_admin on public.cities
  for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy cities_delete_admin on public.cities
  for delete to authenticated
  using ((select private.is_platform_admin()));

create policy governorates_update_admin on public.governorates
  for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- Suspensions décidées depuis un signalement ; la conversation n'a pas de coupable désigné.
create or replace function public.review_report(
  p_report_id uuid,
  p_decision public.report_decision,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_shop uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'note_required';
  end if;

  select * into v_report from public.reports r where r.id = p_report_id for update;

  if v_report.id is null then
    raise exception 'not_found';
  end if;

  if v_report.status <> 'open' then
    raise exception 'invalid_transition';
  end if;

  if p_decision = 'remove_content' then
    if v_report.target_type = 'product' then
      update public.products p
      set publication_status = 'archived', moderated_at = now()
      where p.id = v_report.target_id;
    elsif v_report.target_type = 'video' then
      update public.videos v
      set status = 'archived', moderated_at = now()
      where v.id = v_report.target_id;
    elsif v_report.target_type = 'conversation' then
      update public.conversations c set closed_at = now() where c.id = v_report.target_id;
    elsif v_report.target_type = 'review' then
      update public.reviews r set status = 'hidden' where r.id = v_report.target_id;
    else
      raise exception 'invalid_decision';
    end if;
  elsif p_decision = 'suspend' then
    if v_report.target_type = 'account' then
      if exists (select 1 from public.platform_admins a where a.user_id = v_report.target_id) then
        raise exception 'protected_account';
      end if;

      update public.profiles p set status = 'suspended' where p.id = v_report.target_id;

      perform private.log_audit(
        'user.suspended', 'user', v_report.target_id::text,
        jsonb_build_object('report', p_report_id, 'reason', p_note)
      );
    elsif v_report.target_type in ('shop', 'product', 'video') then
      v_shop := (v_report.snapshot ->> 'shop_id')::uuid;

      update public.shops s
      set status = 'suspended', review_note = p_note
      where s.id = v_shop and s.status = 'approved';

      perform private.log_audit(
        'shop.suspended', 'shop', v_shop::text,
        jsonb_build_object('report', p_report_id, 'note', p_note)
      );
    else
      raise exception 'invalid_decision';
    end if;
  end if;

  update public.reports r
  set status = case when p_decision = 'dismiss' then 'dismissed' else 'resolved' end::public.report_status
  where r.id = p_report_id;

  insert into public.report_decisions (report_id, admin_id, decision, note)
  values (p_report_id, (select auth.uid()), p_decision, p_note);

  perform private.log_audit(
    'report.' || p_decision::text,
    v_report.target_type::text,
    v_report.target_id::text,
    jsonb_build_object('report', p_report_id, 'note', p_note)
  );
end;
$$;
