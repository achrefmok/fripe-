# Essais manuels sur téléphone

**Aucun de ces essais n'a encore été réalisé.** Ils se font sur FRIPE STAGING, qui n'existe pas encore. Les tests automatisés tournent dans Chromium avec une fenêtre réduite : pas de vrai téléphone, pas de Safari iOS, et un clavier seulement simulé.

## Préparation

**Appareils minimum**

| Appareil | Navigateur |
|---|---|
| Android d'entrée de gamme, 3 Go de RAM environ | Chrome |
| iPhone récent | Safari |
| Petit iPhone (SE ou équivalent), si possible | Safari |

**Avant de commencer**

- Site accessible depuis le téléphone, **en HTTPS** : caméra, installation et certains comportements iOS en dépendent.
- Comptes prêts : client, vendeur avec boutique validée, administrateur avec second facteur.
- Une vidéo MP4 et une vidéo MOV de moins de 60 secondes, **avec du son**.
- Des pièces publiées, de quoi passer une commande.

**Pour chaque ligne :** cocher, ou noter le défaut dans le compte rendu avec une capture. Faire **chaque section en français, puis en arabe**.

**Gravité :** bloquant (parcours impossible), majeur (contournement pénible), mineur (visuel).

## 1. Installation PWA

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Installer depuis le navigateur | [ ] menu Installer | [ ] Partager, Sur l'écran d'accueil |
| Icône et nom corrects | [ ] | [ ] |
| Ouverture sans barre de navigateur | [ ] | [ ] |
| Pas de chevauchement avec l'encoche | [ ] | [ ] |
| Mode avion : page hors ligne affichée | [ ] | [ ] |
| Retour du réseau : reprise normale | [ ] | [ ] |
| Aucune donnée personnelle hors ligne | [ ] | [ ] |

## 2. Inscription et connexion

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Créer un compte | [ ] | [ ] |
| Ouvrir l'e-mail dans l'application de messagerie | [ ] | [ ] |
| Le lien de confirmation fonctionne, même dans un autre navigateur | [ ] | [ ] |
| Connexion, et remplissage par le gestionnaire de mots de passe | [ ] | [ ] |
| Mot de passe oublié de bout en bout | [ ] | [ ] |
| Session conservée après fermeture de l'application | [ ] | [ ] |
| Administrateur : scanner le code QR avec une vraie application | [ ] | [ ] |
| Administrateur : le code est accepté, et un code faux est refusé | [ ] | [ ] |

## 3. Navigation arabe (RTL)

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Barre d'onglets dans le bon sens | [ ] | [ ] |
| Flèches et retour inversés | [ ] | [ ] |
| Défilement horizontal au doigt | [ ] | [ ] |
| Prix, téléphones et dates lisibles | [ ] | [ ] |
| Aucun mot coupé ni texte tronqué | [ ] | [ ] |
| Saisie arabe et saisie latine mêlées | [ ] | [ ] |
| Changement de langue sans perte de page | [ ] | [ ] |

## 4. Clavier mobile

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Le champ actif reste visible | [ ] | [ ] |
| Le bouton de validation reste atteignable | [ ] | [ ] |
| Pas de zoom automatique à la saisie | [ ] | [ ] |
| Clavier numérique pour téléphone et code | [ ] | [ ] |
| Saisie du code MFA proposée par le clavier | [ ] | [ ] |
| Erreurs lisibles sans fermer le clavier | [ ] | [ ] |
| Fenêtres de signalement utilisables, clavier ouvert | [ ] | [ ] |
| La barre d'onglets ne recouvre pas le champ | [ ] | [ ] |

## 5. Photos

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Prendre une photo depuis le formulaire | [ ] | [ ] |
| Choisir plusieurs photos | [ ] | [ ] |
| Photo HEIC : convertie, ou message clair | Sans objet | [ ] |
| Orientation correcte | [ ] | [ ] |
| Envoi en 4G faible | [ ] | [ ] |
| Coupure pendant l'envoi : message clair | [ ] | [ ] |
| Photo de plus de 5 Mo : message clair | [ ] | [ ] |

## 6. Vidéos MP4 et MOV

**Ces formats n'ont jamais été testés.** Seul le WebM sans son l'a été, dans Chromium.

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Filmer depuis le formulaire | [ ] | [ ] |
| Choisir un MP4 | [ ] | [ ] |
| Choisir un MOV | [ ] | [ ] |
| Vidéo lourde : compression terminée sans blocage | [ ] | [ ] |
| Durée exacte affichée | [ ] | [ ] |
| Miniature correcte | [ ] | [ ] |
| Vidéo de plus de 60 secondes refusée | [ ] | [ ] |
| Plus de 50 Mo : refus clair | [ ] | [ ] |
| Écran verrouillé pendant l'envoi : résultat clair | [ ] | [ ] |

### Son après compression

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Vidéo courte, légère : son présent | [ ] | [ ] |
| Vidéo lourde compressée : son présent | [ ] | [ ] |
| Son synchronisé avec l'image | [ ] | [ ] |
| Le son se coupe et se réactive dans Fripe Walk | [ ] | [ ] |

## 7. Publication

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Créer une pièce complète | [ ] | [ ] |
| Publication rapide depuis des photos | [ ] | [ ] |
| Publier, masquer, republier | [ ] | [ ] |
| Lecture dans Fripe Walk : une seule vidéo à la fois | [ ] | [ ] |
| Retour depuis l'arrière-plan | [ ] | [ ] |

## 8. Panier et commande

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Ajouter au panier, réserver | [ ] | [ ] |
| Listes gouvernorat et ville natives | [ ] | [ ] |
| Total exact, frais compris | [ ] | [ ] |
| Mention du paiement à la livraison lisible | [ ] | [ ] |
| Confirmer, retrouver la commande | [ ] | [ ] |
| Annuler une commande en attente | [ ] | [ ] |
| Suivre une commande livrée, publier un avis | [ ] | [ ] |

## 9. Messagerie

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Message affiché aussitôt après l'envoi | [ ] | [ ] |
| Réception en direct sur un second téléphone | [ ] | [ ] |
| Verrouiller et rouvrir : messages manqués présents | [ ] | [ ] |
| Passer du Wi-Fi à la 4G pendant une conversation | [ ] | [ ] |
| Bloquer, puis débloquer | [ ] | [ ] |
| Signaler une conversation | [ ] | [ ] |

## 10. Notifications

Le Web Push n'existe pas : seules les notifications internes sont à tester.

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Créer une alerte | [ ] | [ ] |
| Une publication correspondante crée une notification | [ ] | [ ] |
| Badge sur la barre d'onglets | [ ] | [ ] |
| Badge effacé après lecture | [ ] | [ ] |
| Pause d'une alerte | [ ] | [ ] |

## 11. MFA administrateur

Avec une **vraie application d'authentification**. Procédure complète : scénario 16 de [tests-utilisateurs-staging.md](tests-utilisateurs-staging.md).

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Code QR scanné sans erreur | [ ] | [ ] |
| Clé manuelle acceptée | [ ] | [ ] |
| Code accepté dans sa fenêtre de 30 secondes | [ ] | [ ] |
| Code expiré refusé | [ ] | [ ] |
| Passage de l'application au navigateur sans perte de la page | [ ] | [ ] |
| Empreinte lisible et transmissible | [ ] | [ ] |

## 12. Déconnexion et suppression

| Essai | Android Chrome | iPhone Safari |
|---|---|---|
| Se déconnecter : plus d'accès au compte | [ ] | [ ] |
| Bouton Retour après déconnexion : rien de personnel | [ ] | [ ] |
| Suppression refusée avec une commande en cours | [ ] | [ ] |
| Mauvais mot de passe refusé | [ ] | [ ] |
| Suppression réussie, retour à l'accueil | [ ] | [ ] |
| Reconnexion impossible | [ ] | [ ] |
| Application installée : session bien terminée | [ ] | [ ] |

## Compte rendu

| Section | Téléphone | Système et navigateur | Langue | Résultat | Gravité | Capture |
|---|---|---|---|---|---|---|
| | | | | | | |

**Critère de passage :** aucun défaut bloquant ou majeur sur Android Chrome et iPhone Safari, dans les deux langues.
