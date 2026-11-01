# FRIPE

Marketplace de fripe pour la Tunisie : Next.js 16, TypeScript, Tailwind 4, shadcn/ui et Supabase.
La conception est décrite dans [docs/conception-phase-1.md](docs/conception-phase-1.md), l'identité visuelle dans [DESIGN.md](DESIGN.md).

## Lancer le projet en local

Prérequis : Node 24, pnpm et Docker Desktop démarré.

```bash
pnpm install
pnpm db:start      # Supabase local (Docker)
pnpm env:local     # écrit .env.local depuis le Supabase local
pnpm dev           # http://localhost:3000
```

- Studio : http://127.0.0.1:54323
- E-mails de test (confirmation, mot de passe) : http://127.0.0.1:54324

### Devenir administrateur en local

Inscrivez-vous, confirmez l'e-mail dans Mailpit, puis :

```bash
pnpm admin:grant votre@email.tn <empreinte affichée sur /preparation-admin>
```

Ce script refuse de s'exécuter sur une URL qui n'est pas locale.

## Vérifications

```bash
pnpm typecheck
pnpm lint
pnpm test          # tests unitaires
pnpm test:db       # tests RLS (pgTAP) sur le stack de test
pnpm test:e2e      # parcours réels et concurrence sur le stack de test
pnpm test:stack:stop
```

`test:db` et `test:e2e` utilisent un **second Supabase local isolé** (`fripe-test`, ports 553xx, application sur le port 3100). Il est recréé depuis les migrations à chaque lancement : vos données de développement ne sont jamais touchées, et Playwright refuse de démarrer sur une autre base.

`test:e2e` construit l'application pour ce stack : relancez `pnpm build` ensuite si vous utilisez `pnpm start`.

## Commandes de base de données

```bash
pnpm db:up         # applique les nouvelles migrations sans rien effacer
pnpm db:types      # régénère src/types/database.ts
pnpm db:stop       # arrête le Supabase local
```

## Stockage des vidéos

Les limites se règlent dans `platform_settings` : 50 Mo, 60 secondes et 30 vidéos par boutique. Le bucket `shop-videos` impose la taille côté Storage. Prévoir un hébergement vidéo dédié avant une mise en ligne à grande échelle : les vidéos sont servies directement depuis le Storage.

## Avant une mise en ligne

- [docs/validation-avant-ouverture.md](docs/validation-avant-ouverture.md) : informations légales à fournir et traductions à relire.
- [docs/securite-phase-4.md](docs/securite-phase-4.md) : audit, règles de blocage, configuration de production.
- [docs/essais-manuels-mobile.md](docs/essais-manuels-mobile.md) : essais à faire sur de vrais téléphones.
- [docs/securite-phase-5.md](docs/securite-phase-5.md) : Storage, CSP, limites, enquête sur les tests.
- [docs/suppression-de-compte.md](docs/suppression-de-compte.md) : données conservées et décisions à valider.
- [docs/administration-mfa.md](docs/administration-mfa.md) : MFA des administrateurs et récupération.
- [docs/maintenance.md](docs/maintenance.md) : planification de la maintenance, à installer.
- [docs/donnees-personnelles.md](docs/donnees-personnelles.md) : matrice des données conservées et supprimées.
- [docs/retrait-de-contenu.md](docs/retrait-de-contenu.md) : modération et retrait d'urgence.
- [docs/csp-et-dependances.md](docs/csp-et-dependances.md) : stratégies CSP et dépendances forcées.
- [docs/staging-plan.md](docs/staging-plan.md) : plan de préproduction, coûts, actions à autoriser.
- [docs/variables-environnement.md](docs/variables-environnement.md) : variables par environnement.
- [docs/tests-utilisateurs-staging.md](docs/tests-utilisateurs-staging.md) : scénarios avec de vrais testeurs.
- [docs/textes-arabes-a-relire.md](docs/textes-arabes-a-relire.md) : liste pour le relecteur.

## Règles du projet

- Projet Supabase indépendant : aucune connexion à un autre projet, aucune migration distante sans accord explicite.
- `SUPABASE_SECRET_KEY` reste côté serveur ; `src/lib/supabase/admin.ts` est protégé par `server-only`.
- Chaque Server Action valide avec Zod, vérifie la session, puis écrit via RLS ou une RPC.
- Les montants seront stockés en millimes entiers.
- Ne jamais lancer `db reset` sur la base de développement : utiliser `pnpm db:up`.
- Aucune donnée fictive hors tests : le catalogue et les commandes ne sont jamais simulés.

## Avant de passer sur un projet Supabase cloud

1. Reporter dans le projet les modèles d'e-mail de `supabase/templates/` : le lien par `token_hash` en dépend.
2. Configurer l'URL du site, les redirections autorisées et un SMTP transactionnel.
3. Renseigner `NEXT_PUBLIC_SITE_URL` avec le domaine réel.
4. Nommer le premier administrateur en insérant une ligne dans `platform_admins`.
