# À valider avant l'ouverture publique

Les pages légales décrivent ce que l'application fait réellement. Tout ce qui demande une décision ou une validation humaine est marqué `[[À valider : …]]` dans [src/features/legal/content/fr.json](../src/features/legal/content/fr.json) et `[[للمصادقة: …]]` dans [ar.json](../src/features/legal/content/ar.json).

**Ces textes ne sont pas des avis juridiques.** Ils doivent être relus par un juriste tunisien.

Les marqueurs sont surlignés sur le site, et une mention de brouillon s'affiche en haut de la page. Quand tous les marqueurs d'une page sont remplacés, cette mention disparaît d'elle-même. Tant qu'il en reste, la page n'est pas prête.

## Informations à fournir

| Sujet | Pages | Qui décide |
|---|---|---|
| Identité de l'exploitant : raison sociale, forme, siège, matricule, responsable de publication | Mentions légales | Exploitant |
| Hébergeur, sous-traitants, pays d'hébergement, transferts hors de Tunisie | Mentions légales, Confidentialité | Exploitant, technique |
| Responsable du traitement, démarches auprès de l'autorité de protection des données | Confidentialité | Juriste |
| Base légale des traitements, durées de conservation | Confidentialité | Juriste |
| Procédure d'accès, de rectification et de suppression de compte | Confidentialité | Exploitant, juriste |
| Âge minimum, droit applicable, tribunal, limites de responsabilité | CGU | Juriste |
| Contestation d'une suspension | CGU | Exploitant |
| Rôle juridique de FRIPE dans la vente | CGV | Juriste |
| Mentions fiscales, réclamations et médiation | CGV | Juriste, comptable |
| Droit de retour, non-conformité, remboursement en espèces, refus à la livraison | Retours | Exploitant, juriste |
| Règles propres aux boutiques | Retours | Exploitant |
| Délais, transporteurs, responsabilité, zones desservies | Livraison | Exploitant |
| Commission, statut des vendeurs, informations exigées, obligations fiscales | Vendeurs | Exploitant, comptable |
| E-mail, téléphone et horaires du support | Support | Exploitant |
| Absence de bandeau de cookies | Cookies | Juriste |

## Pistes à faire confirmer par le juriste

À titre d'indication seulement, ces textes ne sont pas cités sur le site car leur application n'a pas été vérifiée :

- loi organique n° 2004-63 du 27 juillet 2004 sur la protection des données personnelles, et rôle de l'INPDP ;
- loi n° 2000-83 du 9 août 2000 relative aux échanges et au commerce électroniques ;
- règles de protection du consommateur et de vente à distance.

## Suppression de compte et conservation

Matrice complète : [donnees-personnelles.md](donnees-personnelles.md).

Durées de conservation et cas particuliers : voir [suppression-de-compte.md](suppression-de-compte.md). Tant que `order_personal_data_retention_days` n'est pas fixé, le nom, le téléphone et l'adresse des commandes sont conservés.

## Consentement

L'inscription et la commande affichent une phrase renvoyant aux CGU, à la confidentialité, aux CGV et aux retours. Il n'y a **pas de case à cocher**. Le juriste doit dire si elle est nécessaire, et si l'acceptation doit être enregistrée avec la version du texte.

## Traductions arabes

Liste complète à transmettre au relecteur : [textes-arabes-a-relire.md](textes-arabes-a-relire.md).

## Traductions arabes à faire relire par un arabophone

Tous les textes arabes ont été rédigés sans relecture humaine. Priorités :

1. **Les neuf pages légales** ([ar.json](../src/features/legal/content/ar.json)) : une erreur a ici des conséquences juridiques. Terminologie à arrêter : « الحريف » pour client, « معلوم » pour frais, « المعتمدية » pour délégation, « الإشراف » pour modération.
2. **Messages de sécurité et de blocage** (`errors`, `messaging` dans [ar.json](../src/messages/ar.json)).
3. **Avis** (`reviews`) : pluriels arabes, y compris le duel, dans `summary`.
4. **Administration** (`adminReference`, `moderation`) : usage interne, priorité plus faible.
5. **Interface générale :** français ou arabe standard, mélange éventuel avec le tunisien, ton.
6. **E-mails** de confirmation et de mot de passe ([supabase/templates](../supabase/templates)).

## Données

- **Délégations :** la base contient les chefs-lieux et les grandes villes, pas les 264 délégations officielles. La liste n'a pas été inventée : elle doit être saisie dans `/admin/lieux` depuis une source officielle.
- **Noms arabes des lieux et catégories :** à relire.

## Avant la mise en ligne

Voir aussi [securite-phase-4.md](securite-phase-4.md) pour la configuration de production et [essais-manuels-mobile.md](essais-manuels-mobile.md) pour les essais sur téléphone.
