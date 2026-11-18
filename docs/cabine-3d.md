# Cabine d'essayage 3D (homme / femme)

Novembre 2026. Décisions validées : rotation limitée à ±40° (vues face et trois-quarts, pas de dos inventé), mannequins en géométrie Three.js, cases `outer` (veste) et `dress` (robe) par migration additive locale, filtrage selon l'attribut « Pour », distinction short / jupe par le titre puis la forme de la photo, sans classement forcé.

## Ce que fait la cabine

1. « Essayer la tenue » ouvre d'abord le choix du mannequin : deux cartes, Femme et Homme, chacune avec la miniature de son mannequin. Le choix (et la silhouette) est gardé pour la session (`sessionStorage`, `tryon/mannequin-choice.ts`). Il filtre aussi le rail du créateur de tenues (« Pour : Tous / Femme / Homme »).
2. La cabine affiche le mannequin choisi, habillé des pièces de la tenue. On le tourne au doigt ou à la souris (±40°), on zoome (pincement, molette, boutons), on choisit une vue (¾ gauche, face, ¾ droite).
3. Chaque pièce est listée avec sa vraie photo, son titre, son prix, sa boutique, sa taille et sa disponibilité (seules les pièces publiées et disponibles entrent dans le catalogue). Le total est la somme des vrais prix. On peut retirer une pièce du mannequin (sans la retirer de la tenue), l'ajuster (taille de 85 à 115 %, hauteur de ±6 cm) et tout réinitialiser.
4. Trois silhouettes par mannequin : mince, standard, large. Indicatives, jamais présentées comme des tailles.
5. « Essayer sur ma photo » bascule vers l'essayage sur photo existant (MediaPipe), inchangé ; « Revenir au mannequin » ramène à la cabine 3D avec les mêmes pièces.
6. L'image peut être enregistrée (PNG).

## Architecture (`src/features/stylist/tryon/`)

| Fichier | Rôle |
| --- | --- |
| `mannequin/female-mannequin.ts`, `mannequin/male-mannequin.ts` | Les deux corps : des sections transversales (largeur, profondeur avant et arrière, volumes doux de la poitrine, des pectoraux, des fessiers) du buste, de la tête, du bras, de la jambe et du pied. Deux définitions distinctes, pas un modèle redimensionné. |
| `mannequin/loft.ts` | Tend une surface lisse sur ces sections (courbes Catmull-Rom, super-ellipses) : une peau continue, pas des sphères et des cylindres. |
| `mannequin/mannequin-morphology.ts` | Mince / standard / large : facteurs par zone du corps (la silhouette large prend surtout à la taille, au ventre, aux hanches, aux cuisses) ; les bras et les jambes s'écartent en conséquence. |
| `mannequin/build-mannequin.ts` | Assemble le mannequin, le pose au sol et calcule ses repères (épaules, aisselles, poitrine, taille, hanches, genoux, chevilles, main, pieds). |
| `mannequin/depth-map.ts` | La surface avant du corps, rasterisée sur le processeur (sans WebGL, donc testable) : les vêtements s'y enroulent. |
| `garments/garment-config.ts` | Le type de chaque pièce (t-shirt, polo, chemise, pull, top, veste, manteau, jean, pantalon, short, jupe, robe, chaussures, sac, casquette, ceinture) et sa règle de pose : point d'ancrage, mesure de référence, aisance, épaisseur de la couche. |
| `garments/garment-measure.ts` | Ce qu'on lit sur la photo détourée : largeur du corps du vêtement, cintre éventuel, jambes séparées (short) ou ourlet unique (jupe), pointe des chaussures. |
| `garments/garment-fitting.ts` | La pose : une seule échelle par pièce (les proportions de la photo sont conservées), la photo s'enroule sur le devant du corps en conservant les longueurs ; sous les hanches, jupes, robes et manteaux tombent. Chaussures projetées de profil sur les pieds ; sac et accessoire tenus à la main. |
| `garments/garment-layers.ts` | L'ordre des couches : bas, robe, chaussures, haut, veste, accessoire. |
| `scene/fitting-scene.ts`, `scene/lighting.ts`, `scene/camera.ts` | La scène Three.js : rendu à la demande, OrbitControls bornés, éclairage studio, ombre douce au sol, laque grise, fond crème, libération complète de la mémoire graphique. |
| `mannequin.ts` | Le lien entre les deux : mannequins en cache, préparation des pièces, maillages, miniatures du choix. |
| `fitting-stage.tsx`, `mannequin-chooser.tsx` | L'interface de la cabine et du choix du mannequin. |

Les pièces sont détourées par l'IA existante (`segment.ts`, MagicTouch), une seule fois pour les deux modes.

## Données

- `engine.ts` : `SLOTS` passe à `top, outer, dress, bottom, shoes, accessory`. Les vestes et manteaux vont dans `outer`, les robes dans `dress`. Une robe remplace le haut et le bas (et inversement) : `wearPiece`, avec un message à l'utilisateur, et `isCoherentLook` côté serveur. Le moteur de recommandation propose des tenues « haut + bas » ou « robe », avec une veste en option.
- `queries.ts` : chaque pièce porte son type (`kind`, déduit de la catégorie et du titre, `null` si incertain) et son public (`gender`, attribut « Pour »). Les pièces mixtes ou sans attribut restent visibles pour les deux mannequins.
- `outfits.ts` : une tenue enregistrée avant la migration, dont la veste ou la robe est rangée dans `top`, retrouve sa vraie case au chargement. Rien n'est réécrit en base.
- Migration `20261118000001_tenues_veste_et_robe.sql` : `alter type public.outfit_slot add value if not exists 'outer' | 'dress'`. Additive et rejouable. `save_outfit` n'a pas besoin de changer.

## Ce qui n'est pas simulé

- Pas de simulation de tissu : la photo n'est ni étirée ni déformée pour épouser le corps, elle s'enroule. Les plis restent ceux de la photo.
- Pas de dos : les annonces ne montrent que la face. La rotation s'arrête à ±40°.
- Les manches photographiées écartées du corps ne suivent pas les bras du mannequin (il faudrait déformer la photo) : seules les manches attachées au corps sont posées.
- La qualité dépend de la photo : une pièce à plat, entière, sur fond uni donne le meilleur rendu ; un gros plan ou une mise en scène (chaussures sur un socle, casquette de profil) donne un rendu partiel.
- Les chaussures sont projetées de profil sur les pieds : de face, on en voit surtout la pointe.

## Vérifications

- TypeScript, ESLint : sans erreur.
- Tests unitaires : 156 (dont 15 pour la cabine : mannequins distincts, morphologies, types de pièces, short / jupe, tenue cohérente, proportions conservées, couches).
- Migration validée sur un Postgres en mémoire (PGlite) : ajout des deux cases, rejouable, tenue existante intacte, `save_outfit` enregistre `outer` et `dress`. À appliquer sur le Supabase local quand Docker tourne : `supabase migration up --local`.
- Essais dans le navigateur (aperçu, données de démonstration) : cinq tenues (jean et veste, robe, chemise et jupe, sweat et short, chemise et manteau), sur les deux mannequins, les trois silhouettes et les trois vues ; changement de mannequin (robe et jupe signalées comme non portées par le mannequin homme) ; mode photo et retour au mannequin ; téléphone en arabe (RTL), sans débordement horizontal.
- Données de démonstration : le faux Supabase de test donne maintenant à chaque pièce de boutique un intitulé et une photo cohérents avec sa catégorie ; cinq pièces dessinées complètent les photos (voir `scripts/rapport/vetements/SOURCES.md`).
