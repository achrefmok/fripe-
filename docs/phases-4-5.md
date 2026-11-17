# Phases 4 et 5 : ce qui a été fait

Branche `staging`, rien de commité. L'accueil `/` n'a pas été modifié. Aucune opération sur le Supabase distant.

## Phase 4 — marketplace et confiance

| Élément | Détail | Fichiers |
|---|---|---|
| État « Neuf sans étiquette » | 6ᵉ niveau, entre « Neuf avec étiquette » et « Comme neuf ». « Comme neuf » n'est pas renommé. Reconnu aussi dans le CSV des boutiques (« neuf sans étiquette »). | migration `20261117000001`, `catalog/constants.ts`, `catalog/schemas.ts`, messages |
| Défauts des annonces | Colonne `listings.defects`, avec un droit d'écriture colonne par colonne. Le formulaire exige une description, ou la case « Aucun défaut à signaler ». La fiche affiche les défauts. Les annonces antérieures (`null`) n'affichent rien. | migration, `marketplace/schemas.ts`, `actions.ts`, `listing-form.tsx`, `annonce/[listingId]/page.tsx` |
| Recherche | Suggestions de vraies catégories, marques et pièces publiées (`/api/suggestions`, mises en cache 60 s), recherches récentes gardées dans le navigateur, clavier complet (motif ARIA « combobox »). | `catalog/suggestions.ts`, `api/suggestions/route.ts`, `search-suggest.tsx`, `catalog-filters.tsx` |
| Tri « Populaires » | Par nombre de favoris, puis par date. | `catalog/constants.ts`, `catalog/queries.ts`, page catalogue |
| Fiche produit | « Chez {boutique}, aussi » : les autres pièces de la boutique. | `catalog/queries.ts`, `produit/[productId]/page.tsx` |
| Carte unique | Utilisée dans la grille du catalogue : état, taille, favori, réservée. `ProductCard` est inchangée, car l'accueil `/` l'utilise. | `catalogue/page.tsx` |
| Filtre Chaussures | « Chaussures » englobe Sneakers dans les filtres, les listes et le formulaire des boutiques. | `catalog/category-scope.ts` et ses usages |

## Phase 5 — expériences immersives

| Élément | Détail | Fichiers |
|---|---|---|
| Fripe Walk | La vidéo suivante est préchargée en entier. Le lien vers la boutique existait déjà. | `walk-feed.tsx` |
| Cabine | Bouton « Composer une tenue avec cette pièce » sur la fiche produit (hauts, bas, chaussures, accessoires disponibles), avec la mention « composition visuelle, ne garantit ni la taille ni le rendu porté ». La modification d'une tenue enregistrée existait déjà. | `produit/[productId]/page.tsx` |
| Armoire du Vide-Dressing | Sur la page d'un dressing : vêtements sur la tringle, chaussures et accessoires sur l'étagère, onglets par rayon, fiche en verre de la pièce choisie avec les autres pièces de la personne, position gardée dans l'adresse (`?piece=`, `?rayon=`), ouverture des portes en relief seulement sur un appareil capable (4 cœurs, 4 Go, mouvement non réduit), sinon en fondu. « D'autres armoires à visiter » en bas de page. Le portant à lots est conservé. | `dressing-wardrobe.tsx`, `dressing/wardrobe.css`, `vide-dressing/dressing/[sellerId]/page.tsx` |

## Reste à faire

- **Annonces des particuliers dans la cabine** : `outfit_items` n'accepte que des produits de boutique. Il faut assouplir ce schéma et réécrire la fonction sécurisée `save_outfit`, et les annonces ne passent pas par le panier. C'est un changement de sécurité, à valider séparément.
- **Vidéo Fripe Walk à partir de photos** (diaporama dans le studio) : non commencée.
- **Défauts obligatoires pour les produits de boutique** : le champ existe, mais il n'est pas imposé, pour ne pas bloquer la publication rapide par CSV et les brouillons photo.
- **Filtre par ville** : le filtre par gouvernorat existe ; la ville n'est pas ajoutée.
- **Essayage par IA** : évolution future seulement.

## Vérifications

- Types, lint, 131 tests unitaires.
- `pnpm test:app` : 104 pages × 4 configurations, 97 étapes sur 97, aucun texte non traduit ni débordement.
- E2E : 175 / 188. Les 13 échecs restants existaient avant ; détail dans `validation-phase-3.md`.
- Captures de l'armoire (ordinateur, téléphone), de la recherche (français, arabe) et du formulaire des défauts (arabe).

## Essayage virtuel par IA (gratuit, dans le navigateur)

### Choix de la méthode

- Les modèles d'essayage génératifs ouverts (IDM-VTON, CatVTON, et vraisemblablement OOTDiffusion) sont sous licence **non commerciale** (CC BY-NC-SA 4.0) : inutilisables sur FRIPE. Les démos gratuites hébergées reposent sur ces mêmes modèles et exigeraient d'envoyer la photo du corps à un tiers.
- Méthode retenue : **MediaPipe Pose Landmarker** de Google. Le code est sous Apache 2.0, ainsi que le modèle BlazePose, d'après sa fiche. Il est utilisable commercialement et tourne **sur l'appareil**. Coût : 0.

### Fonctionnement

1. Dans la cabine, « Essayer sur ma photo » (actif dès qu'une pièce a une photo).
2. La personne choisit ou prend une photo. **Elle n'est jamais envoyée ni enregistrée.**
3. L'IA repère 33 points du corps. Les pièces détourées sont posées : le haut sur les épaules, le bas aux hanches, les chaussures aux chevilles, l'accessoire près de la main.
4. Chaque pièce se déplace au doigt, et un curseur règle sa taille. « Replacer automatiquement » relance la détection.
5. Sans silhouette détectée, ou si l'IA n'est pas disponible sur l'appareil, les pièces sont posées au centre, à placer à la main, et la page le dit.
6. Avertissement permanent : aperçu indicatif, qui ne garantit ni la taille réelle ni le rendu porté.

### Technique

- `@mediapipe/tasks-vision` 1.2.3, chargé seulement à l'ouverture de la fenêtre (`next/dynamic`, sans rendu serveur).
- Le WebAssembly (14 Mo) et le modèle (5,6 Mo) sont servis par le site depuis `public/mediapipe/`. Ils sont préparés par `scripts/mediapipe-assets.mjs` à chaque installation (`postinstall`) et ne sont pas suivis par git.
- CSP : ajout de `'wasm-unsafe-eval'` à `script-src`, qui autorise la compilation du WebAssembly mais pas `eval()`.
- Service worker : `public/mediapipe/` est exclu du précache. Personne ne télécharge ces fichiers sans lancer l'essayage.
- Fichiers : `src/features/stylist/tryon/` (`pose.ts`, `virtual-tryon.tsx`, `tryon-button.tsx`, `tryon.css`), `outfit-builder.tsx`, messages `tryon`.

### Vérifié

- 5 tests unitaires du placement sur des silhouettes synthétiques (centrage, hauteurs, rotation, repli sans pose).
- Dans le navigateur, en développement et sur un **build de production** (CSP sans `'unsafe-eval'`) : aucun fichier MediaPipe avant l'ouverture ; WebAssembly et modèle chargés (200) ; détection exécutée ; mode manuel annoncé sur une photo sans personne ; aucune erreur.
- Service worker de production : aucune entrée MediaPipe.

### Limites

- **Pas de test sur une vraie personne** : aucune photo libre de droits adaptée n'a été trouvée. À tester avec ta propre photo, qui reste sur ton appareil.
- **C'est un collage guidé par la pose, pas un rendu photoréaliste** : pas de plis ni de déformation du vêtement selon le corps.
- **Le détourage existant n'enlève que les fonds unis.** Sur une photo au fond chargé, la pièce garde son fond.
- **Premier chargement d'environ 20 Mo** (compressé en transit par le serveur), puis mis en cache par le navigateur.
