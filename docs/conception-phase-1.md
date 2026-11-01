# FRIPE — Dossier de conception (phase 1)

Date : 30 octobre 2026. Statut : phase 1 implémentée en local. Les écarts sont listés au §8.

## 0. Analyse de départ

| Point | Constat | Conséquence |
| --- | --- | --- |
| Répertoire | Vide, pas de dépôt git | Rien à préserver ; `git init` en début de phase 1 |
| Node / pnpm | Node 24.18, pnpm 12.16 | OK (Next exige Node ≥ 20.9) |
| Supabase CLI | Non installée globalement | Installée en devDependency, utilisée via `pnpm exec supabase` |
| Docker | Client 29.8 installé, **démon arrêté** | À démarrer pour le Supabase local |
| Identifiants Supabase | Aucun | Développement 100 % local possible ; `.env.example` seulement |

### Écarts au brief, décidés et motivés

1. **Clés Supabase.** Le brief cite `ANON_KEY` et `SERVICE_ROLE_KEY`, mais demande aussi les noms compatibles avec le SDK actuel. La documentation Next.js de Supabase utilise `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) et le couple publishable/secret remplace anon/service_role. On retient donc `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
2. **Rôles.** Pas de colonne unique `role` : un vendeur achète aussi. Être client = avoir un compte ; être vendeur = être membre d'une boutique (`shop_members`) ; être admin = figurer dans `platform_admins`, table non modifiable par le client.
3. **Prix en millimes.** Le dinar tunisien a 3 décimales. Tous les montants sont des entiers (`price_millimes`) pour éviter les erreurs d'arrondi : 35 DT = `35000`.
4. **Commandes multi-boutiques.** Le brief n'a qu'une table `orders`. On ajoute `order_groups` (le panier payé par le client) ; chaque `orders` appartient à une seule boutique, ce qui simplifie les droits et les statuts.
5. **Tables ajoutées** (voir §2) : `platform_admins`, `order_groups`, `governorates`, `cities`, `shop_addresses`, `conversation_participants`, `stock_request_offers`, `push_subscriptions`, `battles`, `battle_votes`, `product_embeddings`, `delivery_rates`, `platform_settings`, `rate_limits`.
6. **Arborescence.** `src/app/[locale]/(public)/…` au lieu de `src/app/(public)/…` pour le routage fr/ar.
7. **Migrations par étapes.** Tout le schéma est conçu ici, mais chaque migration n'arrive qu'avec la fonctionnalité qui l'utilise. Une table sans parcours n'a pas de RLS réellement testée.

## 1. Architecture technique

```text
Navigateur / PWA (React 19, Tailwind, shadcn/ui, Serwist)
   │  Clé publishable + session cookie → lectures publiques soumises à RLS
   ▼
Next.js 16 (App Router)
   ├─ proxy.ts            locale (next-intl) + rafraîchissement session
   ├─ Server Components   lectures
   ├─ Server Actions      mutations de l'interface
   ├─ Route Handlers      webhooks, cron, push
   ▼
src/features/<domaine>/   logique métier, indépendante de l'UI
   ├─ schemas.ts   Zod (partagé avec le formulaire)
   ├─ queries.ts   lectures (serveur)
   ├─ actions.ts   mutations (auth → validation → RPC/requête)
   └─ service.ts   règles métier
   ▼
src/lib/supabase/
   ├─ client.ts    navigateur (publishable)
   ├─ server.ts    serveur + cookies utilisateur (RLS active)
   └─ admin.ts     clé secrète, `server-only`, crons et admin uniquement
   ▼
Supabase : PostgreSQL + RLS + RPC, Auth, Storage, Realtime
```

Règles structurantes :

- **Défense à deux niveaux** : chaque Server Action vérifie la session et le droit ; RLS refait la vérification en base, même si le code applicatif se trompe.
- **Authentification serveur** : `getClaims()` pour protéger pages et données, `getUser()` quand un état à jour est nécessaire (actions sensibles). Jamais `getSession()` pour autoriser.
- **Opérations critiques en RPC PostgreSQL** (réservation, commande, stock, points) : une transaction atomique, jamais une suite d'appels depuis Next.
- **Clé secrète** : importée seulement depuis `lib/supabase/admin.ts`, protégé par `import 'server-only'`, ce qui fait échouer le build si un composant client l'importe.
- **Services remplaçables** : `PaymentProvider`, `DeliveryProvider`, `StylistEngine`, `VisionProvider`, `NotificationChannel`. Sans fournisseur configuré, la fonction s'affiche comme indisponible, sans faux résultat.
- **Service worker** : pré-cache des ressources statiques et de `/offline` uniquement. Aucune route authentifiée, aucune réponse `/api` et aucune donnée personnelle en cache.
- **Identifiants** : UUID ; références lisibles séparées (`FR-2026-000123`) pour le service client.

### Arborescence

```text
src/
├── app/
│   ├── [locale]/
│   │   ├── (public)/   accueil, catalogue, boutiques
│   │   ├── (auth)/     connexion, inscription
│   │   ├── (client)/   compte
│   │   ├── (seller)/   vendeur
│   │   └── (admin)/    admin
│   ├── api/            route handlers
│   ├── manifest.ts
│   └── sw.ts
├── components/{ui,layout,products,shops,inventory,outfits,notifications}/
├── features/{auth,catalog,shops,inventory,orders,reservations,messaging,
│             recommendations,visual-search,loyalty}/
├── i18n/               routage et chargement des messages
├── lib/{supabase,validations,permissions,utils}/
├── hooks/  types/  styles/
├── messages/{fr,ar}.json
└── proxy.ts
supabase/{config.toml,migrations/,tests/,seed.sql}
tests/{unit,e2e}/
```

## 2. Schéma de base de données

Conventions : `id uuid`, `created_at`, `updated_at` ; suppression logique pour les données commerciales ; `ON DELETE RESTRICT` sur tout ce qui touche aux commandes ; RLS activée partout ; `GRANT` explicites dans les migrations.

### Identité et plateforme

| Table | Rôle | Écriture |
| --- | --- | --- |
| `profiles` | 1:1 avec `auth.users` : nom, téléphone, langue, statut | Soi-même, hors statut |
| `platform_admins` | Liste des administrateurs | Serveur |
| `governorates`, `cities` | 24 gouvernorats et villes (fr/ar) | Migration |
| `platform_settings` | Commission, durée de réservation, plafonds | Admin |
| `audit_logs` | Journal append-only | Serveur |
| `reports` | Signalements | Auteur crée, admin traite |
| `rate_limits` | Compteurs par utilisateur/action/fenêtre | Serveur |

### Boutiques et catalogue

| Table | Rôle |
| --- | --- |
| `shops` | Boutique : slug, statut `pending/approved/suspended`, plan `standard/pro` |
| `shop_members` | Utilisateur ↔ boutique, rôle `owner/manager/staff` |
| `shop_addresses` | Localisation ; coordonnées précises facultatives |
| `categories` | Arbre fr/ar |
| `products` | **Une ligne = une pièce unique, pas de quantité.** Prix en millimes, taille, marque, couleur, état, `status`, `publication_status`, référence interne |
| `product_images` | Images ordonnées |
| `collections`, `collection_products` | Regroupements thématiques |
| `inventory_items` | Stock physique déclaré, ex. « Jeans ≈ 250 », avec `is_indicative`, `last_counted_at` |
| `inventory_movements` | Historique append-only |
| `stock_requests` | Demande client (« veste Nike noire L < 50 DT ») |
| `stock_request_offers` | Proposition du vendeur en réponse |
| `product_embeddings` | Vecteurs pgvector, séparés (phase 5) |
| `price_suggestions` | Fourchettes indicatives (phase 5) |

Distinction essentielle : `products` est vendable et transactionnel ; `inventory_items` est indicatif et **jamais** commandable. Un article déclaré ne devient achetable qu'une fois publié comme produit.

### Commerce

| Table | Rôle |
| --- | --- |
| `order_groups` | Validation client : adresse, téléphone, total |
| `orders` | Sous-commande par boutique ; statut `pending → confirmed → preparing → shipped → delivered`, ou `cancelled` |
| `order_items` | **Instantané** : titre, marque, taille, état, prix, image au moment de l'achat |
| `reservations` | `active/converted/expired/cancelled`, `expires_at` |
| `delivery_rates` | Frais par boutique et gouvernorat |

**Garantie anti-double vente** (trois verrous indépendants) :

```sql
-- 1. Une seule réservation active par pièce
create unique index reservations_one_active
  on reservations (product_id) where status = 'active';

-- 2. Une seule ligne de commande vivante par pièce
create unique index order_items_one_live
  on order_items (product_id) where is_live;

-- 3. Transition atomique dans la RPC, y compris réservation expirée
update products set status = 'reserved', updated_at = now()
where id = $1
  and (status = 'available'
       or (status = 'reserved' and not exists (
             select 1 from reservations r
             where r.product_id = products.id
               and r.status = 'active' and r.expires_at > now())));
-- 0 ligne modifiée = pièce indisponible → erreur métier.
```

`products.status` n'est pas modifiable directement par le vendeur (`GRANT UPDATE` par colonne) : les transitions passent par des RPC. Une commande multi-pièces verrouille les lignes dans l'ordre des id pour éviter les interblocages. Le contrôle de `expires_at` dans la RPC rend la vente correcte même si le cron de libération est en retard.

### Social, fidélité et notifications

| Table | Rôle |
| --- | --- |
| `favorites`, `shop_followers` | Liens utilisateur |
| `conversations`, `conversation_participants`, `messages` | Messagerie client ↔ boutique |
| `reviews` | Unique par `order_item`, après livraison |
| `notifications`, `notification_preferences` | Internes, préférences Drop Alert |
| `push_subscriptions` | Abonnements Web Push par appareil |
| `videos` | Fripe Walk ; durée et taille limitées par contrainte |
| `outfits`, `outfit_items`, `style_preferences` | Tenues et préférences |
| `battles`, `battle_votes` | Unique `(battle_id, user_id)` |
| `loyalty_accounts`, `loyalty_transactions` | Grand livre append-only ; solde dérivé |
| `referrals` | Crédit après première livraison confirmée uniquement |

### RLS

Fonctions d'aide dans un schéma `private`, non exposé par l'API :

```sql
private.is_platform_admin() returns boolean
private.has_shop_role(shop uuid, roles shop_role[]) returns boolean
```

Elles sont `SECURITY DEFINER`, `STABLE`, avec `search_path` vide, et appelées via `(select …)` dans les politiques pour que PostgreSQL mette le résultat en cache.

| Domaine | Lecture | Écriture |
| --- | --- | --- |
| Produits publiés de boutiques approuvées | Public | Membres de la boutique |
| Brouillons | Membres de la boutique, admin | Membres de la boutique |
| Commandes | Acheteur, boutique concernée, admin | RPC uniquement |
| Messages | Participants | Participants |
| Journal d'audit | Admin | Aucune écriture client |

### Storage

| Bucket | Accès | Limites prévues |
| --- | --- | --- |
| `product-images` | Lecture publique, écriture dans `{shop_id}/…` par membres | 5 Mo, JPEG/PNG/WebP |
| `shop-assets` | Lecture publique, écriture par membres | 5 Mo |
| `shop-videos` | Lecture publique, écriture Pro | 50 Mo, 60 s, MP4/WebM |
| `avatars` | Lecture publique, écriture par l'utilisateur | 2 Mo |
| `visual-search` | Privé, propriétaire seul, purge automatique | 5 Mo |

Le type de fichier est revérifié côté serveur, et les images sont compressées côté client avant envoi : mobile et données limitées sont le cas nominal.

### Découpage des migrations

| Fichier | Contenu | Phase |
| --- | --- | --- |
| `0001_extensions_helpers` | `pg_trgm`, `unaccent`, schéma `private`, `updated_at` | 1 |
| `0002_identity` | profils, admins, trigger d'inscription | 1 |
| `0003_reference_data` | gouvernorats, villes, catégories, réglages | 1 |
| `0004_shops` | boutiques, membres, adresses | 1 |
| `0005_audit_ratelimit` | audit, limites de débit | 1 |
| `0006_catalog` | produits, images, collections, recherche | 2 |
| `0007_inventory` | stock physique, mouvements | 2 |
| `0008_commerce` | commandes, réservations, RPC, cron | 2 |
| `0009_storage` | buckets et politiques | 1 (avatars, boutiques), 2 (produits) |
| `0010_pro` | demandes, offres, vidéos | 3 |
| `0011_social_loyalty` | messagerie, avis, tenues, battles, fidélité, notifications | 2 à 4 |
| `0012_ai` | pgvector, embeddings, prix | 5 |

## 3. Pages

La langue française n'a pas de préfixe ; l'arabe utilise `/ar/…`.

| Espace | Routes | Phase |
| --- | --- | --- |
| Public | `/`, `/hors-ligne`, `/mentions-legales`, `/confidentialite` | 1 |
| Public | `/catalogue`, `/produit/[id]`, `/boutiques`, `/boutique/[slug]`, `/recherche` | 2 |
| Public | `/walk`, `/battle`, `/radar`, `/stylist`, `/tenues` | 3-4 |
| Auth | `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/auth/callback` | 1 |
| Client | `/compte`, `/compte/profil` | 1 |
| Client | `/panier`, `/commande`, `/compte/commandes`, `/compte/reservations`, `/compte/favoris`, `/compte/messages` | 2 |
| Client | `/compte/alertes`, `/compte/fidelite` | 4 |
| Vendeur | `/vendeur`, `/vendeur/creer-boutique`, `/vendeur/boutique` | 1 |
| Vendeur | `/vendeur/produits`, `/vendeur/collections`, `/vendeur/stock`, `/vendeur/commandes` | 2 |
| Vendeur | `/vendeur/import`, `/vendeur/demandes`, `/vendeur/videos`, `/vendeur/statistiques` | 3 |
| Admin | `/admin`, `/admin/utilisateurs`, `/admin/boutiques`, `/admin/audit` | 1 |
| Admin | `/admin/produits`, `/admin/signalements`, `/admin/commandes`, `/admin/categories`, `/admin/reglages` | 2 |

En phase 1, les pages de la phase 2 n'existent pas encore : pas de catalogue simulé.

## 4. Fonctionnalités principales

| Bloc | Contenu | Phase |
| --- | --- | --- |
| Socle | Identité, thème clair/sombre, fr/ar RTL, PWA installable, rôles, layouts | 1 |
| Marketplace | Catalogue, recherche, filtres, boutiques, commandes, réservations, admin | 2 |
| Fripe Pro | Import CSV/photos, actions groupées, stock indicatif, demandes, vidéos | 3 |
| Découverte | Stylist déterministe, Outfit Builder, Drop Alert, Battle, Radar, fidélité | 4 |
| IA | Scan & Find, analyse photo, Smart Price, recommandations | 5 |

### Identité visuelle proposée : « L'étiquette »

La signature vient de l'objet que toute friperie manipule : l'étiquette volante, écrite à la main et accrochée au portant. Le prix et la taille sont présentés comme une étiquette, avec une perforation en coin, plutôt que comme un badge générique ; les pages de boutique reprennent le portant comme rail de navigation horizontal.

Fond papier écru et encre quasi noire, un seul accent rouge harissa, mode sombre encre. Typographie à vérifier en fr et en ar avant adoption, avec une grotesque expressive pour les titres et une famille arabe assortie. La validation réelle se fera sur écran, à l'implémentation.

### Tunisie

- Prix : affichage `35 DT`, ou `35,500 DT` si des millimes sont présents.
- Téléphone : format `+216` + 8 chiffres, validé par Zod.
- Recherche : `pg_trgm` + `unaccent`, sans dépendre d'un dictionnaire français ou arabe, avec dénominations en écriture mixte (« jean », « جينز »).
- **Paiement à la livraison** : le risque commercial principal est le refus de colis, pas la fraude bancaire. Sont prévus : plafond de commandes `pending` par compte, confirmation du vendeur, historique de refus visible par la boutique.
- Protection des données : vérifier avec un juriste la conformité à la loi tunisienne (téléphones, adresses, géolocalisation) avant le lancement public.

## 5. Plan de développement de la phase 1

| # | Étape | Vérification |
| --- | --- | --- |
| 1 | `git init`, Next 16, TS strict, ESLint, Vitest, Playwright | `lint`, `typecheck`, `build` |
| 2 | Tailwind 4, shadcn/ui, thème, polices, composants de base | Rendu clair/sombre |
| 3 | next-intl fr/ar, `dir="rtl"`, propriétés CSS logiques | Test e2e `/ar` en RTL |
| 4 | Supabase local, migrations 0001 à 0005, 0009 partielle | `supabase db reset` sans erreur |
| 5 | Tests pgTAP de RLS, dont accès inter-boutiques | `supabase test db` |
| 6 | Auth : inscription, connexion, reset, callback, `proxy.ts` | e2e parcours 1 |
| 7 | Rôles, gardes, layouts client/vendeur/admin | e2e accès refusés |
| 8 | Création de boutique, validation admin, audit | e2e parcours 2 et 10 (partie admin) |
| 9 | PWA : manifest, icônes, Serwist, `/hors-ligne` | Installabilité sur build de production |
| 10 | Revue de sécurité, `README`, bilan de phase | Toutes les vérifications |

Critère de fin : un visiteur s'inscrit en français ou en arabe, crée une boutique, un admin la valide, et un autre vendeur ne peut ni la lire en brouillon ni la modifier, avec tests à l'appui.

Web Push n'est pas livré en phase 1 : le service worker est prêt à l'accueillir, mais la fonction ne sera annoncée qu'après validation réelle sur appareil, en phase 4. Sur iOS, elle exige l'installation sur l'écran d'accueil.

## 6. Dépendances

Versions constatées sur npm le 30 octobre 2026.

| Usage | Paquet | Version |
| --- | --- | --- |
| Framework | `next` / `react` / `react-dom` | 16.4.3 / 19.3.1 |
| Langage | `typescript` | **6.0.3**, pas 7.0.2 |
| Styles | `tailwindcss` | 4.3.3 |
| Composants | `shadcn` (CLI) | 4.23.0 |
| Supabase | `@supabase/supabase-js`, `@supabase/ssr` | 2.118.0, 0.12.7 |
| CLI Supabase | `supabase` (dev) | 2.122.0 |
| Formulaires | `react-hook-form`, `@hookform/resolvers`, `zod` | 7.91.0, 6.0.2, 4.6.7 |
| i18n | `next-intl` | 4.14.9 |
| Thème | `next-themes` | 0.4.6 |
| PWA | `serwist`, `@serwist/turbopack`, `esbuild` (dev) | 9.5.13 |
| Tests | `vitest`, `@playwright/test` | 5.0.5, 1.64.1 |
| Push (phase 4) | `web-push` | 3.6.7 |

**Pourquoi pas TypeScript 7 :** il ne fournit pas l'API de compilateur JavaScript, `next build` demande alors `experimental.useTypeScriptCli`, et typescript-eslint ne le prend pas en charge. On reviendra dessus quand l'outillage suivra.

**Point de vigilance :** je n'ai pas trouvé de confirmation officielle de Serwist + Next 16 + Turbopack ; seule la métadonnée `next >= 14` la suggère. C'est vérifié tôt à l'étape 9. Solution de repli : service worker écrit à la main, suffisant pour le périmètre retenu (hors ligne et push).

## 7. Informations nécessaires

### Pour démarrer

Rien côté cloud : tout le développement de la phase 1 peut se faire sur Supabase local. Il faut seulement **démarrer Docker Desktop**.

### Pour connecter le nouveau projet Supabase (avant tout déploiement)

Quand le nouveau compte sera créé, fournir dans `.env.local` (jamais dans le chat ni dans git) :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Autres informations :

- Confirmation écrite que ce projet est bien le nouveau, et accord explicite avant la première migration distante.
- Région du projet : une région européenne est la plus proche de la Tunisie.
- SMTP transactionnel : le service e-mail par défaut de Supabase ne convient pas à la production.
- Fournisseurs de connexion souhaités en plus de l'e-mail (Google, etc.).
- Nom de marque et nom de domaine définitifs : « FRIPE » reste un nom de travail.

## 8. Écarts apparus à l'implémentation

- **Confirmation d'e-mail :** `/auth/confirm` avec `token_hash` remplace `/auth/callback`. Le lien fonctionne ainsi dans un autre navigateur ou une autre appli que celui de l'inscription, cas courant sur mobile. Les modèles sont dans `supabase/templates/`.
- **Statut de boutique :** ajout de `rejected` (avec motif et nouvelle demande) en plus de `pending`, `approved`, `suspended`.
- **Ordre des migrations :** audit et limites de débit passent avant les boutiques, dont les fonctions en dépendent ; Storage devient la migration 6.
- **Localisation :** clé étrangère composite `(governorate_id, city_id)` pour interdire une ville hors de son gouvernorat, y compris sur une mise à jour directe.
- **Route vendeur :** `/vendeur/boutique/[shopId]`, car un compte peut avoir plusieurs boutiques.
- **Service worker :** stratégie de cache écrite à la main. Le `defaultCache` de Serwist n'est pas utilisé car il mettrait en cache des pages pouvant contenir des données personnelles.
- **Serwist + Next 16 + Turbopack :** fonctionne ; vérifié sur le build de production.
- **Villes :** liste initiale de 77 villes, à compléter avec les délégations officielles.

## 9. Écarts apparus en phase 2

- **Tables ajoutées :** `cart_items`. Le panier est lié au compte, sans réservation de la pièce.
- **Non créées :** `shop_followers`, messagerie, avis, signalements, fidélité, restent aux phases suivantes.
- **Publication :** une photo est obligatoire pour publier. Un brouillon peut rester incomplet ; la contrainte `products_publishable` garantit le reste en base.
- **Statut d'une pièce commandée :** `sold` dès la commande. L'annulation la remet `available` ; une pièce liée à une commande vivante ne peut pas être remise en rayon à la main.
- **Routes vendeur :** imbriquées sous `/vendeur/boutique/[shopId]/…`, un compte pouvant gérer plusieurs boutiques. Les réglages passent de la racine à `/reglages`.
- **Frais de livraison :** `delivery_rates` accepte un tarif par gouvernorat, mais l'interface n'expose qu'un tarif unique par boutique.
- **Tests :** stack Supabase séparé `fripe-test`, pour ne jamais écrire dans la base de développement.

## 10. Décisions de la phase 3

- **Statuts d'une pièce :** `available`, `reserved` (réservation ou commande en cours), `sold` (remise au client). Remplace le choix de la phase 2 : une pièce commandée n'est plus `sold` avant la livraison.
- **Références internes :** lisibles uniquement par la boutique et l'administration via la vue `product_references`. Droits par colonne sur `products` et `order_items` : toute nouvelle colonne publique doit être ajoutée au `GRANT`, et `select *` est interdit sur ces tables.
- **404 réels :** les squelettes `loading.tsx` sont placés dans des groupes `(listes)`. Une page qui peut répondre 404 doit rester hors de ces groupes, sinon la réponse part en 200.
- **Vidéo :** pas d'encodage serveur. Contrôle, compression et miniature se font dans le navigateur ; le serveur vérifie la signature du fichier et sa taille réelle. La durée reste déclarée par le navigateur.
- **Messagerie :** une conversation par couple client-boutique. Temps réel, avec rattrapage toutes les 10 secondes pour les messages manqués.
- **Administrateurs et conversations :** aucun accès direct. Un signalement fige un extrait de 20 messages, seul élément visible.
- **Blocage :** porte sur le couple client-boutique. Étendu en phase 4 aux demandes d'articles et aux alertes (voir section 11).
- **Stylist :** règles déterministes, derrière l'interface `StylistEngine`. L'interface l'annonce clairement.
- **Drop Alert :** une notification par personne et par pièce, à la première publication, dans la limite quotidienne choisie. Au-delà, les notifications sont abandonnées et non reportées.
- **Grilles :** tout conteneur `grid` avec du texte tronqué doit utiliser `grid-cols-[minmax(0,1fr)]`, sinon la page déborde sur téléphone.

## 11. Décisions de la phase 4

- **Blocage :** règles dans `docs/securite-phase-4.md`, imposées par des triggers sur les tables. Les commandes ne sont pas concernées.
- **Prix :** figé tant qu'une pièce est `reserved`. `place_order` compare le total calculé au total affiché.
- **Signalements :** six cibles. Un compte ne peut être signalé que par une boutique en relation avec lui. Une conversation n'a pas de coupable désigné : pas de suspension directe depuis ce type de signalement.
- **Avis :** un par ligne de commande livrée, publié aussitôt, modéré a posteriori, définitif pour son auteur. Une seule réponse de la boutique. Seul le prénom est public.
- **Administration :** catégories à deux niveaux, gouvernorats fixes, délégations désactivables. Un trigger journalise toute modification de ces tables.
- **Fichiers vidéo :** dépôt limité aux brouillons. Une vidéo modérée perd ses fichiers, seul usage de la clé secrète dans l'application.
- **Pages légales :** contenu dans `src/features/legal/content`. Le marqueur `[[…]]` signale ce qui reste à valider.

## 12. Décisions de la phase 5A

- **Fichiers :** toute suppression passe par `storage_purge_queue`, alimentée par des triggers. Les buckets restent publics : retirer un contenu, c'est retirer son fichier.
- **Maintenance :** `POST /api/internal/maintenance`, protégée par `MAINTENANCE_TOKEN`, à appeler par un planificateur externe.
- **Suppression de compte :** l'identité disparaît, les faits de vente restent sans lien vers le compte. Boutique possédée fermée (`closed`). Détails dans `docs/suppression-de-compte.md`.
- **CSP :** nonce réalisable, reporté au choix de l'hébergement (`docs/securite-phase-5.md`).

## 13. Décisions de la phase 5B

- **MFA :** `private.is_platform_admin()` exige `aal2`. Le contrôle est en base, l'interface ne fait que rediriger.
- **Maintenance :** verrou par index unique sur `maintenance_runs`, revérification des orphelins avant retrait.
- **Retrait d'urgence :** `emergency_takedown` retire définitivement les fichiers d'une boutique, contrairement à la suspension.
- **Pages qui répondent 404 :** `/compte/securite` reste hors du groupe `(listes)`, comme les pages de détail.

## Sources

- [Supabase — Auth côté serveur (Next.js)](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase — Migration vers les clés publishable et secret](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Next.js — Guide PWA](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js — Configuration TypeScript](https://nextjs.org/docs-wip/app/api-reference/config/typescript)
- [Serwist — Intégration Turbopack](https://serwist.pages.dev/docs/next/turbo)
- [Why your TypeScript 7 upgrade broke ESLint](https://dev.to/dev_encyclopedia/why-your-typescript-7-upgrade-broke-eslint-ts-jest-and-ts-morph-385k)
