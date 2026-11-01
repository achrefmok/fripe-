# Retrait de contenu

Guide pour l'équipe de modération.

## Choisir la bonne action

| Situation | Action | Fichier en ligne ? | Réversible ? |
|---|---|---|---|
| Produit signalé, fondé | Signalement : **Retirer le contenu** | Supprimé | Non |
| Produit masqué par la boutique | Aucune | **Reste à son URL** | Oui |
| Vidéo signalée, fondée | Signalement : **Retirer le contenu** | Supprimé | Non |
| Vidéo à retirer sans signalement | `/admin/videos` : **Retirer** | Supprimé | Non |
| Doute sur une boutique | `/admin/boutiques` : **Suspendre** | **Reste à son URL** | Oui |
| **Contenu dangereux ou potentiellement illégal** | `/admin/boutiques` : **Retrait d'urgence** | Supprimé | **Non** pour les fichiers |
| Compte supprimé | Automatique | Supprimé, boutique fermée | Non |

**Suspendre ne suffit jamais pour un contenu dangereux :** les pages disparaissent, mais les fichiers restent lisibles par quiconque a leur URL.

## Retrait d'urgence

Sur `/admin/boutiques`, **Retrait d'urgence** avec un motif. Cela :

1. archive et modère toutes les pièces, qui ne pourront plus être republiées ;
2. retire toutes les photos, les vidéos et le logo ;
3. suspend la boutique ;
4. journalise l'étendue du retrait.

Les fichiers sont supprimés aussitôt. Si la suppression échoue, ils restent en file jusqu'au prochain passage de maintenance, qui n'est pas encore planifié : voir [maintenance.md](maintenance.md).

Rétablir la boutique ensuite ne restaure rien.

Pour un seul contenu, préférer le retrait ciblé du produit ou de la vidéo.

## Conserver la preuve : décision à prendre

**La suppression est définitive et il n'existe pas de quarantaine.** Seuls restent le titre, le motif et les métadonnées. Pour un contenu illégal, les autorités peuvent exiger sa conservation. **Procédure à définir avec un juriste avant l'ouverture**, avec notamment :

- qui décide et qui contacte les autorités ;
- s'il faut copier le fichier en lieu sûr avant le retrait ;
- le délai de réaction attendu ;
- l'information de la boutique.

En attendant, en cas de contenu pouvant relever d'une infraction grave, consulter un juriste, sans partager ni copier le contenu sans instruction.

## Après le retrait

Le fichier disparaît du Storage, pas forcément des copies :

- **CDN :** si un CDN est placé devant le Storage, purger l'URL. À vérifier avec l'hébergeur retenu.
- **Cache navigateur :** les vidéos sont envoyées avec `cacheControl` à un an. Un visiteur qui l'a déjà chargée peut la revoir localement.
- **Copies externes :** captures et téléchargements restent hors de portée.

Le test automatique vérifie que l'URL publique du Storage ne répond plus. Il ne vérifie pas un CDN, qui n'existe pas encore.

## Pourquoi le Storage reste public

Le rendre privé imposerait des URL signées à chaque affichage du catalogue, de Fripe Walk et des commandes. Les pages publiques ne seraient plus cachables, et le coût serait important pour des images destinées à être publiques.

Règle : **public ne signifie pas confidentiel**. Aucun document personnel ne doit y être déposé, et retirer un contenu revient à supprimer son fichier.

## Vérifier un retrait

```sql
select action, entity_id, metadata, created_at from audit_logs
where action in ('shop.emergency_takedown', 'product.moderated', 'video.moderated', 'report.remove_content')
order by created_at desc limit 20;

select bucket, path, attempts, done_at, outcome from storage_purge_queue
order by created_at desc limit 20;
```

Une ligne sans `done_at` signifie que le fichier est **encore en ligne**.
