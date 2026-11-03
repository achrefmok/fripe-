import { expect, test, type Page } from "@playwright/test";
import { admin, createAdminUser, createConfirmedUser, signIn } from "./helpers";
import { clientFor, createApprovedShop, seedProduct, unique } from "./market-helpers";

// Fabrique une vraie vidéo WebM dans le navigateur : aucun fichier binaire dans le dépôt.
async function makeWebm(page: Page, width: number, height: number, seconds: number) {
  await page.goto("/mentions-legales");

  const base64 = await page.evaluate(
    async ({ width, height, seconds }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));

      recorder.start(100);
      const start = performance.now();

      await new Promise<void>((resolve) => {
        const draw = () => {
          const elapsed = performance.now() - start;
          context.fillStyle = `hsl(${elapsed / 10}, 70%, 50%)`;
          context.fillRect(0, 0, width, height);

          if (elapsed > seconds * 1000) resolve();
          else requestAnimationFrame(draw);
        };

        draw();
      });

      recorder.stop();
      await stopped;

      const buffer = await new Blob(chunks).arrayBuffer();
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },
    { width, height, seconds },
  );

  return Buffer.from(base64, "base64");
}

async function seedVideo(shopId: string, description: string, source: { video: string; thumb: string }) {
  const { data, error } = await admin
    .from("videos")
    .insert({
      shop_id: shopId,
      description,
      video_path: source.video,
      thumbnail_path: source.thumb,
      duration_seconds: 2,
      size_bytes: 1000,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // video_path est unique : chaque ligne reçoit sa propre copie du fichier.
    const copy = `${shopId}/${crypto.randomUUID()}.webm`;
    await admin.storage.from("shop-videos").copy(source.video, copy);
    return seedVideo(shopId, description, { ...source, video: copy });
  }

  return data.id;
}

test.describe("corrections de la phase 2", () => {
  test("les pages refusées répondent en vrai 404", async ({ page, request }) => {
    const victim = await createApprovedShop();
    const intruder = await createApprovedShop();
    const product = await seedProduct(victim.id);
    const client = await createConfirmedUser("quatre");

    expect((await request.get("/produit/00000000-0000-4000-8000-000000000000")).status()).toBe(404);

    await signIn(page, intruder.owner.email);

    for (const path of [
      `/vendeur/boutique/${victim.id}`,
      `/vendeur/boutique/${victim.id}/commandes`,
      `/vendeur/boutique/${intruder.id}/produits/${product.id}`,
      `/vendeur/boutique/${intruder.id}/commandes/00000000-0000-4000-8000-000000000000`,
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }

    await page.context().clearCookies();
    await signIn(page, client.email);

    const response = await page.goto("/compte/commandes/00000000-0000-4000-8000-000000000000");
    expect(response?.status()).toBe(404);
  });

  test("la référence interne n'est visible que par la boutique", async ({ page, request }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);

    const { data } = await admin
      .from("products")
      .select("reference")
      .eq("id", product.id)
      .single();
    const reference = data!.reference;

    const anon = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=reference&limit=1`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } },
    );
    expect(anon.ok()).toBe(false);

    await page.goto(`/produit/${product.id}`);
    expect(await page.content()).not.toContain(reference);

    await page.goto(`/catalogue?q=${reference}`);
    await expect(page.getByRole("heading", { name: /Rien ne correspond/ })).toBeVisible();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits?onglet=published&q=${reference}`);
    await expect(page.getByText(reference)).toBeVisible();
  });

  test("la durée de réservation suit le réglage", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const client = await createConfirmedUser("duree");

    await admin.from("platform_settings").update({ value: 90 }).eq("key", "reservation_ttl_minutes");

    try {
      await signIn(page, client.email, `/produit/${product.id}`);
      await expect(page.getByText(/gardée pendant 1\sheure 30\sminutes/)).toBeVisible();
    } finally {
      await admin.from("platform_settings").update({ value: 120 }).eq("key", "reservation_ttl_minutes");
    }
  });

  test("une pièce commandée est réservée, puis vendue à la livraison", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const client = await createConfirmedUser("statut");

    await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });
    await signIn(page, client.email, "/commande");
    await page.getByLabel("Téléphone").fill("22123456");
    await page.getByLabel("Retrait en boutique").check();
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();

    await page.goto(`/produit/${product.id}`);
    await expect(page.getByText("Quelqu'un l'a réservée")).toBeVisible();

    const { data: order } = await admin.from("orders").select("id").eq("client_id", client.id).single();
    await page.context().clearCookies();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/commandes/${order!.id}`);
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await page.getByRole("button", { name: "Lancer la préparation" }).click();
    await page.getByRole("button", { name: "Marquer livrée" }).click();
    await expect(page.getByText("Livrée", { exact: true })).toBeVisible();

    await page.goto(`/produit/${product.id}`);
    await expect(page.getByText("Cette pièce a trouvé preneur")).toBeVisible();
  });

  test("tarif de livraison propre à un gouvernorat", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id, { price: 30000 });
    const client = await createConfirmedUser("tarif");

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/reglages`);
    await page.getByLabel("Frais de livraison (DT)").fill("9");
    await page.getByText("Tarifs par gouvernorat").click();
    await page.getByLabel("Tunis", { exact: true }).fill("4,500");
    await page.getByRole("button", { name: "Enregistrer" }).last().click();
    await expect(page.getByText("Frais enregistrés")).toBeVisible();
    await page.context().clearCookies();

    await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });
    await signIn(page, client.email, "/commande");

    await page.getByLabel("Gouvernorat").selectOption({ label: "Sfax" });
    await expect(page.getByText("9 DT", { exact: true })).toBeVisible();

    await page.getByLabel("Gouvernorat").selectOption({ label: "Tunis" });
    await expect(page.getByText("4,500 DT", { exact: true })).toBeVisible();
    await expect(page.getByText("34,500 DT", { exact: true })).toBeVisible();
  });
});

test.describe("Fripe Walk", () => {
  test.describe.configure({ timeout: 120_000 });

  test("upload, compression, miniature, association à une pièce, lecture", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id, { title: `Vue ${unique("v")}` });
    const video = await makeWebm(page, 1920, 1080, 2);

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/videos`);
    await page.getByLabel("Description").fill("Nouveaux arrivages de vestes");
    await page.getByLabel("Choisir une vidéo").setInputFiles({ name: "a.webm", mimeType: "video/webm", buffer: video });

    await expect(page.getByText("Vidéo publiée", { exact: true })).toBeVisible({ timeout: 60_000 });

    const { data: row } = await admin
      .from("videos")
      .select("id, video_path, thumbnail_path, width, height, size_bytes, duration_seconds, status")
      .eq("shop_id", shop.id)
      .single();

    expect(row?.status).toBe("published");
    expect(Math.max(row!.width!, row!.height!)).toBeLessThanOrEqual(1280);
    expect(row?.duration_seconds).toBeGreaterThanOrEqual(1);

    await page.getByText(/Pièces associées/).click();
    await page.getByRole("checkbox", { name: new RegExp(product.title!) }).check();
    await page.getByRole("button", { name: "Enregistrer les pièces" }).click();
    await expect(page.getByText("Pièces associées", { exact: true })).toBeVisible();

    await page.context().clearCookies();
    await page.goto(`/walk?v=${row!.id}`);

    const player = page.locator('[data-active="true"] video');
    await expect(player).toHaveAttribute("src", /shop-videos/);
    await expect(player).toHaveAttribute("poster", /thumbnail\.jpg/);
    await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime), {
      timeout: 15_000,
    }).toBeGreaterThan(0);

    await page.getByRole("button", { name: "1 pièce" }).first().click();
    await page.getByRole("link", { name: new RegExp(product.title!) }).click();
    await expect(page.getByRole("heading", { name: product.title! })).toBeVisible();
  });

  test("le fil ne charge que la vidéo visible et ses voisines, et pagine", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("walk");
    const video = await makeWebm(page, 360, 640, 1);

    const path = `${shop.id}/source/video.webm`;
    const thumb = `${shop.id}/source/thumbnail.jpg`;
    await admin.storage.from("shop-videos").upload(path, video, { contentType: "video/webm" });
    await admin.storage.from("shop-videos").upload(thumb, Buffer.from([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" });

    const ids: string[] = [];

    for (let index = 0; index < 8; index += 1) {
      ids.push(await seedVideo(shop.id, `Clip ${index}`, { video: path, thumb }));
    }

    await signIn(page, client.email, "/walk");

    const feed = page.getByTestId("walk-feed");
    await expect(feed.locator("video").first()).toBeVisible();
    await expect(feed.locator("video[src]")).toHaveCount(2);

    const slides = await feed.locator("section").count();
    expect(slides).toBeLessThanOrEqual(6);

    for (let index = 0; index < 5; index += 1) {
      await feed.evaluate((element) => element.scrollBy({ top: element.clientHeight }));
      await page.waitForTimeout(400);
    }

    await expect.poll(() => feed.locator("section").count()).toBeGreaterThan(slides);
    expect(await feed.locator("video[src]").count()).toBeLessThanOrEqual(3);

    const playing = await feed.locator("video").evaluateAll(
      (elements) => (elements as HTMLVideoElement[]).filter((element) => !element.paused).length,
    );
    expect(playing).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Ajouter la vidéo aux favoris" }).first().click();
    await expect(page.getByRole("button", { name: "Retirer la vidéo des favoris" }).first()).toBeVisible();

    const { count } = await admin
      .from("video_favorites")
      .select("video_id", { count: "exact", head: true })
      .eq("user_id", client.id);
    expect(count).toBe(1);
  });

  test("un fichier déguisé en vidéo est refusé", async ({ page }) => {
    const shop = await createApprovedShop();
    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/videos`);

    await page.getByLabel("Choisir une vidéo").setInputFiles({
      name: "faux.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("<html>pas une video</html>"),
    });

    await expect(page.getByText("Cette vidéo n'est pas lisible")).toBeVisible();

    const { count } = await admin.from("videos").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
    expect(count).toBe(0);
  });

  test("un chemin modifié avant l'appel de l'action serveur est refusé", async ({ page }) => {
    const shop = await createApprovedShop();
    const video = await makeWebm(page, 640, 360, 1);
    let tampered = false;

    await page.route(`**/vendeur/boutique/${shop.id}/videos`, async (route) => {
      const body = route.request().postData();

      if (route.request().method() === "POST" && body?.includes("videoPath")) {
        tampered = true;
        await route.continue({ postData: body.replace("/video.webm", "/../../autre/video.webm") });
      } else {
        await route.continue();
      }
    });

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/videos`);
    await page.getByLabel("Choisir une vidéo").setInputFiles({ name: "a.webm", mimeType: "video/webm", buffer: video });

    await expect(page.getByText("Tu n'as pas les droits pour cette action.")).toBeVisible({ timeout: 60_000 });
    expect(tampered).toBe(true);

    const { data } = await admin.from("videos").select("status, video_path").eq("shop_id", shop.id).single();
    expect(data).toEqual({ status: "draft", video_path: null });
  });
});

test("suivi : abonnement, compteur, arrivages, désabonnement", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Arrivage ${unique("a")}` });
  const client = await createConfirmedUser("suit");

  await signIn(page, client.email, `/boutique/${shop.slug}`);
  await expect(page.getByText("Aucun abonné")).toBeVisible();
  await page.getByRole("button", { name: "Suivre" }).click();
  await expect(page.getByText("1 abonné")).toBeVisible();

  await page.goto("/compte/suivis");
  await expect(page.getByRole("link", { name: new RegExp(product.title!) })).toBeVisible();

  await page.goto(`/boutique/${shop.slug}`);
  await page.getByRole("button", { name: "Suivie" }).click();
  await expect(page.getByText("Aucun abonné")).toBeVisible();

  await page.goto("/compte/suivis");
  await expect(page.getByRole("heading", { name: "Tu ne suis aucune boutique" })).toBeVisible();
});

test.describe("messagerie", () => {
  test("échange en temps réel, non-lus, historique et isolation", async ({ page, browser }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id, { title: `Sujet ${unique("m")}` });
    const client = await createConfirmedUser("cli", "Client Message");
    const stranger = await createConfirmedUser("etranger");

    await signIn(page, client.email, `/produit/${product.id}`);
    await page.getByRole("button", { name: "Contacter la boutique" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Bonjour, encore disponible ?");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();

    await expect(page).toHaveURL(/compte\/messages\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Bonjour, encore disponible ?")).toBeVisible();
    await expect(page.getByRole("link", { name: product.title! })).toBeVisible();

    const conversationId = page.url().split("/").pop()!;

    const sellerContext = await browser.newContext({ viewport: { width: 412, height: 800 } });
    const seller = await sellerContext.newPage();
    await signIn(seller, shop.owner.email, `/vendeur/boutique/${shop.id}/messages`);
    await expect(seller.getByText("1 non lu")).toBeVisible();

    await seller.getByRole("link", { name: /Client Message/ }).click();
    await expect(seller.getByText("Bonjour, encore disponible ?")).toBeVisible();

    await page.waitForTimeout(1500);

    await seller.getByRole("textbox", { name: "Écris ton message" }).fill("Oui, toujours là");
    await seller.getByRole("button", { name: "Envoyer" }).click();

    // Le client n'a rien rechargé : le message arrive par le temps réel.
    await expect(page.getByText("Oui, toujours là")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("textbox", { name: "Écris ton message" }).fill("Je passe demain");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(seller.getByText("Je passe demain")).toBeVisible({ timeout: 10_000 });

    await seller.goto(`/vendeur/boutique/${shop.id}/messages`);
    await expect(seller.getByText("1 non lu")).toHaveCount(0);
    await sellerContext.close();

    await page.reload();
    await expect(page.getByText("Oui, toujours là")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, stranger.email);

    const refused = await page.goto(`/compte/messages/${conversationId}`);
    expect(refused?.status()).toBe(404);
    expect(await page.content()).not.toContain("Bonjour, encore");
  });

  test("blocage, fermeture de l'envoi, et limitation du spam", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("bloc");
    const supabase = await clientFor(client.email);

    const { data: conversationId, error } = await supabase.rpc("start_conversation", {
      p_shop_id: shop.id,
      p_product_id: null,
      p_request_id: null,
      p_body: "Premier message",
    });
    expect(error).toBeNull();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/messages/${conversationId}`);
    await page.getByRole("button", { name: "Bloquer" }).click();
    await expect(page.getByText("Cette conversation est bloquée.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Écris ton message" })).toHaveCount(0);

    const blocked = await supabase.rpc("send_message", { p_conversation_id: conversationId, p_body: "Encore" });
    expect(blocked.error?.message).toBe("blocked");

    await page.getByRole("button", { name: "Débloquer" }).click();
    await expect(page.getByRole("textbox", { name: "Écris ton message" })).toBeVisible();

    const results = [];

    for (let index = 0; index < 60; index += 1) {
      results.push(await supabase.rpc("send_message", { p_conversation_id: conversationId, p_body: `m${index}` }));
    }

    expect(results.at(-1)?.error?.message).toBe("rate_limited");
  });

  test("le vendeur contacte le client depuis une demande d'article", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("dem", "Client Demande");
    const supabase = await clientFor(client.email);

    await supabase.rpc("create_stock_request", {
      p_shop_id: shop.id,
      p_category_id: null,
      p_size: "L",
      p_color: "",
      p_brand: "",
      p_budget_millimes: 0,
      p_message: "Une veste noire",
    });

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/demandes`);
    await page.getByRole("button", { name: "Contacter le client" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Quelle longueur de manche ?");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(page).toHaveURL(/messages\/[0-9a-f-]{36}$/);
    await page.context().clearCookies();

    await signIn(page, client.email, "/compte/messages");
    await expect(page.getByText("1 non lu")).toBeVisible();
  });
});

test("AI Stylist : tenues réelles dans le budget, jamais de pièce inventée", async ({ page }) => {
  const shop = await createApprovedShop();
  const size = unique("T").slice(0, 12);
  const top = await seedProduct(shop.id, { title: `Sweat stylist ${unique("s")}`, size, price: 30000, categorySlug: "pulls-sweats" });
  const bottom = await seedProduct(shop.id, { title: `Jean stylist ${unique("j")}`, size, price: 25000, categorySlug: "jeans" });
  const expensive = await seedProduct(shop.id, { title: `Cher ${unique("c")}`, size, price: 90000, categorySlug: "jeans" });

  await page.goto("/stylist");
  await expect(page.getByText("pas sur un modèle d'intelligence artificielle")).toBeVisible();

  await page.getByLabel("Budget (DT)").fill("60");
  await page.getByLabel("Taille", { exact: true }).fill(size);
  await page.getByLabel("Style").selectOption({ label: "Streetwear" });
  await page.getByRole("button", { name: "Composer mes tenues" }).click();

  await expect(page.getByRole("heading", { name: "Tenue 1" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(top.title!) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(bottom.title!) })).toBeVisible();
  await expect(page.getByText("55 DT", { exact: true })).toBeVisible();
  await expect(page.getByText(expensive.title!)).toHaveCount(0);

  await page.getByLabel("Budget (DT)").fill("10");
  await page.getByRole("button", { name: "Composer mes tenues" }).click();
  await expect(page.getByText("Aucune tenue possible")).toBeVisible();
});

test("Outfit Builder : prix, budget, remplacement, moins chère, sauvegarde, partage, panier", async ({ page }) => {
  const shop = await createApprovedShop();
  const token = unique("o");
  const top = await seedProduct(shop.id, { title: `Haut ${token}`, price: 40000, categorySlug: "t-shirts" });
  const cheapTop = await seedProduct(shop.id, { title: `Hautbis ${token}`, price: 15000, categorySlug: "t-shirts" });
  const bottom = await seedProduct(shop.id, { title: `Bas ${token}`, price: 35000, categorySlug: "pantalons" });
  const client = await createConfirmedUser("tenue");

  await signIn(page, client.email, "/tenues/nouvelle");

  await page.getByRole("button", { name: "Choisir Haut" }).click();
  await page.getByRole("textbox", { name: "Rechercher une pièce" }).fill(`Haut ${token}`);
  await page.getByRole("button", { name: "Voir" }).click();
  await page.getByRole("button", { name: new RegExp(top.title!) }).click();
  await expect(page.getByTestId("outfit-total")).toHaveText("40 DT");

  await page.getByRole("button", { name: "Choisir Bas" }).click();
  await page.getByRole("textbox", { name: "Rechercher une pièce" }).fill(`Bas ${token}`);
  await page.getByRole("button", { name: "Voir" }).click();
  await page.getByRole("button", { name: new RegExp(bottom.title!) }).click();
  await expect(page.getByTestId("outfit-total")).toHaveText("75 DT");

  await page.getByLabel("Budget (DT)").fill("70");
  await expect(page.getByText("Cette tenue dépasse ton budget.")).toBeVisible();

  await page.getByRole("button", { name: "Remplacer Haut" }).click();
  await page.getByRole("textbox", { name: "Rechercher une pièce" }).fill(`Hautbis ${token}`);
  await page.getByRole("button", { name: "Voir" }).click();
  await page.getByRole("button", { name: new RegExp(cheapTop.title!) }).click();
  await expect(page.getByTestId("outfit-total")).toHaveText("50 DT");
  await expect(page.getByText("Cette tenue dépasse ton budget.")).toHaveCount(0);

  await page.getByRole("button", { name: "Remplacer Haut" }).click();
  await page.getByRole("textbox", { name: "Rechercher une pièce" }).fill(`Haut ${token}`);
  await page.getByRole("button", { name: "Voir" }).click();
  await page.getByRole("button", { name: new RegExp(`^${top.title}`) }).click();
  await expect(page.getByTestId("outfit-total")).toHaveText("75 DT");

  await page.getByRole("button", { name: "Trouver une tenue similaire moins chère" }).click();
  await expect(page.getByText("25 DT d'économie")).toBeVisible();
  await expect(page.getByTestId("outfit-total")).toHaveText("50 DT");

  await page.getByLabel("Nom de la tenue").fill("Tenue d'été");
  await page.getByLabel("Partageable par lien").check();
  await page.getByRole("button", { name: "Enregistrer la tenue" }).click();
  await expect(page).toHaveURL(/tenues\/[0-9a-f-]{36}$/);

  const shared = page.url();

  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  await expect(page.getByText("Pièces disponibles ajoutées au panier")).toBeVisible();

  const { count } = await admin
    .from("cart_items")
    .select("product_id", { count: "exact", head: true })
    .eq("user_id", client.id);
  expect(count).toBe(2);

  await page.context().clearCookies();
  await page.goto(shared);
  await expect(page.getByRole("heading", { name: "Tenue d'été" })).toBeVisible();
  await expect(page.getByText("50 DT", { exact: true })).toBeVisible();

  await admin.from("products").update({ status: "sold" }).eq("id", cheapTop.id);
  await page.reload();
  await expect(page.getByText(`Plus disponibles : ${cheapTop.title}`.replace(" ", " "))).toBeVisible();
});

test("Drop Alert : notification interne, badge, pause, sans doublon", async ({ page }) => {
  const shop = await createApprovedShop();
  const brand = unique("Alerte");
  const client = await createConfirmedUser("drop");

  await signIn(page, client.email, "/compte/alertes");
  await page.getByLabel("Nom de l'alerte").fill("Mes vestes");
  await page.getByLabel("Marques").fill(brand.toUpperCase());
  await page.getByLabel("Budget maximum (DT)").fill("50");
  await page.getByRole("button", { name: "Créer une alerte" }).click();
  await expect(page.getByText("Alerte enregistrée")).toBeVisible();

  const owner = await clientFor(shop.owner.email);

  const publish = async (price: number) => {
    const { data } = await admin
      .from("products")
      .insert({
        shop_id: shop.id,
        reference: "",
        title: `Drop ${unique("d")}`,
        brand,
        condition: "good",
        price_millimes: price,
        category_id: (await admin.from("categories").select("id").eq("slug", "jeans").single()).data!.id,
      })
      .select("id, title")
      .single();

    await admin.from("product_images").insert({ product_id: data!.id, path: `${shop.id}/${data!.id}/a.png` });
    await owner.rpc("set_products_publication", { p_product_ids: [data!.id], p_status: "published" });

    return data!;
  };

  const match = await publish(30000);
  await publish(90000);

  await page.goto("/compte/notifications");
  await expect(page.getByText(match.title)).toBeVisible();
  await expect(page.getByTestId("account-badge")).toBeVisible();

  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", client.id);
  expect(count).toBe(1);

  await page.getByRole("button", { name: "Tout marquer comme lu" }).click();
  await expect(page.getByRole("button", { name: "Tout marquer comme lu" })).toHaveCount(0);
  await page.goto("/compte/alertes");
  await expect(page.getByTestId("account-badge")).toHaveCount(0);

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  // Le bouton « Mettre en pause » contient lui-même « en pause » : on attend que la pause soit enregistrée.
  await expect(page.getByRole("button", { name: "Réactiver" })).toBeVisible();
  await expect(page.getByText(/· en pause/)).toBeVisible();

  await publish(20000);

  const { count: after } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", client.id);
  expect(after).toBe(1);
});

test("modération : signalements, décision admin, historique, permissions", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Douteux ${unique("x")}` });
  const reporter = await createConfirmedUser("signale");
  const supabase = await clientFor(reporter.email);

  await signIn(page, reporter.email, `/produit/${product.id}`);
  await page.getByRole("button", { name: "Signaler" }).click();
  await page.getByLabel("Motif").selectOption({ label: "Contrefaçon" });
  await page.getByLabel(/Précisions/).fill("Logo faux");
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Signalement envoyé")).toBeVisible();

  const { data: conversationId } = await supabase.rpc("start_conversation", {
    p_shop_id: shop.id,
    p_product_id: null,
    p_request_id: null,
    p_body: "Message signalé",
  });

  await page.goto(`/compte/messages/${conversationId}`);
  await page.getByRole("button", { name: "Signaler" }).click();
  await page.getByLabel("Motif").selectOption({ label: "Harcèlement" });
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Signalement envoyé")).toBeVisible();

  const denied = await page.goto("/admin/signalements");
  expect(denied?.status()).toBe(404);
  await page.context().clearCookies();

  const manager = await createAdminUser();
  await signIn(page, manager.email, "/admin/signalements");

  const productRow = page.getByRole("listitem").filter({ hasText: product.title! });
  await expect(productRow.getByText("Logo faux")).toBeVisible();
  await productRow.getByRole("button", { name: "Retirer le contenu" }).click();
  const productNote = `Contrefaçon confirmée ${unique("n")}`;
  await page.getByLabel("Motif de la décision").fill(productNote);
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Décision enregistrée")).toBeVisible();

  const conversationRow = page.getByRole("listitem").filter({ hasText: "Message signalé" });
  await conversationRow.getByRole("button", { name: "Retirer le contenu" }).click();
  const conversationNote = `Propos inacceptables ${unique("n")}`;
  await page.getByLabel("Motif de la décision").fill(conversationNote);
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByText(productNote)).toBeVisible();
  await expect(page.getByText(conversationNote)).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByText("report.remove_content", { exact: true }).first()).toBeVisible();
  await page.context().clearCookies();

  const removed = await page.goto(`/produit/${product.id}`);
  expect(removed?.status()).toBe(404);

  await signIn(page, reporter.email, `/compte/messages/${conversationId}`);
  await expect(page.getByText("fermée par la modération")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Écris ton message" })).toHaveCount(0);
});

test("textes extrêmes : aucune page ne déborde et les actions restent cliquables", async ({ page }) => {
  const shop = await createApprovedShop();
  const long = "x".repeat(78);
  const size = unique("L").slice(0, 12);

  await admin.from("shops").update({ name: long }).eq("id", shop.id);

  const top = await seedProduct(shop.id, { title: "T".repeat(120), brand: "B".repeat(60), size, price: 10000, categorySlug: "t-shirts" });
  const bottom = await seedProduct(shop.id, { title: "J".repeat(120), brand: "C".repeat(60), size, price: 10000, categorySlug: "jeans" });
  const client = await createConfirmedUser("extreme");
  const supabase = await clientFor(client.email);

  const { data: conversationId } = await supabase.rpc("start_conversation", {
    p_shop_id: shop.id,
    p_product_id: top.id,
    p_request_id: null,
    p_body: "m".repeat(1000),
  });

  await supabase.rpc("create_stock_request", {
    p_shop_id: shop.id,
    p_category_id: null,
    p_size: "",
    p_color: "",
    p_brand: "",
    p_budget_millimes: 0,
    p_message: "d".repeat(500),
  });

  const { data: outfitId } = await supabase.rpc("save_outfit", {
    p_outfit_id: null,
    p_name: "Tenue longue",
    p_budget_millimes: null,
    p_is_public: true,
    p_items: [
      { slot: "top", product_id: top.id },
      { slot: "bottom", product_id: bottom.id },
    ],
  });

  const expectNoOverflow = async (path: string) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect.soft(overflow, path).toBeLessThanOrEqual(0);
  };

  await signIn(page, client.email, "/stylist");
  await page.getByLabel("Budget (DT)").fill("30");
  await page.getByLabel("Taille", { exact: true }).fill(size);
  await page.getByRole("button", { name: "Composer mes tenues" }).click();
  await expect(page.getByRole("heading", { name: "Tenue 1" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Tout ajouter au panier" }).click();
  await expect(page.getByText("Pièces ajoutées au panier")).toBeVisible();

  for (const path of [
    "/panier",
    "/commande",
    "/compte/messages",
    `/compte/messages/${conversationId}`,
    "/compte/demandes",
    `/tenues/${outfitId}`,
    `/tenues/nouvelle?pieces=${top.id},${bottom.id}`,
    `/produit/${top.id}`,
    `/boutique/${shop.slug}`,
    `/ar/compte/messages/${conversationId}`,
    "/ar/panier",
  ]) {
    await expectNoOverflow(path);
  }

  await page.context().clearCookies();
  await signIn(page, shop.owner.email);

  for (const path of [
    `/vendeur/boutique/${shop.id}/demandes`,
    `/vendeur/boutique/${shop.id}/messages`,
    `/vendeur/boutique/${shop.id}/messages/${conversationId}`,
    `/vendeur/boutique/${shop.id}/produits?onglet=published`,
    `/vendeur/boutique/${shop.id}/videos`,
  ]) {
    await expectNoOverflow(path);
  }
});

test("interfaces mobiles et arabes de la phase 3", async ({ page }) => {
  const shop = await createApprovedShop();
  const client = await createConfirmedUser("mobile3");
  const supabase = await clientFor(client.email);

  const { data: conversationId } = await supabase.rpc("start_conversation", {
    p_shop_id: shop.id,
    p_product_id: null,
    p_request_id: null,
    p_body: "Message au titre assez long pour tester le retour à la ligne sur téléphone",
  });

  const expectNoOverflow = async (paths: string[]) => {
    for (const path of paths) {
      await page.goto(path, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect.soft(overflow, path).toBeLessThanOrEqual(0);
    }
  };

  const publicPaths = ["/walk", "/stylist", "/tenues/nouvelle"];
  await expectNoOverflow(publicPaths);
  await expectNoOverflow(publicPaths.map((path) => `/ar${path}`));

  await signIn(page, client.email);

  const clientPaths = [
    "/compte/messages",
    `/compte/messages/${conversationId}`,
    "/compte/alertes",
    "/compte/notifications",
    "/compte/suivis",
    "/tenues",
  ];
  await expectNoOverflow(clientPaths);
  await expectNoOverflow(clientPaths.map((path) => `/ar${path}`));

  await page.goto("/ar/compte/alertes");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "إنشاء تنبيه" })).toBeVisible();

  await page.goto(`/ar/compte/messages/${conversationId}`);
  await expect(page.getByRole("button", { name: "إبلاغ" })).toBeVisible();

  await page.goto("/ar/stylist");
  await expect(page.getByText("ليس على نموذج ذكاء اصطناعي")).toBeVisible();
  await page.getByLabel("الميزانية (د.ت)").fill("10");
  await page.getByRole("button", { name: "تركيب إطلالاتي" }).click();
  await expect(page.getByText("لا توجد إطلالة ممكنة")).toBeVisible();

  await page.goto("/ar/tenues/nouvelle");
  await expect(page.getByText("الجزء العلوي")).toBeVisible();
});
