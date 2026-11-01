# Matrice des données personnelles

Pour le juriste et l'exploitant. Elle complète [suppression-de-compte.md](suppression-de-compte.md).

**Aucune durée légale n'est fixée ici.** La mention **[À VALIDER]** signale une décision juridique. Les durées techniques indiquées sont des choix de fonctionnement, pas des obligations.

## Après suppression d'un compte

| Catégorie | Devenir | Raison | Durée | Mécanisme |
|---|---|---|---|---|
| Profil : nom, langue | Supprimé | Plus d'utilité | Immédiat | `delete_my_account`, puis retrait de la fiche |
| E-mail, mot de passe, facteurs MFA | Supprimés | Plus d'utilité | Immédiat, repris par la maintenance si échec | `auth.admin.deleteUser` |
| Téléphone du profil | Supprimé | Plus d'utilité | Immédiat | `delete_my_account` |
| Favoris, panier, suivis, alertes, préférences, tenues, notifications | Supprimés | Plus d'utilité | Immédiat | `delete_my_account` |
| Blocages | Supprimés | Sans objet | Immédiat | `delete_my_account` |
| Commande : pièces, prix, statut, dates | **Conservée**, sans lien vers le compte | Preuve de vente, comptabilité, vendeur | **[À VALIDER]** | `client_id` passe à vide |
| Commande : nom du destinataire, téléphone | **Conservés** | Litige, livraison, comptabilité | **[À VALIDER]** | Anonymisés par `order_personal_data_retention_days`, vide aujourd'hui |
| Adresse de livraison | **Conservée** | Idem | **[À VALIDER]** | Idem |
| Messages du client | Texte remplacé | Contenu personnel | Immédiat | `delete_my_account` |
| Messages de la boutique | **Conservés** | Propriété de la boutique, litiges. Peuvent citer le client | **[À VALIDER]** | Aucun |
| Demandes d'articles | Contenu effacé, ligne conservée | Cohérence de la boutique | Immédiat | `delete_my_account` |
| Avis : commentaire, prénom | Supprimés | Contenu personnel | Immédiat | `delete_my_account` |
| Avis : note, titre de la pièce | **Conservés** **[À VALIDER]** | Moyenne de la boutique | Vie de la boutique | Aucun |
| Signalements : auteur | Lien retiré | Plus d'utilité | À la suppression de la fiche | Clé `set null` |
| Signalements : extrait figé (20 messages, noms) | **Conservé** | Preuve de modération | **[À VALIDER]** | Aucun |
| Décisions de modération | **Conservées** | Preuve, contestation | **[À VALIDER]** | Ajout seul |
| Journal d'audit : identifiant, actions, motifs | **Conservé** | Sécurité, traçabilité | **[À VALIDER]** | Ajout seul, aucune purge |
| Journal des blocages | **Conservé**, identifiants techniques | Traçabilité | **[À VALIDER]** | Ajout seul |

## Informations des boutiques

| Donnée | Devenir à la suppression du propriétaire | Raison | Durée | Mécanisme |
|---|---|---|---|---|
| Description, téléphone, logo, adresses | Supprimés | Plus d'utilité | Immédiat | `delete_my_account` |
| Nom et adresse web de la boutique | **Conservés**, invisibles | Historique des commandes | **[À VALIDER]** | Statut `closed` |
| Gouvernorat, ville | **Conservés**, invisibles | Idem | **[À VALIDER]** | Aucun |
| Photos, vidéos | Fichiers supprimés | Plus d'utilité | Après passage de la maintenance | `storage_purge_queue` |
| Fiches produits : titre, prix, description | **Conservées**, archivées | Lignes de commande | **[À VALIDER]** | Archivage |
| Stock, collections | **Conservés**, masqués | Sans donnée personnelle attendue | **[À VALIDER]** | Masquage |

## Pendant la vie du compte

| Donnée | Durée | Nature |
|---|---|---|
| Notifications lues | 90 jours | Choix technique **[À VALIDER]** |
| Autres notifications | 180 jours | Choix technique **[À VALIDER]** |
| Compteurs `rate_limits` | 2 jours | Choix technique |
| File des fichiers supprimés (chemins) | 30 jours | Choix technique |
| Historique de maintenance | 90 jours | Choix technique |
| Réservations expirées | Sans limite | **[À VALIDER]** |
| Journal d'audit | Sans limite | **[À VALIDER]** |

## Hors de la base

Ces copies échappent aux mécanismes ci-dessus. **[À VALIDER]** avant l'ouverture :

- **Sauvegardes** : une donnée supprimée y survit jusqu'à leur expiration.
- **Journaux** de l'hébergeur, de Supabase et du fournisseur d'e-mails.
- **Cache** : les vidéos sont envoyées avec un cache d'un an, voir [retrait-de-contenu.md](retrait-de-contenu.md).
- **Appareils** : cache de l'application et e-mails déjà reçus.

## Décisions à prendre

1. Durée de conservation des commandes, puis des coordonnées, puis valeur de `order_personal_data_retention_days`.
2. Durée du journal d'audit, et s'il faut y effacer les motifs nominatifs.
3. Durée des signalements et de leurs extraits.
4. Messages de boutique citant un client supprimé.
5. Note d'un avis après suppression.
6. Durée des fiches de boutiques fermées.
7. Sort des comptes suspendus qui demandent la suppression.
8. Durée des sauvegardes.
