# Phase 3 — validations restantes

État au 16 novembre 2026, branche `staging`, rien de commité. L'accueil `/` n'a pas été modifié : sa seule différence avec le commit `d1184aa` est l'optimisation des images convenue (4 attributs `unoptimized` retirés). Aucune opération sur le Supabase distant ni en production.

## Résumé

| # | Validation | État |
|---|---|---|
| 1 | Démarrer Supabase local et appliquer la migration | **Bloquée** : Docker ne démarre pas, le disque `G:` est plein |
| 2 | Vérifier anciennes annonces, identifiants, relations et nouveaux univers | **Bloquée** par le point 1. Vérifié uniquement sur PostgreSQL en mémoire (PGlite) |
| 3 | Exécuter les 24 tests E2E | **Bloquée** : ils exigent la pile Supabase de test, donc Docker |
| 4 | Tester avec les vraies données (`/`, recherche, catégories) | **Bloquée** par le point 1 |
| 5 | Vrai téléphone et performances | **Partielle** : performances mesurées en téléphone simulé. Le test sur un vrai téléphone reste à faire |

## 1 à 4 — Docker ne démarre pas

### Constat

- Docker Desktop 4.94 se lance, puis s'arrête sur « Docker Desktop is unable to start ».
- Dans le journal (`%LOCALAPPDATA%\Docker\log\host\monitor.log`), le moteur de conteneurs (containerd) plante dès le démarrage avec `signal SIGBUS: bus error`, en lisant sa base interne.
- Les données de Docker sont rangées sur `G:` (réglage `CustomWslDistroDir` : `G:\DockerData\DockerDesktopWSL`).
- **`G:` fait 100 Go et il n'y reste que 25 Mo libres.** Le disque virtuel `docker_data.vhdx` y occupe à lui seul 42,5 Go.
- Docker ne peut donc plus écrire. C'était déjà la cause de l'échec de la première tentative.

### Ce que je n'ai pas fait

- Je n'ai supprimé aucun fichier : `G:` contient tes documents personnels.
- Je n'ai pas utilisé « Clean / Purge data » de Docker : cette commande effacerait aussi les données de ton Supabase local.
- J'ai refermé Docker Desktop, que j'avais lancé.

### Pour débloquer (à ta main)

1. Libérer au moins 10 à 15 Go sur `G:`. La corbeille `G:\$RECYCLE.BIN` est un bon premier endroit à vérifier.
2. Autre possibilité : déplacer le disque de Docker vers un lecteur qui a au moins 45 Go libres, dans Docker Desktop → Settings → Resources → Advanced → Disk image location. `C:` n'a que 9 Go libres, ce n'est donc pas possible aujourd'hui.
3. Relancer Docker Desktop. Je reprendrai alors les points 1 à 4 :
   - `pnpm db:start` ;
   - `supabase migration list --local` pour voir ce qui manque ;
   - `pnpm db:up` pour appliquer **uniquement** la migration `20261116000001`, sans réinitialisation ;
   - les contrôles SQL ;
   - `pnpm test:e2e` ;
   - les captures sur tes vraies données.

### Ce qui est déjà vérifié sans Docker

La migration `20261116000001_univers_sneakers_livres_enfants.sql` a été appliquée deux fois sur PGlite, avec les tables, déclencheurs et données d'origine des migrations existantes :

- 15 catégories ajoutées (de 67 à 82), aucun nom en double ;
- jamais plus de deux niveaux, sections cohérentes ;
- identifiants de Baskets, Livres et Puériculture conservés, donc les produits et annonces suivent ;
- migration rejouable sans effet ;
- attributs de Sneakers copiés depuis Chaussures.

Il reste à vérifier sur ta vraie base : les annonces existantes rangées dans ces catégories, et les relations produits / vendeurs.

## 5 — Performances (téléphone simulé)

### Méthode

- Build de production (`next build` puis `next start`) dans un dossier séparé (`.next-test`), avec les données d'exemple du faux Supabase.
- Chromium avec le profil d'un Pixel 7, processeur ralenti 4 fois, réseau 4G lente (150 ms de latence, 1,6 Mb/s en descente) : ce sont les réglages mobiles de Lighthouse.
- Médiane de 3 chargements par page.

| Page | FCP | LCP | CLS | TBT | JS | Images | Total |
|---|---|---|---|---|---|---|---|
| `/` | 2,1 s | **2,1 s** | 0 | 256 ms | 275 Ko | 108 Ko | 728 Ko |
| `/ar` | 2,2 s | 2,2 s | 0 | 341 ms | 275 Ko | 108 Ko | 733 Ko |
| `/accueil-preview` | 2,0 s | 3,3 s | 0 | 269 ms | 257 Ko | 109 Ko | 717 Ko |
| `/ar/accueil-preview` | 2,1 s | 3,2 s | 0 | 319 ms | 257 Ko | 109 Ko | 725 Ko |
| `/catalogue` | 2,0 s | 3,3 s | 0 | 306 ms | 208 Ko | 74 Ko | 635 Ko |
| `/decouvrir` | 1,9 s | 1,9 s | 0 | **2 843 ms** | 197 Ko | 0 | 447 Ko |

Seuils « bon » de Google : LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms.

### Lecture

- **Aucun décalage de mise en page** (CLS = 0) sur toutes les pages.
- **`/`** : LCP bon. TBT un peu au-dessus du seuil, surtout en arabe.
- **`/accueil-preview` et `/catalogue`** : LCP à 3,2–3,3 s, donc à améliorer. L'élément le plus long est une photo. À étudier avant tout remplacement de `/`.
- **`/decouvrir` est le point le plus sérieux.** 2,8 s de blocage du fil principal sur un téléphone moyen, à cause de la scène three.js. C'est la page que voient les nouveaux visiteurs à leur première ouverture. Pistes à valider avant d'y toucher :
  - scène allégée sur téléphone (sans ombres, moins de points, démarrage différé) ;
  - image fixe sur les appareils modestes.

### Limites de ces chiffres

- Les données sont fictives : peu de photos, déjà petites. Avec un vrai catalogue, le poids des images et le LCP seront plus élevés.
- Le serveur est local, sans réseau réel ni CDN. Les chiffres en ligne seront différents.
- C'est Chromium qui simule un téléphone, pas un vrai appareil.

### Vrai téléphone

Je ne peux pas manipuler un téléphone moi-même. Deux moyens de le faire toi-même :

- **Dès maintenant, données d'exemple** : `pnpm apercu`, puis ouvrir `http://<adresse IP du PC>:3300` depuis un téléphone connecté au même réseau Wi-Fi. Le pare-feu Windows peut demander d'autoriser Node.js.
- **Avec tes vraies données** : après le déblocage de Docker, même chose avec `pnpm dev` sur le port 3000.

## Numérotation des phases

Le plan d'origine (`docs/audit-refonte-2026-11.md`, section 5) prévoit :

- 3 : accueil ;
- 4 : marketplace et confiance (recherche, fiche produit, défauts, état « Neuf sans étiquette », carte unique partout) ;
- 5 : expériences immersives (Fripe Walk, Vide-Dressing, cabine) ;
- 6 : assistant d'achat.

Les univers Enfants, Livres et Sneakers ont été avancés en phase 3, parce que l'accueil en avait besoin.

En te proposant « la phase 5 », je suivais les deux demandes que tu venais d'envoyer (Vide-Dressing 3D et cabine), qui relèvent de cette phase. C'était une erreur de présentation : **la phase 4 n'a pas commencé et elle est la prochaine prévue.** La phase 5 ne passera avant que si tu décides de changer l'ordre.

---

## Mise à jour : Docker démarre (16 novembre)

L'espace libéré sur `G:` (environ 1 Go) suffit pour démarrer Docker : le moteur répond, et les piles `fripe-local` et `fripe-test` redémarrent. `G:` reste presque plein : à surveiller.

| # | Validation | État |
|---|---|---|
| 1 | Supabase local et migration | **Base locale en retard.** `fripe-local` s'est arrêtée au 5 novembre : 10 migrations du dépôt (`20261106000001` à `20261112000001`) n'y ont jamais été appliquées. La nouvelle en dépend : l'appliquer seule échouerait. **Rien n'a été appliqué**, en attente de ta décision. |
| 2 | Anciennes annonces, identifiants, relations | **Rien à vérifier en local** : 1 utilisateur, 0 boutique, 0 produit, 0 commande, pas de table d'annonces. Le script de données d'exemple refuse la base locale, par règle du projet. |
| 2 bis | Nouveaux univers, sur un vrai PostgreSQL | **Validé.** La pile de test `fripe-test`, recréée depuis zéro, a rejoué les **37 migrations sans erreur**, nouvelle comprise. On y trouve 82 catégories, Sneakers (mode) avec Baskets et Running, Livres et Enfants (marketplace) avec leurs sous-catégories, Puériculture sous Enfants, et les 2 attributs de Sneakers. |
| 3 | 24 tests E2E | **Bloqués par Next.js** (voir ci-dessous). Le build va jusqu'au bout (compilation, TypeScript, 148 pages générées), puis Next.js l'arrête. |
| 4 | Vraies données | **Impossible en local** : la base locale est vide. Les données réelles sont sur le staging distant, auquel je ne touche pas sans autorisation. |

### Blocage des tests E2E : avis de sécurité Next.js

- Next.js 16 arrête `next build` quand il est lancé par un agent et que la version installée fait l'objet d'un avis de sécurité. Il propose alors `next upgrade`.
- Avis en cause : GHSA-mfr8-8qww-v76h, de gravité modérée. Fuite d'informations entre « root params » quand une fonction `'use cache'` est appelée via `unstable_cache()`. Versions touchées : 16.3.0 à 16.4.4. **Corrigé à partir de 16.4.5** ; la dernière 16.x est la 16.4.6.
- **FRIPE n'utilise ni `'use cache'` ni `unstable_cache()`** : le projet n'est pas exposé en pratique, mais le contrôle bloque le build.
- La relance prévue par Next.js, dans les 5 minutes, n'a pas débloqué le build. Je n'ai pas contourné ce garde-fou et je n'ai pas mis Next.js à jour : c'est un changement de dépendance qui demande ton accord.
- Pour débloquer : passer `next` (et `eslint-config-next`) de 16.4.3 à 16.4.6, une version corrective du même cycle, puis relancer `pnpm test:e2e`.

---

## Validation terminée (17 novembre)

- **Next.js 16.4.3 → 16.4.6** (avec `eslint-config-next`) : l'avis GHSA-mfr8-8qww-v76h est fermé, `pnpm audit` ne signale plus rien sur `next`, et le build n'est plus bloqué.
- **Base locale `fripe-local`** : les 10 migrations en attente sont appliquées dans l'ordre, sans réinitialisation (9 en retard, plus celle des univers). J'en avais annoncé 11 par erreur. Ensuite, la migration de la phase 4 (`20261117000001`). Résultat : 38 migrations sur 38, ton compte est conservé, 82 catégories. Les types TypeScript du projet correspondent au schéma réel (64 tables, mêmes énumérations).
- **Tests e2e (188)** : 175 réussis, 13 en échec. Les 13 échecs sont identiques, au message près, sur le dernier commit sans aucune modification, rejoué dans une copie de travail séparée : ils existaient avant. La plupart viennent de tests restés sur l'ancienne interface (« strict mode violation » : deux liens au nom d'une pièce, deux titres « Nouveaux arrivages », deux champs « Gouvernorat »).
- **Deux échecs étaient liés à mes changements, et sont corrigés** :
  - « ajout de produit » : Baskets introuvable sous Chaussures après la migration. Corrigé : le formulaire des boutiques propose aussi Sneakers et ses sous-catégories sous Chaussures.
  - « lot dans un dressing » : un libellé ajouté créait un doublon de texte. Corrigé.
- **Vraies données** : la base locale ne contient aucun produit ni annonce. Les tests sur de vraies données restent à faire avec tes propres publications en local, ou sur le staging avec ton autorisation.
