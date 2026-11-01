# Checklist de création de FRIPE STAGING

Pour le propriétaire, sur Windows (PowerShell). Budget : gratuit. **Ne jamais activer d'option payante, ni saisir de carte bancaire.**

Ne collez jamais une clé secrète dans une conversation, un ticket ou un fichier du dépôt. Les étapes qui en demandent une se font directement dans l'interface concernée.

## 1. GitHub

- [ ] Créer un dépôt **privé** vide, nommé par exemple `fripe`, sans README ni licence.
- [ ] Dans GitHub, section Emails, activer l'adresse masquée et noter l'adresse `...@users.noreply.github.com`.
- [ ] Me donner **uniquement** l'URL du dépôt et cette adresse masquée.

**Pourquoi l'adresse :** les commits n'ont pas d'identité personnelle pour l'instant. Vercel Hobby peut refuser un déploiement dont l'auteur n'est pas le propriétaire du dépôt privé. L'adresse masquée évite aussi d'écrire votre vraie adresse dans l'historique.

## 2. Supabase

- [ ] Créer une **nouvelle organisation**, offre **Free**, par exemple `fripe-staging-org`. Ne rien faire dans une organisation existante.
- [ ] Vérifier la limite de 2 projets actifs gratuits. Si elle est atteinte, **ne supprimez et ne mettez en pause aucun projet existant** : prévenez-moi.
- [ ] Créer le projet `fripe-staging`, région **Central EU (Frankfurt)** si proposée.
- [ ] Générer un mot de passe de base long, à garder dans un gestionnaire de mots de passe.
- [ ] Noter la référence du projet : les 20 lettres de `https://<ref>.supabase.co`.
- [ ] **Vérifier deux fois** cette référence : nom du projet, organisation, région.
- [ ] Me donner **uniquement** la référence, ainsi que les références de vos **autres** projets Supabase.

Les autres projets vont dans `FRIPE_FORBIDDEN_SUPABASE_REFS`. **La référence de staging n'y va pas** : elle va dans `FRIPE_STAGING_REF`.

### Authentification, dans le tableau de bord

À faire après l'étape 4, car l'URL Vercel est nécessaire :

- [ ] Authentication, Sign In / Providers : confirmation par e-mail activée.
- [ ] Authentication, Multi-Factor : TOTP activé pour l'inscription et la vérification.
- [ ] URL Configuration : Site URL égale à l'URL Vercel.
- [ ] Redirect URLs : `https://<projet>.vercel.app/**`.
- [ ] Email Templates : coller `supabase/templates/confirmation.html` et `recovery.html`, avec leurs sujets.

## 3. Brevo

- [ ] Créer un compte, offre gratuite.
- [ ] Vérifier une adresse d'expéditeur.
- [ ] Créer une **clé SMTP**, pas une clé d'API.
- [ ] Dans Supabase, Authentication, SMTP Settings : saisir `smtp-relay.brevo.com`, port `587`, l'identifiant et la clé SMTP.
- [ ] Ne rien envoyer avant le test contrôlé.

## 4. Vercel

- [ ] Créer un compte, offre **Hobby**. Refuser l'essai Pro.
- [ ] Importer le dépôt privé.
- [ ] Settings, Git : branche de production égale à `staging`.
- [ ] Settings, Environment Variables, valeurs de **staging** uniquement :

| Variable | Valeur | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_FRIPE_ENV` | `staging` | Non |
| `NEXT_PUBLIC_SITE_URL` | URL `*.vercel.app` du projet | Non |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publishable de staging | Non |
| `SUPABASE_SECRET_KEY` | Clé secrète de staging | **Oui** |
| `MAINTENANCE_TOKEN` | Voir ci-dessous | **Oui** |

Pour générer le jeton sans l'écrire dans un fichier :

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

Sous Windows PowerShell 5.1, si `ToHexString` n'existe pas :

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

- [ ] Après un changement de variable `NEXT_PUBLIC_`, redéployer.

## 5. cron-job.org

À faire **après** le premier déploiement réussi, voir [maintenance.md](maintenance.md).

- [ ] Tâche maintenance : `POST`, toutes les 15 minutes, en-tête `Authorization: Bearer <jeton>`.
- [ ] Tâche surveillance : route `/status`, toutes les heures, même en-tête.
- [ ] Notifications d'échec par e-mail activées.

## Ce que je fais ensuite, avec vos informations

Chaque opération distante est précédée d'une vérification de la cible.

**Contrôle des variables**, sans afficher de valeur :

```powershell
$env:FRIPE_STAGING_REF = "<ref-staging>"
$env:FRIPE_FORBIDDEN_SUPABASE_REFS = "<ref1>,<ref2>"
pnpm env:check staging
```

**Migrations**, après votre confirmation :

```powershell
pnpm exec supabase link --project-ref <ref-staging>
pnpm exec supabase migration list
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

Les 27 migrations sont listées avant le premier `db push`. **Jamais de `db reset`.**

`supabase link` n'écrit que dans `supabase/.temp`, ignoré par Git. Les commandes locales `pnpm db:up` et `pnpm db:types` ciblent explicitement la base locale.

**Données fictives et administrateur**, depuis votre poste : voir [tests-utilisateurs-staging.md](tests-utilisateurs-staging.md).

Dans une session PowerShell où les variables de staging sont définies, appeler directement `node scripts/seed-staging.mjs` et `node scripts/grant-admin.mjs`. Les raccourcis `pnpm admin:*` chargent `.env.local`, qui désigne la base locale.

Ces variables ne vivent que dans la session : fermez PowerShell ensuite. **Ne modifiez jamais `.env.local`.**
