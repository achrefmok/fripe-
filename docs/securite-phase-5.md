# Sécurité résiduelle : phase 5A

Suite de [securite-phase-4.md](securite-phase-4.md). Voir aussi [suppression-de-compte.md](suppression-de-compte.md) et [administration-mfa.md](administration-mfa.md).

## Storage

### Permissions réelles

Les quatre buckets restent **publics en lecture par URL**. Toutes les pages, le catalogue, Fripe Walk et l'historique des commandes lisent les fichiers ainsi. Les passer en privé demanderait des URL signées partout, et rendrait les pages publiques non cachables : ce n'est pas justifié pour des images de vente.

Conséquence assumée : un fichier reste lisible par quiconque connaît son URL tant qu'il existe. Les URL contiennent des identifiants aléatoires et le listing est fermé, mais **public n'est pas confidentiel**. Il ne faut jamais y déposer de document personnel. C'est pourquoi le retrait d'un contenu supprime le fichier, au lieu de seulement le masquer.

| Bucket | Dépôt | Remplacement ou déplacement | Suppression |
|---|---|---|---|
| `product-images` | Boutique active, produit réel et non modéré, 12 fichiers par produit | Fermé | Membres de la boutique |
| `shop-videos` | Boutique active, brouillon existant, 4 fichiers par vidéo | Fermé | Membres de la boutique |
| `shop-assets` | Propriétaire ou gérant, boutique non suspendue, 10 fichiers | Fermé | Propriétaire ou gérant |
| `avatars` | Fermé : aucun écran n'envoie d'avatar | Fermé | Le propriétaire |

### Cycle de vie

| Situation | Base | Fichier |
|---|---|---|
| Produit modéré | Photos retirées, commande sans vignette | Supprimé |
| Vidéo modérée ou supprimée, par n'importe quelle route | Ligne conservée ou retirée | Supprimé |
| Photo supprimée par la boutique | Vignette de commande retirée | Supprimé |
| Boutique suspendue | Pages en 404 | **Conservé** : la décision est réversible |
| Boutique fermée par suppression du compte | Fermée | Supprimé |
| Brouillon vidéo de plus de 24 h | Supprimé | Supprimé |
| Fichier sans référence depuis 24 h | Rien | Supprimé |

La base ne peut pas effacer un objet Storage. Elle inscrit le travail dans `storage_purge_queue`, dans la même transaction que la décision. Le serveur vide cette file juste après une modération ou une suppression de compte, et `POST /api/internal/maintenance` reprend ce qui reste.

**La planification externe de cette route n'est pas en place** : voir [maintenance.md](maintenance.md). Sans elle, les brouillons abandonnés sont repérés chaque heure par la base, mais leurs fichiers ne partent qu'au prochain passage.

**Conséquence de la suspension :** les fichiers d'une boutique suspendue restent accessibles à qui possède leur URL. Si un contenu est illégal, il faut le retirer, pas seulement suspendre la boutique.

## CSP et `unsafe-inline`

Mesuré sur des builds temporaires, dans Chromium, sur 9 pages, français et arabe compris.

| Variante | Hydratation | Violations par page | Médiane `/` | Médiane `/cgv` |
|---|---|---|---|---|
| Actuelle, `unsafe-inline` | Oui | 0 | 15 ms | 16 ms |
| `script-src 'self'` sans nonce | **Non, sur toutes les pages** | 4 à 12 | 15 ms | 15 ms |
| Nonce et `strict-dynamic`, pages dynamiques | Oui | 1 | 32 ms | 16 ms |

**Conclusion.** Retirer la directive seule casse l'application : Next injecte ses données dans des scripts en ligne. Une politique à nonce est **réalisable** avec Next.js 16. La violation restante vient du script de `next-themes`, qui accepte une prop `nonce`. Le guide de Next confirme que cela exige un rendu dynamique de toutes les pages.

**Décision : ne pas l'adopter maintenant.**

- Elle retire le rendu statique des 29 pages prérendues. Le coût réel dépend de l'hébergement et d'un CDN, qui ne sont pas choisis. Les temps ci-dessus sont locaux, sans réseau.
- L'essai n'a couvert ni le service worker ni l'ensemble des parcours.
- Le risque actuel est limité : aucun `dangerouslySetInnerHTML` dans `src`, et React échappe les contenus.

Ajouté à la place : `script-src-attr 'none'`, qui bloque les gestionnaires en ligne injectés. Un test le prouve. Le choix devra être refait avec l'hébergement. L'adoption demandera le nonce dans `proxy.ts`, le passage à `ThemeProvider`, et une vérification du mode hors ligne.

## Audit des protections

| Sujet | Constat | Action |
|---|---|---|
| Écritures directes sans limite : favoris, suivis, panier, produits | Compteurs et volumes manipulables | Limites par trigger |
| Limites des RPC | Déjà présentes : demandes, messages, signalements, réservations, commandes, vidéos, avis, blocages | Aucune |
| Connexion et inscription | Limites de Supabase Auth | Captcha à prévoir en production |
| `rate_limits` | Purgée chaque nuit | Test ajouté |
| Notifications | Accumulation sans fin | Lues après 90 jours, toutes après 180 jours. **Durées à confirmer** |
| Attribution du rôle admin, réglages | Non journalisés | Journalisés |
| Secrets | Clé et jeton absents du bundle, aucun dans le code suivi | Contrôlé |
| En-têtes | COOP absent | Ajouté |
| Réponses personnelles | `/api/badges` en `no-store` ; pages personnelles sans cache public | Testé |
| `outfits.user_id` | Identifiant technique lisible sur une tenue publique | **Non corrigé** : il sert aux filtres des écritures, et il ne donne accès à rien |
| Note de suspension (`shops.review_note`) | Lisible seulement par les membres et l'administration | Aucune |

## Échec intermittent du test de modération

### Observé

- Phase 4 : `POST /produit/…` sans réponse après 5 s, sur 1 passage complet.
- Trois passages instrumentés : 3 à 4 s sur des appels sans rapport (`token`, `inventory_items`, `cart_items`), et plusieurs requêtes PostgREST simultanées lentes de la même durée.
- Requêtes les plus lentes : 5,6 s sur `POST /connexion`, 4,2 s sur `POST /produit`.
- La boucle d'événements de Node était souvent saine pendant ces lenteurs, parfois figée de 1 à 3 s. Pendant les builds, tous les processus se figeaient ensemble 2 à 4 s.
- Le poste a 11,8 Go de RAM et n'en gardait que 0,4 à 1,5 Go de libres, avec Docker, deux stacks Supabase et Chromium.
- Les journaux lents de Postgres n'ont pas pu être activés (droit refusé) : aucune mesure interne de la base.

### Conclusion

**Démontré :** le test de modération n'est pas en cause en soi. La lenteur touche tous les appels, sans lien avec le signalement.

**Démontré aussi :** une sonde externe a enregistré des blocages de 1,4 à 3 s sur Kong et Auth, alors que le minuteur de Windows restait à 125 ms au plus et que la connexion TCP au port Postgres prenait 2 ms. Le ralentissement se situe donc dans les services HTTP des conteneurs Supabase, ou derrière eux, pas dans Node ni dans Windows.

**Hypothèse, non démontrée :** pression mémoire ou disque dans la VM Docker, limitée à 5,7 Go pour deux stacks. Le point précis n'a pas pu être isolé, faute de mesures dans Postgres. Sur les quatre derniers passages, la sonde a montré 0, 1, 8 et 0 blocages : la lenteur reste possible, et l'absence d'échec n'est pas une preuve de correction.

**Le délai de 10 s** d'attente Playwright est conservé, mais il ne résout rien : il rend seulement le test tolérant à cette lenteur du poste.

### Défauts réels trouvés pendant l'enquête

| Défaut | Preuve | Correction |
|---|---|---|
| Le stack de test réutilisait d'anciennes données après un arrêt avec sauvegarde | Mêmes notes à 01:12 et 01:27 ; 3 échecs | `--no-backup` à l'arrêt et avant chaque démarrage |
| Test de stock : attente fixe de 500 ms | `PATCH` à 3,6 s, échec | Attente de l'écriture en base |
| Message envoyé invisible tant que le temps réel ou le rattrapage de 10 s n'arrive pas | Échec du test mobile ; lecture du code | Message ajouté dès la réponse du serveur, sans doublon |
| Test de modération : notes identiques entre répétitions | 11 échecs sur 12 | Notes uniques |
| 9 liens légaux préchargés à chaque page | Requêtes `_rsc` groupées | `prefetch={false}` |
