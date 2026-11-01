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

Une seule idée : l'étiquette qui se stabilise au chargement et se balance au survol ou au focus. `prefers-reduced-motion` la désactive.

## Surfaces

- Accueil et authentification : expressifs, aplats harissa et encre.
- Compte, vendeur et administration : sobres, listes à filets et tableaux, chiffres tabulaires.

## RTL

Utiliser uniquement les propriétés logiques (`ms-`, `pe-`, `start-`). Les icônes directionnelles portent `rtl:-scale-x-100`. Les valeurs latines (e-mail, téléphone, chemin) sont forcées en `dir="ltr"`.
