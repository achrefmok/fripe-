-- Trois univers : Sneakers, Livres et Enfants. Les mêmes écritures que l'écran d'administration des
-- catégories (mêmes déclencheurs : deux niveaux au plus, section héritée du parent, journal d'audit).
--
-- Additif et rejouable : aucune catégorie n'est supprimée ni renommée. Les trois catégories déplacées
-- gardent leur identifiant : les produits et annonces qui y sont rangés les suivent sans modification.
--
--   Sneakers (mode)        ← Baskets, déplacée depuis Chaussures, + 3 sous-catégories
--   Livres (marketplace)   ← l'ancienne sous-catégorie « Livres » de Sport et loisirs devient racine, + 5
--   Enfants (marketplace)  ← Puériculture, déplacée depuis Jeux et jouets, + 3 sous-catégories
--
-- Sans doublon : les vêtements d'enfant restent dans les catégories de mode (attribut « Pour : Enfant »),
-- les jouets restent dans « Jeux et jouets ». Chaussures reçoit deux sous-catégories pour ne pas rester
-- avec la seule « Bottes ».

-- 1. Racines
insert into public.categories (slug, name_fr, name_ar, position, section) values
  ('sneakers', 'Sneakers', 'سنيكرز', 55, 'mode'),
  ('enfants', 'Enfants', 'الأطفال', 12, 'marketplace')
on conflict (slug) do nothing;

-- « Livres » passe de sous-catégorie à racine ; sa section (marketplace) est conservée.
update public.categories
set parent_id = null, position = 11
where slug = 'livres'
  and parent_id = (select id from public.categories where slug = 'sport-loisirs');

-- « Autres produits » reste la dernière racine de la marketplace.
update public.categories set position = 99 where slug = 'autres-produits' and parent_id is null and position < 99;

-- 2. Déplacements (identifiants conservés)
update public.categories
set parent_id = (select id from public.categories where slug = 'sneakers'), position = 10
where slug = 'baskets'
  and parent_id = (select id from public.categories where slug = 'chaussures');

update public.categories
set parent_id = (select id from public.categories where slug = 'enfants'), position = 10
where slug = 'puericulture'
  and parent_id = (select id from public.categories where slug = 'jeux-jouets');

-- 3. Nouvelles sous-catégories
insert into public.categories (parent_id, slug, name_fr, name_ar, position)
select p.id, c.slug, c.name_fr, c.name_ar, c.position
from (values
  ('sneakers', 'running-training', 'Running et training', 'ركض وتدريب', 20),
  ('sneakers', 'basketball-skate', 'Basketball et skate', 'كرة السلة والتزلج', 30),
  ('sneakers', 'sneakers-collection', 'Éditions limitées', 'إصدارات محدودة', 40),
  ('chaussures', 'sandales-claquettes', 'Sandales et claquettes', 'صنادل وشباشب', 30),
  ('chaussures', 'chaussures-ville', 'Chaussures de ville', 'أحذية كلاسيكية', 40),
  ('livres', 'romans-litterature', 'Romans et littérature', 'روايات وأدب', 10),
  ('livres', 'bd-mangas', 'BD et mangas', 'قصص مصوّرة ومانغا', 20),
  ('livres', 'scolaire-universitaire', 'Scolaire et universitaire', 'كتب مدرسية وجامعية', 30),
  ('livres', 'livres-jeunesse', 'Livres jeunesse', 'كتب الأطفال واليافعين', 40),
  ('livres', 'livres-pratiques', 'Pratique et loisirs', 'كتب عملية وهوايات', 50),
  ('enfants', 'poussettes-sieges-auto', 'Poussettes et sièges auto', 'عربات الأطفال ومقاعد السيارة', 20),
  ('enfants', 'chambre-enfant', 'Chambre d''enfant', 'غرفة الطفل', 30),
  ('enfants', 'fournitures-scolaires', 'Cartables et fournitures', 'محافظ ولوازم مدرسية', 40)
) as c (parent_slug, slug, name_fr, name_ar, position)
join public.categories p on p.slug = c.parent_slug and p.parent_id is null
on conflict (slug) do nothing;

-- 4. Caractéristiques : Sneakers reprend celles de Chaussures (pour qui, matière).
insert into public.category_attributes (category_id, key, label_fr, label_ar, kind, options, position)
select s.id, a.key, a.label_fr, a.label_ar, a.kind, a.options, a.position
from public.category_attributes a
join public.categories c on c.id = a.category_id and c.slug = 'chaussures'
cross join public.categories s
where s.slug = 'sneakers'
on conflict (category_id, key) do nothing;
