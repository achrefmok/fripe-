-- Phase 4 (confiance) : un sixième état et la déclaration des défauts pour les annonces.
-- Additif seulement : aucune valeur existante n'est renommée, aucune donnée n'est modifiée.

-- 1. « Neuf sans étiquette », entre « Neuf avec étiquette » et « Comme neuf ».
alter type public.product_condition add value if not exists 'new_without_tags' after 'new_with_tags';

-- 2. Les défauts d'une annonce de particulier, comme ceux des produits de boutique (500 caractères).
--    Null pour les annonces existantes ; les formulaires demandent désormais soit une description des
--    défauts, soit une déclaration explicite « aucun défaut ».
alter table public.listings
  add column if not exists defects text check (char_length(defects) <= 500);

-- Les droits sur les annonces sont accordés colonne par colonne : la nouvelle colonne doit l'être aussi,
-- sans quoi le vendeur ne pourrait pas la remplir. Les politiques RLS existantes s'appliquent telles quelles.
grant insert (defects), update (defects) on public.listings to authenticated;
