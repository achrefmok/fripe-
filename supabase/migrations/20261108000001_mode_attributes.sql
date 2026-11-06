-- Caractéristiques des pièces de mode, choisies en un geste dans le formulaire du vendeur.
-- Ajout seulement : aucune donnée existante n'est modifiée. La taille et la pointure restent dans
-- products.size, la couleur dans products.color.

insert into public.category_attributes (category_id, key, label_fr, label_ar, kind, options, position)
select r.id, a.key, a.label_fr, a.label_ar, 'choice', a.options::jsonb, a.position
from (values
  ('hauts', 'genre', 'Pour', 'لـ',
    '[{"value":"femme","fr":"Femme","ar":"نساء"},{"value":"homme","fr":"Homme","ar":"رجال"},{"value":"mixte","fr":"Mixte","ar":"للجنسين"},{"value":"enfant","fr":"Enfant","ar":"أطفال"}]', 1),
  ('hauts', 'coupe', 'Coupe', 'القصّة',
    '[{"value":"ajustee","fr":"Ajustée","ar":"ضيّقة"},{"value":"droite","fr":"Droite","ar":"مستقيمة"},{"value":"ample","fr":"Ample","ar":"واسعة"},{"value":"oversize","fr":"Oversize","ar":"أوفرسايز"},{"value":"courte","fr":"Courte","ar":"قصيرة"}]', 2),
  ('hauts', 'matiere', 'Matière', 'القماش',
    '[{"value":"coton","fr":"Coton","ar":"قطن"},{"value":"laine","fr":"Laine","ar":"صوف"},{"value":"lin","fr":"Lin","ar":"كتان"},{"value":"soie","fr":"Soie","ar":"حرير"},{"value":"jean","fr":"Jean","ar":"جينز"},{"value":"synthetique","fr":"Synthétique","ar":"صناعي"}]', 3),

  ('bas', 'genre', 'Pour', 'لـ',
    '[{"value":"femme","fr":"Femme","ar":"نساء"},{"value":"homme","fr":"Homme","ar":"رجال"},{"value":"mixte","fr":"Mixte","ar":"للجنسين"},{"value":"enfant","fr":"Enfant","ar":"أطفال"}]', 1),
  ('bas', 'coupe', 'Coupe', 'القصّة',
    '[{"value":"slim","fr":"Slim","ar":"سليم"},{"value":"droite","fr":"Droite","ar":"مستقيمة"},{"value":"large","fr":"Large","ar":"واسعة"},{"value":"evasee","fr":"Évasée","ar":"متّسعة من الأسفل"},{"value":"taille_haute","fr":"Taille haute","ar":"خصر عالٍ"}]', 2),
  ('bas', 'matiere', 'Matière', 'القماش',
    '[{"value":"jean","fr":"Jean","ar":"جينز"},{"value":"coton","fr":"Coton","ar":"قطن"},{"value":"lin","fr":"Lin","ar":"كتان"},{"value":"laine","fr":"Laine","ar":"صوف"},{"value":"cuir","fr":"Cuir","ar":"جلد"},{"value":"synthetique","fr":"Synthétique","ar":"صناعي"}]', 3),

  ('vestes-manteaux', 'genre', 'Pour', 'لـ',
    '[{"value":"femme","fr":"Femme","ar":"نساء"},{"value":"homme","fr":"Homme","ar":"رجال"},{"value":"mixte","fr":"Mixte","ar":"للجنسين"},{"value":"enfant","fr":"Enfant","ar":"أطفال"}]', 1),
  ('vestes-manteaux', 'coupe', 'Coupe', 'القصّة',
    '[{"value":"ajustee","fr":"Ajustée","ar":"ضيّقة"},{"value":"droite","fr":"Droite","ar":"مستقيمة"},{"value":"oversize","fr":"Oversize","ar":"أوفرسايز"},{"value":"longue","fr":"Longue","ar":"طويلة"},{"value":"courte","fr":"Courte","ar":"قصيرة"}]', 2),
  ('vestes-manteaux', 'matiere', 'Matière', 'القماش',
    '[{"value":"cuir","fr":"Cuir","ar":"جلد"},{"value":"jean","fr":"Jean","ar":"جينز"},{"value":"laine","fr":"Laine","ar":"صوف"},{"value":"coton","fr":"Coton","ar":"قطن"},{"value":"duvet","fr":"Duvet","ar":"ريش"},{"value":"synthetique","fr":"Synthétique","ar":"صناعي"}]', 3),

  ('robes', 'genre', 'Pour', 'لـ',
    '[{"value":"femme","fr":"Femme","ar":"نساء"},{"value":"enfant","fr":"Enfant","ar":"أطفال"}]', 1),
  ('robes', 'coupe', 'Longueur', 'الطول',
    '[{"value":"courte","fr":"Courte","ar":"قصيرة"},{"value":"midi","fr":"Midi","ar":"متوسطة"},{"value":"longue","fr":"Longue","ar":"طويلة"}]', 2),
  ('robes', 'matiere', 'Matière', 'القماش',
    '[{"value":"coton","fr":"Coton","ar":"قطن"},{"value":"lin","fr":"Lin","ar":"كتان"},{"value":"soie","fr":"Soie","ar":"حرير"},{"value":"laine","fr":"Laine","ar":"صوف"},{"value":"synthetique","fr":"Synthétique","ar":"صناعي"}]', 3),

  ('chaussures', 'genre', 'Pour', 'لـ',
    '[{"value":"femme","fr":"Femme","ar":"نساء"},{"value":"homme","fr":"Homme","ar":"رجال"},{"value":"mixte","fr":"Mixte","ar":"للجنسين"},{"value":"enfant","fr":"Enfant","ar":"أطفال"}]', 1),
  ('chaussures', 'matiere', 'Matière', 'المادة',
    '[{"value":"cuir","fr":"Cuir","ar":"جلد"},{"value":"daim","fr":"Daim","ar":"شمواه"},{"value":"toile","fr":"Toile","ar":"قماش"},{"value":"synthetique","fr":"Synthétique","ar":"صناعي"}]', 2),

  ('accessoires', 'genre', 'Pour', 'لـ',
    '[{"value":"femme","fr":"Femme","ar":"نساء"},{"value":"homme","fr":"Homme","ar":"رجال"},{"value":"mixte","fr":"Mixte","ar":"للجنسين"}]', 1),
  ('accessoires', 'matiere', 'Matière', 'المادة',
    '[{"value":"cuir","fr":"Cuir","ar":"جلد"},{"value":"metal","fr":"Métal","ar":"معدن"},{"value":"tissu","fr":"Tissu","ar":"قماش"},{"value":"paille","fr":"Paille","ar":"قش"},{"value":"plastique","fr":"Plastique","ar":"بلاستيك"}]', 2)
) as a (root, key, label_fr, label_ar, options, position)
join public.categories r on r.slug = a.root and r.parent_id is null
on conflict (category_id, key) do nothing;
