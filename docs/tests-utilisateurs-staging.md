# Tests avec de vrais utilisateurs

Procédure pour FRIPE STAGING. **Non exécutable tant que staging n'existe pas.** La plupart de ces parcours sont couverts par les tests automatisés locaux, mais pas sur Internet ni sur de vrais téléphones.

## Consignes aux testeurs

À transmettre avec l'invitation :

- C'est une version de test : aucune vente, aucune livraison, aucun paiement réel.
- N'utilisez **jamais** vos vraies informations : ni adresse, ni téléphone, ni photo de personne.
- Utilisez seulement vos propres photos de vêtements, sans personne identifiable.
- Les données peuvent être effacées à tout moment.
- Signalez tout problème à : [[À compléter : contact du test]].

## Comptes fictifs

Créés par `pnpm staging:seed`. Mots de passe dans `.staging-accounts.local.json`, à transmettre individuellement.

| Rôle | E-mail | État initial |
|---|---|---|
| Administrateur | `admin.demo@example.com` | Sans rôle, à nommer après enrôlement |
| Boutique A | `boutique.a@example.com` | Boutique validée, 4 pièces |
| Boutique B | `boutique.b@example.com` | Boutique validée, 4 pièces |
| Client A | `client.a@example.com` | Vide |
| Client B | `client.b@example.com` | Vide |

Ces adresses ne reçoivent pas d'e-mail. Pour le scénario 1, utiliser une adresse réelle du testeur.

## Scénarios

Reporter chaque résultat : réussi, échoué, ou bloqué, avec l'appareil et une capture.

| N° | Scénario | Compte | Attendu | Isolation à vérifier |
|---|---|---|---|---|
| 1 | Création de compte | Nouveau | E-mail reçu, lien valide, connexion | Le lien fonctionne une seule fois |
| 2 | Boutique : demande et validation | Nouveau, puis Admin | Boutique visible seulement après validation | Invisible du public avant |
| 3 | Publier un vêtement | Boutique A | Visible dans le catalogue | Boutique B ne peut pas le modifier |
| 4 | Publier plusieurs articles | Boutique A | Publication rapide et groupée | Limite de 8 photos par pièce |
| 5 | Ajouter des photos | Boutique A | Compressées, visibles | Image de plus de 4 Mo : message clair |
| 6 | Publier une vidéo | Boutique A | Fripe Walk, avec son | Boutique B ne peut pas la supprimer |
| 7 | Navigation et recherche | Sans compte, puis Client A | Filtres, français et arabe | Brouillons jamais visibles |
| 8 | Favoris et abonnements | Client A | Conservés, compteurs justes | Boutique A ne voit pas l'identité de ses abonnés |
| 9 | Demande d'article | Client A, Boutique A | Demande et proposition | Boutique B ne voit rien |
| 10 | Messagerie | Client A, Boutique A | Temps réel sur deux téléphones | Client B et Boutique B ne voient rien |
| 11 | Panier et commande | Client A | Total exact, paiement à la livraison | Client B ne voit pas la commande ; Boutique B ne voit pas le total du groupe |
| 12 | Réservation et annulation | Client A | Pièce réservée puis libérée | Client B ne peut pas la réserver entre-temps |
| 13 | Modération | Client B, Admin | Signalement, décision, historique | Client B ne peut pas décider |
| 14 | Blocage | Boutique A, Client B | Messages et demandes impossibles | Essayer toutes les routes : fiche, demande, messagerie |
| 15 | Suppression de compte | Nouveau compte | Reconnexion impossible, commandes anonymes | **Jamais avec un compte qu'on réutilise** |
| 16 | MFA administrateur | Admin | Voir ci-dessous | Mot de passe seul : aucun droit |
| 17 | Retrait d'urgence | Admin | Fichiers retirés, URL morte | Rétablir la boutique ne restaure rien |
| 18 | Maintenance automatique | Exploitant | Passage réussi visible dans `/admin` | Fichiers légitimes intacts |

## Scénario 16 : MFA avec un vrai téléphone

Application : Google Authenticator, Microsoft Authenticator ou équivalent.

1. L'administrateur se connecte et ouvre `/preparation-admin`.
2. Il scanne le code QR, saisit le code, puis note l'empreinte affichée.
3. Il transmet l'empreinte à l'opérateur **de vive voix ou par un canal de confiance**.
4. L'opérateur lance :
   ```powershell
   $env:FRIPE_CONFIRM_REMOTE = "admin.demo@example.com"
   node scripts/grant-admin.mjs admin.demo@example.com <empreinte>
   ```

   Dans une session où les variables de staging sont définies. Ne pas utiliser `pnpm admin:grant`, qui charge `.env.local`.
5. L'administrateur se reconnecte : le code est demandé, puis `/admin` s'ouvre.
6. Il ajoute un second appareil dans `/compte/securite`.
7. Il essaie de se connecter avec un code faux : refus.
8. L'opérateur essaie la récupération, puis la nomination est refaite.

**Résultat non acquis tant que ces étapes n'ont pas été faites sur un vrai téléphone.**

## Vérifications d'isolation à faire par l'exploitant

- [ ] Depuis Client B, ouvrir l'URL d'une commande de Client A : 404.
- [ ] Depuis Boutique B, ouvrir `/vendeur/boutique/<id A>` : 404.
- [ ] Depuis Client A, ouvrir `/admin` : 404.
- [ ] Sans compte, ouvrir `/compte` : redirection vers la connexion.
- [ ] Ouvrir `/robots.txt` : tout est interdit.
- [ ] Vérifier le bandeau « Version de test » sur chaque espace.

## Fin de campagne

1. Récupérer les retours.
2. Supprimer le projet Supabase staging si vous ne le gardez pas : cela efface tout ce que les testeurs ont saisi.
3. Supprimer le projet Vercel et les tâches planifiées.
4. Révoquer les clés et le jeton.
