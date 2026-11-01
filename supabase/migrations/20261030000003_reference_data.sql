-- Données de référence : présentes en production, donc dans une migration et non dans seed.sql.

create table public.governorates (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name_fr text not null,
  name_ar text not null
);

create table public.cities (
  id integer generated always as identity primary key,
  governorate_id smallint not null references public.governorates (id) on delete restrict,
  slug text not null,
  name_fr text not null,
  name_ar text not null,
  unique (governorate_id, slug),
  unique (governorate_id, id)
);

create index cities_governorate_idx on public.cities (governorate_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug text not null unique,
  name_fr text not null,
  name_ar text not null,
  position smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_parent_idx on public.categories (parent_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text not null,
  updated_at timestamptz not null default now()
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function private.set_updated_at();

insert into public.governorates (slug, name_fr, name_ar) values
  ('ariana', 'Ariana', 'أريانة'),
  ('beja', 'Béja', 'باجة'),
  ('ben-arous', 'Ben Arous', 'بن عروس'),
  ('bizerte', 'Bizerte', 'بنزرت'),
  ('gabes', 'Gabès', 'قابس'),
  ('gafsa', 'Gafsa', 'قفصة'),
  ('jendouba', 'Jendouba', 'جندوبة'),
  ('kairouan', 'Kairouan', 'القيروان'),
  ('kasserine', 'Kasserine', 'القصرين'),
  ('kebili', 'Kébili', 'قبلي'),
  ('kef', 'Le Kef', 'الكاف'),
  ('mahdia', 'Mahdia', 'المهدية'),
  ('manouba', 'La Manouba', 'منوبة'),
  ('medenine', 'Médenine', 'مدنين'),
  ('monastir', 'Monastir', 'المنستير'),
  ('nabeul', 'Nabeul', 'نابل'),
  ('sfax', 'Sfax', 'صفاقس'),
  ('sidi-bouzid', 'Sidi Bouzid', 'سيدي بوزيد'),
  ('siliana', 'Siliana', 'سليانة'),
  ('sousse', 'Sousse', 'سوسة'),
  ('tataouine', 'Tataouine', 'تطاوين'),
  ('tozeur', 'Tozeur', 'توزر'),
  ('tunis', 'Tunis', 'تونس'),
  ('zaghouan', 'Zaghouan', 'زغوان');

-- Liste initiale : chefs-lieux et grandes villes, à compléter avec les délégations officielles.
insert into public.cities (governorate_id, slug, name_fr, name_ar)
select g.id, c.slug, c.name_fr, c.name_ar
from (values
  ('ariana', 'ariana-ville', 'Ariana Ville', 'أريانة المدينة'),
  ('ariana', 'la-soukra', 'La Soukra', 'السكرة'),
  ('ariana', 'raoued', 'Raoued', 'رواد'),
  ('ariana', 'ettadhamen', 'Ettadhamen', 'التضامن'),
  ('beja', 'beja-ville', 'Béja', 'باجة'),
  ('beja', 'medjez-el-bab', 'Medjez el-Bab', 'مجاز الباب'),
  ('ben-arous', 'ben-arous-ville', 'Ben Arous', 'بن عروس'),
  ('ben-arous', 'ezzahra', 'Ezzahra', 'الزهراء'),
  ('ben-arous', 'mornag', 'Mornag', 'مرناق'),
  ('ben-arous', 'hammam-lif', 'Hammam Lif', 'حمام الأنف'),
  ('bizerte', 'bizerte-ville', 'Bizerte', 'بنزرت'),
  ('bizerte', 'menzel-bourguiba', 'Menzel Bourguiba', 'منزل بورقيبة'),
  ('bizerte', 'mateur', 'Mateur', 'ماطر'),
  ('gabes', 'gabes-ville', 'Gabès', 'قابس'),
  ('gabes', 'el-hamma', 'El Hamma', 'الحامة'),
  ('gabes', 'mareth', 'Mareth', 'مارث'),
  ('gafsa', 'gafsa-ville', 'Gafsa', 'قفصة'),
  ('gafsa', 'metlaoui', 'Métlaoui', 'المتلوي'),
  ('gafsa', 'redeyef', 'Redeyef', 'الرديف'),
  ('jendouba', 'jendouba-ville', 'Jendouba', 'جندوبة'),
  ('jendouba', 'tabarka', 'Tabarka', 'طبرقة'),
  ('jendouba', 'ain-draham', 'Aïn Draham', 'عين دراهم'),
  ('kairouan', 'kairouan-ville', 'Kairouan', 'القيروان'),
  ('kairouan', 'haffouz', 'Haffouz', 'حفوز'),
  ('kairouan', 'sbikha', 'Sbikha', 'السبيخة'),
  ('kasserine', 'kasserine-ville', 'Kasserine', 'القصرين'),
  ('kasserine', 'sbeitla', 'Sbeïtla', 'سبيطلة'),
  ('kasserine', 'feriana', 'Fériana', 'فريانة'),
  ('kebili', 'kebili-ville', 'Kébili', 'قبلي'),
  ('kebili', 'douz', 'Douz', 'دوز'),
  ('kef', 'le-kef-ville', 'Le Kef', 'الكاف'),
  ('kef', 'dahmani', 'Dahmani', 'الدهماني'),
  ('kef', 'tajerouine', 'Tajerouine', 'تاجروين'),
  ('mahdia', 'mahdia-ville', 'Mahdia', 'المهدية'),
  ('mahdia', 'ksour-essef', 'Ksour Essef', 'قصور الساف'),
  ('mahdia', 'el-jem', 'El Jem', 'الجم'),
  ('manouba', 'la-manouba-ville', 'La Manouba', 'منوبة'),
  ('manouba', 'oued-ellil', 'Oued Ellil', 'وادي الليل'),
  ('manouba', 'douar-hicher', 'Douar Hicher', 'دوار هيشر'),
  ('manouba', 'tebourba', 'Tebourba', 'طبربة'),
  ('medenine', 'medenine-ville', 'Médenine', 'مدنين'),
  ('medenine', 'djerba-houmt-souk', 'Djerba Houmt Souk', 'جربة حومة السوق'),
  ('medenine', 'zarzis', 'Zarzis', 'جرجيس'),
  ('medenine', 'ben-gardane', 'Ben Gardane', 'بن قردان'),
  ('monastir', 'monastir-ville', 'Monastir', 'المنستير'),
  ('monastir', 'moknine', 'Moknine', 'المكنين'),
  ('monastir', 'ksar-hellal', 'Ksar Hellal', 'قصر هلال'),
  ('monastir', 'jemmal', 'Jemmal', 'جمال'),
  ('nabeul', 'nabeul-ville', 'Nabeul', 'نابل'),
  ('nabeul', 'hammamet', 'Hammamet', 'الحمامات'),
  ('nabeul', 'kelibia', 'Kélibia', 'قليبية'),
  ('nabeul', 'korba', 'Korba', 'قربة'),
  ('sfax', 'sfax-ville', 'Sfax', 'صفاقس'),
  ('sfax', 'sakiet-ezzit', 'Sakiet Ezzit', 'ساقية الزيت'),
  ('sfax', 'sakiet-eddaier', 'Sakiet Eddaïer', 'ساقية الدائر'),
  ('sfax', 'mahres', 'Mahrès', 'المحرس'),
  ('sidi-bouzid', 'sidi-bouzid-ville', 'Sidi Bouzid', 'سيدي بوزيد'),
  ('sidi-bouzid', 'regueb', 'Regueb', 'الرقاب'),
  ('sidi-bouzid', 'meknassy', 'Meknassy', 'المكناسي'),
  ('siliana', 'siliana-ville', 'Siliana', 'سليانة'),
  ('siliana', 'makthar', 'Makthar', 'مكثر'),
  ('siliana', 'bou-arada', 'Bou Arada', 'بوعرادة'),
  ('sousse', 'sousse-ville', 'Sousse', 'سوسة'),
  ('sousse', 'hammam-sousse', 'Hammam Sousse', 'حمام سوسة'),
  ('sousse', 'msaken', 'Msaken', 'مساكن'),
  ('sousse', 'kalaa-kebira', 'Kalâa Kebira', 'القلعة الكبرى'),
  ('tataouine', 'tataouine-ville', 'Tataouine', 'تطاوين'),
  ('tataouine', 'remada', 'Remada', 'رمادة'),
  ('tozeur', 'tozeur-ville', 'Tozeur', 'توزر'),
  ('tozeur', 'nefta', 'Nefta', 'نفطة'),
  ('tunis', 'tunis-ville', 'Tunis', 'تونس'),
  ('tunis', 'la-marsa', 'La Marsa', 'المرسى'),
  ('tunis', 'le-bardo', 'Le Bardo', 'باردو'),
  ('tunis', 'la-goulette', 'La Goulette', 'حلق الوادي'),
  ('tunis', 'carthage', 'Carthage', 'قرطاج'),
  ('zaghouan', 'zaghouan-ville', 'Zaghouan', 'زغوان'),
  ('zaghouan', 'el-fahs', 'El Fahs', 'الفحص')
) as c (governorate_slug, slug, name_fr, name_ar)
join public.governorates g on g.slug = c.governorate_slug;

insert into public.categories (slug, name_fr, name_ar, position) values
  ('hauts', 'Hauts', 'ملابس علوية', 10),
  ('bas', 'Bas', 'ملابس سفلية', 20),
  ('vestes-manteaux', 'Vestes et manteaux', 'سترات ومعاطف', 30),
  ('robes', 'Robes et ensembles', 'فساتين وأطقم', 40),
  ('chaussures', 'Chaussures', 'أحذية', 50),
  ('accessoires', 'Accessoires', 'إكسسوارات', 60);

insert into public.categories (parent_id, slug, name_fr, name_ar, position)
select p.id, c.slug, c.name_fr, c.name_ar, c.position
from (values
  ('hauts', 't-shirts', 'T-shirts', 'تي شيرت', 10),
  ('hauts', 'chemises', 'Chemises', 'قمصان', 20),
  ('hauts', 'pulls-sweats', 'Pulls et sweats', 'كنزات وسويت شيرت', 30),
  ('bas', 'jeans', 'Jeans', 'جينز', 10),
  ('bas', 'pantalons', 'Pantalons', 'سراويل', 20),
  ('bas', 'jupes-shorts', 'Jupes et shorts', 'تنانير وشورتات', 30),
  ('vestes-manteaux', 'vestes-sport', 'Vestes de sport', 'سترات رياضية', 10),
  ('vestes-manteaux', 'vestes-jean', 'Vestes en jean', 'سترات جينز', 20),
  ('vestes-manteaux', 'manteaux', 'Manteaux', 'معاطف', 30),
  ('chaussures', 'baskets', 'Baskets', 'أحذية رياضية', 10),
  ('chaussures', 'bottes', 'Bottes', 'أحذية طويلة', 20),
  ('accessoires', 'sacs', 'Sacs', 'حقائب', 10),
  ('accessoires', 'casquettes-bonnets', 'Casquettes et bonnets', 'قبعات', 20),
  ('accessoires', 'ceintures', 'Ceintures', 'أحزمة', 30)
) as c (parent_slug, slug, name_fr, name_ar, position)
join public.categories p on p.slug = c.parent_slug;

insert into public.platform_settings (key, value, description) values
  ('max_shops_per_user', '3', 'Nombre maximal de boutiques créées par compte'),
  ('reservation_ttl_minutes', '120', 'Durée d''une réservation avant expiration'),
  ('commission_basis_points', '0', 'Commission plateforme en points de base');

alter table public.governorates enable row level security;
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.platform_settings enable row level security;

revoke all on public.governorates, public.cities, public.categories, public.platform_settings
  from anon, authenticated;

grant select on public.governorates, public.cities, public.categories to anon, authenticated;
grant select on public.platform_settings to authenticated;
grant update (value) on public.platform_settings to authenticated;
grant insert, update on public.categories to authenticated;

create policy governorates_select_all on public.governorates
  for select to anon, authenticated using (true);

create policy cities_select_all on public.cities
  for select to anon, authenticated using (true);

create policy categories_select_active on public.categories
  for select to anon, authenticated
  using (is_active or (select private.is_platform_admin()));

create policy categories_insert_admin on public.categories
  for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy categories_update_admin on public.categories
  for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy platform_settings_select_admin on public.platform_settings
  for select to authenticated
  using ((select private.is_platform_admin()));

create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
