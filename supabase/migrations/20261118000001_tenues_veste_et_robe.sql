-- Cabine d'essayage : la veste (portée par-dessus le haut) et la robe (qui remplace le haut et le bas)
-- deviennent des cases à part entière d'une tenue. Ajout seulement : les tenues existantes restent
-- valides telles quelles (leurs vestes et robes, rangées jusqu'ici dans « top », n'y bougent pas).
alter type public.outfit_slot add value if not exists 'outer' after 'top';
alter type public.outfit_slot add value if not exists 'dress' after 'outer';
