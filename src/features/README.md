# Modules métier

Chaque domaine vit dans son dossier et suit la même découpe :

- `schemas.ts` : validation Zod partagée entre formulaire et serveur.
- `queries.ts` : lectures côté serveur (`server-only`).
- `actions.ts` : Server Actions. Toujours : validation, session, puis écriture soumise à RLS ou RPC.
- `components/` : interface propre au domaine.

Domaines présents : `auth`, `shops`, `admin`, `catalog`, `collections`, `inventory`, `reservations`, `orders`, `walk`, `social`, `messaging`, `stylist`, `moderation`, `reviews`, `legal`.
Les autres sont créés avec la phase qui les implémente.
