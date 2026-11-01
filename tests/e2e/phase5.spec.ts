import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, createAdminUser, createConfirmedUser, PASSWORD, signIn } from "./helpers";
import { clientFor, createApprovedShop, PNG, seedProduct } from "./market-helpers";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonymous = createClient(SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false },
});

const publicUrl = (bucket: string, path: string) => `${SUPABASE}/storage/v1/object/public/${bucket}/${path}`;
const png = () => new Blob([PNG], { type: "image/png" });

async function maintenance(request: import("@playwright/test").APIRequestContext) {
  return request.post("/api/internal/maintenance", {
    headers: { Authorization: `Bearer ${process.env.MAINTENANCE_TOKEN}` },
  });
}

test.describe("Storage", () => {
  test("écriture, lecture et suppression : chaque boutique reste chez elle", async () => {
    const shop = await createApprovedShop();
    const other = await createApprovedShop();
    const client = await createConfirmedUser("storage");
    const product = await seedProduct(shop.id);
    const seller = await clientFor(shop.owner.email);
    const stranger = await clientFor(other.owner.email);
    const ordinary = await clientFor(client.email);
    const path = `${shop.id}/${product.id}/photo.png`;
    const bucket = "product-images";

    expect((await seller.storage.from(bucket).upload(path, png())).error).toBeNull();
    expect((await fetch(publicUrl(bucket, path))).ok).toBe(true);

    expect((await anonymous.storage.from(bucket).upload(`${shop.id}/${product.id}/anon.png`, png())).error).not.toBeNull();
    expect((await ordinary.storage.from(bucket).upload(`${shop.id}/${product.id}/client.png`, png())).error).not.toBeNull();
    expect((await stranger.storage.from(bucket).upload(`${shop.id}/${product.id}/autre.png`, png())).error).not.toBeNull();
    expect((await seller.storage.from(bucket).upload(`${shop.id}/${crypto.randomUUID()}/x.png`, png())).error).not.toBeNull();
    expect((await seller.storage.from(bucket).upload(`${shop.id}/hors-produit.png`, png())).error).not.toBeNull();

    expect((await anonymous.storage.from(bucket).list(`${shop.id}/${product.id}`)).data ?? []).toEqual([]);
    expect((await stranger.storage.from(bucket).list(`${shop.id}/${product.id}`)).data ?? []).toEqual([]);

    await stranger.storage.from(bucket).remove([path]);
    await anonymous.storage.from(bucket).remove([path]);
    expect((await fetch(publicUrl(bucket, path))).ok).toBe(true);

    const moved = await seller.storage.from(bucket).move(path, `${other.id}/${product.id}/vol.png`);
    expect(moved.error).not.toBeNull();

    const overwrite = await seller.storage.from(bucket).upload(path, png(), { upsert: true });
    expect(overwrite.error).not.toBeNull();

    await seller.storage.from(bucket).remove([path]);
    expect((await fetch(publicUrl(bucket, path))).ok).toBe(false);
  });

  test("avatars fermés, logos bornés, boutique suspendue sans dépôt", async () => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("avatar");
    const ordinary = await clientFor(client.email);
    const seller = await clientFor(shop.owner.email);

    expect((await ordinary.storage.from("avatars").upload(`${client.id}/a.png`, png())).error).not.toBeNull();
    expect((await seller.storage.from("shop-assets").upload(`${shop.id}/logo.png`, png())).error).toBeNull();

    await admin.from("shops").update({ status: "suspended" }).eq("id", shop.id);

    expect((await seller.storage.from("shop-assets").upload(`${shop.id}/logo2.png`, png())).error).not.toBeNull();
    expect((await fetch(publicUrl("shop-assets", `${shop.id}/logo.png`))).ok).toBe(true);
  });

  test("la modération d'un produit retire le fichier, et la commande reste lisible", async ({ page }) => {
    const shop = await createApprovedShop();
    const manager = await createAdminUser();
    const client = await createConfirmedUser("modere");
    const product = await seedProduct(shop.id, { title: "Piece modereee" });
    const seller = await clientFor(shop.owner.email);
    const buyer = await clientFor(client.email);
    const path = `${shop.id}/${product.id}/vraie.png`;

    await seller.storage.from("product-images").upload(path, png());
    await admin.from("product_images").delete().eq("product_id", product.id);
    await admin.from("product_images").insert({ product_id: product.id, path });

    await buyer.rpc("place_order", {
      p_product_ids: [product.id],
      p_pickup_shop_ids: [shop.id],
      p_recipient_name: "Test",
      p_phone: "+21622123456",
      p_governorate_id: null,
      p_city_id: null,
      p_address_line: null,
    });

    const { data: order } = await admin.from("orders").select("id").eq("client_id", client.id).single();

    expect((await fetch(publicUrl("product-images", path))).ok).toBe(true);

    await signIn(page, manager.email, "/admin/produits");
    await page.getByRole("listitem").filter({ hasText: "Piece modereee" }).getByRole("button", { name: "Retirer" }).click();
    await page.getByLabel("Motif interne").fill("Photo interdite");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Produit retiré")).toBeVisible();

    await expect.poll(async () => (await fetch(publicUrl("product-images", path))).ok).toBe(false);

    await page.context().clearCookies();
    await signIn(page, client.email, `/compte/commandes/${order!.id}`);
    await expect(page.getByText("Piece modereee")).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(0);
  });

  test("la maintenance exige son jeton et vide réellement la file", async ({ request }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const seller = await clientFor(shop.owner.email);
    const path = `${shop.id}/${product.id}/orpheline.png`;

    await seller.storage.from("product-images").upload(path, png());

    expect((await request.post("/api/internal/maintenance")).status()).toBe(404);

    const forged = await request.post("/api/internal/maintenance", { headers: { Authorization: "Bearer faux" } });
    expect(forged.status()).toBe(404);

    const direct = await seller.from("storage_purge_queue").insert({ bucket: "product-images", path, reason: "pirate" });
    expect(direct.error).not.toBeNull();

    await admin.from("storage_purge_queue").insert({ bucket: "product-images", path, reason: "test" });

    expect((await fetch(publicUrl("product-images", path))).ok).toBe(true);

    const response = await maintenance(request);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ storage: { failed: 0 } });

    expect((await fetch(publicUrl("product-images", path))).ok).toBe(false);

    const { data } = await admin.from("storage_purge_queue").select("done_at").eq("path", path).single();
    expect(data?.done_at).not.toBeNull();
  });
});

test.describe("suppression de compte", () => {
  async function deliveredFor(clientEmail: string, shopId: string, productId: string, sellerEmail: string) {
    const buyer = await clientFor(clientEmail);
    const seller = await clientFor(sellerEmail);

    const { data: groupId } = await buyer.rpc("place_order", {
      p_product_ids: [productId],
      p_pickup_shop_ids: [shopId],
      p_recipient_name: "Nadia",
      p_phone: "+21622123456",
      p_governorate_id: null,
      p_city_id: null,
      p_address_line: null,
    });

    const { data: order } = await admin.from("orders").select("id").eq("group_id", groupId).single();

    for (const status of ["confirmed", "preparing", "delivered"]) {
      await seller.rpc("update_order_status", { p_order_id: order!.id, p_status: status });
    }

    return { orderId: order!.id, groupId, buyer };
  }

  async function openDeletion(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    await page.getByLabel("Ton mot de passe").fill(PASSWORD);
    await page.getByRole("checkbox", { name: /définitive/ }).check();
  }

  test("client : mot de passe exigé, compte retiré, historique conservé sans identité", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const client = await createConfirmedUser("adieu", "Nadia Gharbi");
    const { orderId, groupId, buyer } = await deliveredFor(client.email, shop.id, product.id, shop.owner.email);

    const { data: conversationId } = await buyer.rpc("start_conversation", {
      p_shop_id: shop.id,
      p_product_id: null,
      p_request_id: null,
      p_body: "Message privé de Nadia",
    });

    await signIn(page, client.email, "/compte/profil");
    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    await page.getByLabel("Ton mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("checkbox", { name: /définitive/ }).check();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();

    expect((await admin.auth.admin.getUserById(client.id)).data.user).not.toBeNull();

    await page.getByLabel("Ton mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await page.waitForURL((url) => url.pathname === "/");

    expect((await admin.auth.admin.getUserById(client.id)).data.user).toBeNull();
    expect((await admin.from("profiles").select("id").eq("id", client.id)).data).toEqual([]);

    const { data: deletion } = await admin.from("account_deletions").select("completed_at").eq("user_id", client.id).single();
    expect(deletion?.completed_at).not.toBeNull();

    const { data: order } = await admin.from("orders").select("client_id, total_millimes, status").eq("id", orderId).single();
    expect(order).toMatchObject({ client_id: null, status: "delivered", total_millimes: 30000 });

    const { data: group } = await admin.from("order_groups").select("client_id, recipient_name").eq("id", groupId).single();
    expect(group).toEqual({ client_id: null, recipient_name: "Nadia" });

    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(client.email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/messages/${conversationId}`);
    await expect(page.getByRole("heading", { name: "Compte supprimé" })).toBeVisible();
    await expect(page.getByText("Message privé de Nadia")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Signaler ce client" })).toHaveCount(0);

    await page.goto(`/vendeur/boutique/${shop.id}/commandes/${orderId}`);
    await expect(page.getByText(product.title!)).toBeVisible();
  });

  test("vendeur : une commande en cours bloque, puis la boutique ferme et ses fichiers partent", async ({ page, request }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const client = await createConfirmedUser("acheteur");
    const seller = await clientFor(shop.owner.email);
    const buyer = await clientFor(client.email);
    const path = `${shop.id}/${product.id}/vitrine.png`;

    await seller.storage.from("product-images").upload(path, png());
    await admin.from("product_images").insert({ product_id: product.id, path });

    await buyer.rpc("place_order", {
      p_product_ids: [product.id],
      p_pickup_shop_ids: [shop.id],
      p_recipient_name: "Test",
      p_phone: "+21622123456",
      p_governorate_id: null,
      p_city_id: null,
      p_address_line: null,
    });

    await signIn(page, shop.owner.email, "/compte/profil");
    await openDeletion(page);
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Termine ou annule d'abord tes commandes en cours")).toBeVisible();

    const { data: order } = await admin.from("orders").select("id").eq("client_id", client.id).single();
    await seller.rpc("cancel_order", { p_order_id: order!.id, p_reason: "Test" });

    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await page.waitForURL((url) => url.pathname === "/");

    const { data: closed } = await admin.from("shops").select("status").eq("id", shop.id).single();
    expect(closed?.status).toBe("closed");

    expect((await page.goto(`/boutique/${shop.slug}`))?.status()).toBe(404);
    expect((await page.goto(`/produit/${product.id}`))?.status()).toBe(404);

    await maintenance(request);
    await expect.poll(async () => (await fetch(publicUrl("product-images", path))).ok).toBe(false);
  });

  test("un administrateur et un compte suspendu ne peuvent pas se supprimer eux-mêmes", async ({ page }) => {
    const manager = await createAdminUser();

    await signIn(page, manager.email, "/compte/profil");
    await openDeletion(page);
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Ce compte administrateur ne peut pas être suspendu.")).toBeVisible();

    expect((await admin.auth.admin.getUserById(manager.id)).data.user).not.toBeNull();

    const client = await createConfirmedUser("suspendu");
    const supabase = await clientFor(client.email);
    await admin.from("profiles").update({ status: "suspended" }).eq("id", client.id);

    expect((await supabase.rpc("delete_my_account")).error?.message).toBe("forbidden");
  });
});

test.describe("suspension d'une boutique", () => {
  test("publique invisible, vendeur informé, actions refusées, rétablissement", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const manager = await createAdminUser();

    await signIn(page, manager.email, "/admin/boutiques");
    await page.getByRole("listitem").filter({ hasText: shop.name }).getByRole("button", { name: "Suspendre" }).click();
    await page.getByLabel("Motif communiqué à la boutique").fill("Vérification");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect.poll(async () => (await admin.from("shops").select("status").eq("id", shop.id).single()).data?.status).toBe("suspended");

    await page.goto(`/admin/audit?action=shop.suspended&element=${shop.id}`);
    await expect(page.getByText("Par Admin Test")).toBeVisible();
    await expect(page.getByText(/"note":"Vérification"/)).toBeVisible();

    await page.context().clearCookies();
    expect((await page.goto(`/boutique/${shop.slug}`))?.status()).toBe(404);
    expect((await page.goto(`/produit/${product.id}`))?.status()).toBe(404);

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}`);
    await expect(page.getByText("Suspendue", { exact: true })).toBeVisible();

    const seller = await clientFor(shop.owner.email);
    const draft = await seller.rpc("create_video_draft", { p_shop_id: shop.id, p_description: "" });
    expect(draft.error?.message).toBe("forbidden");

    await page.context().clearCookies();
    await signIn(page, manager.email, "/admin/boutiques");
    await page.getByRole("listitem").filter({ hasText: shop.name }).getByRole("button", { name: "Rétablir" }).click();
    await expect.poll(async () => (await admin.from("shops").select("status").eq("id", shop.id).single()).data?.status).toBe("approved");

    expect((await page.goto(`/boutique/${shop.slug}`))?.status()).toBe(200);
  });
});

test.describe("fiabilité et protections", () => {
  test("mon message s'affiche une seule fois, même sans temps réel", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("direct");
    const supabase = await clientFor(client.email);

    const { data: conversationId } = await supabase.rpc("start_conversation", {
      p_shop_id: shop.id,
      p_product_id: null,
      p_request_id: null,
      p_body: "Premier",
    });

    await page.routeWebSocket(/realtime/, (socket) => socket.close());
    await signIn(page, client.email, `/compte/messages/${conversationId}`);

    await page.getByRole("textbox", { name: "Écris ton message" }).fill("Visible sans websocket");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByText("Visible sans websocket")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.getByText("Visible sans websocket")).toBeVisible();
  });

  test("un gestionnaire en ligne injecté ne s'exécute pas, et les en-têtes sont présents", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response!.headers();

    expect(headers["content-security-policy"]).toContain("script-src-attr 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=");

    const fired = await page.evaluate(async () => {
      const target = window as unknown as { injected?: boolean };
      const image = document.createElement("img");
      image.setAttribute("onerror", "window.injected = true");
      image.src = "data:image/png;base64,invalide";
      document.body.append(image);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return target.injected ?? false;
    });

    expect(fired).toBe(false);
  });

  test("les pages personnelles ne sont jamais mises en cache publiquement", async ({ page, request }) => {
    const client = await createConfirmedUser("cache");
    await signIn(page, client.email, "/compte");

    const badges = await request.get("/api/badges");
    expect(badges.headers()["cache-control"]).toContain("no-store");

    const account = await page.goto("/compte/profil");
    expect(account?.headers()["cache-control"] ?? "").not.toContain("public");
  });

  test("le préchargement du pied de page ne lance aucune requête vers les pages légales", async ({ page }) => {
    const prefetched: string[] = [];

    page.on("request", (request) => {
      if (/\/(cgu|cgv|cookies|retours|livraison|support)(\?|$)/.test(request.url())) prefetched.push(request.url());
    });

    await page.goto("/catalogue", { waitUntil: "networkidle" });
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    expect(prefetched).toEqual([]);
  });
});
