# FRIPE — système visuel « L'étiquette »

Le vocabulaire vient de l'objet que toute friperie manipule : l'étiquette volante accrochée au portant.

## Couleurs

Définies dans `src/app/globals.css`, en clair et en sombre.

| Rôle | Clair | Usage |
| --- | --- | --- |
| Papier | `oklch(0.955 0.016 88)` | Fond |
| Encre | `oklch(0.2 0.014 55)` | Texte, actions principales |
| Harissa | `oklch(0.54 0.195 31)` | Grands aplats, statuts d'alerte, sélection, focus |
| Kraft | `oklch(0.74 0.085 72)` | Étiquettes secondaires |

En sombre, l'encre devient le fond et le harissa s'éclaircit. Le harissa sert par grandes surfaces ou comme signal, jamais en décoration dispersée.

## Typographie

- Marque et titres latins : Bricolage Grotesque, très gras.
- Texte latin : Hanken Grotesk.
- Arabe, titres et texte : Alexandria.
- Le mot FRIPE reste en latin dans les deux langues.

## Formes

- `HangTag` (`.hangtag`) : fil, œillet, coins hauts coupés. Il pend d'un rail et se balance au survol.
- `.rail` : le portant, une tringle de 5 px.
- `StatusTag` (`.status-tag`) : petite étiquette dont la pointe suit le sens de lecture.
- `.price-tag` : le prix agrafé sur la photo, pointe vers l'intérieur, miroir en RTL.
- Champs (`.field-line`) : une ligne, comme sur une étiquette à remplir.
- Angles de 2 px. Pas de cartes arrondies ni d'ombres décoratives.

- Fripe Walk : seul écran sur fond noir, pour laisser la vidéo décider de la couleur. Boutons carrés sur voile sombre.

## Mouvement

Une seule idée : ce qui pend bouge comme ce qui pend. L'étiquette se stabilise au chargement et se balance au survol ou au focus, les vêtements de l'armoire aussi.

Trois moments forts, réservés à l'accueil et à l'entrée dans le catalogue :

- L'armoire (`src/features/home/components/dressing-hero.tsx`) : un objet en 3D CSS dans le héros harissa. Les portes s'ouvrent une fois par visite, la lumière s'allume, les vêtements se balancent. Le bouton « Fermer le dressing » la referme et la rouvre. Fermée, son intérieur est `inert`.
- Les rayons (`universe-showcase.tsx`) : toucher un vêtement ouvre son univers plus bas sur l'accueil, la section prend sa couleur. « Tout voir » mène au catalogue par le rideau (`universe-link.tsx`), qui se lève sur un bandeau de la même couleur.
- Le défilé (`runway.tsx`) : les collections des boutiques deviennent des looks, posés sur un podium ; sans collection, chaque arrivage défile seul. Les pièces arrivent du fond en quatre pas, la pièce principale ondule légèrement, puis fait demi-tour et sort ; le projecteur se rallume à chaque look. Une barre fine montre le temps avant le look suivant. Le défilement automatique a toujours un bouton pause, s'arrête au survol et au focus, et reste coupé si l'utilisateur limite les animations. Flèches, pastilles et glisser au doigt.

Seules `transform`, `opacity` et `clip-path` s'animent, en CSS ou en API Web Animations, sans bibliothèque d'animation. `prefers-reduced-motion` ouvre l'armoire d'emblée et retire balancement, rideau et défilement automatique.

## Univers

Chaque catégorie racine a sa matière, définie dans `src/features/home/universes.ts` : hauts harissa, bas denim, vestes kraft, robes garance, chaussures olive, accessoires ocre. Le texte posé sur chaque aplat dépasse 4,5:1. Ces couleurs vivent dans les rayons de l'accueil et le bandeau du catalogue, nulle part ailleurs. La description d'un rayon est la liste de ses sous-catégories, jamais un texte rédigé. Une catégorie ajoutée dans l'administration prend l'étiquette kraft ; une sous-catégorie garde l'univers de sa racine.

`Garment` dessine les vêtements en SVG : un seul cintre, à plat, sans ombre de matière. Les tuiles « Découvrir autrement » en composent de petites scènes : une tenue sous une étiquette de budget, un assemblage pièce par pièce, trois écrans verticaux pour Fripe Walk.

## Rubriques

Trois expériences partagent le même vocabulaire. La mode garde le harissa ; la Marketplace prend le denim (`oklch(0.38 0.075 255)`), le Vide-Dressing la garance (`oklch(0.47 0.135 5)`), tous deux avec un texte papier au-dessus de 6:1. La couleur vit dans le bandeau de la rubrique, ses puces de catégorie et les tuiles qui y mènent, jamais sur les cartes. Une carte d'annonce est une carte de pièce, avec l'identité du vendeur : monogramme pour une boutique, silhouette kraft et « Particulier » pour une personne.

Dans l'en-tête, les trois rubriques forment un seul groupe d'étiquettes. Sur téléphone, la barre du bas les porte, la vente en relief au centre. Les filtres montent du bas dans un panneau.

## Boutiques

Chaque pièce affichée porte l'identité de sa boutique : `ShopMark` (`src/features/shops/components/shop-mark.tsx`) montre son logo, ou à défaut un monogramme. Le monogramme écarte les mots courants (« Boutique Démo A » donne « DA ») et sa couleur, tirée des matières des univers, reste la même pour une boutique donnée. Sur l'accueil, une boutique se présente par une vitrine de ses trois dernières pièces, le monogramme posé à cheval sur la vitrine.

## Surfaces

- Accueil : expressif. Héros harissa avec l'armoire, rayons aux couleurs des univers, podium sur encre chaude, puis étiquettes et tuiles franches.
- Authentification : expressive, aplats harissa et encre.
- Compte, vendeur et administration : sobres, listes à filets et tableaux, chiffres tabulaires.

## RTL

Utiliser uniquement les propriétés logiques (`ms-`, `pe-`, `start-`). Les icônes directionnelles portent `rtl:-scale-x-100`. Les valeurs latines (e-mail, téléphone, chemin) sont forcées en `dir="ltr"`.
