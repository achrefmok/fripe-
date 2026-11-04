-- Marketplace et Vide-Dressing.
--
-- Le catalogue mode ne change pas : ses catégories restent « mode » et ses produits restent ceux des
-- boutiques. Les autres produits ont leur propre arbre de catégories. Les particuliers publient des
-- annonces, séparées des produits professionnels : dans la Marketplace, ou dans le Vide-Dressing
-- pour la mode. La vente se conclut par message, sans paiement en ligne.

-- Catégories ---------------------------------------------------------------------------------------

alter table public.categories add column section public.category_section not null default 'mode';

-- Une sous-catégorie vit toujours dans la rubrique de sa catégorie racine.
create function private.inherit_category_section()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    select c.section into new.section from public.categories c where c.id = new.parent_id;
  end if;

  return new;
end;
$$;
revoke all on function private.inherit_category_section() from public;

create trigger categories_inherit_section
  before insert or update of parent_id, section on public.categories
  for each row execute function private.inherit_category_section();

create function private.cascade_category_section()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null and new.section <> old.section then
    update public.categories c set section = new.section where c.parent_id = new.id;
  end if;

  return null;
end;
$$;
revoke all on function private.cascade_category_section() from public;

create trigger categories_cascade_section
  after update of section on public.categories
  for each row execute function private.cascade_category_section();

insert into public.categories (slug, name_fr, name_ar, position, section) values
  ('electromenager', 'Électroménager', 'الأجهزة الكهرومنزلية', 1, 'marketplace'),
  ('informatique-electronique', 'Informatique et électronique', 'الإعلامية والإلكترونيات', 2, 'marketplace'),
  ('velos-mobilite', 'Vélos et mobilité', 'الدراجات والتنقل', 3, 'marketplace'),
  ('mobilier', 'Mobilier', 'الأثاث', 4, 'marketplace'),
  ('maison-decoration', 'Maison et décoration', 'المنزل والديكور', 5, 'marketplace'),
  ('sport-loisirs', 'Sport et loisirs', 'الرياضة والترفيه', 6, 'marketplace'),
  ('jeux-jouets', 'Jeux et jouets', 'الألعاب واللعب', 7, 'marketplace'),
  ('bricolage-jardinage', 'Bricolage et jardinage', 'الأشغال اليدوية والبستنة', 8, 'marketplace'),
  ('auto-accessoires', 'Automobile et accessoires', 'السيارات وإكسسواراتها', 9, 'marketplace'),
  ('autres-produits', 'Autres produits', 'منتجات أخرى', 10, 'marketplace');

insert into public.categories (parent_id, slug, name_fr, name_ar, position)
select r.id, c.slug, c.name_fr, c.name_ar, c.position
from (values
  ('electromenager', 'refrigerateurs', 'Réfrigérateurs', 'ثلاجات', 1),
  ('electromenager', 'machines-a-laver', 'Machines à laver', 'غسالات', 2),
  ('electromenager', 'climatiseurs', 'Climatiseurs', 'مكيفات', 3),
  ('electromenager', 'fours-cuisinieres', 'Fours et cuisinières', 'أفران وطباخات', 4),
  ('electromenager', 'petit-electromenager', 'Petit électroménager', 'أجهزة منزلية صغيرة', 5),
  ('informatique-electronique', 'ordinateurs', 'Ordinateurs', 'حواسيب', 1),
  ('informatique-electronique', 'telephones', 'Téléphones', 'هواتف', 2),
  ('informatique-electronique', 'televisions', 'Télévisions', 'تلفزات', 3),
  ('informatique-electronique', 'tablettes', 'Tablettes', 'أجهزة لوحية', 4),
  ('informatique-electronique', 'audio-photo', 'Audio, photo et vidéo', 'صوت وصورة وفيديو', 5),
  ('informatique-electronique', 'consoles-jeux-video', 'Consoles et jeux vidéo', 'أجهزة وألعاب الفيديو', 6),
  ('velos-mobilite', 'velos', 'Vélos', 'دراجات هوائية', 1),
  ('velos-mobilite', 'trottinettes', 'Trottinettes', 'سكوترات', 2),
  ('velos-mobilite', 'accessoires-velo', 'Accessoires vélo', 'إكسسوارات الدراجات', 3),
  ('mobilier', 'chaises', 'Chaises', 'كراسي', 1),
  ('mobilier', 'tables', 'Tables', 'طاولات', 2),
  ('mobilier', 'canapes', 'Canapés', 'أرائك', 3),
  ('mobilier', 'lits', 'Lits', 'أسرّة', 4),
  ('mobilier', 'rangements', 'Armoires et rangements', 'خزائن ورفوف', 5),
  ('maison-decoration', 'decoration', 'Décoration', 'ديكور', 1),
  ('maison-decoration', 'luminaires', 'Luminaires', 'إنارة', 2),
  ('maison-decoration', 'linge-de-maison', 'Linge de maison', 'مفروشات', 3),
  ('maison-decoration', 'vaisselle', 'Vaisselle et cuisine', 'أواني ومطبخ', 4),
  ('sport-loisirs', 'fitness', 'Fitness et musculation', 'لياقة بدنية', 1),
  ('sport-loisirs', 'sports-collectifs', 'Sports collectifs', 'رياضات جماعية', 2),
  ('sport-loisirs', 'camping-plein-air', 'Camping et plein air', 'تخييم وهواء طلق', 3),
  ('sport-loisirs', 'instruments-musique', 'Instruments de musique', 'آلات موسيقية', 4),
  ('sport-loisirs', 'livres', 'Livres', 'كتب', 5),
  ('jeux-jouets', 'jouets', 'Jouets', 'لعب أطفال', 1),
  ('jeux-jouets', 'jeux-de-societe', 'Jeux de société', 'ألعاب جماعية', 2),
  ('jeux-jouets', 'puericulture', 'Puériculture', 'مستلزمات الرضّع', 3),
  ('bricolage-jardinage', 'outillage', 'Outillage', 'عُدّة وأدوات', 1),
  ('bricolage-jardinage', 'jardin', 'Jardin', 'حديقة', 2),
  ('bricolage-jardinage', 'materiaux', 'Matériaux', 'مواد بناء', 3),
  ('auto-accessoires', 'pieces-auto', 'Pièces auto', 'قطع غيار السيارات', 1),
  ('auto-accessoires', 'accessoires-auto', 'Accessoires auto', 'إكسسوارات السيارات', 2),
  ('auto-accessoires', 'equipement-moto', 'Équipement moto', 'تجهيزات الدراجات النارية', 3)
) as c (root, slug, name_fr, name_ar, position)
join public.categories r on r.slug = c.root;

-- Filtres propres à chaque catégorie : marque d'un réfrigérateur, taille de cadre d'un vélo…
create table public.category_attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label_fr text not null check (char_length(label_fr) between 2 and 40),
  label_ar text not null check (char_length(label_ar) between 2 and 40),
  kind text not null check (kind in ('choice', 'text')),
  -- Pour un choix : [{"value": "...", "fr": "...", "ar": "..."}].
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position smallint not null default 0,
  unique (category_id, key)
);

create index category_attributes_category_idx on public.category_attributes (category_id, position);

insert into public.category_attributes (category_id, key, label_fr, label_ar, kind, options, position)
select r.id, a.key, a.label_fr, a.label_ar, a.kind, a.options::jsonb, a.position
from (values
  ('electromenager', 'marque', 'Marque', 'العلامة', 'text', '[]', 1),
  ('electromenager', 'classe_energie', 'Classe énergie', 'فئة الطاقة', 'choice',
    '[{"value":"a+++","fr":"A+++","ar":"A+++"},{"value":"a++","fr":"A++","ar":"A++"},{"value":"a+","fr":"A+","ar":"A+"},{"value":"a","fr":"A","ar":"A"},{"value":"b","fr":"B ou moins","ar":"B أو أقل"}]', 2),
  ('informatique-electronique', 'marque', 'Marque', 'العلامة', 'text', '[]', 1),
  ('informatique-electronique', 'stockage', 'Stockage', 'السعة', 'choice',
    '[{"value":"64","fr":"64 Go ou moins","ar":"64 جيغا أو أقل"},{"value":"128","fr":"128 Go","ar":"128 جيغا"},{"value":"256","fr":"256 Go","ar":"256 جيغا"},{"value":"512","fr":"512 Go","ar":"512 جيغا"},{"value":"1000","fr":"1 To ou plus","ar":"1 تيرا أو أكثر"}]', 2),
  ('velos-mobilite', 'type_velo', 'Type', 'النوع', 'choice',
    '[{"value":"ville","fr":"Ville","ar":"مدينة"},{"value":"vtt","fr":"VTT","ar":"جبلية"},{"value":"route","fr":"Route","ar":"طريق"},{"value":"enfant","fr":"Enfant","ar":"أطفال"},{"value":"electrique","fr":"Électrique","ar":"كهربائية"}]', 1),
  ('velos-mobilite', 'taille_cadre', 'Taille du cadre', 'مقاس الإطار', 'choice',
    '[{"value":"xs","fr":"XS","ar":"XS"},{"value":"s","fr":"S","ar":"S"},{"value":"m","fr":"M","ar":"M"},{"value":"l","fr":"L","ar":"L"},{"value":"xl","fr":"XL","ar":"XL"}]', 2),
  ('mobilier', 'matiere', 'Matière', 'المادة', 'choice',
    '[{"value":"bois","fr":"Bois","ar":"خشب"},{"value":"metal","fr":"Métal","ar":"معدن"},{"value":"tissu","fr":"Tissu","ar":"قماش"},{"value":"cuir","fr":"Cuir","ar":"جلد"},{"value":"plastique","fr":"Plastique","ar":"بلاستيك"},{"value":"verre","fr":"Verre","ar":"زجاج"}]', 1),
  ('jeux-jouets', 'age', 'Âge', 'السن', 'choice',
    '[{"value":"0-2","fr":"0 à 2 ans","ar":"من 0 إلى 2 سنوات"},{"value":"3-5","fr":"3 à 5 ans","ar":"من 3 إلى 5 سنوات"},{"value":"6-9","fr":"6 à 9 ans","ar":"من 6 إلى 9 سنوات"},{"value":"10+","fr":"10 ans et plus","ar":"10 سنوات فأكثر"}]', 1),
  ('auto-accessoires', 'marque', 'Marque du véhicule', 'علامة السيارة', 'text', '[]', 1)
) as a (root, key, label_fr, label_ar, kind, options, position)
join public.categories r on r.slug = a.root;

alter table public.category_attributes enable row level security;
revoke all on public.category_attributes from anon, authenticated;
grant select on public.category_attributes to anon, authenticated;
grant insert, update, delete on public.category_attributes to authenticated;

create policy category_attributes_select_all on public.category_attributes
  for select to anon, authenticated
  using (true);

create policy category_attributes_write_admin on public.category_attributes
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- Les produits des boutiques peuvent aussi porter ces caractéristiques dans la Marketplace.
alter table public.products
  add column attributes jsonb not null default '{}'::jsonb
  check (jsonb_typeof(attributes) = 'object');

-- Les colonnes des produits sont accordées une à une : la nouvelle aussi.
grant select (attributes) on public.products to anon, authenticated;
grant insert (attributes), update (attributes) on public.products to authenticated;

-- Contrôle commun : seules les caractéristiques prévues pour la catégorie (ou sa racine) sont
-- acceptées, une valeur de choix doit figurer dans la liste.
create function private.check_attributes(p_category uuid, p_attributes jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_attribute public.category_attributes%rowtype;
begin
  if p_attributes is null or p_attributes = '{}'::jsonb then
    return;
  end if;

  if jsonb_typeof(p_attributes) <> 'object' or (select count(*) from jsonb_object_keys(p_attributes)) > 12 then
    raise exception 'invalid_attributes';
  end if;

  for v_entry in select key, value from jsonb_each(p_attributes) loop
    select a.* into v_attribute
    from public.category_attributes a
    join public.categories c on c.id = p_category
    where a.key = v_entry.key and a.category_id in (c.id, c.parent_id)
    limit 1;

    if v_attribute.id is null
      or jsonb_typeof(v_entry.value) <> 'string'
      or char_length(v_entry.value #>> '{}') not between 1 and 60
      or (
        v_attribute.kind = 'choice'
        and not exists (
          select 1 from jsonb_array_elements(v_attribute.options) o where o ->> 'value' = v_entry.value #>> '{}'
        )
      ) then
      raise exception 'invalid_attributes';
    end if;
  end loop;
end;
$$;
revoke all on function private.check_attributes(uuid, jsonb) from public;

create function private.check_product_attributes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_attributes(new.category_id, new.attributes);
  return new;
end;
$$;
revoke all on function private.check_product_attributes() from public;

create trigger products_check_attributes
  before insert or update of attributes, category_id on public.products
  for each row when (new.attributes <> '{}'::jsonb)
  execute function private.check_product_attributes();

-- Comptes : visibles publiquement seulement par leur nom, et seulement s'ils sont actifs.
create function private.profile_is_active(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = p_id and p.status = 'active');
$$;
revoke all on function private.profile_is_active(uuid) from public;
grant execute on function private.profile_is_active(uuid) to anon, authenticated;

-- Annonces de particuliers -------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Copie du nom affiché : les profils ne sont pas lisibles publiquement.
  seller_name text not null default '',
  section public.listing_section not null,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  brand text check (char_length(brand) <= 60),
  size text check (char_length(size) <= 20),
  condition public.product_condition not null,
  price_millimes integer not null check (price_millimes > 0 and price_millimes <= 100000000),
  governorate_id smallint not null references public.governorates (id) on delete restrict,
  city_id integer references public.cities (id) on delete restrict,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  status public.product_status not null default 'available',
  publication_status public.publication_status not null default 'published',
  published_at timestamptz,
  sold_at timestamptz,
  moderated_at timestamptz,
  favorite_count integer not null default 0,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_feed_idx on public.listings (section, publication_status, published_at desc);
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_category_idx on public.listings (category_id);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function private.set_updated_at();

create function private.prepare_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.categories%rowtype;
  v_names text;
begin
  if tg_op = 'INSERT' then
    new.moderated_at := null;
    new.favorite_count := 0;

    -- La clé de service (serveur uniquement, données de démonstration) publie pour un compte actif ;
    -- toute autre session publie en son propre nom.
    if (select auth.role()) = 'service_role' then
      if new.seller_id is null or not private.profile_is_active(new.seller_id) then
        raise exception 'forbidden';
      end if;
    else
      new.seller_id := (select auth.uid());

      if new.seller_id is null or not private.is_active_user() then
        raise exception 'forbidden';
      end if;

      perform private.enforce_rate_limit('create_listing', 30, 86400);
    end if;

    if (
      select count(*) from public.listings l
      where l.seller_id = new.seller_id and l.publication_status <> 'archived'
    ) >= 200 then
      raise exception 'listing_limit';
    end if;
  else
    -- Une annonce retirée par la modération ne revient pas, sauf décision d'un administrateur.
    if old.moderated_at is not null and not private.is_platform_admin() then
      raise exception 'moderated';
    end if;

    if new.section <> old.section or new.seller_id <> old.seller_id then
      raise exception 'forbidden';
    end if;
  end if;

  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id then
    select * into v_category from public.categories c where c.id = new.category_id;

    if v_category.id is null or not v_category.is_active
      or (new.section = 'vide_dressing' and v_category.section <> 'mode')
      or (new.section = 'marketplace' and v_category.section <> 'marketplace') then
      raise exception 'invalid_category';
    end if;
  end if;

  if new.city_id is not null and not exists (
    select 1 from public.cities c where c.id = new.city_id and c.governorate_id = new.governorate_id
  ) then
    raise exception 'invalid_city';
  end if;

  perform private.check_attributes(new.category_id, new.attributes);

  if new.publication_status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status = 'sold' and (tg_op = 'INSERT' or old.status <> 'sold') then
    new.sold_at := now();
  elsif new.status <> 'sold' then
    new.sold_at := null;
  end if;

  select p.display_name into new.seller_name from public.profiles p where p.id = new.seller_id;

  select concat_ws(' ', c.name_fr, c.name_ar, parent.name_fr, parent.name_ar) into v_names
  from public.categories c
  left join public.categories parent on parent.id = c.parent_id
  where c.id = new.category_id;

  new.title := btrim(new.title);
  new.search_text := lower(extensions.unaccent(concat_ws(
    ' ', new.title, new.brand, new.size, v_names,
    (select string_agg(value, ' ') from jsonb_each_text(new.attributes))
  )));

  return new;
end;
$$;
revoke all on function private.prepare_listing() from public;

create trigger listings_prepare
  before insert or update on public.listings
  for each row execute function private.prepare_listing();

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  path text not null unique,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id, position);

-- Une photo appartient au dossier de son annonce, dans la limite de dix.
create function private.check_listing_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
begin
  select * into v_listing from public.listings l where l.id = new.listing_id;

  if v_listing.id is null
    or (v_listing.seller_id <> (select auth.uid()) and (select auth.role()) is distinct from 'service_role')
    or v_listing.moderated_at is not null
    or new.path !~ ('^' || v_listing.seller_id || '/' || v_listing.id || '/[A-Za-z0-9._-]{1,80}$') then
    raise exception 'forbidden';
  end if;

  if (select count(*) from public.listing_images i where i.listing_id = new.listing_id) >= 10 then
    raise exception 'too_many_images';
  end if;

  return new;
end;
$$;
revoke all on function private.check_listing_image() from public;

create trigger listing_images_check
  before insert on public.listing_images
  for each row execute function private.check_listing_image();

create function private.release_listing_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_file('listing-images', old.path, 'image_removed');
  return null;
end;
$$;
revoke all on function private.release_listing_image() from public;

create trigger listing_images_release
  after delete on public.listing_images
  for each row execute function private.release_listing_image();

create table public.listing_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index listing_favorites_listing_idx on public.listing_favorites (listing_id);

-- Le compteur passe par la fonction : aucun vendeur ne peut le gonfler lui-même.
create function private.bump_listing_favorites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.listings l
  set favorite_count = greatest(0, l.favorite_count + case when tg_op = 'INSERT' then 1 else -1 end)
  where l.id = coalesce(new.listing_id, old.listing_id);

  return null;
end;
$$;
revoke all on function private.bump_listing_favorites() from public;
create trigger listing_favorites_count
  after insert or delete on public.listing_favorites
  for each row execute function private.bump_listing_favorites();

-- Blocage entre personnes : plus aucun message, dans un sens comme dans l'autre.
create table public.person_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create function private.persons_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.person_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;
revoke all on function private.persons_blocked(uuid, uuid) from public;

-- Échanges entre l'acheteur et le vendeur d'une annonce.
create table public.listing_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  listing_title text not null,
  seller_id uuid references public.profiles (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_name text not null,
  buyer_name text not null,
  seller_read_at timestamptz not null default now(),
  buyer_read_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create index listing_threads_seller_idx on public.listing_threads (seller_id, last_message_at desc);
create index listing_threads_buyer_idx on public.listing_threads (buyer_id, last_message_at desc);

create table public.listing_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.listing_threads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index listing_messages_thread_idx on public.listing_messages (thread_id, created_at);

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('drop_alert', 'listing_message'));
alter table public.notifications
  add column listing_thread_id uuid references public.listing_threads (id) on delete cascade;

create function private.notify_listing_message(p_thread uuid, p_recipient uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  -- Une seule notification non lue par échange : les messages suivants la rafraîchissent.
  delete from public.notifications n
  where n.user_id = p_recipient and n.listing_thread_id = p_thread and n.read_at is null;

  insert into public.notifications (user_id, kind, listing_thread_id)
  select p_recipient, 'listing_message', p_thread
  where p_recipient is not null;
$$;
revoke all on function private.notify_listing_message(uuid, uuid) from public;

create function public.contact_listing(p_listing_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_listing public.listings%rowtype;
  v_thread uuid;
  v_name text;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('contact_listing', 30, 86400);

  select * into v_listing from public.listings l
  where l.id = p_listing_id
    and l.publication_status = 'published'
    and l.moderated_at is null
    and l.status <> 'sold'
    and private.profile_is_active(l.seller_id);

  if v_listing.id is null then
    raise exception 'not_found';
  end if;

  if v_listing.seller_id = v_user then
    raise exception 'own_listing';
  end if;

  if private.persons_blocked(v_user, v_listing.seller_id) then
    raise exception 'blocked';
  end if;

  select p.display_name into v_name from public.profiles p where p.id = v_user;

  insert into public.listing_threads (listing_id, listing_title, seller_id, buyer_id, seller_name, buyer_name)
  values (v_listing.id, v_listing.title, v_listing.seller_id, v_user, v_listing.seller_name, v_name)
  on conflict (listing_id, buyer_id) do update set closed_at = null
  returning id into v_thread;

  insert into public.listing_messages (thread_id, sender_id, body)
  values (v_thread, v_user, btrim(p_body));

  update public.listing_threads t
  set last_message_at = now(), buyer_read_at = now()
  where t.id = v_thread;

  perform private.notify_listing_message(v_thread, v_listing.seller_id);

  return v_thread;
end;
$$;
revoke all on function public.contact_listing(uuid, text) from public, anon;
grant execute on function public.contact_listing(uuid, text) to authenticated;

create function public.send_listing_message(p_thread_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_thread public.listing_threads%rowtype;
  v_other uuid;
begin
  if not private.is_active_user() then
    raise exception 'forbidden';
  end if;

  perform private.enforce_rate_limit('listing_message', 200, 86400);

  select * into v_thread from public.listing_threads t
  where t.id = p_thread_id and v_user in (t.seller_id, t.buyer_id)
  for update;

  if v_thread.id is null then
    raise exception 'not_found';
  end if;

  if v_thread.closed_at is not null then
    raise exception 'closed';
  end if;

  v_other := case when v_user = v_thread.seller_id then v_thread.buyer_id else v_thread.seller_id end;

  if v_other is null or not private.profile_is_active(v_other) or private.persons_blocked(v_user, v_other) then
    raise exception 'blocked';
  end if;

  insert into public.listing_messages (thread_id, sender_id, body) values (p_thread_id, v_user, btrim(p_body));

  update public.listing_threads t
  set last_message_at = now(),
      seller_read_at = case when v_user = t.seller_id then now() else t.seller_read_at end,
      buyer_read_at = case when v_user = t.buyer_id then now() else t.buyer_read_at end
  where t.id = p_thread_id;

  perform private.notify_listing_message(p_thread_id, v_other);
end;
$$;
revoke all on function public.send_listing_message(uuid, text) from public, anon;
grant execute on function public.send_listing_message(uuid, text) to authenticated;

create function public.mark_listing_thread_read(p_thread_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.listing_threads t
  set seller_read_at = case when (select auth.uid()) = t.seller_id then now() else t.seller_read_at end,
      buyer_read_at = case when (select auth.uid()) = t.buyer_id then now() else t.buyer_read_at end
  where t.id = p_thread_id and (select auth.uid()) in (t.seller_id, t.buyer_id);

  update public.notifications n
  set read_at = now()
  where n.user_id = (select auth.uid()) and n.listing_thread_id = p_thread_id and n.read_at is null;
$$;
revoke all on function public.mark_listing_thread_read(uuid) from public, anon;
grant execute on function public.mark_listing_thread_read(uuid) to authenticated;

-- Bloquer une personne ferme les échanges en cours avec elle.
create function public.block_person(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if not private.is_active_user() or p_user_id is null or p_user_id = v_user then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from public.listing_threads t
    where (t.seller_id = v_user and t.buyer_id = p_user_id) or (t.buyer_id = v_user and t.seller_id = p_user_id)
  ) then
    -- Pas d'échange, pas de blocage : aucune énumération de comptes possible.
    raise exception 'not_found';
  end if;

  insert into public.person_blocks (blocker_id, blocked_id) values (v_user, p_user_id) on conflict do nothing;

  update public.listing_threads t
  set closed_at = coalesce(t.closed_at, now())
  where (t.seller_id = v_user and t.buyer_id = p_user_id) or (t.buyer_id = v_user and t.seller_id = p_user_id);
end;
$$;
revoke all on function public.block_person(uuid) from public, anon;
grant execute on function public.block_person(uuid) to authenticated;

create function public.unblock_person(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.person_blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p_user_id;
$$;
revoke all on function public.unblock_person(uuid) from public, anon;
grant execute on function public.unblock_person(uuid) to authenticated;

-- Modération -------------------------------------------------------------------------------------

create function private.takedown_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.listings l
  set publication_status = 'archived', moderated_at = now()
  where l.id = p_listing_id;

  -- Les photos quittent le stockage ; l'annonce reste comme trace de la décision.
  delete from public.listing_images i where i.listing_id = p_listing_id;

  update public.listing_threads t set closed_at = coalesce(t.closed_at, now()) where t.listing_id = p_listing_id;
end;
$$;
revoke all on function private.takedown_listing(uuid) from public;

create function public.moderate_listing(p_listing_id uuid, p_note text)
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

  if not exists (select 1 from public.listings l where l.id = p_listing_id) then
    raise exception 'not_found';
  end if;

  perform private.takedown_listing(p_listing_id);

  perform private.log_audit(
    'listing.moderated', 'listing', p_listing_id::text, jsonb_build_object('note', p_note)
  );
end;
$$;
revoke all on function public.moderate_listing(uuid, text) from public, anon;
grant execute on function public.moderate_listing(uuid, text) to authenticated;

-- Signalements : une annonce, ou un échange entre particuliers.
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
  elsif p_target_type = 'listing' then
    if exists (select 1 from public.listings l where l.id = p_target_id and l.seller_id = v_user) then
      raise exception 'own_listing';
    end if;

    select jsonb_build_object(
      'title', l.title, 'seller', l.seller_name, 'user_id', l.seller_id, 'section', l.section
    ) into v_snapshot
    from public.listings l
    where l.id = p_target_id and l.publication_status = 'published' and l.moderated_at is null;
  elsif p_target_type = 'listing_thread' then
    -- Un participant signale l'autre ; l'extrait des messages accompagne le signalement.
    select jsonb_build_object(
      'title', t.listing_title,
      'client', case when t.seller_id = v_user then t.buyer_name else t.seller_name end,
      'user_id', case when t.seller_id = v_user then t.buyer_id else t.seller_id end,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'side', case when x.sender_id = t.seller_id then 'seller' else 'buyer' end,
          'body', x.body, 'at', x.created_at
        ) order by x.created_at)
        from (
          select m.sender_id, m.body, m.created_at from public.listing_messages m
          where m.thread_id = t.id order by m.created_at desc limit 20
        ) x
      ), '[]'::jsonb)
    ) into v_snapshot
    from public.listing_threads t
    where t.id = p_target_id and v_user in (t.seller_id, t.buyer_id);
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

-- Décisions : retrait de l'annonce, fermeture de l'échange, suspension du compte visé.
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
  v_target_user uuid;
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
    elsif v_report.target_type = 'listing' then
      perform private.takedown_listing(v_report.target_id);
    elsif v_report.target_type = 'listing_thread' then
      update public.listing_threads t set closed_at = coalesce(t.closed_at, now()) where t.id = v_report.target_id;
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
    elsif v_report.target_type in ('listing', 'listing_thread') then
      v_target_user := (v_report.snapshot ->> 'user_id')::uuid;

      if v_target_user is null
        or exists (select 1 from public.platform_admins a where a.user_id = v_target_user) then
        raise exception 'protected_account';
      end if;

      update public.profiles p set status = 'suspended' where p.id = v_target_user and p.status = 'active';

      perform private.log_audit(
        'user.suspended', 'user', v_target_user::text,
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

-- Comptes supprimés et noms --------------------------------------------------------------------------

-- La suppression de compte passe le profil à « deleted » : ses annonces et ce qu'il a écrit partent.
create function private.clean_deleted_seller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deleted' and old.status <> 'deleted' then
    delete from public.listing_images i
    where i.listing_id in (select l.id from public.listings l where l.seller_id = new.id);

    delete from public.listings l where l.seller_id = new.id;

    update public.listing_messages m set body = '[message supprimé]' where m.sender_id = new.id;

    update public.listing_threads t
    set closed_at = coalesce(t.closed_at, now()),
        seller_name = case when t.seller_id = new.id then 'Compte supprimé' else t.seller_name end,
        buyer_name = case when t.buyer_id = new.id then 'Compte supprimé' else t.buyer_name end,
        seller_id = case when t.seller_id = new.id then null else t.seller_id end,
        buyer_id = case when t.buyer_id = new.id then null else t.buyer_id end
    where new.id in (t.seller_id, t.buyer_id);

    delete from public.listing_favorites f where f.user_id = new.id;
    delete from public.person_blocks b where new.id in (b.blocker_id, b.blocked_id);
  elsif new.display_name <> old.display_name and new.status <> 'deleted' then
    update public.listings l set seller_name = new.display_name where l.seller_id = new.id and l.moderated_at is null;
  end if;

  return null;
end;
$$;
revoke all on function private.clean_deleted_seller() from public;

create trigger profiles_clean_listings
  after update of status, display_name on public.profiles
  for each row execute function private.clean_deleted_seller();

-- Lecture et écriture ----------------------------------------------------------------------------

alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_favorites enable row level security;
alter table public.person_blocks enable row level security;
alter table public.listing_threads enable row level security;
alter table public.listing_messages enable row level security;

revoke all on public.listings, public.listing_images, public.listing_favorites, public.person_blocks,
  public.listing_threads, public.listing_messages from anon, authenticated;

grant select on public.listings, public.listing_images to anon, authenticated;
grant insert (
  id, section, category_id, title, description, brand, size, condition, price_millimes, governorate_id,
  city_id, attributes, status, publication_status
) on public.listings to authenticated;
grant update (
  category_id, title, description, brand, size, condition, price_millimes, governorate_id, city_id,
  attributes, status, publication_status
) on public.listings to authenticated;
grant delete on public.listings to authenticated;
grant insert (listing_id, path, position), update (position), delete on public.listing_images to authenticated;
grant select, insert, delete on public.listing_favorites to authenticated;
grant select on public.person_blocks, public.listing_threads, public.listing_messages to authenticated;

create policy listings_select_visible on public.listings
  for select to anon, authenticated
  using (
    (
      publication_status = 'published'
      and moderated_at is null
      and private.profile_is_active(seller_id)
    )
    or seller_id = (select auth.uid())
    or (select private.is_platform_admin())
  );

create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and (select private.is_active_user()));

create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()) and (select private.is_active_user()));

create policy listings_delete_own on public.listings
  for delete to authenticated
  using (seller_id = (select auth.uid()));

create policy listing_images_select_visible on public.listing_images
  for select to anon, authenticated
  using (listing_id in (select l.id from public.listings l));

create policy listing_images_insert_own on public.listing_images
  for insert to authenticated
  with check (listing_id in (select l.id from public.listings l where l.seller_id = (select auth.uid())));

create policy listing_images_update_own on public.listing_images
  for update to authenticated
  using (listing_id in (select l.id from public.listings l where l.seller_id = (select auth.uid())));

create policy listing_images_delete_own on public.listing_images
  for delete to authenticated
  using (listing_id in (select l.id from public.listings l where l.seller_id = (select auth.uid())));

create policy listing_favorites_select_own on public.listing_favorites
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy listing_favorites_insert_own on public.listing_favorites
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_active_user())
    and listing_id in (select l.id from public.listings l where l.publication_status = 'published')
  );

create policy listing_favorites_delete_own on public.listing_favorites
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy person_blocks_select_own on public.person_blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy listing_threads_select_participants on public.listing_threads
  for select to authenticated
  using ((select auth.uid()) in (seller_id, buyer_id));

create policy listing_messages_select_participants on public.listing_messages
  for select to authenticated
  using (thread_id in (select t.id from public.listing_threads t));

-- Vue Marketplace : annonces de particuliers et produits de boutiques, sous les droits de celui qui
-- lit. Les vendus n'y figurent plus.
create view public.marketplace_items with (security_invoker = true) as
select
  'listing'::text as kind,
  l.id,
  l.title,
  l.price_millimes,
  l.condition,
  l.status,
  l.category_id,
  l.governorate_id,
  l.published_at,
  l.attributes,
  l.search_text,
  'particulier'::text as seller_type,
  l.seller_name,
  null::text as shop_slug,
  null::text as shop_logo_path,
  (
    select i.path from public.listing_images i
    where i.listing_id = l.id order by i.position, i.created_at limit 1
  ) as image_path
from public.listings l
where l.section = 'marketplace'
  and l.publication_status = 'published'
  and l.moderated_at is null
  and l.status <> 'sold'
  and private.profile_is_active(l.seller_id)
union all
select
  'product'::text,
  p.id,
  p.title,
  p.price_millimes,
  p.condition,
  p.status,
  p.category_id,
  s.governorate_id,
  p.published_at,
  p.attributes,
  p.search_text,
  'pro'::text,
  s.name,
  s.slug,
  s.logo_path,
  (
    select i.path from public.product_images i
    where i.product_id = p.id order by i.position, i.created_at limit 1
  )
from public.products p
join public.shops s on s.id = p.shop_id and s.status = 'approved'
join public.categories c on c.id = p.category_id and c.section = 'marketplace'
where p.publication_status = 'published'
  and p.status <> 'sold';

grant select on public.marketplace_items to anon, authenticated;

-- Stockage des photos d'annonces ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 4194304, array['image/jpeg', 'image/png', 'image/webp']);

alter table public.storage_purge_queue drop constraint storage_purge_queue_known_bucket;
alter table public.storage_purge_queue
  add constraint storage_purge_queue_known_bucket
  check (bucket in ('avatars', 'shop-assets', 'product-images', 'shop-videos', 'listing-images'));

-- Dépôt : dossier « vendeur/annonce/ », annonce à soi et non modérée, dix fichiers au plus.
create function private.listing_image_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = private.safe_uuid(split_part(p_name, '/', 2))
      and l.seller_id = private.safe_uuid(split_part(p_name, '/', 1))
      and l.seller_id = (select auth.uid())
      and l.moderated_at is null
  )
  and (
    select count(*) from storage.objects o
    where o.bucket_id = 'listing-images'
      and starts_with(o.name, split_part(p_name, '/', 1) || '/' || split_part(p_name, '/', 2) || '/')
  ) < 10;
$$;
revoke all on function private.listing_image_upload_allowed(text) from public;
grant execute on function private.listing_image_upload_allowed(text) to authenticated;

create policy listing_images_insert_sellers on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-images' and private.listing_image_upload_allowed(name));

-- Fichiers déposés puis jamais rattachés à une annonce : retirés après un jour.
create function private.sweep_listing_files()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with orphans as (
    select o.name from storage.objects o
    where o.bucket_id = 'listing-images'
      and o.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.listing_images i where i.path = o.name)
  ),
  queued as (
    insert into public.storage_purge_queue (bucket, path, reason)
    select 'listing-images', name, 'orphan' from orphans
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from queued;

  return v_count;
end;
$$;
revoke all on function private.sweep_listing_files() from public;

select cron.schedule('sweep-listing-files', '41 * * * *', 'select private.sweep_listing_files()');
