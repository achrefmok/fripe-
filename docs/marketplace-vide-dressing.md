# Marketplace et Vide-Dressing

FRIPE réunit trois expériences dans une seule application et un seul compte :

| Rubrique | Contenu | Vendeurs | Route |
|---|---|---|---|
| Mode | Le catalogue de vêtements actuel | Boutiques | `/`, `/catalogue` |
| Marketplace | Tous les autres produits | Boutiques et particuliers | `/marketplace` |
| Vide-Dressing | Vêtements, chaussures et accessoires | Particuliers | `/vide-dressing` |

Le Vide-Dressing n'existait pas avant ce module : il est créé ici, comme côté particuliers de la mode.

## Ce qui ne change pas

Le catalogue mode garde ses catégories, ses filtres, sa recherche et ses écrans. `getCategories()` ne renvoie que la mode par défaut ; seuls les formulaires des boutiques demandent `getCategories("all")`. Le catalogue et l'accueil filtrent aussi les produits sur `categories.section = 'mode'` : un produit de boutique rangé dans une catégorie Marketplace n'y apparaît jamais.

## Données

Migrations `20261106000001_marketplace_enums.sql` et `20261106000002_marketplace.sql`, incrémentales, sans suppression.

- `categories.section` (`mode` par défaut, ou `marketplace`) : une sous-catégorie hérite de sa racine. Dix rubriques Marketplace et leurs sous-catégories sont créées en français et en arabe.
- `category_attributes` : les filtres propres à une catégorie (marque, classe énergie, stockage, type de vélo, taille de cadre, matière, âge). Un produit ou une annonce ne peut porter que des caractéristiques prévues pour sa catégorie ou sa racine, avec une valeur de la liste pour un choix.
- `listings` et `listing_images` : les annonces de particuliers, séparées des produits professionnels. Section `marketplace` ou `vide_dressing` ; une annonce du Vide-Dressing doit être en catégorie mode, une annonce Marketplace en catégorie Marketplace.
- `listing_favorites`, `listing_threads`, `listing_messages`, `person_blocks` : favoris, échanges et blocage entre particuliers.
- Vue `marketplace_items` (`security_invoker`) : annonces Marketplace et produits de boutiques en catégorie Marketplace, sous les droits de la personne qui lit. Les pièces vendues n'y figurent pas.

## Vente entre particuliers

La vente se conclut par message, sans paiement en ligne : l'acheteur écrit, les deux personnes conviennent de la remise, le vendeur indique « réservée » puis « vendue ». La fiche d'annonce le rappelle, avec des conseils de prudence.

## Règles de sécurité

- Le vendeur est toujours le compte connecté : la colonne n'est pas modifiable et le déclencheur l'impose. Seule la clé de service (serveur, données de démonstration) publie pour un autre compte, et seulement s'il est actif.
- Une annonce n'est visible que publiée, non modérée et d'un compte actif : un compte suspendu disparaît des résultats.
- Le vendeur ne touche ni à la modération ni au compteur de favoris (droits par colonne). Une annonce retirée par la modération ne revient pas.
- Photos : bucket `listing-images`, dossier `vendeur/annonce/`, dix au plus, 4 Mo. Les photos retirées ou d'annonces supprimées partent dans la file de purge ; les fichiers orphelins sont balayés chaque heure.
- Échanges : uniquement par `contact_listing` et `send_listing_message`. Pas d'écriture directe, pas de message à soi-même, plus aucun message après un blocage, limites quotidiennes (30 nouveaux contacts, 200 messages, 30 annonces).
- Signalements : une annonce ou un échange. L'administration peut retirer l'annonce (photos purgées), fermer l'échange ou suspendre le compte visé. Elle ne lit pas les échanges, seulement l'extrait joint au signalement.
- Suppression de compte : annonces et photos effacées, messages remplacés par `[message supprimé]`, échanges fermés, favoris et blocages retirés.

Tests : `supabase/tests/database/008_marketplace_listings.test.sql` (43 vérifications) et `tests/e2e/marketplace-listings.spec.ts`.

## Navigation mobile

Barre du bas : Mode, Marketplace, Vendre (au centre), Vide-Dressing, Compte. Le panier passe dans l'en-tête. « Vendre » mène à `/vendre`, qui oriente vers une annonce Marketplace, une annonce Vide-Dressing ou la boutique professionnelle. Les filtres s'ouvrent dans un panneau qui monte du bas ; le formulaire est une simple requête GET, utilisable sans JavaScript et partageable par lien.

## Limites connues

- Pas de paiement ni de livraison entre particuliers : volontaire.
- Les nouveaux messages arrivent par sondage toutes les 8 secondes quand l'onglet est visible, et par notification interne. Il n'y a pas de notification push.
- Les annonces sont publiées sans validation préalable, puis modérées sur signalement. À revoir si les abus l'exigent.
- Les textes arabes de la Marketplace n'ont pas été relus.
