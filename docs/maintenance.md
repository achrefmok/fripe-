# Maintenance planifiée

**Aucun planificateur n'est actif.** Ce guide décrit l'installation à faire au moment de la mise en production.

## Rôle

`POST /api/internal/maintenance` retire les fichiers inscrits dans `storage_purge_queue` et termine les suppressions de compte. La base ne peut pas le faire seule : cela demande la clé secrète et l'API Storage.

Les tâches `pg_cron` tournent déjà seules : réservations expirées, repérage des fichiers abandonnés, purges. Seule cette route a besoin d'un appel externe.

## Choix du planificateur

Comparaison et décision dans [staging-plan.md](staging-plan.md) : **cron-job.org** pour staging, car le cron de Vercel Hobby est quotidien. Exemples inactifs dans [deploy/](../deploy) pour un serveur ou GitHub Actions.

## Configuration de staging

Deux tâches, créées après autorisation :

| Tâche | Méthode et URL | Fréquence | En-tête |
|---|---|---|---|
| Maintenance | `POST https://<site>/api/internal/maintenance` | 15 minutes | `Authorization: Bearer <jeton>` |
| Surveillance | `POST https://<site>/api/internal/maintenance/status` | 1 heure | `Authorization: Bearer <jeton>` |

Activer les notifications d'échec par e-mail sur les deux. La surveillance répond **503** si aucun passage n'a réussi depuis 60 minutes : c'est ce qui déclenche l'alerte, même si la première tâche a disparu.

**200** et **409** sont normaux pour la maintenance. **207** signale un échec partiel, repris au passage suivant.

## Fréquence recommandée

**Toutes les 15 minutes.** Les retraits urgents sont déjà exécutés immédiatement après la décision ; ce passage rattrape les échecs et les fichiers abandonnés. Un intervalle plus long reste sans risque, un fichier retiré restant simplement en ligne plus longtemps.

## Installation

1. Générer un jeton d'au moins 32 caractères : `openssl rand -hex 32`.
2. Le déclarer comme `MAINTENANCE_TOKEN` **dans l'environnement du serveur**, et dans les secrets du planificateur. Jamais de préfixe `NEXT_PUBLIC_`.
3. Déclarer `MAINTENANCE_URL` côté planificateur : `https://<domaine>/api/internal/maintenance`.
4. Installer l'exemple choisi, en HTTPS uniquement.
5. Lancer un passage à la main, avec `pnpm maintenance:run`, puis vérifier `/admin`.
6. Configurer une alerte sur le code de sortie.

Un jeton absent ou de moins de 32 caractères désactive la route, qui répond 404.

**Rotation :** remplacer le jeton sur le serveur et le planificateur, et redéployer. Un passage peut échouer entre les deux : le suivant rattrape.

## Comportement

| Situation | Réponse | Sortie du script |
|---|---|---|
| Succès | 200 | 0 |
| Passage déjà en cours | 409, rien n'est fait | 0 |
| Une partie a échoué, reprise au passage suivant | 207 | 1 après 3 essais |
| Panne | 500, passage noté `failed` | 1 après 3 essais |
| Jeton absent ou faux, ou route désactivée | 404 | 1 immédiatement |

## Garanties

- **Authenticité :** comparaison en temps constant sur une empreinte du jeton, lu seulement dans l'en-tête `Authorization`. Le jeton n'apparaît ni dans le code du navigateur, ni dans l'URL, ni dans les journaux.
- **Une exécution à la fois :** index unique sur les passages `running`. Un passage interrompu libère le verrou après 15 minutes.
- **Reprise sans risque :** un fichier déjà retiré compte comme traité, et une ligne déjà traitée n'est pas relue.
- **Fichiers légitimes :** un fichier inscrit comme orphelin est revérifié juste avant le retrait. S'il est de nouveau référencé, il est conservé (`outcome = 'kept'`). Le balayage ne touche pas un fichier de moins de 24 heures.
- **Erreurs :** chaque ligne échouée est retentée 10 fois au plus, puis reste visible en base.

## Surveillance

La vue d'ensemble de `/admin` affiche le dernier passage, et `pnpm maintenance:status` interroge la route de surveillance. Requêtes utiles :

```sql
-- Derniers passages
select started_at, status, result, error from maintenance_runs order by started_at desc limit 20;

-- Lignes abandonnées après 10 essais : à traiter à la main
select bucket, path, reason, attempts from storage_purge_queue where done_at is null and attempts >= 10;

-- Suppressions de compte non terminées
select user_id, requested_at, attempts from account_deletions where completed_at is null;
```

La route de surveillance renvoie aussi `stuckFiles` et `stuckAccounts`, le nombre de lignes abandonnées.

## Limites connues

- Storage ne signale pas d'erreur pour un bucket inconnu : la file n'accepte donc que les quatre buckets du projet.
- Une panne réelle de Storage n'a été simulée qu'en test unitaire, pas sur un vrai service.
