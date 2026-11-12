# Variables d'environnement

Chaque environnement a ses propres valeurs. **Une valeur ne passe jamais d'un environnement à l'autre.**

| Variable | Local | Staging | Production future | Visibilité | Sensible |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_FRIPE_ENV` | Absente | `staging` | `production` | Navigateur | Non |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | URL Vercel | Domaine définitif | Navigateur | Non |
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | Projet staging | Projet de production | Navigateur | Non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Générée par `pnpm env:local` | Projet staging | Projet de production | Navigateur | Non, protégée par RLS |
| `SUPABASE_SECRET_KEY` | Générée par `pnpm env:local` | Vercel, Sensitive | Vercel, Sensitive | **Serveur uniquement** | **Oui** |
| `COURIER_API_TOKEN` | Absente, route `/api/livraison` désactivée | Vercel, Sensitive, et application des livreurs | Autre valeur | **Serveur uniquement** | **Oui** |
| `MAINTENANCE_TOKEN` | Absente, route désactivée | Vercel, Sensitive, et planificateur | Autre valeur | **Serveur uniquement** | **Oui** |
| `TURN_URLS` | Absente, vidéo des Lives en STUN seul | Adresses du relais coturn | Idem | **Serveur uniquement** | Non |
| `TURN_SECRET` | Absente | Vercel, Sensitive, et `static-auth-secret` de coturn | Autre valeur | **Serveur uniquement** | **Oui** |

**Outils, jamais sur Vercel :**

| Variable | Usage |
|---|---|
| `MAINTENANCE_URL` | Script du planificateur |
| `FRIPE_ENV`, `FRIPE_SEED_CONFIRM`, `FRIPE_SEED_OUT` | Données fictives |
| `FRIPE_CONFIRM_REMOTE` | Nomination ou réinitialisation hors local |
| `FRIPE_STAGING_REF` | Référence attendue du projet staging, exigée par `pnpm env:check staging` |
| `FRIPE_FORBIDDEN_SUPABASE_REFS` | Références des **autres** projets, à ne jamais viser. Jamais celle de staging |
| `FRIPE_STRICT_GRANTS` | Replay des tests sans droits par défaut |

## Règles

- Une variable `NEXT_PUBLIC_` finit dans le navigateur : jamais de secret.
- Les variables `NEXT_PUBLIC_` sont figées au build : les changer impose un redéploiement.
- La CSP est construite au build à partir de `NEXT_PUBLIC_SUPABASE_URL`.
- Sur Vercel, renseigner les valeurs de staging uniquement dans le projet staging.
- Ne jamais coller une clé dans un ticket, une capture ou un message.

## Contrôle

```bash
pnpm env:check local
pnpm env:check staging
pnpm env:check production
```

Le script lit les variables de l'environnement courant et n'affiche jamais une valeur. Il refuse :

- une variable manquante ;
- un secret public ;
- une clé d'un mauvais type ;
- une URL locale ou non HTTPS hors local ;
- un jeton trop court ;
- un projet listé comme interdit.

## En cas de fuite

1. Générer une nouvelle clé dans Supabase, révoquer l'ancienne.
2. Mettre à jour Vercel et redéployer.
3. Regarder le journal d'audit et les journaux Supabase.
4. Faire de même avec `MAINTENANCE_TOKEN` sur le serveur et le planificateur.
