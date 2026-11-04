# Livraison et suivi des colis

## Fonctionnement

- Le client choisit, boutique par boutique, **Livraison à domicile** ou **Retrait en boutique** (gratuit).
- Le paiement se fait **uniquement à la livraison ou au retrait** : aucun paiement en ligne.
- Le prix de la livraison est fixé **par l'administration**, dans `/admin/livraison` : un tarif par défaut et, au besoin, un tarif par gouvernorat. Les boutiques le voient dans leurs réglages et ne le fixent plus. Leurs anciens tarifs restent en base (`delivery_rates`) mais ne servent plus.
- Chaque livraison reçoit un **numéro de suivi** (`FRP-XXXXXXXXXX`). Le client suit les étapes dans sa commande, mises à jour en direct ; la boutique voit le numéro et les informations du livreur.

Migration : `supabase/migrations/20261107000001_delivery_tracking.sql`. Tests : `supabase/tests/database/009_delivery_tracking.test.sql` et `tests/e2e/delivery-tracking.spec.ts`.

## Étapes d'un colis

| Étape | Auteur | Moment |
|---|---|---|
| `ordered` | client | Commande passée |
| `confirmed` | boutique | Commande confirmée |
| `preparing` | boutique | En préparation |
| `handed_over` | boutique | « Marquer expédiée » : colis remis au livreur |
| `in_transit` | livreur | En transit |
| `out_for_delivery` | livreur | En cours de livraison |
| `delivered` | boutique ou livreur | Remis et encaissé : la commande passe à livrée, les pièces à vendues |
| `failed` | livreur | Livraison échouée |
| `returned` | livreur | Retour vers la boutique |
| `cancelled` | client, boutique ou administration | Commande annulée |

Chaque étape est enregistrée dans `shipment_events`, avec son auteur. La table `shipments` garde l'étape actuelle, le livreur, la dernière position et l'arrivée prévue.

## Raccord pour l'application des livreurs

L'application des livreurs parle à FRIPE par une route serveur, protégée par un jeton : `COURIER_API_TOKEN`, 32 caractères au moins, à créer dans Vercel (Sensitive) et dans l'application des livreurs. Sans jeton configuré, la route répond 404. Le navigateur n'a jamais accès à ces fonctions : en base, elles ne sont exécutables que par la clé de service.

Toutes les requêtes portent l'en-tête `Authorization: Bearer <COURIER_API_TOKEN>`.

### Consulter un colis

```
GET /api/livraison?code=FRP-XXXXXXXXXX
```

Répond, pour une commande confirmée, en préparation ou expédiée : référence, boutique (nom, téléphone, ville), destinataire (nom, téléphone, gouvernorat, ville, adresse), **somme à encaisser** en millimes, nombre de pièces, arrivée prévue.

### Signaler une étape ou une position

```
POST /api/livraison
Content-Type: application/json

{
  "trackingCode": "FRP-XXXXXXXXXX",
  "status": "out_for_delivery",
  "note": "En route",
  "latitude": 36.878,
  "longitude": 10.324,
  "eta": "2026-11-05T15:30:00+01:00",
  "carrier": "Société de livraison",
  "courierName": "Sami",
  "courierPhone": "98 000 000"
}
```

- Tous les champs sauf `trackingCode` sont facultatifs. Sans `status`, seules la position, l'arrivée prévue ou l'identité du livreur sont mises à jour : c'est le cas d'un envoi de position régulier.
- `status` accepte `in_transit`, `out_for_delivery`, `delivered`, `failed`, `returned`, et seulement une fois le colis remis par la boutique (`handed_over`). Sinon : 409 `invalid_transition`.
- `latitude` et `longitude` vont ensemble. Le client voit un lien « Voir sur la carte » vers OpenStreetMap.
- Réponses : 200 avec `{ tracking_code, status }`, 400 si le format est invalide, 404 si le colis est inconnu, 409 si l'étape est refusée.

### Temps réel

`shipments` et `shipment_events` sont publiées dans Supabase Realtime, sous RLS : seuls le client, la boutique et l'administration reçoivent les changements de leur commande. La page de commande du client se met à jour dès qu'un événement arrive, avec un rafraîchissement de secours toutes les 10 secondes. Pour suivre le livreur sur une carte en continu, il suffit que l'application envoie sa position régulièrement (par exemple toutes les 30 secondes) ; la page la reçoit en direct.

## Compte et inscription

- La confirmation de l'e-mail **ne bloque plus rien**. En local, `supabase/config.toml` désactive `enable_confirmations`. Un compte créé avant ce choix et jamais confirmé est confirmé automatiquement à sa première connexion, une fois son mot de passe validé.
- À l'inscription, le **téléphone est obligatoire** : c'est le numéro qu'appelle le livreur. L'adresse (gouvernorat, ville, rue) est facultative ; elle est enregistrée au profil, modifiable dans `/compte/profil` et préremplie à la commande.
- **Staging** : la confirmation se règle dans Supabase, Authentication, Providers, Email, option « Confirm email ». Tant qu'elle reste active, une nouvelle inscription attend un e-mail que le service d'envoi par défaut ne délivre qu'aux membres de l'équipe.

## Connexion par code, sans inscription

- Sur `/connexion`, le choix « Code par e-mail » : l'adresse, puis un code à 6 chiffres reçu par e-mail (valable une heure). Sans compte pour cette adresse, Supabase le crée à la première connexion, au nom « Membre », modifiable dans le profil. Le lien « Connecte-toi avec un code reçu par e-mail » de `/inscription` y mène (`/connexion?methode=code`).
- La réponse est la même que l'adresse soit connue ou non. Un administrateur passe toujours ensuite par le second facteur.
- Un renvoi trop rapproché est refusé par Supabase (une minute par défaut) avec le message « Un code vient de partir… ».
- Un compte créé par code n'a pas de mot de passe. Pour en choisir un, par exemple avant de supprimer son compte, « Mot de passe oublié ».
- Modèle d'e-mail : `supabase/templates/magic-link.html` (le code, plus un lien). En local il est appliqué par `config.toml`. **Staging** : coller ce modèle dans Supabase, Authentication, Email Templates, « Magic Link » ; le modèle par défaut ne contient pas le code. L'envoi par défaut de Supabase ne délivre qu'aux adresses de l'équipe du projet et peu d'e-mails par heure : pour de vrais clients, un service d'envoi (SMTP) est à configurer.
