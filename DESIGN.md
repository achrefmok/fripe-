# Friptex — système visuel « Friptex Luxe »

Une friperie tunisienne présentée comme une maison de couture : la nuit, l'or, le crème, la terre cuite. Le vocabulaire vient du portant, du cintre, de l'étiquette, de l'arche et du zellige.

## Couleurs

Définies dans `src/app/globals.css`, en clair et en sombre. Les anciens noms restent pour ne rien casser : `--harissa` porte la terre cuite, `--kraft` l'or.

| Rôle | Jeton | Clair | Usage |
| --- | --- | --- | --- |
| Papier | `--paper` / `--background` | `oklch(0.975 0.008 85)` | Fond |
| Encre | `--ink` / `--foreground` | `oklch(0.17 0.008 60)` | Texte, action principale |
| Surface | `--surface` | `oklch(0.995 0.004 85)` | Cartes |
| Crème | `--cream` | `oklch(0.94 0.02 82)` | Contrôles segmentés, fonds doux |
| Or | `--gold` | `oklch(0.74 0.1 80)` | Filets, anneaux, soulignés actifs, bouton Vendre |
| Or lisible | `--goldink` | `oklch(0.5 0.09 72)` | Or posé sur papier : prix, sur-titres, liens |
| Terre cuite | `--harissa` | `oklch(0.56 0.13 40)` | Signal : « Nouveau », compteurs, alertes |
| Nuit | `--night` | `oklch(0.16 0.01 55)` | Héros, bandeau boutique, défilé, Fripe Walk, résumé du panier |
| Verre | `--glass` | papier à 88 % | En-tête et barre du bas, avec flou |

En sombre, la nuit devient le fond, le crème fonce et l'or s'éclaircit (`--goldink` remonte à 0.8 de clarté). L'or sur papier passe toujours par `--goldink`, jamais par `--gold`, pour garder 4,5:1.

## Typographie

- Titres et marque : Bodoni Moda (`--font-wordmark`, `.font-display`), graisse 400 à 500, italique pour le mot qui compte (`<em>` dans les messages : « Chaque pièce a déjà une *histoire.* »).
- Texte latin : Jost.
- Arabe, titres et texte : Alexandria.
- Sur-titres (`.luxe-kicker`) : petites capitales espacées en or lisible.

## Formes

- Cartes arrondies à `--radius-card` (18 px), grands panneaux à 24–28 px, filet de 1 px `--border`, pas d'ombre décorative.
- Boutons, puces, segments et onglets en pilule (`rounded-full`).
- `.zellige` : la frise sous l'en-tête, seul motif répété.
- `.luxe-price` : le prix agrafé sur la photo, œillet d'or, pointe vers l'intérieur, miroir en RTL.
- `ShopMark` : médaillon rond, logo ou monogramme, anneau d'or sur le bandeau boutique.
- Champs : soulignés, comme une étiquette à remplir.

## Cadre

- En-tête en verre (`.luxe-header`) : la marque, les liens (Mode, Marketplace, Vide-Dressing, Boutiques, Fripe Walk, Chine, Cabine, Vendre) soulignés d'or quand ils sont actifs, puis thème, langue, favoris, panier et compte.
- Barre du bas flottante (`.luxe-tabbar`, téléphone) : Accueil, Chine, Vendre sur disque d'or au centre, Cabine, Compte.
- Pied de page : « Friptex » en Bodoni, une ligne, les liens légaux.

## Mouvement

Ce qui pend bouge comme ce qui pend. Seules `transform`, `opacity` et `clip-path` s'animent, en CSS ou en API Web Animations. `prefers-reduced-motion` ouvre l'arche d'emblée et coupe balancements, rideau et rotation du défilé.

- L'arche (`dressing-hero.tsx`) : le dressing en arche tunisienne dans le héros de nuit, sous un projecteur qui suit la souris. Les portes s'ouvrent une fois par visite (`sessionStorage`), la porte est le seul bouton : la toucher ferme, la toucher encore rouvre. La porte gauche porte le nom et l'état, la droite est muette. Fermée, l'intérieur est `inert`. Chaque vêtement mène au catalogue de sa catégorie.
- Le défilé (`runway-ring.tsx`) : les nouvelles pièces tournent sur un anneau 3D. Pause, flèches, arrêt au survol et au focus.
- Le portant (`/chine`, `rack-swipe.tsx`) : glisser à gauche ou à droite, tirer vers le haut pour décrocher une pièce dans les favoris. Les flèches du clavier et des boutons font la même chose.
- La cabine (`fitting-booth.tsx`) : quatre emplacements sous une arche, « Tirer le rideau », jauge de budget.

## Univers

Chaque catégorie racine garde sa matière (`src/features/home/universes.ts`). `Garment` dessine les vêtements en SVG, à plat. Ces couleurs vivent dans l'arche, le bandeau du catalogue et les scènes de l'atelier, jamais sur les cartes.

## Surfaces

- Accueil : salutation et rubriques, recherche, héros de nuit avec « Je chine » et « Je vends » et l'arche ; le portant et la cabine côte à côte ; Fripe Walk en stories ; les nouveaux arrivages validés par l'administration ; le défilé ; la sélection ; les boutiques en mosaïques ; Marketplace et Vide-Dressing en photos ; l'atelier (AI Stylist, Outfit Builder, Fripe Walk) en rangées.
- Catalogue : bandeau `.lx-band` (sur-titre, catégorie, sous-catégories), puces des catégories, raccourcis taille et tri, filtres.
- Fiche pièce : galerie 4:5, badge « Pièce unique », prix en or lisible, `FlipTag` (caractéristiques au recto, défauts au verso).
- Boutique : bandeau de nuit, onglets « Pièces en ligne » et « En magasin ».
- Marketplace et Vide-Dressing : la rubrique garde sa couleur (denim, garance) dans son bandeau.
- Fripe Walk : seul écran entièrement de nuit ; sur grand écran, la vidéo dans une arche cerclée d'or.
- Connexion : panneau photo de nuit, étiquette « Friptex » qui se balance, formulaire à droite.
- Compte, vendeur et administration : sobres, rangées à filets, chiffres tabulaires.

## Vide-Dressing

La garance (`--vd`) est son identité, l'or (`--vd-gold`) ce qui pend et ce qui brille, le crème (`--vd-paper`) les fiches de lot. Chaque dressing reçoit une teinte stable tirée de l'identifiant de la personne (`src/features/dressing/tone.ts`), reprise sur son cercle, ses photos manquantes (rayées, avec un cintre) et sa page.

- Accueil : bandeau d'or qui défile (dernières pièces), héros dont le rideau se lève et dont l'armoire s'ouvre sur le portant du dressing le plus garni (pièces qui se balancent, prix agrafés, armoire qui suit la souris) ; dressings du jour en cercles, l'anneau d'or tourne autour de ceux qui ont du nouveau depuis la dernière visite (`localStorage`) ; « Chiner par envie » en quatre tuiles ; toutes les pièces en grille ou sur portant (choix mémorisé, transition de vue) ; Lot malin ; « Ton dressing déborde ? ».
- Carte : photo, état, cœur, marque en petites capitales d'or, taille en pastille, prix en Bodoni, prénom et ville, « Faire une offre » (mène au formulaire de contact de l'annonce, `#contact`).
- Page d'un dressing : bandeau dans sa teinte, quatre chiffres réels (pièces, marques, coups de cœur, plus petit prix), portant où l'on touche les pièces pour composer un lot ; la fiche du lot propose un prix et part en un seul message par `contact_listing`. Aucune remise n'est inventée : c'est l'acheteur qui propose.
- Coup de foudre (`/vide-dressing/coup-de-foudre`) : cinq pièces du jour en pile, glisser à droite garde (favori), à gauche passe ; boutons et flèches font le même geste.
- Mouvement : seuls `transform`, `rotate`, `translate`, `opacity` et `clip-path` s'animent ; les sections entrent au défilement (`animation-timeline: view()`, sinon au chargement). `prefers-reduced-motion` ouvre l'armoire d'emblée, arrête le bandeau, les balancements et l'anneau.

## Live Shopping

Côté client, une scène de nuit : la vidéo verticale cerclée d'or, la pièce mise en avant posée dessus en carte crème, le fil des commentaires et les pièces à côté. Le rouge vif (`oklch(0.55 0.2 27)`) est réservé à « En direct » et au bouton qui lance le direct. Côté boutique, le studio est clair et lisible : moniteur, un seul grand bouton, quatre chiffres, les pièces à épingler d'un geste, le fil à modérer sur fond de nuit.

## Cabine, côté miroir

Le rideau se ferme sur la cabine et se rouvre sur le miroir : les pièces du look, posées comme on s'habille, légèrement inclinées, bordées de blanc. Toucher une pièce choisit sa catégorie ; la remplacer se fait sans quitter le miroir.
## Photos

Aucune marque visible, aucune personne. Les sources sont notées dans `scripts/seed-photos/SOURCES.md`.

## RTL

Uniquement des propriétés logiques (`ms-`, `pe-`, `start-`). Les icônes directionnelles portent `rtl:-scale-x-100`. Les valeurs latines (e-mail, téléphone, chemin) sont forcées en `dir="ltr"`.
