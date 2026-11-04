# Textes arabes à faire relire

**Aucun texte arabe de FRIPE n'a été relu par un humain.** Ils ont tous été rédigés sans vérification par un arabophone.

Pour le relecteur : ouvrir les fichiers indiqués, ou le site en ajoutant `/ar` au début de l'adresse.

## Priorité 1 : valeur juridique

Fichier : [src/features/legal/content/ar.json](../src/features/legal/content/ar.json)

| Page | Route |
|---|---|
| البيانات القانونية | `/ar/mentions-legales` |
| الشروط العامة للاستخدام | `/ar/cgu` |
| الشروط العامة للبيع | `/ar/cgv` |
| سياسة الخصوصية | `/ar/confidentialite` |
| ملفات تعريف الارتباط | `/ar/cookies` |
| الإرجاع والإلغاء | `/ar/retours` |
| شروط التوصيل | `/ar/livraison` |
| معلومات عن البائعين | `/ar/informations-vendeurs` |
| الدعم | `/ar/support` |

Une erreur a ici des conséquences juridiques. Faire relire **avec le juriste**, une fois les textes français validés.

## Priorité 2 : actions irréversibles et sécurité

Fichier : [src/messages/ar.json](../src/messages/ar.json)

| Clés | Contenu |
|---|---|
| `account.delete*` | Suppression de compte |
| `mfa.*` | Second facteur, préparation administrateur |
| `errors.*` | Tous les messages d'erreur |
| `messaging.block*`, `messaging.blocks*` | Blocage |
| `checkout.*`, `orders.*`, `orderStatus.*` | Commande et paiement |
| `validation.*` | Erreurs de formulaire |

## Priorité 3 : parcours principaux

| Clés | Contenu |
|---|---|
| `nav`, `home`, `footer`, `common` | Navigation et accueil |
| `market` | Marketplace, Vide-Dressing, annonces de particuliers, échanges |
| Catégories Marketplace (`supabase/migrations/20261106000002_marketplace.sql`) | Noms des rubriques et des caractéristiques |
| `auth` | Connexion et inscription |
| `catalog`, `product`, `conditions`, `cart`, `favorites` | Catalogue |
| `reservations`, `requests` | Réservation et demandes |
| `social`, `messaging` | Suivis, alertes, messages |
| `reviews` | Avis, notamment les pluriels et le duel dans `summary` |
| `walk`, `stylist`, `outfits` | Vidéos et tenues |
| `seller`, `sellerShop`, `shopPublic` | Espace vendeur |
| `staging` | Bandeau de test |

## Priorité 4 : usage interne

`admin`, `adminMarket`, `adminReference`, `moderation`.

## Hors de ces fichiers

- **E-mails :** [supabase/templates](../supabase/templates).
- **Données de référence :** noms arabes des gouvernorats, villes et catégories, dans la migration `20261030000003_reference_data.sql`.
- **Textes codés en dur :** `Compte supprimé`, `[message supprimé]`, `[demande supprimée]` et `Client` sont **uniquement en français** dans `delete_my_account`. Ils s'affichent aux boutiques, quelle que soit leur langue. **À décider :** traduire à l'affichage.

## Terminologie à arrêter

| Français | Choix actuel | À confirmer |
|---|---|---|
| Client | الحريف | Usage tunisien, ou الزبون |
| Frais | معلوم | Usage administratif tunisien |
| Délégation | المعتمدية | Terme officiel |
| Gouvernorat | الولاية | Terme officiel |
| Modération | الإشراف | Compris par les utilisateurs ? |
| Tenue | إطلالة | Ou طقم |
| Second facteur | العامل الثاني | Ou التحقق بخطوتين |

## Questions au relecteur

1. Arabe standard ou tunisien : quel registre pour l'interface ?
2. Le tutoiement du français a-t-il un équivalent juste ?
3. Les chiffres latins conviennent-ils partout ?
4. Y a-t-il des mots coupés ou mal alignés à l'écran ?
