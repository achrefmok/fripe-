# CSP et dépendances

## Les deux stratégies CSP

La politique actuelle n'a pas changé en phase 5B. La comparaison repose sur la mesure faite en phase 5A, sur des builds temporaires, dans Chromium, sur 9 pages.

| Critère | Actuelle : `'unsafe-inline'` | Nonce : `'nonce-…' 'strict-dynamic'` |
|---|---|---|
| Protection contre un script injecté | Faible : un `<script>` injecté s'exécute | Forte : sans nonce valide, il est bloqué |
| Gestionnaires en ligne (`onclick`) | Bloqués par `script-src-attr 'none'` | Bloqués |
| Rendu statique | Conservé | **Perdu** : toutes les pages deviennent dynamiques |
| Page `/`, médiane locale | 15 ms | 32 ms |
| Page `/catalogue`, médiane locale | 30 ms | 30 ms |
| Page `/cgv`, médiane locale | 16 ms | 16 ms |
| Cache CDN des pages | Possible | Impossible : chaque réponse est unique |
| Charge serveur | Faible pour les pages statiques | Plus élevée à chaque visite |
| Hydratation | OK | OK |
| Violations mesurées | 0 | 1 par page, script de `next-themes` |
| Service worker, mode hors ligne | Testés | **Non testés** |
| Partial Prerendering | Compatible | Incompatible, selon le guide de Next.js |

Une troisième variante, `script-src 'self'` sans nonce, **casse l'hydratation de toutes les pages**. Il ne faut pas retirer `'unsafe-inline'` seul.

Les temps sont locaux, sans réseau ni base lente. Ils ne prédisent pas la production.

### Recommandation

Garder la politique actuelle tant que l'hébergement n'est pas choisi, car le coût réel en dépend. Le risque est contenu : aucun `dangerouslySetInnerHTML` et React échappe les contenus. Le nonce deviendrait prioritaire si du HTML riche ou un script tiers était ajouté.

### Pour passer au nonce

1. Générer le nonce dans `src/proxy.ts` et y poser la CSP.
2. Forcer le rendu dynamique.
3. Passer le nonce à `ThemeProvider` pour supprimer la dernière violation.
4. Retirer l'en-tête CSP de `next.config.ts`.
5. Tester le service worker et le mode hors ligne, puis lancer toute la suite.

## Dépendances forcées

| Paquet | Version | Portée | Pourquoi |
|---|---|---|---|
| `glob` | 14.0.3 | `@serwist/build>glob` | Avis GHSA-3g3m-2fjr-6pw4 sur 9.0.0 à 14.0.1 |
| `minimatch` | 11.0.3 | `glob>minimatch` | Avis GHSA-g3hv-75wg-m249 sous 11.0.1 |

**Correction apportée en phase 5B :** la première version de ces règles forçait aussi `minimatch` 11 dans ESLint, qui en attendait une version bien plus ancienne. Elles sont désormais limitées à la branche concernée.

### Compatibilité vérifiée avec `@serwist/build` 9.5.13

- `@serwist/build` déclare `glob` 13.0.6 : le passage à 14 est un **écart assumé** à sa déclaration.
- Il n'utilise que `globSync`, avec les options `cwd`, `follow` et `ignore`.
- `glob` 14.0.3 demande Node 18, 20 ou 22 et plus, et `minimatch` ^11.0.2. Le projet utilise Node 24.
- Le build génère le service worker, et `tests/e2e/pwa.spec.ts` vérifie son fonctionnement.

### Risques

- Ces paquets ne servent **qu'au build**, sur les fichiers du projet. Ils ne tournent pas sur le site en ligne.
- Une mise à jour de Serwist peut rendre ces règles inutiles, ou incompatibles.
- `pnpm audit` sans `--prod` remonte des alertes sur les outils de développement : voir le dernier rapport.
- `pnpm audit` dépend de la base d'avis du jour : un résultat propre peut changer sans modification du code.

### Commandes de contrôle

```bash
pnpm audit --prod             # dépendances de production
pnpm audit                    # tout, outils de développement compris
pnpm why glob                 # version et origine
pnpm why minimatch
pnpm build                    # doit afficher « (serwist) N precache entries »
pnpm test:e2e pwa             # service worker réel
```

### À chaque mise à jour de Serwist

1. Retirer temporairement les deux règles de `pnpm-workspace.yaml`.
2. `pnpm install`, puis `pnpm audit --prod`.
3. Si l'audit est propre, supprimer les règles définitivement.
4. Sinon, les remettre, puis vérifier le build et `pwa.spec.ts`.
