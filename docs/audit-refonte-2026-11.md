# FRIPE — Audit du dépôt et plan de refonte

État au 15 novembre 2026, branche `staging` (commit `d1184aa`). Ce document répond aux phases 1 et 2 du brief « FRIPE: the next-generation second-hand marketplace » : rien n'a encore été modifié pour la refonte.

Tout ce qui suit a été vérifié dans le code. Quand le brief demande une fonction qui existe déjà, c'est indiqué ; quand elle n'existe pas, c'est dit aussi.

---

## 1. En bref

FRIPE est beaucoup plus avancé que ce que le brief laisse supposer. La plupart des briques demandées existent déjà et fonctionnent :

- marketplace d'objets hors mode (10 univers : électroménager, informatique, mobilier, sport, jeux…) ;
- Vide-Dressing entre particuliers, avec armoire animée, portant, lots et mode « Coup de foudre » ;
- Fripe Walk (vidéos verticales) avec studio de montage dans le navigateur ;
- cabine d'essayage (Outfit Builder) et styliste à moteur déterministe ;
- commandes, livraison et suivi, avis clients, signalements et modération ;
- live shopping, arrivages de boutiques, demandes de stock, messagerie ;
- page Découvrir en 3D (three.js), PWA, français et arabe complets.

La refonte ne part donc pas de zéro. Il s'agit surtout de **relier, harmoniser et compléter**, pas de reconstruire. Une réécriture large ferait courir plus de risques qu'elle n'apporterait.

**Qualité mesurée aujourd'hui :**

| Contrôle | Résultat |
|---|---|
| Tests unitaires (vitest) | 125 / 125 réussis |
| TypeScript strict | 0 erreur |
| ESLint | 0 erreur |
| Parcours Playwright `pnpm test:app` (103 pages × 4 configurations, 36 étapes de scénario) | 0 étape en échec, 0 texte non traduit, 0 débordement |
| Tests e2e `pnpm test:e2e` (24 specs) | **non lancés** : ils exigent la pile Supabase de test sous Docker |

---

## 2. Carte fonctionnelle

### 2.1 Chiffres

- 103 routes (`src/app/[locale]/…`), réparties en 8 groupes : `(public)`, `(auth)`, `(client)`, `(seller)`, `(admin)`, `(walk)`, `(landing)`, `[...rest]`.
- 21 domaines dans `src/features/`, environ 21 700 lignes.
- 64 tables, 3 vues, 68 fonctions SQL, 149 politiques RLS, 36 migrations.
- 1 869 textes traduits en français et en arabe.
- 102 composants client sur 248 fichiers `.tsx`.

### 2.2 Par domaine

| Domaine | Ce qui existe | État |
|---|---|---|
| **Comptes** (`auth`) | Inscription, connexion, vérification d'e-mail, mot de passe oublié, MFA pour les administrateurs, suspension, suppression de compte | Complet |
| **Boutiques** (`shops`) | Création, validation par l'administration, membres et rôles (owner, manager, staff), réglages, abonnés, annuaire | Complet |
| **Catalogue boutiques** (`catalog`) | Produits avec état, défauts, marque, taille, couleur, photos ; publication rapide par CSV ; recherche sans accents ; filtres catégorie, taille, marque, état, gouvernorat, prix ; 3 tris | Complet ; pas d'autocomplétion ni de recherches récentes |
| **Stock physique** (`inventory`) | Pièces déclarées sans photo, mouvements, demandes de stock des clients | Complet |
| **Arrivages et collections** | Arrivages validés par l'administration, collections de boutique | Complet |
| **Marketplace et Vide-Dressing** (`marketplace`, `dressing`) | Annonces entre particuliers dans 2 sections ; Vide-Dressing avec armoire animée en CSS, portant, lots, Coup de foudre, favoris | Complet ; les annonces n'ont **pas de champ « défauts »** |
| **Fripe Walk** (`walk`) | Fil vertical plein écran, une vidéo active, partage, favoris, produits liés ; studio : filmer ou importer une vidéo, texte, voix, musique générée par le code (libre de droits) | Fonctionne ; **pas de vidéo à partir de photos** ; pas de préchargement des vidéos voisines |
| **Live shopping** (`live`) | Diffusion WebRTC avec relais TURN, commentaires, produits épinglés | Fonctionne |
| **Cabine et styliste** (`stylist`) | Tenues par emplacement (haut, bas, chaussures, accessoire) ; moteur de recommandation déterministe, sans service externe, prévu pour brancher un modèle plus tard | Fonctionne |
| **Commandes et livraison** (`orders`) | Panier, commande groupée par boutique, statuts, expéditions, événements de suivi, tarifs par zone, accès livreur | Complet |
| **Réservations** | Mise de côté d'une pièce | Fonctionne |
| **Avis** (`reviews`) | Avis par article commandé, réponse du vendeur, masquage par l'administration | Complet pour les boutiques ; **rien pour les ventes entre particuliers** |
| **Confiance et modération** | Signalements sur 8 types de contenu, décisions, blocages, journal d'audit, limites de débit | Complet |
| **Social** (`social`) | Abonnements aux boutiques, alertes « nouvelles pièces », notifications | Complet |
| **Messagerie** | Conversations client–boutique et fils d'annonce | Complet |
| **Administration** | 14 écrans : boutiques, produits, annonces, catégories, lieux, commandes, livraison, avis, signalements, utilisateurs, vidéos, arrivages, audit | Complet |
| **Accueil et Découvrir** (`home`, `landing`) | Accueil mode (recherche, portant, cabine, Walk, arrivages, sélection, boutiques) ; page Découvrir 3D affichée à la première ouverture | Fonctionne ; **l'accueil met peu en avant les objets hors mode** |

### 2.3 Fondations techniques

- **Données** : Supabase, avec un client public pour les lectures publiques et un client de session côté serveur. Le client `admin` (clé service) n'est utilisé que côté serveur.
- **Sécurité** : RLS activée dans 21 migrations (149 politiques), CSP stricte (`next.config.ts`), en-têtes de sécurité, Server Actions validées par zod.
- **Proxy** (`src/proxy.ts`) : langue (next-intl), rafraîchissement de session, redirection vers Découvrir à la première ouverture.
- **Interface** : Tailwind 4, composants shadcn/Radix, `motion` (Framer Motion), `three`. Le design est décrit dans `DESIGN.md` (direction « L'étiquette » : écru, encre, harissa, or, Bodoni Moda et Jost, Alexandria pour l'arabe).

---

## 3. Écarts entre le brief et l'existant

| Section du brief | Existe déjà | Manque réellement |
|---|---|---|
| §4 Accueil éditorial | Accueil riche mais centré sur la mode ; page Découvrir 3D | Accueil multi-univers (mode et objets) ; collections thématiques dynamiques (« trouvailles du jour », « meilleures occasions »…) ; section « devenir vendeur » |
| §4 Univers Mode, Sneakers, Maison, Tech, Sport, Loisirs, Enfants, Accessoires | Catégories mode (hauts, bas, vestes, robes, chaussures, accessoires) et 10 univers marketplace | **Enfants**, **Livres** et **Sneakers** comme univers à part : ils n'existent pas comme catégories racines. Ils peuvent être créés dans l'écran d'administration des catégories, sans migration. |
| §5 Fripe Walk | Fil, partage, favoris, produits liés, studio | Vidéo à partir de photos (diaporama et transitions) ; préchargement de la vidéo suivante ; navigation vers l'armoire du vendeur |
| §6 Vide-Dressing immersif | Armoire animée en CSS, portant, lots | Sections chaussures et accessoires ; mémoire de la position au retour ; une version 3D, à justifier sur mobile (voir 4.3) |
| §7 Cabine et Outfit Builder | Tenues, emplacements, styliste, prix total | Suggestions compatibles depuis une fiche produit ; partage d'une tenue ; mention claire qu'il s'agit d'une composition, pas d'un essayage |
| §8 Confiance | États, défauts (boutiques), avis, signalements, modération, suivi | Champ défauts pour les **annonces** ; 6ᵉ niveau d'état « Neuf sans étiquette » (aujourd'hui « Comme neuf ») ; avis entre particuliers ; litiges (aujourd'hui seulement les signalements et le support) |
| §9 Assistant IA | Moteur de styliste prêt à recevoir un modèle | Analyse de requêtes en langage naturel (« Nlawwej 3la baskets Nike… ») ; recherche par image ; estimation de prix |
| §10 Recherche | Sans accents, 7 filtres, 3 tris | Autocomplétion, recherches récentes, filtre par ville, tri « popularité » |
| §11 Design system | `DESIGN.md`, jetons de couleur, composants | `globals.css` fait 8 885 lignes en un seul fichier ; les cartes produit diffèrent d'une section à l'autre |
| §13 Performance | Rendu serveur, ISR (`revalidate = 60`), compression des photos à l'envoi | Les 50 usages de `next/image` sont en `unoptimized` : aucune image n'est redimensionnée côté serveur |
| §14 Tests | 24 specs e2e, 8 fichiers unitaires, parcours `pnpm test:app` | Specs e2e non exécutables sans Docker ; parcours d'achat complet à ajouter au banc sans Docker |

---

## 4. Points d'attention

### 4.1 Le brief contredit les principes du projet sur trois points

`PRODUCT.md` fixe des règles validées par le client. Elles priment sur le brief :

1. **« Strong editorial photography »** : il n'existe aucune photo éditoriale réelle, et `PRODUCT.md` interdit d'en inventer. L'accueil utilisera les vraies photos des pièces publiées, comme la page Découvrir, ou des illustrations assumées.
2. **« Seller verification »** : le brief le dit lui-même, seulement si un vrai processus existe. Pour les boutiques, il existe (validation par l'administration) ; pour les particuliers, il n'existe pas. Aucun badge « vérifié » ne sera affiché aux particuliers.
3. **IA** : rien ne doit être simulé. Chaque fonction IA aura une version sans IA (recherche classique) et ne sera activée qu'après un chiffrage.

### 4.2 Dépendances

Le brief cite React Three Fiber. Le projet utilise déjà `three` directement, sans R3F (page Découvrir). Ajouter R3F ne se justifie que si plusieurs scènes 3D complexes arrivent. Pour l'armoire, `three` seul ou le CSS 3D actuel suffisent. Aucune nouvelle dépendance n'est nécessaire pour les phases 3 à 5.

### 4.3 Armoire 3D sur mobile

L'armoire du Vide-Dressing est aujourd'hui en CSS : légère, nette, et fonctionnelle sur les téléphones d'entrée de gamme. Une armoire WebGL chargerait three.js (environ 150 Ko compressés) et solliciterait la batterie, pour un gain incertain dans l'acte d'achat. Proposition : garder le CSS comme expérience principale, et réserver la 3D à l'ouverture de l'armoire sur les appareils capables, avec repli automatique.

### 4.4 Tests et environnements

- Les tests e2e ont besoin de la pile Docker (`pnpm test:e2e`). Sans Docker, la couverture passe par `pnpm test:app` (faux Supabase), qui ne vérifie pas les vraies politiques RLS.
- Le Supabase local (`127.0.0.1:54321`) est éteint. Les captures se font donc avec le faux Supabase.
- Toute migration nouvelle sera **additive** (nouvelles colonnes avec valeur par défaut, nouvelles tables, nouvelles valeurs d'énumération). Aucune suppression, aucune réinitialisation. Rien ne sera appliqué sur un projet distant sans demande explicite.

---

## 5. Plan de réalisation

Chaque phase est livrée séparément sur `staging`, vérifiée (types, lint, tests unitaires, `pnpm test:app`, captures en français et en arabe, clair et sombre, mobile et ordinateur), puis commitée sur demande.

### Phase 3 — Accueil multi-univers (sans migration)

- **Nouvel accueil** construit à partir de l'actuel, sans retirer aucune de ses sections :
  - accroche courte (« Chaque objet mérite une seconde vie. » / « كل قطعة تستحق حياة جديدة. ») sur de vraies photos ;
  - deux appels à l'action, Découvrir et Vendre.
- **Grille des univers** : les 6 univers mode et les univers marketplace, avec leurs sous-catégories, chacun menant à son catalogue.
- **Collections dynamiques**, toutes tirées de la base et masquées quand elles sont vides : Nouveautés, Les plus aimées, Petits prix, Pièces de marque.
- **Fripe Walk, armoires du Vide-Dressing et sélection** : réorganisés en sections éditoriales.
- **Section « Vendre sur FRIPE »** : particulier ou boutique, avec liens réels.
- **Carte produit unique** (image, prix, état, vendeur, favori, disponibilité), réutilisée partout.
- Fichiers concernés : `src/app/[locale]/(public)/page.tsx`, `src/features/home/*`, `src/features/catalog/components/product-card.tsx`, messages.

### Phase 4 — Marketplace et confiance (migrations additives)

- Recherche : autocomplétion (marques, catégories, titres), recherches récentes enregistrées localement, filtre par ville, tri par popularité.
- Fiche produit : galerie plein écran, bloc état et défauts mis en avant, infos de livraison, « autres pièces du vendeur » et « pièces similaires ».
- Migration : `listings.defects` (texte, optionnel) et valeur d'état `new_without_tags`. Les données existantes ne changent pas.
- Défauts obligatoires à déclarer, avec une case « aucun défaut » explicite, pour les nouvelles annonces et les nouveaux produits.

### Phase 5 — Expériences immersives

- Fripe Walk :
  - préchargement de la vidéo suivante ;
  - lien vers l'armoire du vendeur ;
  - **studio photo → vidéo** : diaporama de 3 à 8 photos, transitions, textes et musique du studio actuel, rendu dans le navigateur (MediaRecorder), donc sans API payante.
- Vide-Dressing : sections chaussures et accessoires, retour à la même position, armoire suivante.
- Cabine :
  - bouton « Composer une tenue avec cette pièce » sur les fiches produit ;
  - suggestions tirées des pièces disponibles ;
  - partage d'une tenue ;
  - mention « composition visuelle, pas un essayage ».

### Phase 6 — Assistant d'achat

- **Étape 1, sans IA et sans coût** : un analyseur de requêtes en français, arabe et darija latine (« nlawwej », « baskets », « taille 42 », « max 120 DT »). Il le transforme en filtres de recherche existants. Il est testable en tests unitaires et ne peut pas inventer de produit.
- **Étape 2, optionnelle** : brancher un modèle de langage sur cette interface pour les requêtes ambiguës. Elle demande un chiffrage préalable, et n'est activée que si une clé est configurée.
- **Différé** : recherche par image et estimation de prix. Les deux exigent des données réelles en quantité et un chiffrage.

### Phase 7 — Confiance et conversion

- Avis après une vente entre particuliers. Cela demande une nouvelle table, car les ventes entre particuliers ne passent pas par les commandes.
- Page « vendeur » plus lisible : ancienneté, nombre de ventes, note moyenne réelle.
- Parcours litige : formulaire relié aux signalements et au support existants.

### Phase 8 — Contrôle qualité

- Étendre `pnpm test:app` avec les parcours d'achat, de publication, de Walk et de changement de langue, testés comme un vrai utilisateur.
- Lancer `pnpm test:e2e` sur la pile Docker, sur ton poste ou en CI. Je ne le lance pas ici.
- Rapport PDF par phase.

### Phase 9 — Validation staging

- Liste de contrôle mobile et ordinateur, français et arabe, clair et sombre, sur l'URL staging.
- Aucun déploiement en production sans autorisation explicite.

---

## 6. Décisions à prendre avant la phase 3

1. **Accueil** : le nouvel accueil remplace-t-il l'actuel sur `/`, ou est-il d'abord publié sur une route d'essai (par exemple `/accueil-v2`) pour comparer ?
2. **Nouveaux univers** : faut-il créer Enfants, Livres et Sneakers dans l'administration des catégories ? Je peux préparer la liste, mais leur création touche la base.
3. **État « Neuf sans étiquette »** : l'ajouter comme 6ᵉ niveau, ou renommer « Comme neuf » ? L'ajout est plus sûr pour les données existantes.
4. **IA** : partir de l'étape 1 sans coût, ou chiffrer tout de suite un fournisseur pour l'étape 2 ?
5. **Armoire 3D** : CSS amélioré avec ouverture 3D sur les appareils capables (recommandé), ou armoire entièrement en WebGL ?
