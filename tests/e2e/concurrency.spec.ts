import { expect, test } from "@playwright/test";
import { admin, createConfirmedUser } from "./helpers";
import { clientFor, createApprovedShop, productStatus, seedProduct } from "./market-helpers";

// Requêtes réellement parallèles sur la base : on vérifie les verrous PostgreSQL, pas l'interface.
const CLIENTS = 8;

test.describe.configure({ timeout: 120_000 });

async function createClients(count: number) {
  return Promise.all(
    Array.from({ length: count }, async () => {
      const user = await createConfirmedUser("concurrent");
      return { ...user, supabase: await clientFor(user.email) };
    }),
  );
}

function orderArgs(productIds: string[], pickupShopIds: string[]) {
  return {
    p_product_ids: productIds,
    p_pickup_shop_ids: pickupShopIds,
    p_recipient_name: "Client Test",
    p_phone: "+21622123456",
    p_governorate_id: 0,
    p_city_id: 0,
    p_address_line: "",
  };
}

test("double réservation simultanée : une seule réussit", async () => {
  const shop = await createApprovedShop();
  const clients = await createClients(CLIENTS);

  for (let round = 0; round < 5; round += 1) {
    const product = await seedProduct(shop.id);

    const results = await Promise.all(
      clients.map(({ supabase }) => supabase.rpc("reserve_product", { p_product_id: product.id })),
    );

    const succeeded = results.filter((result) => !result.error);
    const refused = results.filter((result) => result.error?.message === "product_unavailable");

    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(CLIENTS - 1);

    const { count } = await admin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id)
      .eq("status", "active");

    expect(count).toBe(1);

    await clients[0].supabase.rpc("cancel_reservation", { p_reservation_id: succeeded[0].data });
    await admin.from("reservations").update({ status: "cancelled" }).eq("product_id", product.id);
  }
});

test("double vente simultanée : une seule commande aboutit", async () => {
  const shop = await createApprovedShop();
  const clients = await createClients(CLIENTS);

  for (let round = 0; round < 4; round += 1) {
    const product = await seedProduct(shop.id, { price: 40000 });

    const results = await Promise.all(
      clients.map(({ supabase }) => supabase.rpc("place_order", orderArgs([product.id], [shop.id]))),
    );

    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.filter((result) => result.error?.message === "product_unavailable")).toHaveLength(
      CLIENTS - 1,
    );

    const { count } = await admin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id)
      .eq("is_live", true);

    expect(count).toBe(1);
    expect(await productStatus(product.id)).toBe("reserved");
  }
});

test("réservation et commande simultanées : la pièce ne part qu'une fois", async () => {
  const shop = await createApprovedShop();
  const [first, second] = await createClients(2);

  for (let round = 0; round < 8; round += 1) {
    const product = await seedProduct(shop.id);

    const [reservation, order] = await Promise.all([
      first.supabase.rpc("reserve_product", { p_product_id: product.id }),
      second.supabase.rpc("place_order", orderArgs([product.id], [shop.id])),
    ]);

    expect(Number(!reservation.error) + Number(!order.error)).toBe(1);
    expect([reservation.error?.message, order.error?.message].filter(Boolean)).toEqual([
      "product_unavailable",
    ]);

    // Remise à zéro : les plafonds par client ne doivent pas fausser le tour suivant.
    if (!reservation.error) {
      await first.supabase.rpc("cancel_reservation", { p_reservation_id: reservation.data });
    } else {
      const { data: placed } = await admin
        .from("orders")
        .select("id")
        .eq("group_id", order.data)
        .single();

      await second.supabase.rpc("cancel_order", { p_order_id: placed!.id, p_reason: "test" });
    }
  }
});

test("paniers croisés : pas d'interblocage et une seule vente par pièce", async () => {
  const shop = await createApprovedShop();
  const [first, second] = await createClients(2);

  for (let round = 0; round < 5; round += 1) {
    const one = await seedProduct(shop.id);
    const two = await seedProduct(shop.id);

    const results = await Promise.all([
      first.supabase.rpc("place_order", orderArgs([one.id, two.id], [shop.id])),
      second.supabase.rpc("place_order", orderArgs([two.id, one.id], [shop.id])),
    ]);

    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.map((result) => result.error?.code)).not.toContain("40P01");
  }
});

test("une pièce annulée et revendue garde une seule ligne vivante", async () => {
  const shop = await createApprovedShop();
  const [first, second] = await createClients(2);
  const product = await seedProduct(shop.id);

  const order = await first.supabase.rpc("place_order", orderArgs([product.id], [shop.id]));
  expect(order.error).toBeNull();

  const { data: placed } = await admin
    .from("orders")
    .select("id")
    .eq("group_id", order.data)
    .single();

  const cancelled = await first.supabase.rpc("cancel_order", { p_order_id: placed!.id, p_reason: "test" });
  expect(cancelled.error).toBeNull();
  expect(await productStatus(product.id)).toBe("available");

  const again = await second.supabase.rpc("place_order", orderArgs([product.id], [shop.id]));
  expect(again.error).toBeNull();

  const { data: items } = await admin
    .from("order_items")
    .select("is_live")
    .eq("product_id", product.id);

  expect(items?.filter((item) => item.is_live)).toHaveLength(1);
  expect(items).toHaveLength(2);
});
