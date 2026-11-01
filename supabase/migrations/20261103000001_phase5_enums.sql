-- Valeurs isolées : une valeur d'énumération n'est utilisable qu'après la validation de sa migration.

alter type public.shop_status add value 'closed';
alter type public.account_status add value 'deleted';
