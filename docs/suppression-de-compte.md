# Suppression de compte

Depuis son profil, une personne peut supprimer son compte elle-même. L'opération est immédiate et définitive.

La vue complète par catégorie est dans [donnees-personnelles.md](donnees-personnelles.md).

**Ce document décrit un choix technique, pas un avis juridique.** Les durées et les bases de conservation listées à la fin doivent être validées par un juriste tunisien.

## Déroulement

1. La personne saisit son mot de passe et coche la confirmation. Une session ouverte ne suffit pas.
2. `delete_my_account()` efface ou anonymise les données dans une seule transaction.
3. Le compte passe à `deleted` : la session encore valide ne peut plus rien faire.
4. Le serveur retire les fichiers et la fiche d'authentification avec la clé secrète.
5. Si cette dernière étape échoue, `account_deletions` et `storage_purge_queue` gardent le travail. `POST /api/internal/maintenance` le reprend.

## Cas refusés

| Cas | Résultat | Raison |
|---|---|---|
| Commande en cours, comme client ou dans une boutique possédée | `account_has_active_orders` | Une livraison ou un paiement à la réception resterait sans interlocuteur |
| Administrateur | `protected_account` | Le rôle doit d'abord être retiré, ce qui est journalisé |
| Compte suspendu | `forbidden` | Se supprimer ne doit pas permettre d'échapper à une décision de modération |

Une personne suspendue doit passer par le support. **Cette exception au droit de suppression est à valider.**

## Sort des données

| Donnée | Traitement | Raison |
|---|---|---|
| Profil : nom, téléphone, avatar | Effacé | Donnée personnelle |
| Fiche d'authentification, e-mail | Supprimée | Donnée personnelle |
| Favoris, panier, suivis, alertes, notifications, préférences, tenues, blocages | Supprimés | Sans utilité pour autrui |
| Réservations actives | Annulées, pièces remises en vente | Sinon la pièce resterait bloquée |
| Messages écrits par le client | Texte remplacé par `[message supprimé]` | Contenu personnel |
| Messages écrits par la boutique | Conservés | Ils appartiennent à la boutique |
| Conversation | Fermée, nom remplacé par « Compte supprimé » | Plus aucun échange n'est possible |
| Demandes d'articles | Fermées, contenu effacé | Contenu personnel |
| Avis | Commentaire et prénom retirés, **note conservée** | La moyenne de la boutique reste exacte |
| Commandes : pièces, prix, statuts, dates | **Conservés**, sans lien vers le compte | Historique commercial et comptable |
| Nom, téléphone et adresse de commande | **Conservés** jusqu'à une durée fixée | Voir ci-dessous |
| Journal d'audit | **Conservé**, identifiants compris | Il est en ajout seul et prouve les décisions prises |
| Signalements et décisions | **Conservés**, auteur retiré | Historique de modération |
| Annonces de particuliers et leurs photos | Supprimées, photos purgées | Contenu personnel |
| Messages d'échanges entre particuliers | Texte remplacé par `[message supprimé]`, échanges fermés | Contenu personnel ; l'autre personne garde le fil |
| Favoris d'annonces, blocages entre personnes | Supprimés | Sans utilité pour autrui |

Le journal d'audit garde l'identifiant technique du compte, et la fiche de la personne n'existe plus. Un signalement peut contenir un extrait figé de messages : il reste tel quel.

## Compte vendeur

Chaque boutique possédée est fermée (`closed`), sans possibilité de réouverture :

- les pièces sont archivées, leurs photos et les vidéos supprimées ;
- le logo, la description, le téléphone et les adresses sont retirés ;
- les autres membres perdent l'accès, car le transfert de propriété n'existe pas ;
- les ventes restent dans l'historique, et les commandes des clients perdent leur vignette.

Pour un membre non propriétaire, seul son lien avec la boutique est retiré.

## Coordonnées de commande

Le réglage `order_personal_data_retention_days` vaut `null`. Tant que c'est le cas, **aucune coordonnée n'est anonymisée**. Une fois la durée fixée, une tâche quotidienne efface nom, téléphone et adresse des commandes des comptes supprimés, passé ce délai.

## Décisions à valider par un humain

1. Durée légale de conservation des commandes, et du nom, du téléphone et de l'adresse.
2. Durée de conservation du journal d'audit et des signalements, y compris leurs extraits de messages.
3. Durée de conservation des messages de la boutique, et traitement de ceux qui citent des données du client.
4. Conservation de la note d'un avis après suppression du compte.
5. Traitement de la demande d'une personne suspendue.
6. Délai de rétractation avant la suppression : il est aujourd'hui inexistant.
7. Sort d'une boutique dont le propriétaire part : faut-il prévoir un transfert à un autre membre ?
8. Information des boutiques et des clients concernés.
