# Espace vendeur, formulaire produit et studio vidéo

## Navigation

- Barre du bas (téléphone) : Mode, Marketplace (« سلع متنوعة » en arabe), Vendre, Vide-Dressing, **Vidéos** (Fripe Walk). Le compte est une icône dans l'en-tête, avec sa pastille de notifications.
- Accueil : une rangée « En vidéo » montre les dernières vidéos publiées, juste après les rayons. Chacune ouvre Fripe Walk sur elle-même.

## Espace vendeur

Trois entrées principales : **Ma boutique**, **Mes produits**, **Mes vidéos**. Les pages secondaires restent accessibles :

- dans Mes produits : Produits, Publication rapide, Collections, Stock physique ;
- dans la rangée « Activité » : Commandes, Messages, Demandes, Avis, Blocages.

En tête de chaque page : le logo ou le monogramme, le statut, **Voir ma boutique** (une fois la boutique validée) et **Retour à l'application**. La page Ma boutique propose les deux gestes du quotidien (Ajouter un produit, Créer une vidéo), les informations de la boutique avec « Modifier les infos et le logo », et les chiffres.

## Formulaire produit

- Catégorie en puces : le rayon, puis la sous-catégorie. Une fois le rayon choisi, les autres se replient (« Changer de rayon »).
- Les champs suivent le type de pièce (`src/features/catalog/product-options.ts`) :

| Type | Taille | Couleur | Caractéristiques |
|---|---|---|---|
| Vêtements (hauts, bas, vestes, robes) | XS à 3XL, ou 34 à 48 | pastilles | Pour, Coupe (Longueur pour les robes), Matière |
| Chaussures | pointures 35 à 46 | pastilles | Pour, Matière |
| Accessoires | Taille unique | pastilles | Pour, Matière |
| Objets divers | — | — | celles de la rubrique (classe énergie, stockage…) |

- Une taille ou une couleur hors liste reste possible en texte libre. La couleur est enregistrée en français (« Bleu ») et affichée en arabe sur la fiche.
- Marques suggérées : celles déjà utilisées par la boutique, puis les plus courantes du type.
- **Prix habituel** : la médiane des pièces en ligne de la catégorie, arrondie au demi-dinar, proposée seulement s'il y en a au moins trois. Rien n'est imposé.
- Titre proposé (catégorie, marque, couleur) et description rédigée à partir des choix, toujours modifiables.
- Les caractéristiques de mode sont ajoutées par la migration `20261108000001_mode_attributes.sql` (ajout seulement). La base refuse une valeur hors liste ou une caractéristique d'un autre rayon.
- Pièce unique conservée : la disponibilité reste disponible, réservée ou vendue ; les lots restent dans le stock physique.

## Studio vidéo

Route : `/vendeur/boutique/[shopId]/videos/nouvelle`. Code : `src/features/walk/studio/`.

1. **Filmer** : caméra arrière par défaut, changement de caméra, démarrage, pause, reprise, arrêt ; 60 secondes au plus, arrêt automatique.
2. **Revoir** : refaire ou valider.
3. **Monter** :
   - musique de fond ;
   - voix off enregistrée pendant la lecture ;
   - volumes du son d'origine, de la musique et de la voix ;
   - texte sur la vidéo ;
   - pièce montrée, avec son nom et son prix modifiables, affichés dans une étiquette rouge.
4. **Publier** : description, association à la pièce montrée, puis le circuit de publication unique (`src/features/walk/publish-video.ts`), le même que l'import de fichier : vérification, compression, miniature, envoi, relecture de l'en-tête par le serveur.

### Musiques

Quatre ambiances (Portant, Souk, Défilé, Plage) **composées par le code** dans le navigateur (`music.ts`, Web Audio hors ligne). Aucun fichier ni droit d'auteur. Pour ajouter des morceaux du commerce, il faudrait une licence écrite pour chacun : rien de tel n'est intégré.

### Contraintes des navigateurs et solutions de secours

- La caméra et le micro exigent une page sécurisée (HTTPS ou localhost) et l'accord de l'utilisateur. L'en-tête `Permissions-Policy` les autorise pour le site lui-même seulement (`camera=(self), microphone=(self)`), jamais dans un cadre tiers.
- Format enregistré : MP4 (H.264) sur Safari, WebM ailleurs. Les deux sont acceptés par la publication.
- **Recours toujours visibles** : « Filmer avec l'appareil photo » (appareil natif du téléphone) et « Importer une vidéo ».
- Sans MediaRecorder, sans capture de canevas ou sans Web Audio, le montage est indisponible : la vidéo est publiée telle quelle, avec un message clair.
- Le rendu final se fait en temps réel : une vidéo de 30 secondes demande 30 secondes. L'écran doit rester ouvert ; le message le rappelle.
- Refus de la caméra ou du micro : message en clair avec le chemin vers les réglages, et les recours ci-dessus.

### Tests

`tests/e2e/video-studio.spec.ts` filme avec la caméra et le micro simulés de Chromium :
- pause et reprise ;
- musique ;
- texte, nom et prix, en vérifiant les pixels de l'étiquette dessinée ;
- voix off et volume ;
- rendu et publication, avec la pièce associée en base.

Un second parcours couvre une prise refaite et la publication sans montage.

**Non testé avec du vrai matériel** : iPhone (Safari) et Android réels, son réel de la musique et de la voix, qualité de la vidéo finale.
