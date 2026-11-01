import { expect, test } from "@playwright/test";
import { admin, createAdminUser, createConfirmedUser, signIn } from "./helpers";
import { clientFor, createApprovedShop, seedProduct, unique } from "./market-helpers";

async function deliveredOrder() {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const client = await createConfirmedUser("avis", "Salma Trabelsi");
  const buyer = await clientFor(client.email);
  const seller = await clientFor(shop.owner.email);

  const { data: groupId, error } = await buyer.rpc("place_order", {
    p_product_ids: [product.id],
    p_pickup_shop_ids: [shop.id],
    p_recipient_name: "Salma",
    p_phone: "+21622123456",
    p_governorate_id: null,
    p_city_id: null,
    p_address_line: null,
  });

  expect(error).toBeNull();

  const { data: order } = await admin.from("orders").select("id").eq("group_id", groupId).single();

  for (const status of ["confirmed", "preparing", "delivered"]) {
    await seller.rpc("update_order_status", { p_order_id: order!.id, p_status: status });
  }

  return { shop, product, client, buyer, seller, orderId: order!.id };
}

test.describe("blocage", () => {
  test("depuis une demande : le client ne peut plus écrire par aucune route", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("bloque", "Client Bloque");
    const supabase = await clientFor(client.email);

    const first = await supabase.rpc("create_stock_request", {
      p_shop_id: shop.id,
      p_category_id: null,
      p_size: "",
      p_color: "",
      p_brand: "",
      p_budget_millimes: 0,
      p_message: "Je cherche un manteau",
    });
    expect(first.error).toBeNull();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/demandes`);
    await page.getByRole("button", { name: "Bloquer ce client" }).click();
    await expect(page.getByRole("button", { name: "Débloquer" })).toBeVisible();

    const { data: closed } = await admin.from("stock_requests").select("status").eq("id", first.data).single();
    expect(closed?.status).toBe("closed");

    const routes = await Promise.all([
      supabase.rpc("create_stock_request", {
        p_shop_id: shop.id,
        p_category_id: null,
        p_size: "",
        p_color: "",
        p_brand: "",
        p_budget_millimes: 0,
        p_message: "Contournement",
      }),
      supabase.rpc("start_conversation", {
        p_shop_id: shop.id,
        p_product_id: null,
        p_request_id: null,
        p_body: "Contournement",
      }),
    ]);

    expect(routes.map((route) => route.error?.message)).toEqual(["blocked", "blocked"]);

    await page.goto(`/vendeur/boutique/${shop.id}/blocages`);
    await expect(page.getByText("Client Bloque")).toBeVisible();
    await page.getByRole("button", { name: "Débloquer" }).click();
    await expect(page.getByText("Aucun blocage.")).toBeVisible();

    const again = await supabase.rpc("start_conversation", {
      p_shop_id: shop.id,
      p_product_id: null,
      p_request_id: null,
      p_body: "Bonjour",
    });
    expect(again.error).toBeNull();
  });

  test("côté client : la boutique bloquée disparaît des échanges, la page l'explique", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("bloqueur");

    await signIn(page, client.email, `/boutique/${shop.slug}`);
    await expect(page.getByRole("link", { name: "Demander un article" })).toBeVisible();
    await page.getByRole("button", { name: "Bloquer cette boutique" }).click();
    await expect(page.getByText("ne sont pas possibles avec cette boutique")).toBeVisible();
    await expect(page.getByRole("link", { name: "Demander un article" })).toHaveCount(0);

    const seller = await clientFor(shop.owner.email);
    const reply = await seller.rpc("block_client", { p_shop_id: shop.id, p_client_id: client.id, p_block: true });
    expect(reply.error?.message).toBe("forbidden");

    await page.goto("/compte/blocages");
    await expect(page.getByRole("link", { name: shop.name })).toBeVisible();
    await page.getByRole("button", { name: "Débloquer" }).click();
    await expect(page.getByText("Aucun blocage.")).toBeVisible();
  });
});

test.describe("signalements", () => {
  test("boutique et compte : examen, suspension, historique, sans pouvoir pour les utilisateurs", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("signale", "Client Signale");
    const manager = await createAdminUser();
    const supabase = await clientFor(client.email);

    await supabase.rpc("start_conversation", {
      p_shop_id: shop.id,
      p_product_id: null,
      p_request_id: null,
      p_body: "Message désagréable",
    });

    await signIn(page, client.email, `/boutique/${shop.slug}`);
    await page.getByRole("button", { name: "Signaler" }).click();
    await page.getByLabel("Motif").selectOption("scam");
    await page.getByRole("button", { name: "Envoyer le signalement" }).click();
    await expect(page.getByText("Signalement envoyé")).toBeVisible();

    const denied = await supabase.rpc("set_user_status", { p_user_id: shop.owner.id, p_status: "suspended", p_reason: "Non" });
    expect(denied.error?.message).toBe("forbidden");

    await page.context().clearCookies();
    const { data: conversation } = await admin
      .from("conversations")
      .select("id")
      .eq("client_id", client.id)
      .single();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/messages/${conversation!.id}`);
    await page.getByRole("button", { name: "Signaler ce client" }).click();
    await page.getByLabel("Motif").selectOption("harassment");
    await page.getByRole("button", { name: "Envoyer le signalement" }).click();
    await expect(page.getByText("Signalement envoyé")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, manager.email, "/admin/signalements");

    const accountReport = page.getByRole("listitem").filter({ hasText: "Compte · Harcèlement" });
    await expect(accountReport).toContainText("Client Signale");
    await expect(accountReport.getByRole("button", { name: "Retirer le contenu" })).toHaveCount(0);
    await accountReport.getByRole("button", { name: "Suspendre le compte" }).click();
    await page.getByLabel("Motif de la décision").fill("Propos répétés");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Décision enregistrée")).toBeVisible();

    const { data: profile } = await admin.from("profiles").select("status").eq("id", client.id).single();
    expect(profile?.status).toBe("suspended");

    const shopReport = page.getByRole("listitem").filter({ hasText: "Boutique · Arnaque" });
    await shopReport.getByRole("button", { name: "Suspendre la boutique" }).click();
    await page.getByLabel("Motif de la décision").fill("Vérification en cours");
    await page.getByRole("button", { name: "Confirmer" }).click();

    await expect.poll(async () => {
      const { data } = await admin.from("shops").select("status").eq("id", shop.id).single();
      return data?.status;
    }).toBe("suspended");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(shopReport).toHaveCount(0);
    await expect(page.getByText("Vérification en cours")).toBeVisible();

    expect((await page.goto(`/boutique/${shop.slug}`))?.status()).toBe(404);
  });
});

test.describe("avis", () => {
  test("achat livré, publication, réponse, signalement, masquage par l'administration", async ({ page }) => {
    const { shop, product, client, orderId } = await deliveredOrder();
    const manager = await createAdminUser();

    await signIn(page, client.email, `/compte/commandes/${orderId}`);
    await page.getByRole("button", { name: "Publier mon avis" }).click();
    await expect(page.getByText("Choisis une note.")).toBeVisible();

    await page.getByRole("radio", { name: "4 sur 5" }).check({ force: true });
    await page.getByLabel(/Commentaire/).fill("Conforme à la description");
    await page.getByRole("button", { name: "Publier mon avis" }).click();
    await expect(page.getByText("Avis publié")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publier mon avis" })).toHaveCount(0);

    await page.goto(`/boutique/${shop.slug}`);
    await expect(page.getByText("4 sur 5 · 1 avis")).toBeVisible();
    await expect(page.getByText("Conforme à la description")).toBeVisible();
    await expect(page.getByText(`Achat vérifié · ${product.title}`)).toBeVisible();
    await expect(page.getByText("Salma", { exact: true })).toBeVisible();
    await expect(page.getByText("Trabelsi")).toHaveCount(0);

    const reportButton = page.locator("#avis").getByRole("button", { name: "Signaler" });
    await reportButton.click();
    await page.getByRole("button", { name: "Envoyer le signalement" }).click();
    await expect(page.getByText("Signalement envoyé")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/avis`);
    await page.getByRole("button", { name: "Répondre" }).click();
    await page.getByLabel("Ta réponse, publique et définitive").fill("Merci pour votre achat");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Merci pour votre achat")).toBeVisible();
    await expect(page.getByRole("button", { name: "Répondre" })).toHaveCount(0);

    await page.context().clearCookies();
    await signIn(page, manager.email, "/admin/signalements");
    const report = page.getByRole("listitem").filter({ hasText: "Avis ·" });
    await report.getByRole("button", { name: "Retirer le contenu" }).click();
    await page.getByLabel("Motif de la décision").fill("Avis retiré");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Décision enregistrée")).toBeVisible();

    await page.goto("/admin/avis?statut=hidden");
    await expect(page.getByText("Conforme à la description")).toBeVisible();

    await page.context().clearCookies();
    await page.goto(`/boutique/${shop.slug}`);
    await expect(page.getByText("Conforme à la description")).toHaveCount(0);
    await expect(page.getByText("Aucun avis pour le moment.")).toBeVisible();
  });

  test("aucun formulaire d'avis tant que la commande n'est pas livrée, ni pour un tiers", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const client = await createConfirmedUser("attente");
    const buyer = await clientFor(client.email);

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

    await signIn(page, client.email, `/compte/commandes/${order!.id}`);
    await expect(page.getByRole("button", { name: "Annuler" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Publier mon avis" })).toHaveCount(0);
  });
});

test.describe("prix", () => {
  test("le client voit le nouveau total si le prix change avant de valider", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id, { price: 30000 });
    const client = await createConfirmedUser("prix");

    await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });
    await signIn(page, client.email, "/commande");
    await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();

    await page.getByLabel("Téléphone").fill("22123456");
    await page.getByRole("radio", { name: /Retrait|retrait/ }).first().check();

    await admin.from("products").update({ price_millimes: 45000 }).eq("id", product.id);

    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByText("Un prix ou des frais ont changé.")).toBeVisible();
    await expect(page.getByText("45 DT").first()).toBeVisible();

    const { count } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("client_id", client.id);
    expect(count).toBe(0);

    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page).toHaveURL(/commande\/confirmation/);
  });
});

test.describe("fichiers", () => {
  test("le Storage refuse les dépôts hors brouillon, hors boutique et les doublons de quota", async () => {
    const shop = await createApprovedShop();
    const other = await createApprovedShop();
    const seller = await clientFor(shop.owner.email);
    const body = new Blob(["x"], { type: "video/webm" });

    const { data: videoId } = await seller.rpc("create_video_draft", { p_shop_id: shop.id, p_description: "" });

    const orphan = await seller.storage.from("shop-videos").upload(`${shop.id}/${crypto.randomUUID()}/video.webm`, body);
    expect(orphan.error).not.toBeNull();

    const foreign = await seller.storage.from("shop-videos").upload(`${other.id}/${videoId}/video.webm`, body);
    expect(foreign.error).not.toBeNull();

    const allowed = await seller.storage.from("shop-videos").upload(`${shop.id}/${videoId}/video.webm`, body);
    expect(allowed.error).toBeNull();

    const image = await seller.from("product_images").insert({
      product_id: (await seedProduct(shop.id)).id,
      path: `${other.id}/volee.jpg`,
    });
    expect(image.error).not.toBeNull();

    const logo = await seller.from("shops").update({ logo_path: `${other.id}/logo.png` }).eq("id", shop.id);
    expect(logo.error).not.toBeNull();
  });

  test("une vidéo modérée perd ses fichiers et ne peut plus revenir", async ({ page }) => {
    const shop = await createApprovedShop();
    const client = await createConfirmedUser("video");
    const manager = await createAdminUser();
    const seller = await clientFor(shop.owner.email);
    const reporter = await clientFor(client.email);

    const { data: videoId } = await seller.rpc("create_video_draft", { p_shop_id: shop.id, p_description: "Vidéo" });
    const folder = `${shop.id}/${videoId}`;
    const webm = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: "video/webm" });
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

    await seller.storage.from("shop-videos").upload(`${folder}/video.webm`, webm);
    await seller.storage.from("shop-videos").upload(`${folder}/thumb.jpg`, jpeg);

    const finalized = await seller.rpc("finalize_video", {
      p_video_id: videoId,
      p_video_path: `${folder}/video.webm`,
      p_thumbnail_path: `${folder}/thumb.jpg`,
      p_duration_seconds: 5,
      p_width: 360,
      p_height: 640,
    });
    expect(finalized.error).toBeNull();

    const report = await reporter.rpc("create_report", {
      p_target_type: "video",
      p_target_id: videoId,
      p_reason: "inappropriate",
      p_details: "",
    });
    expect(report.error).toBeNull();

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shop-videos/${folder}/video.webm`;
    expect((await fetch(url)).ok).toBe(true);

    await signIn(page, manager.email, "/admin/signalements");
    await page.getByRole("listitem").filter({ hasText: "Vidéo ·" }).getByRole("button", { name: "Retirer le contenu" }).click();
    await page.getByLabel("Motif de la décision").fill("Contenu interdit");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Décision enregistrée")).toBeVisible();

    await expect.poll(async () => (await fetch(url)).ok).toBe(false);

    const again = await seller.rpc("finalize_video", {
      p_video_id: videoId,
      p_video_path: `${folder}/video.webm`,
      p_thumbnail_path: `${folder}/thumb.jpg`,
      p_duration_seconds: 5,
      p_width: 360,
      p_height: 640,
    });
    expect(again.error?.message).toBe("moderated");

    const removed = await seller.from("videos").delete().eq("id", videoId).select("id");
    expect(removed.data).toEqual([]);
  });
});

test.describe("administration", () => {
  test("catégories : création, sous-catégorie, désactivation, suppression, journal", async ({ page }) => {
    const manager = await createAdminUser();
    const name = `Rayon ${unique("r").replace(/[^a-z0-9]/gi, "")}`;

    await signIn(page, manager.email, "/admin/categories");
    await page.getByRole("button", { name: "Nouvelle catégorie" }).click();
    await page.getByLabel("Nom en français").fill(name);
    await page.getByLabel("Nom en arabe").fill("قسم تجريبي");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText(name, { exact: false })).toBeVisible();

    const row = page.locator("div").filter({ hasText: name }).filter({ has: page.getByRole("button", { name: "Sous-catégorie" }) }).last();
    await row.getByRole("button", { name: "Sous-catégorie" }).click();
    await page.getByLabel("Nom en français").fill(`${name} fille`);
    await page.getByLabel("Nom en arabe").fill("فرع تجريبي");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText(`${name} fille`, { exact: false })).toBeVisible();

    const { data: parent } = await admin.from("categories").select("id").eq("name_fr", name).single();

    await row.getByRole("button", { name: "Désactiver" }).click();
    await expect.poll(async () => {
      const { data } = await admin.from("categories").select("is_active").eq("parent_id", parent!.id).single();
      return data?.is_active;
    }).toBe(false);

    const { data: audit } = await admin.from("audit_logs").select("id").eq("action", "categories.insert").eq("entity_id", parent!.id);
    expect(audit).toHaveLength(1);

    await page.goto("/admin/audit?action=categories.insert");
    await expect(page.getByText(parent!.id)).toBeVisible();
    await expect(page.getByText("Par Admin Test").first()).toBeVisible();

    const client = await createConfirmedUser("categorie");
    const ordinary = await clientFor(client.email);

    const denied = await ordinary.from("categories").insert({ slug: "pirate", name_fr: "Pirate", name_ar: "قرصان" });
    expect(denied.error).not.toBeNull();

    const silent = await ordinary.from("categories").delete().eq("id", parent!.id).select("id");
    expect(silent.data ?? []).toEqual([]);

    const used = await admin.from("categories").select("id").eq("slug", "jeans").single();
    await page.goto("/admin/categories");
    const jeans = page.locator("div").filter({ hasText: /^Jeans/ }).last();
    await jeans.getByRole("button", { name: "Supprimer" }).click();
    await page.goto("/admin/categories");
    expect((await admin.from("categories").select("id").eq("id", used.data!.id)).data).toHaveLength(1);
  });

  test("délégations : ajout visible à la création d'une boutique, désactivation et refus", async ({ page }) => {
    const manager = await createAdminUser();
    const name = `Delegation ${unique("d").replace(/[^a-z0-9]/gi, "")}`;

    await signIn(page, manager.email, "/admin/lieux");
    await page.locator("summary").filter({ hasText: "Béja" }).click();
    await page.getByRole("button", { name: "Ajouter une délégation" }).filter({ visible: true }).click();
    await page.getByLabel("Nom en français").fill(name);
    await page.getByLabel("Nom en arabe").fill("معتمدية تجريبية");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect.poll(async () => (await admin.from("cities").select("id").eq("name_fr", name)).data?.length).toBe(1);

    const { data: city } = await admin.from("cities").select("id, governorate_id").eq("name_fr", name).single();

    await admin.from("cities").update({ is_active: false }).eq("id", city!.id);

    const client = await createConfirmedUser("lieu");
    const supabase = await clientFor(client.email);

    const refused = await supabase.rpc("create_shop", {
      p_name: "Boutique Lieu",
      p_slug: unique("lieu-"),
      p_description: "",
      p_phone: "",
      p_governorate_id: city!.governorate_id,
      p_city_id: city!.id,
    });

    expect(refused.error?.message).toBe("invalid_location");

    const denied = await supabase.from("cities").update({ name_fr: "Pirate" }).eq("id", city!.id).select("id");
    expect(denied.data ?? []).toEqual([]);
  });

  test("les pages d'administration restent invisibles pour un client ou un vendeur", async ({ page }) => {
    const shop = await createApprovedShop();
    await signIn(page, shop.owner.email);

    for (const path of ["/admin/categories", "/admin/lieux", "/admin/avis", "/admin/audit"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
  });

  test("recherche et détail d'une commande, produits retirés", async ({ page }) => {
    const manager = await createAdminUser();
    const { orderId } = await deliveredOrder();
    const { data: order } = await admin.from("orders").select("order_groups (reference)").eq("id", orderId).single();
    const reference = (order!.order_groups as unknown as { reference: string }).reference;

    await signIn(page, manager.email, `/admin/commandes?q=${reference}`);
    await page.getByRole("link", { name: reference }).click();
    await expect(page.getByRole("heading", { name: reference })).toBeVisible();

    await page.goto("/admin/produits?vue=moderes");
    await expect(page.getByRole("link", { name: "Retirés par la modération" })).toHaveAttribute("aria-current", "true");
  });
});

test.describe("conformité", () => {
  const PAGES = [
    ["/mentions-legales", "Mentions légales", true],
    ["/cgu", "Conditions générales d'utilisation", true],
    ["/cgv", "Conditions générales de vente", true],
    ["/confidentialite", "Politique de confidentialité", true],
    ["/cookies", "Cookies et stockage local", true],
    ["/retours", "Retours et annulations", true],
    ["/livraison", "Modalités de livraison", true],
    ["/informations-vendeurs", "Informations sur les vendeurs", true],
    ["/support", "Support", true],
  ] as const;

  test("chaque page existe en deux langues et signale ce qui reste à valider", async ({ page }) => {
    for (const [path, title] of PAGES) {
      await page.context().clearCookies({ name: "NEXT_LOCALE" });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("note")).toBeVisible();
      expect(await page.locator("[data-legal-placeholder]").count(), path).toBeGreaterThan(0);

      await page.goto(`/ar${path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("[data-legal-placeholder]").first()).toContainText("للمصادقة");
    }
  });

  test("le pied de page et les parcours mènent aux pages légales", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "CGV" }).click();
    await expect(page).toHaveURL(/\/cgv$/);

    await page.goto("/inscription");
    await expect(page.getByRole("link", { name: "conditions d'utilisation" })).toHaveAttribute("href", "/cgu");
  });

  test("la politique de sécurité n'interdit aucune ressource de l'application", async ({ page }) => {
    const violations: string[] = [];

    page.on("console", (message) => {
      if (/Content Security Policy|Refused to/.test(message.text())) violations.push(message.text());
    });

    const shop = await createApprovedShop();
    await seedProduct(shop.id);

    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

    for (const path of ["/catalogue", `/boutique/${shop.slug}`, "/walk", "/stylist"]) {
      await page.goto(path, { waitUntil: "networkidle" });
    }

    expect(violations).toEqual([]);
  });
});
