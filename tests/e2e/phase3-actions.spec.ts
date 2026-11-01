import { expect, test } from "@playwright/test";
import { admin, createAdminUser, createConfirmedUser, signIn } from "./helpers";
import { clientFor, createApprovedShop, seedProduct, unique } from "./market-helpers";

async function publishedVideo(shopId: string, description: string) {
  const id = crypto.randomUUID();
  const path = `${shopId}/${id}/video.webm`;
  const thumb = `${shopId}/${id}/thumbnail.jpg`;

  await admin.storage.from("shop-videos").upload(path, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), { contentType: "video/webm" });
  await admin.storage.from("shop-videos").upload(thumb, Buffer.from([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" });

  const { error } = await admin.from("videos").insert({
    id,
    shop_id: shopId,
    description,
    video_path: path,
    thumbnail_path: thumb,
    duration_seconds: 5,
    size_bytes: 4,
    status: "published",
    published_at: new Date().toISOString(),
  });

  if (error) throw error;
  return { id, path, thumb };
}

test("temps réel : un inconnu ne reçoit aucun message d'une conversation privée", async () => {
  const shop = await createApprovedShop();
  const client = await createConfirmedUser("rt-client");
  const stranger = await createConfirmedUser("rt-inconnu");
  const clientDb = await clientFor(client.email);
  const strangerDb = await clientFor(stranger.email);
  const ownerDb = await clientFor(shop.owner.email);

  const { data: conversationId } = await clientDb.rpc("start_conversation", {
    p_shop_id: shop.id,
    p_product_id: null,
    p_request_id: null,
    p_body: "Bonjour",
  });

  const listen = async (db: typeof clientDb, name: string) => {
    const received: string[] = [];
    const { data } = await db.auth.getSession();
    db.realtime.setAuth(data.session!.access_token);

    await new Promise<void>((resolve) => {
      db.channel(name)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => received.push((payload.new as { body: string }).body),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
        });
    });

    return received;
  };

  const legitimate = await listen(clientDb, `a-${conversationId}`);
  const intruder = await listen(strangerDb, `b-${conversationId}`);

  // « SUBSCRIBED » précède l'activation réelle du flux : on envoie jusqu'à ce que le participant
  // reçoive, puis une dernière fois pour vérifier l'inconnu sur un canal forcément actif.
  await expect
    .poll(
      async () => {
        await ownerDb.rpc("send_message", { p_conversation_id: conversationId, p_body: "Secret" });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return legitimate.length;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  const count = legitimate.length;
  await ownerDb.rpc("send_message", { p_conversation_id: conversationId, p_body: "Secret" });
  await expect.poll(() => legitimate.length, { timeout: 10_000 }).toBeGreaterThan(count);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  expect(intruder).toEqual([]);

  await clientDb.removeAllChannels();
  await strangerDb.removeAllChannels();
});

test("vidéo : signalement, retrait par l'administrateur, disparition du fil", async ({ page }) => {
  const shop = await createApprovedShop();
  const description = `Signalee ${unique("v")}`;
  const video = await publishedVideo(shop.id, description);
  const reporter = await createConfirmedUser("video-report");

  await signIn(page, reporter.email, `/walk?v=${video.id}`);
  await page.locator('[data-active="true"]').getByRole("button", { name: "Signaler" }).click();
  await page.getByLabel("Motif").selectOption({ label: "Contenu inapproprié" });
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Signalement envoyé")).toBeVisible();
  await page.context().clearCookies();

  const manager = await createAdminUser();
  await signIn(page, manager.email, "/admin/signalements");
  const row = page.getByRole("listitem").filter({ hasText: description });
  await row.getByRole("button", { name: "Retirer le contenu" }).click();
  await page.getByLabel("Motif de la décision").fill("Contenu hors charte");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Décision enregistrée")).toBeVisible();
  await page.context().clearCookies();

  await page.goto(`/walk?v=${video.id}`);
  expect(await page.content()).not.toContain(description);

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/videos`);
  await expect(page.getByText("Retirée par la modération")).toBeVisible();
  await expect(page.getByRole("button", { name: "Republier" })).toHaveCount(0);
});

test("vidéo : dépublication, republication, suppression du fichier", async ({ page }) => {
  const shop = await createApprovedShop();
  const description = `Gestion ${unique("g")}`;
  const video = await publishedVideo(shop.id, description);

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/videos`);

  await page.getByRole("button", { name: "Dépublier" }).click();
  await expect(page.getByRole("button", { name: "Republier" })).toBeVisible();

  const hidden = await clientFor(shop.owner.email);
  expect((await hidden.from("videos").select("status").eq("id", video.id).single()).data?.status).toBe("archived");

  await page.getByRole("button", { name: "Republier" }).click();
  await expect(page.getByRole("button", { name: "Dépublier" })).toBeVisible();

  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Aucune vidéo publiée.")).toBeVisible();

  const { count } = await admin.from("videos").select("id", { count: "exact", head: true }).eq("id", video.id);
  expect(count).toBe(0);

  const { data: files } = await admin.storage.from("shop-videos").list(`${shop.id}/${video.id}`);
  expect(files).toEqual([]);
});

test("partage d'une vidéo et d'une tenue", async ({ page, context }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { categorySlug: "t-shirts" });
  const video = await publishedVideo(shop.id, `Partage ${unique("p")}`);
  const client = await createConfirmedUser("partage");
  const supabase = await clientFor(client.email);

  const { data: outfitId } = await supabase.rpc("save_outfit", {
    p_outfit_id: null,
    p_name: "Tenue partagée",
    p_budget_millimes: null,
    p_is_public: true,
    p_items: [{ slot: "top", product_id: product.id }],
  });

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });

  await page.goto(`/walk?v=${video.id}`);
  await page.locator('[data-active="true"]').getByRole("button", { name: "Partager la vidéo" }).click();
  await expect(page.getByText("Lien copié")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/walk?v=${video.id}`);

  await page.goto(`/tenues/${outfitId}`);
  await page.getByRole("button", { name: "Partager" }).click();
  await expect(page.getByText("Lien copié")).toBeVisible();
});

test("une tenue privée n'est lisible que par son auteur", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { categorySlug: "t-shirts" });
  const owner = await createConfirmedUser("prive");
  const supabase = await clientFor(owner.email);

  const { data: outfitId } = await supabase.rpc("save_outfit", {
    p_outfit_id: null,
    p_name: "Tenue secrète",
    p_budget_millimes: null,
    p_is_public: false,
    p_items: [{ slot: "top", product_id: product.id }],
  });

  const response = await page.goto(`/tenues/${outfitId}`);
  expect(response?.status()).toBe(404);

  await signIn(page, owner.email, `/tenues/${outfitId}`);
  await expect(page.getByRole("heading", { name: "Tenue secrète" })).toBeVisible();

  await page.goto("/tenues");
  await expect(page.getByRole("link", { name: /Tenue secrète/ })).toBeVisible();

  await page.goto(`/tenues/${outfitId}`);
  await page.getByRole("button", { name: "Supprimer la tenue" }).click();
  await expect(page).toHaveURL(/\/tenues$/);
  await expect(page.getByRole("heading", { name: "Aucune tenue" })).toBeVisible();
});

test("AI Stylist : ajout au panier et préférences enregistrées", async ({ page }) => {
  const shop = await createApprovedShop();
  const size = unique("P").slice(0, 12);
  const top = await seedProduct(shop.id, { title: `Top ${unique("t")}`, size, price: 20000, categorySlug: "t-shirts" });
  const bottom = await seedProduct(shop.id, { title: `Bas ${unique("b")}`, size, price: 20000, categorySlug: "jeans" });
  const client = await createConfirmedUser("stylist");

  await signIn(page, client.email, "/stylist");
  await page.getByLabel("Budget (DT)").fill("50");
  await page.getByLabel("Taille", { exact: true }).fill(size);
  await page.getByLabel("Noir").check();
  await page.getByRole("button", { name: "Composer mes tenues" }).click();
  await page.getByRole("button", { name: "Tout ajouter au panier" }).click();
  await expect(page.getByText("Pièces ajoutées au panier")).toBeVisible();

  const { data: cart } = await admin.from("cart_items").select("product_id").eq("user_id", client.id);
  expect(cart?.map((row) => row.product_id).sort()).toEqual([top.id, bottom.id].sort());

  const { data: preferences } = await admin
    .from("style_preferences")
    .select("size, colors, budget_millimes")
    .eq("user_id", client.id)
    .single();

  expect(preferences).toEqual({ size, colors: ["noir"], budget_millimes: 50000 });
});

test("préférences : couper les notifications internes les arrête réellement", async ({ page }) => {
  const shop = await createApprovedShop();
  const brand = unique("Pref");
  const client = await createConfirmedUser("prefs");
  const owner = await clientFor(shop.owner.email);

  await admin.from("drop_alerts").insert({ user_id: client.id, name: "Toutes", brands: [brand] });

  await signIn(page, client.email, "/compte/notifications");
  await page.getByLabel("Recevoir les notifications dans l'application").uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées")).toBeVisible();

  const { data: draft } = await admin
    .from("products")
    .insert({
      shop_id: shop.id,
      reference: "",
      title: "Sans notification",
      brand,
      condition: "good",
      price_millimes: 10000,
      category_id: (await admin.from("categories").select("id").eq("slug", "jeans").single()).data!.id,
    })
    .select("id")
    .single();

  await admin.from("product_images").insert({ product_id: draft!.id, path: `${shop.id}/${draft!.id}/a.png` });
  await owner.rpc("set_products_publication", { p_product_ids: [draft!.id], p_status: "published" });

  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", client.id);

  expect(count).toBe(0);
});

test("alertes : une alerte par boutique suivie et un anonyme sans accès", async ({ page, request }) => {
  const followed = await createApprovedShop();
  const other = await createApprovedShop();
  const client = await createConfirmedUser("suivie");
  const brand = unique("Suiv");

  await admin.from("shop_followers").insert({ user_id: client.id, shop_id: followed.id });
  await signIn(page, client.email, "/compte/alertes");

  await page.getByLabel("Nom de l'alerte").fill("Mes boutiques");
  await page.getByLabel("Marques").fill(brand);
  await page.getByLabel("Uniquement les boutiques que je suis").check();
  await page.getByRole("button", { name: "Créer une alerte" }).click();
  await expect(page.getByText("Alerte enregistrée")).toBeVisible();

  const publish = async (shop: { id: string; owner: { email: string } }) => {
    const db = await clientFor(shop.owner.email);
    const { data } = await admin
      .from("products")
      .insert({
        shop_id: shop.id,
        reference: "",
        title: "Pièce",
        brand,
        condition: "good",
        price_millimes: 10000,
        category_id: (await admin.from("categories").select("id").eq("slug", "jeans").single()).data!.id,
      })
      .select("id")
      .single();

    await admin.from("product_images").insert({ product_id: data!.id, path: `${shop.id}/${data!.id}/a.png` });
    await db.rpc("set_products_publication", { p_product_ids: [data!.id], p_status: "published" });
    return data!.id;
  };

  const expected = await publish(followed);
  await publish(other);

  const { data } = await admin.from("notifications").select("product_id").eq("user_id", client.id);
  expect(data).toEqual([{ product_id: expected }]);

  const anonymous = await request.get("/api/badges");
  expect(await anonymous.json()).toEqual({ total: 0 });
});

test("messagerie : un message manqué par le temps réel finit par apparaître", async ({ page }) => {
  const shop = await createApprovedShop();
  const client = await createConfirmedUser("filet");
  const clientDb = await clientFor(client.email);
  const ownerDb = await clientFor(shop.owner.email);

  const { data: conversationId } = await clientDb.rpc("start_conversation", {
    p_shop_id: shop.id,
    p_product_id: null,
    p_request_id: null,
    p_body: "Bonjour",
  });

  // Bloque le canal WebSocket de cette page : seul le rattrapage peut livrer le message.
  await page.routeWebSocket(/realtime/, () => undefined);
  await signIn(page, client.email, `/compte/messages/${conversationId}`);

  await ownerDb.rpc("send_message", { p_conversation_id: conversationId, p_body: "Reçu sans temps réel" });
  await expect(page.getByText("Reçu sans temps réel")).toBeVisible({ timeout: 20_000 });
});
