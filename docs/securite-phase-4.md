# Audit de sécurité de la phase 4

Audit du code, des migrations et des droits réels de la base. Portée : authentification, rôles, RLS, isolation des boutiques, commandes, réservations, messagerie, fichiers, vidéos, demandes d'articles, notifications, administration.

Il a été mené en interne. Il ne remplace pas un test d'intrusion indépendant avant une ouverture à grande échelle.

## Règles métier du blocage

Définies avant l'implémentation.

1. Un blocage relie **un compte client et une boutique**. Il concerne donc tous les membres de la boutique.
2. Chaque camp pose et lève uniquement son propre blocage. Si les deux ont bloqué, les deux doivent lever le leur.
3. Tant qu'un blocage existe, dans un sens ou dans l'autre :
   - aucune nouvelle conversation ni aucun message ;
   - aucune demande d'article, aucune proposition de pièce, aucun contact depuis une demande ;
   - aucune notification Drop Alert de cette boutique.
4. Bloquer ferme les demandes en cours entre ces deux parties. Les débloquer ne les rouvre pas.
5. L'historique des messages reste lisible par les deux camps.
6. **Ne sont pas touchés :** les commandes et réservations, y compris les nouvelles (les pièces restent publiques), le suivi de boutique, la lecture du catalogue, les signalements.
7. Une boutique ne peut bloquer qu'un client qui l'a contactée, lui a envoyé une demande ou lui a commandé une pièce.

**Garantie :** la règle est portée par des triggers sur `conversations`, `messages`, `stock_requests` et `stock_request_offers`. Une nouvelle route ou une nouvelle Server Action ne peut pas l'oublier.

**Décision à confirmer :** faut-il aussi empêcher un client bloqué par une boutique de lui acheter des pièces ? Non pour l'instant : la demande de phase 4 porte sur la messagerie et les demandes d'articles.

## Failles trouvées et corrigées

| Gravité | Écart | Correction | Preuve |
|---|---|---|---|
| Élevée | Blocage absent des demandes d'articles et des propositions : un client bloqué pouvait encore écrire à la boutique | Triggers en base, nouvelles RPC `block_shop` et `block_client` | `004_phase4_security`, `phase4.spec` |
| Élevée | Un fichier vidéo retiré par la modération restait accessible par son URL publique | Suppression du fichier à la décision, avec la clé secrète, côté serveur uniquement | `phase4.spec` |
| Élevée | Dépôt direct au Storage sans limite : le quota de 30 vidéos ne s'appliquait qu'à la base | Dépôt limité à un brouillon existant de sa boutique, 4 fichiers au plus par vidéo | `phase4.spec` |
| Moyenne | Le prix d'une pièce réservée pouvait changer, et une commande partait au nouveau prix sans que le client le sache | Prix figé pendant une réservation ou une commande ; total attendu vérifié à la commande | `004`, `phase4.spec` |
| Moyenne | Une boutique pouvait lire le total d'un groupe, donc déduire les achats faits ailleurs | Colonne retirée des droits de lecture | `004` |
| Moyenne | `finalize_video` pouvait remettre en ligne une vidéo modérée ; une boutique pouvait supprimer une vidéo modérée | Contrôle ajouté, suppression refusée | `phase4.spec` |
| Moyenne | La suppression d'un compte aurait effacé les signalements et l'historique des décisions | Clés étrangères revues, historique protégé en écriture et en suppression | Revue du code, aucun test de suppression de compte |
| Moyenne | `saveDeliveryRates` supprimait puis réinsérait sans transaction : un échec laissait une boutique sans tarif | RPC atomique | `phase3.spec` (tarifs par gouvernorat) |
| Faible | Un compte suspendu pouvait encore ajouter favoris, panier et suivis | Politiques renforcées | `004` |
| Faible | Une boutique suspendue pouvait modifier ses adresses et tarifs | Politiques renforcées | Revue du code |
| Faible | Chemins d'images, logos et avatars libres : une boutique pouvait désigner le fichier d'une autre | Trigger et contraintes | `phase4.spec` |
| Faible | `finalizeVideo` nettoyait des chemins fournis par le navigateur sans les valider | Validation du dossier | Revue du code |
| Faible | `rate_limits` grossissait sans limite | Purge quotidienne | Revue du code |
| Faible | Pas de politique de sécurité des contenus (CSP) ni de HSTS | En-têtes ajoutés | `phase4.spec` |

## Vérifié sans écart

- **Toutes les tables publiques** ont RLS, et toute fonction `security definer` fixe son `search_path` (test permanent).
- **Fonctions accessibles aux anonymes :** seulement `reservation_ttl_minutes` et `top_shops` (test permanent).
- **Statut, rôle, plan :** aucun n'est modifiable en écriture directe.
- **Prix :** le total vient toujours de la base, jamais du navigateur.
- **Clé secrète :** jamais dans le code navigateur. `createAdminClient` est protégé par `server-only`.
- **Administrateurs :** un compte suspendu perd l'accès, et les pages renvoient 404 aux autres.
- **Redirections après connexion et lien de confirmation :** limitées aux chemins internes.
- **Temps réel :** soumis à RLS.

## Risques restants

- **`'unsafe-inline'` dans la CSP :** Next.js injecte des scripts en ligne. Le retirer demande des nonces, donc le rendu dynamique de toutes les pages.
- **Photos produit modérées :** corrigé en phase 5A.
- **Faux avis entre comptes complices :** un second compte peut acheter et noter. La livraison est déclarée par la boutique, aucune preuve externe n'existe.
- **Brouillons vidéo abandonnés :** corrigé en phase 5A, sous réserve de planifier la maintenance.
- **Comptes multiples :** une personne bloquée ou suspendue peut créer un autre compte. Aucun contrôle d'identité n'existe.
- **Suppression de compte :** fonction disponible en phase 5A, durées de conservation à valider.

## À régler avant la production

Ces réglages ne concernent pas le Supabase local et n'ont pas été modifiés :

- SMTP réel et limites d'envoi d'e-mails ;
- `max_frequency` des e-mails (1 s en local) ;
- `site_url` et `additional_redirect_urls` sur le domaine réel ;
- `secure_password_change = true` ;
- MFA pour les comptes administrateurs ;
- captcha à l'inscription et à la connexion ;
- sauvegardes et procédure de restauration ;
- HTTPS obligatoire, sans lequel le HSTS n'a pas d'effet.
