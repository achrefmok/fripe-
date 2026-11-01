# Plan FRIPE STAGING

**Rien n'a été créé.** Aucun compte externe, projet Cloud, migration distante, branche, commit ou publication. Chaque étape ci-dessous attend votre autorisation.

Tarifs et limites relevés sur les pages officielles de Vercel et Supabase le 1er novembre 2026. Ils peuvent changer.

## Architecture retenue

| Élément | Choix | Pourquoi |
|---|---|---|
| Frontend | Vercel, région `dub1`, proche de la base | Next.js 16 pris en charge, HTTPS inclus, URL temporaire |
| Backend | **Nouveau** projet Supabase, région Irlande (`eu-west-1`) | RLS, Auth, Storage, Realtime et `pg_cron` déjà utilisés |
| Storage | Buckets créés par les migrations | Aucune configuration manuelle |
| Dépôt | Branche `staging` | Séparée de `main`, à créer après votre autorisation |
| E-mails | Brevo, offre gratuite | Le SMTP par défaut de Supabase ne convient pas |
| Maintenance | cron-job.org | Seule option gratuite à 15 minutes, voir plus bas |
| Journaux | Journaux Vercel et Supabase, historique `maintenance_runs` | Suffisants pour un test fermé |

## Coûts

| Service | Offre gratuite | Payant |
|---|---|---|
| Vercel | Hobby : 0 $, usage **personnel et non commercial** | Pro : 20 $ par siège et par mois |
| Supabase | Free : 0 $ | Pro : à partir de 25 $ par mois |
| Brevo | 300 e-mails par jour (page Brevo) | Non nécessaire au départ |
| cron-job.org | Gratuit | Aucun |
| **Total** | **0 $** | **45 $ par mois environ** |

Aucun domaine n'est nécessaire : l'URL `*.vercel.app` suffit.

### Limites qui comptent

| Limite | Valeur | Effet sur FRIPE |
|---|---|---|
| Vercel : usage Hobby | Non commercial | **À trancher :** FRIPE vise une activité commerciale. Un test fermé sans vente réelle reste à apprécier par vous |
| Vercel : corps de requête | 4,5 Mo | **Traité :** images limitées à 4 Mo |
| Vercel : cron Hobby | Une fois par jour | **Écarté** pour la maintenance |
| Vercel : durée de fonction | 300 s | Suffisant, la maintenance est bornée à 120 s |
| Vercel : journaux Hobby | 1 heure | Faible pour diagnostiquer après coup |
| Vercel : dépassement Hobby | Fonction coupée jusqu'à 30 jours | Pas de facturation surprise |
| Supabase : base | 500 Mo | Large pour un test |
| Supabase : fichiers | 1 Go | **Serré avec des vidéos :** environ 20 vidéos de 50 Mo |
| Supabase : trafic sortant | 5 Go | **Serré :** les vidéos sont servies par le Storage |
| Supabase : taille de fichier | 50 Mo | Correspond à la limite de FRIPE |
| Supabase : pause | Après une semaine d'inactivité | Réactivation manuelle |
| Supabase : sauvegardes | Aucune en Free | Acceptable : données fictives |
| Supabase : projets actifs | 2 en Free | **À vérifier :** vos projets existants peuvent occuper ces places |
| Supabase : e-mails par défaut | Membres de l'équipe, 2 par heure | **Bloquant sans SMTP dédié** |

### Recommandation

Commencer en gratuit pour un petit groupe, avec peu de vidéos. Passer à Supabase Pro si le quota de fichiers ou de trafic gêne. Passer à Vercel Pro si vous considérez ce test comme commercial, ou dès qu'il y a de vraies ventes.

## Choix du planificateur

| Option | Coût | Fréquence | Limite |
|---|---|---|---|
| **cron-job.org (retenu)** | Gratuit | 15 minutes | Service tiers qui détient le jeton de staging ; 30 s par appel ; désactivation après 25 échecs de suite |
| Vercel Cron Hobby | Gratuit | Une fois par jour | Trop rare, et appelle en `GET` |
| Vercel Cron Pro | 20 $ par mois | À la minute | Payant, et appelle en `GET` |
| GitHub Actions | Selon le quota | Sans garantie | Retards signalés par les utilisateurs, non recommandé ici |

Le délai de 30 s ne pose pas de problème : si l'appelant abandonne, la fonction se termine, et le verrou empêche tout chevauchement.

## Compatibilité vérifiée

- **Replay complet :** les 27 migrations rejouent sur un stack neuf à chaque test.
- **Droits stricts :** elles ont aussi été rejouées avec `auto_expose_new_tables = false`, voir le dernier rapport.
- **Non vérifiable sans Cloud :** comportement réel sur un projet distant. Le premier passage de l'étape 3 servira de contrôle.

## Actions et accès nécessaires

**De votre part :**

1. Autoriser la publication.
2. Décider du plan Vercel.
3. Créer les comptes, ou me dire qui s'en charge : Vercel, Supabase (organisation séparée), Brevo, cron-job.org.
4. Vérifier qu'aucun projet Supabase existant ne sera touché, et me donner leurs références pour la liste d'interdiction.
5. Donner une adresse d'expéditeur vérifiable pour Brevo.
6. Autoriser le commit et la création de la branche `staging`, nécessaires à Vercel.
7. Choisir la personne qui sera administrateur de test, avec son téléphone.

## Procédure, après autorisation uniquement

Checklist détaillée : [staging-checklist-comptes.md](staging-checklist-comptes.md).

### 1. Dépôt
Créer la branche `staging` et le dépôt distant privé. Vérifier qu'aucun fichier `.env` n'est suivi.

### 2. Projet Supabase
- Nouveau projet « fripe-staging », dans une organisation séparée, région Francfort.
- Mot de passe de base stocké dans un gestionnaire.
- Vérifier deux fois la référence du projet : c'est la protection principale contre une erreur de cible.

### 3. Migrations
```bash
pnpm exec supabase link --project-ref <ref-staging>
pnpm exec supabase migration list
pnpm exec supabase db push
```
Vérifier ensuite la liste de contrôle ci-dessous.

**Jamais `db reset`. Ne pas lier ce dossier à un autre projet.**

### 4. Auth
Dans le tableau de bord Supabase :
- URL du site : l'URL Vercel ;
- URL de redirection autorisées : `https://<projet>.vercel.app/**` ;
- confirmation par e-mail activée ;
- MFA TOTP : inscription et vérification **activées avant tout** ;
- SMTP personnalisé : Brevo ;
- modèles `supabase/templates/confirmation.html` et `recovery.html` copiés.

Les liens utilisent `/auth/confirm?token_hash=…` : les modèles par défaut ne conviennent pas.

### 5. Vercel
- Importer le dépôt, branche `staging`, sans projet existant.
- Saisir les variables de [variables-environnement.md](variables-environnement.md), secrets en mode Sensitive.
- Déployer, puis lancer `pnpm env:check staging` avec ces valeurs.

### 6. Données fictives
```powershell
$env:FRIPE_ENV = "staging"
$env:FRIPE_SEED_CONFIRM = "<ref>.supabase.co"
pnpm staging:seed
```
Les mots de passe vont dans `.staging-accounts.local.json`, ignoré par git.

### 7. Administrateur de test
Suivre [administration-mfa.md](administration-mfa.md), avec une vraie application d'authentification.

### 8. Maintenance
Créer les deux tâches décrites dans [maintenance.md](maintenance.md).

### 9. Vérification
Dérouler [tests-utilisateurs-staging.md](tests-utilisateurs-staging.md) avant d'inviter des testeurs.

## Liste de contrôle après migrations

```sql
-- 27 attendues
select count(*) from supabase_migrations.schema_migrations;

-- 0 attendu
select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 4 buckets : avatars, product-images, shop-assets, shop-videos
select id, public, file_size_limit from storage.buckets order by id;

-- Politiques
select schemaname, count(*) from pg_policies where schemaname in ('public', 'storage') group by 1;

-- Temps réel : 1 attendu
select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages';

-- 4 tâches : purge-expired-data, purge-rate-limits, release-expired-reservations, sweep-abandoned-files
select jobname, schedule, active from cron.job order by jobname;

-- Déclencheur d'inscription : 1 attendu
select count(*) from pg_trigger where tgname = 'on_auth_user_created';

-- 0 attendu : aucun administrateur avant enrôlement
select count(*) from platform_admins;
```

Comparer les politiques avec le dernier rapport local.

## Risques et retour arrière

| Risque | Conséquence | Parade |
|---|---|---|
| Mauvaise cible Supabase | Atteinte à un autre projet | Organisation séparée, double vérification de la référence, `FRIPE_FORBIDDEN_SUPABASE_REFS` |
| Clé secrète exposée | Accès total à staging | Sensitive, renouvellement de la clé, données fictives uniquement |
| Migration en échec à mi-parcours | Base partiellement migrée | Staging est jetable : supprimer le projet et en recréer un |
| Déploiement défectueux | Site cassé | Retour au déploiement précédent en un clic sur Vercel |
| Quota Hobby dépassé | Coupure jusqu'à 30 jours | Pas de facturation, passage à Pro si besoin |
| Vraies données saisies par un testeur | Données personnelles sur staging | Bandeau, consignes, purge finale |
| Indexation | Site de test visible | `noindex`, `robots.txt` bloquant, testés |

**Retour arrière complet :** supprimer le projet Vercel et le projet Supabase staging. Votre environnement local n'est relié à aucun des deux.

## Sources

- [Limites des fonctions Vercel](https://vercel.com/docs/functions/limitations)
- [Cron Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Offre Hobby de Vercel](https://vercel.com/docs/plans/hobby)
- [Tarifs Supabase](https://supabase.com/pricing)
- [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
- [SMTP gratuit Brevo](https://www.brevo.com/free-smtp-server)
- [cron-job.org, fiche d'offre gratuite](https://freetier.co/directory/products/cron-joborg)
- [Retards des tâches GitHub Actions](https://github.com/orgs/community/discussions/209514)
