-- Marketplace et Vide-Dressing : valeurs d'énumération à part, PostgreSQL n'autorise pas leur emploi
-- dans la transaction qui les crée.

alter type public.report_target add value 'listing';
alter type public.report_target add value 'listing_thread';

-- Mode : le catalogue actuel. Marketplace : tous les autres produits.
create type public.category_section as enum ('mode', 'marketplace');

-- Une annonce de particulier vit dans la Marketplace ou dans le Vide-Dressing (mode uniquement).
create type public.listing_section as enum ('marketplace', 'vide_dressing');
