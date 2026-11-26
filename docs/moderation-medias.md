# Modération automatique des médias

Chaque photo et chaque vidéo est analysée **côté serveur, avant stockage** : photos de produits, photos
d'annonces (Marketplace et Vide-Dressing), logos de boutique, vidéos Fripe Walk et leur miniature.
Code : `src/features/media-moderation/`. Base : `supabase/migrations/20261126000001_media_moderation.sql`.

## Ce qui est détecté, et avec quelle fiabilité

| Contenu | Méthode | Décision |
| --- | --- | --- |
| Sexuel explicite, pornographique | Classifieur d'images Sightengine `nudity-2.1` (activité sexuelle, parties génitales) | **Bloqué**. Score ≥ 0,85 : gravité critique ; ≥ 0,5 : élevée |
| Nudité érotique (+18) | Même classifieur (`erotica`) ≥ 0,5 | **Bloqué**, gravité moyenne |
| Très suggestif (lingerie portée, etc.) | `very_suggestive` ≥ 0,85 | Signalé aux administrateurs, publié |
| Généré ou retouché par IA | Provenance déclarée dans le fichier (IPTC / C2PA, logiciel générateur, paramètres Stable Diffusion) et détecteur Sightengine `genai` ≥ 0,9 | Signalé, publié, jamais sanctionné |

Un contenu interdit reste bloqué **qu'il soit photographié ou généré par IA**.

Limites, à connaître :

- Les scores sont des probabilités : faux positifs et faux négatifs existent. Les seuils sont dans
  `policy.ts` (`THRESHOLDS`).
- **La détection d'IA n'est jamais une certitude.** La provenance déclarée disparaît dès qu'une image
  est réencodée (capture d'écran, et la compression faite par le navigateur avant l'envoi) ; les
  détecteurs statistiques se trompent, surtout sur les images retouchées ou compressées.
- **Sans `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET`, le contenu sexuel n'est pas détecté.**
  Seule la provenance IA déclarée est lue. Mettre `MEDIA_MODERATION_REQUIRED=true` en production :
  sans service joignable, tout envoi est alors refusé.
- Une panne du service d'analyse refuse l'envoi (« vérification momentanément indisponible ») : rien
  n'est publié sans avoir été vérifié.
- Les vidéos sont déposées par le navigateur puis relues par le serveur avant publication : pendant
  cette analyse (quelques secondes), le fichier du brouillon existe dans le bucket ; bloqué, il est
  effacé avec son brouillon.
- Les Lives (flux vidéo en direct) ne passent pas par cette analyse.
- Les médias sont envoyés à Sightengine : à mentionner dans la politique de confidentialité avant
  l'activation.

## Sanctions

Appliquées par `public.record_media_moderation` (réservée à la clé secrète), sur les blocages sexuels
des 30 derniers jours, tentative en cours comprise :

| Gravité | Suspension |
| --- | --- |
| Critique | immédiate |
| Élevée | à la 2e tentative |
| Moyenne | à la 3e tentative |
| Faible (signalement) | jamais |

Un compte administrateur n'est jamais suspendu automatiquement (le rapport existe quand même).
Chaque suspension est inscrite au journal d'audit (`user.auto_suspended`). Pour lever une suspension :
**Administration > Utilisateurs**.

## Rapport aux administrateurs

Chaque média bloqué crée une notification pour chaque administrateur actif, et une ligne dans
**Administration > Médias bloqués** (`/admin/medias`) : identifiant du compte, type de contenu,
date, motif, gravité, sanction, nombre de tentatives, indices d'IA, empreinte SHA-256. Le journal est
en ajout seul. Le fichier bloqué n'est jamais stocké.

## Tests

- `tests/unit/media-moderation.test.ts` : règle, provenance IA, fournisseurs, chaîne complète.
- `supabase/tests/database/012_media_moderation.test.sql` : droits, sanctions, notifications, audit.
- `tests/e2e/moderation-medias.spec.ts` : envoi réel par l'interface. Le stack de test utilise le
  fournisseur `fixture`, piloté par un marqueur `FRIPE-MODERATION-TEST:<cas>` dans le fichier ; il est
  refusé hors du stack de test.
