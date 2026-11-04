import { expect, test, type APIRequestContext } from "@playwright/test";
import { admin, createConfirmedUser, signIn } from "./helpers";
import { clientFor, createApprovedShop, seedProduct, unique } from "./market-helpers";

const TOKEN = process.env.COURIER_API_TOKEN!;

async function deliveryOrder(pickup = false) {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Colis ${unique("c")}` });
  const client = await createConfirmedUser("suivi", "Client Suivi");
  const buyer = await clientFor(client.email);
  const { data: city } = await admin.from("cities").select("id, governorate_id").eq("slug", "la-marsa").single();

  const { error } = await buyer.rpc("place_order", {
    p_product_ids: [product.id],
    p_pickup_shop_ids: pickup ? [shop.id] : [],
    p_recipient_name: "Client Suivi",
    p_phone: "+21622123456",
    p_governorate_id: pickup ? null : city!.governorate_id,
    p_city_id: pickup ? null : city!.id,
    p_address_line: pickup ? null : "12 rue de la Fripe",
  });
  expect(error).toBeNull();

  const { data: item } = await admin.from("order_items").select("order_id").eq("product_id", product.id).single();
  const { data: shipment } = await admin.from("shipments").select("tracking_code").eq("order_id", item!.order_id).maybeSingle();
  return { shop, product, client, orderId: item!.order_id, code: shipment?.tracking_code ?? null };
}

async function advance(email: string, orderId: string, statuses: string[]) {
  const owner = await clientFor(email);
  for (const status of statuses) {
    const { error } = await owner.rpc("update_order_status", { p_order_id: orderId, p_status: status as "confirmed" });
    expect(error).toBeNull();
  }
}

const courier = (request: APIRequestContext, data: Record<string, unknown>, token = TOKEN) =>
  request.post("/api/livraison", { headers: { authorization: `Bearer ${token}` }, data });

test("commande : la livraison se coche, le retrait est gratuit", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { price: 30000 });
  const client = await createConfirmedUser("coche");
  await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });

  await signIn(page, client.email, "/commande");
  const delivery = page.getByRole("radio", { name: "Livraison à domicile" });
  await expect(delivery).toBeChecked();
  await expect(delivery).toHaveAccessibleDescription("Le prix dépend de ton gouvernorat, fixé par FRIPE.");

  await page.getByLabel("Gouvernorat").selectOption({ label: "Tunis" });
  await expect(delivery).toHaveAccessibleDescription("8 DT, payés à la livraison");

  await page.getByRole("radio", { name: "Retrait en boutique" }).check();
  await expect(page.getByText("Retrait en boutique, sans frais : la boutique te prévient quand c'est prêt.")).toBeVisible();
  await expect(page.getByLabel("Rue, numéro, immeuble")).toHaveCount(0);
  await expect(page.getByText("30 DT", { exact: true }).last()).toBeVisible();
});

test("suivi : numéro de colis, étapes, mise à jour en direct quand la boutique avance", async ({ page }) => {
  const { shop, client, orderId, code } = await deliveryOrder();
  expect(code).toMatch(/^FRP-[A-Z0-9]{10}$/);

  await signIn(page, client.email, `/compte/commandes/${orderId}`);
  await expect(page.getByRole("heading", { name: "Suivi" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Copier le numéro de suivi ${code}` })).toBeVisible();
  await expect(page.locator(".tracking__step.is-current")).toContainText("Commande reçue");

  // Sans recharger la page : l'étape arrive par le temps réel.
  await advance(shop.owner.email, orderId, ["confirmed"]);
  await expect(page.locator(".tracking__step.is-current")).toContainText("Confirmée par la boutique", { timeout: 15_000 });
  await expect(page.getByText("Confirmée par la boutique · boutique")).toBeVisible();
});

test("livreur : jeton exigé, consultation, tournée, position et livraison", async ({ page, request }) => {
  const { shop, product, client, orderId, code } = await deliveryOrder();

  expect((await request.get(`/api/livraison?code=${code}`)).status()).toBe(404);
  expect((await courier(request, { trackingCode: code, status: "in_transit" }, "x".repeat(40))).status()).toBe(404);

  // Avant la remise du colis, le livreur ne peut rien déclarer.
  await advance(shop.owner.email, orderId, ["confirmed", "preparing"]);
  const early = await courier(request, { trackingCode: code, status: "in_transit" });
  expect(early.status()).toBe(409);

  const details = await request.get(`/api/livraison?code=${code}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  expect(details.status()).toBe(200);
  expect(await details.json()).toMatchObject({
    tracking_code: code,
    recipient: { name: "Client Suivi", phone: "+21622123456", address: "12 rue de la Fripe" },
    cash_to_collect_millimes: 38000,
  });

  await advance(shop.owner.email, orderId, ["shipped"]);
  const route = await courier(request, {
    trackingCode: code,
    status: "out_for_delivery",
    latitude: 36.878,
    longitude: 10.324,
    courierName: "Sami",
    carrier: "Livreur Test",
    courierPhone: "98 000 000",
  });
  expect(route.status()).toBe(200);

  await signIn(page, client.email, `/compte/commandes/${orderId}`);
  await expect(page.locator(".tracking__step.is-current")).toContainText("En cours de livraison");
  await expect(page.getByText("Sami · Livreur Test")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir sur la carte" })).toHaveAttribute("href", /mlat=36\.878/);

  const done = await courier(request, { trackingCode: code, status: "delivered", note: "Remis et encaissé" });
  expect(done.status()).toBe(200);
  await expect(page.locator(".tracking__step.is-current")).toContainText("Livrée", { timeout: 15_000 });

  const { data: order } = await admin.from("orders").select("status").eq("id", orderId).single();
  const { data: sold } = await admin.from("products").select("status").eq("id", product.id).single();
  expect(order?.status).toBe("delivered");
  expect(sold?.status).toBe("sold");
});

test("retrait en boutique : étapes sans numéro de colis", async ({ page }) => {
  const { shop, client, orderId, code } = await deliveryOrder(true);
  expect(code).toBeNull();

  await advance(shop.owner.email, orderId, ["confirmed", "preparing", "delivered"]);
  await signIn(page, client.email, `/compte/commandes/${orderId}`);
  await expect(page.getByRole("heading", { name: "Suivi" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copier le numéro de suivi/ })).toHaveCount(0);
  await expect(page.locator(".tracking__step.is-current")).toContainText("Retirée en boutique");
});
