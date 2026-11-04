begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('90000000-0000-0000-0000-00000000000a', 'boutique-livraison@test.local', '{"display_name":"Boutique"}'),
  ('90000000-0000-0000-0000-00000000000b', 'client-livraison@test.local',
    '{"display_name":"Client Livré","phone":"+21622123456","governorate_id":"1","address_line":"  12 rue de la Fripe  "}'),
  ('90000000-0000-0000-0000-00000000000c', 'curieux-livraison@test.local', '{"display_name":"Curieux","phone":"12345"}'),
  ('90000000-0000-0000-0000-00000000000d', 'admin-livraison@test.local', '{"display_name":"Admin Livraison"}');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '90000000-0000-0000-0000-00000000000d', 'totp', 'verified', now(), now());
insert into public.platform_admins (user_id) values ('90000000-0000-0000-0000-00000000000d');

create function pg_temp.login(p_id text, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

create function pg_temp.gov(p_slug text) returns smallint language sql as $$
  select governorate_id from public.cities where slug = p_slug;
$$;

-- Inscription : téléphone et adresse ----------------------------------------------------------------

select is(
  (select phone from public.profiles where id = '90000000-0000-0000-0000-00000000000b'),
  '+21622123456',
  'le téléphone donné à l''inscription est enregistré'
);

select is(
  (select address_line from public.profiles where id = '90000000-0000-0000-0000-00000000000b'),
  '12 rue de la Fripe',
  'l''adresse donnée à l''inscription est enregistrée'
);

select is(
  (select phone from public.profiles where id = '90000000-0000-0000-0000-00000000000c'),
  null,
  'un téléphone invalide est ignoré sans bloquer l''inscription'
);

select pg_temp.login('90000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$update public.profiles set governorate_id = pg_temp.gov('sfax-ville'), city_id = (select id from public.cities where slug = 'la-marsa')
    where id = '90000000-0000-0000-0000-00000000000b'$$,
  'P0001', 'invalid_city', 'une ville hors du gouvernorat est refusée'
);

select lives_ok(
  $$update public.profiles set governorate_id = pg_temp.gov('la-marsa'), city_id = (select id from public.cities where slug = 'la-marsa')
    where id = '90000000-0000-0000-0000-00000000000b'$$,
  'le client enregistre son adresse'
);

-- Tarifs ------------------------------------------------------------------------------------------

select pg_temp.logout();

insert into public.shops (id, slug, name, governorate_id, city_id, status)
select '91000000-0000-0000-0000-00000000000a', 'livraison-t', 'Boutique Livraison', c.governorate_id, c.id, 'approved'
from public.cities c where c.slug = 'sfax-ville';

insert into public.shop_members (shop_id, user_id, role)
values ('91000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000a', 'owner');

-- Un tarif de boutique ne compte plus : c'est la grille de la plateforme qui s'applique.
insert into public.delivery_rates (shop_id, governorate_id, fee_millimes)
values ('91000000-0000-0000-0000-00000000000a', null, 99000);

select pg_temp.login('90000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.save_platform_delivery_rates(5000, '[]')$$,
  'P0001', 'forbidden', 'un client ne fixe pas les tarifs'
);

select pg_temp.login('90000000-0000-0000-0000-00000000000d', 'aal2');

select lives_ok(
  $$select public.save_platform_delivery_rates(9000, jsonb_build_array(jsonb_build_object('governorate_id', pg_temp.gov('la-marsa'), 'fee_millimes', 6000)))$$,
  'l''administration fixe la grille'
);

select throws_ok(
  $$select public.save_platform_delivery_rates(9000, '[{"governorate_id": 1, "fee_millimes": 500000}]')$$,
  'P0001', 'invalid_rates', 'un tarif hors limites est refusé'
);

select pg_temp.login('90000000-0000-0000-0000-00000000000b');

select is(
  (select fee_millimes from public.delivery_quote(array['91000000-0000-0000-0000-00000000000a']::uuid[], pg_temp.gov('la-marsa'))),
  6000,
  'le gouvernorat de la grille a son tarif'
);

select is(
  (select fee_millimes from public.delivery_quote(array['91000000-0000-0000-0000-00000000000a']::uuid[], pg_temp.gov('sousse-ville'))),
  9000,
  'un gouvernorat absent prend le tarif par défaut, pas celui de la boutique'
);

-- Commande et suivi -------------------------------------------------------------------------------

select pg_temp.logout();

insert into public.products (id, shop_id, reference, title, category_id, condition, price_millimes, publication_status, published_at)
select v.id::uuid, '91000000-0000-0000-0000-00000000000a', v.ref, v.title, (select id from public.categories where slug = 'jeans'), 'good', 30000, 'published', now()
from (values
  ('92000000-0000-0000-0000-000000000001', 'L-1', 'Jean livré'),
  ('92000000-0000-0000-0000-000000000002', 'L-2', 'Jean retiré')
) as v (id, ref, title);

select pg_temp.login('90000000-0000-0000-0000-00000000000b');

select lives_ok(
  $$select public.place_order(
      array['92000000-0000-0000-0000-000000000001']::uuid[], array[]::uuid[], 'Client Livré', '+21622123456',
      pg_temp.gov('la-marsa'), (select id from public.cities where slug = 'la-marsa'), '12 rue de la Fripe')$$,
  'le client commande en livraison'
);

select lives_ok(
  $$select public.place_order(
      array['92000000-0000-0000-0000-000000000002']::uuid[], array['91000000-0000-0000-0000-00000000000a']::uuid[],
      'Client Livré', '+21622123456', null, null, null)$$,
  'le client commande en retrait'
);

select is(
  (select o.delivery_fee_millimes from public.orders o join public.order_items i on i.order_id = o.id
   where i.product_id = '92000000-0000-0000-0000-000000000001'),
  6000,
  'la commande applique le tarif de la grille'
);

select matches(
  (select s.tracking_code from public.shipments s join public.order_items i on i.order_id = s.order_id
   where i.product_id = '92000000-0000-0000-0000-000000000001'),
  '^FRP-[A-Z0-9]{10}$',
  'une livraison reçoit un numéro de suivi'
);

select is(
  (select count(*)::int from public.shipments s join public.order_items i on i.order_id = s.order_id
   where i.product_id = '92000000-0000-0000-0000-000000000002'),
  0,
  'un retrait en boutique n''a pas de colis'
);

select pg_temp.login('90000000-0000-0000-0000-00000000000c');

select is((select count(*)::int from public.shipments), 0, 'un tiers ne voit aucun colis');
select is((select count(*)::int from public.shipment_events), 0, 'un tiers ne voit aucun historique');

-- La boutique fait avancer la commande ; chaque étape entre dans l'historique.
select pg_temp.login('90000000-0000-0000-0000-00000000000a');

-- Le numéro de suivi est relevé ici, par la boutique : la clé de service n'a pas à lire les tables.
create temporary table delivery_order as
select o.id, s.tracking_code from public.orders o
join public.order_items i on i.order_id = o.id
join public.shipments s on s.order_id = o.id
where i.product_id = '92000000-0000-0000-0000-000000000001';
grant select on delivery_order to authenticated, service_role;

select lives_ok($$select public.update_order_status((select id from delivery_order), 'confirmed')$$, 'la boutique confirme');
select lives_ok($$select public.update_order_status((select id from delivery_order), 'preparing')$$, 'la boutique prépare');

-- Le livreur : jamais depuis une session, seulement par le serveur.
select throws_ok(
  $$select public.courier_update((select tracking_code from delivery_order), 'in_transit')$$,
  '42501', null, 'une session ne peut pas se faire passer pour le livreur'
);

select pg_temp.logout();
set local role service_role;

select throws_ok(
  $$select public.courier_update((select tracking_code from delivery_order), 'in_transit')$$,
  'P0001', 'invalid_transition', 'le livreur n''intervient qu''après la remise du colis'
);

reset role;
select pg_temp.login('90000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.update_order_status((select id from delivery_order), 'shipped')$$, 'la boutique remet le colis');

select pg_temp.logout();
set local role service_role;

select lives_ok(
  $$select public.courier_update((select tracking_code from delivery_order),
      'out_for_delivery', 'En route', 36.878, 10.324, null, 'Livreur Test', 'Sami', '+21698000000')$$,
  'le livreur signale sa tournée et sa position'
);

select lives_ok(
  $$select public.courier_update((select tracking_code from delivery_order), 'delivered', 'Remis et encaissé')$$,
  'le livreur confirme la livraison'
);

reset role;

select is(
  (select status::text from public.orders where id = (select id from delivery_order)),
  'delivered',
  'la commande passe à livrée'
);

select is(
  (select status::text from public.products where id = '92000000-0000-0000-0000-000000000001'),
  'sold',
  'la pièce est vendue'
);

select results_eq(
  $$select status || ':' || source from public.shipment_events where order_id = (select id from delivery_order) order by id$$,
  $$values ('ordered:client'), ('confirmed:shop'), ('preparing:shop'), ('handed_over:shop'), ('out_for_delivery:courier'), ('delivered:courier')$$,
  'l''historique retrace chaque étape et son auteur'
);

select * from finish();
rollback;
