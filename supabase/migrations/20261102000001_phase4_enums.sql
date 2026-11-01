-- Nouvelles valeurs d'énumération : isolées, car une valeur ajoutée n'est utilisable qu'après
-- la validation de la transaction qui la crée.

alter type public.report_target add value 'shop';
alter type public.report_target add value 'account';
alter type public.report_target add value 'review';

alter type public.report_decision add value 'suspend';
