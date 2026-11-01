# MFA des administrateurs

## État réel

| Élément | État |
|---|---|
| Implémentation | **Faite** |
| Parcours testé | Oui, de bout en bout dans Chromium sur le stack de test, avec des codes TOTP calculés par le test |
| Application d'authentification réelle sur téléphone | **Non testée** |
| Supabase local | TOTP activé dans `supabase/config.toml` |
| Production | **Rien n'est activé : aucune production n'existe** |

## Fonctionnement

Le fournisseur est Supabase Auth. Il gère les facteurs TOTP et élève la session de `aal1` à `aal2`.

**Le contrôle est dans la base :** `private.is_platform_admin()` exige `aal2`. Il couvre toutes les RPC et politiques RLS d'administration, y compris un appel direct à l'API avec une session volée au mot de passe seul.

| Action | Mot de passe seul (`aal1`) | Après le code (`aal2`) |
|---|---|---|
| Achats, compte client, boutique | Oui | Oui |
| Pages `/admin` | Redirigé vers le code | Oui |
| RPC d'administration, journal, réglages | Refusé | Oui |
| Ajouter ou retirer un appareil | Refusé par Supabase Auth | Oui |

## Nomination d'un administrateur

**Aucun rôle sans facteur déjà vérifié.** Un trigger l'impose dans la base, y compris pour un accès direct.

1. La personne se connecte et ouvre `/preparation-admin`.
2. Elle enregistre son appareil, puis lit l'empreinte affichée.
3. Elle vérifie qu'aucun appareil inconnu n'apparaît.
4. Elle transmet l'empreinte à l'opérateur **de vive voix ou par un canal de confiance**.
5. L'opérateur lance `pnpm admin:grant <email> <empreinte>`.
6. La personne se reconnecte. Un jeton émis avant la nomination ne vaut pas.

L'empreinte ferme la fenêtre de prise de contrôle : si un intrus connaît le mot de passe et enregistre son appareil avant le titulaire, l'empreinte ne correspond pas, et l'appareil inconnu est visible.

Hors local, les scripts exigent `FRIPE_CONFIRM_REMOTE=<email>`.

## Connexions

- Le code est demandé juste après le mot de passe, et la destination est conservée.
- `/compte/securite` liste, ajoute et retire les appareils. Le dernier ne peut pas être retiré.
- **Traçabilité :** `platform_admins.insert`, `mfa.enrolled`, `mfa.removed`, `mfa.reset`.

## Récupération

Supabase ne propose pas de codes de secours. Je n'en ai pas ajouté : des codes stockés seraient un second mot de passe à protéger.

1. **Prévention :** chaque administrateur enregistre **deux appareils** dès le premier jour. Il faut au moins **deux administrateurs**.
2. **Appareil perdu, un autre disponible :** se connecter avec l'autre appareil et retirer le perdu.
3. **Tous les appareils perdus :** procédure opérateur.

### Procédure opérateur

À exécuter par une personne ayant accès à la clé secrète, **autre que le demandeur** si possible :

1. Vérifier l'identité du demandeur par un autre canal que l'e-mail du compte, car il pourrait être compromis.
2. Lancer :

   ```bash
   pnpm admin:mfa-reset <email> "<opérateur>" "<motif>"
   ```

3. Vérifier l'entrée `mfa.reset` dans `/admin/audit`.
4. Demander au titulaire de changer son mot de passe.
5. Refaire la **nomination complète**.

Cette commande retire le rôle, **coupe toutes les sessions** et supprime les facteurs. Un jeton encore valide perd ses droits immédiatement, et un jeton plus ancien que la nomination suivante reste sans valeur.

## Risques connus

- **Retrait direct :** une session `aal2` peut retirer le dernier facteur en appelant Supabase Auth sans passer par l'application. L'écran de connexion ne permet alors plus d'en recréer un. Mais Supabase Auth accepte encore une inscription en `aal1` par appel direct : quelqu'un qui connaît le mot de passe pourrait alors regagner `aal2`. Ce cas exige une session complète compromise au préalable. En cas de doute, utiliser la procédure opérateur.
- **Journalisation :** `mfa.enrolled` et `mfa.removed` sont écrits par l'application. Un retrait direct par l'API de Supabase ne serait pas journalisé.
- **Tentatives de code :** limitées par Supabase Auth. Le seuil reste à vérifier sur le projet distant.

## Essai avec une vraie application

Procédure : scénario 16 de [tests-utilisateurs-staging.md](tests-utilisateurs-staging.md). **Non réalisé.**

## À faire en production

```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

**À activer avant toute nomination :** sans cela, aucun administrateur ne peut atteindre `aal2`.

Vérifier ensuite qu'un administrateur en `aal1` reçoit `forbidden`, et que le même compte en `aal2` y accède.

## Autres réglages de production

Voir [securite-phase-4.md](securite-phase-4.md) : limites d'authentification, captcha, durée de session.
