import { expect, test } from "@playwright/test";
import { admin, createAdminUser, createConfirmedUser, signIn } from "./helpers";
import { createApprovedShop, PNG, productStatus, seedProduct, unique, resetDeliveryGrid, setDeliveryGrid } from "./market-helpers";

test("favoris : ajout, liste, compteur de popularité, retrait", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Aimee ${unique("f")}` });
  const client = await createConfirmedUser("favori");

  await signIn(page, client.email, `/produit/${product.id}`);
  await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
  await expect(page.getByRole("button", { name: "Retirer des favoris" })).toBeVisible();

  const { data } = await admin.from("products").select("favorite_count").eq("id", product.id).single();
  expect(data?.favorite_count).toBe(1);

  await page.goto("/compte/favoris");
  await expect(page.getByRole("link", { name: new RegExp(product.title!) })).toBeVisible();

  await page.goto(`/produit/${product.id}`);
  await page.getByRole("button", { name: "Retirer des favoris" }).click();
  await expect(page.getByRole("button", { name: "Ajouter aux favoris" })).toBeVisible();

  await page.goto("/compte/favoris");
  await expect(page.getByRole("heading", { name: "Aucun favori" })).toBeVisible();
});

test("partage : le lien est copié quand le partage natif est absent", async ({ page, context }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });

  await page.goto(`/produit/${product.id}`);
  await page.getByRole("button", { name: "Partager" }).click();
  await expect(page.getByText("Lien copié")).toBeVisible();
});

test("panier : retrait d'une pièce et pièce devenue indisponible", async ({ page }) => {
  const shop = await createApprovedShop();
  const kept = await seedProduct(shop.id, { title: `Gardee ${unique("g")}` });
  const removed = await seedProduct(shop.id, { title: `Retiree ${unique("r")}` });
  const client = await createConfirmedUser("panier");

  await admin.from("cart_items").insert([
    { user_id: client.id, product_id: kept.id },
    { user_id: client.id, product_id: removed.id },
  ]);

  await signIn(page, client.email, "/panier");
  await page.getByRole("listitem").filter({ hasText: removed.title! }).getByRole("button", { name: "Retirer" }).click();
  await expect(page.getByText(removed.title!)).toHaveCount(0);

  await admin.from("products").update({ status: "sold" }).eq("id", kept.id);
  await page.reload();
  await expect(page.getByText("Plus disponible")).toBeVisible();
  await expect(page.getByRole("link", { name: "Passer la commande" })).toHaveCount(0);
});

test("frais de livraison : le tarif fixé par FRIPE s'applique à la commande", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { price: 30000 });
  const client = await createConfirmedUser("frais");
  await setDeliveryGrid(8000, { tunis: 5500 });

  // La boutique voit la grille de FRIPE et ne peut plus la changer.
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/reglages`);
  await expect(page.getByRole("heading", { name: "Frais de livraison" })).toBeVisible();
  await expect(page.getByLabel("Frais de livraison (DT)")).toHaveCount(0);
  await page.context().clearCookies();

  await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });
  await signIn(page, client.email, "/commande");
  await page.getByLabel("Téléphone").fill("22123456");
  await page.getByLabel("Gouvernorat").selectOption({ label: "Tunis" });
  await page.getByLabel("Ville").selectOption({ label: "La Marsa" });
  await page.getByLabel("Rue, numéro, immeuble").fill("12 rue de la Fripe");
  await expect(page.getByText("35,500 DT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();

  const { data } = await admin.from("orders").select("delivery_fee_millimes, total_millimes").eq("client_id", client.id).single();
  expect(data).toEqual({ delivery_fee_millimes: 5500, total_millimes: 35500 });
  await resetDeliveryGrid();
});

test("annulation par le vendeur, et retrait en boutique sans expédition", async ({ page }) => {
  const shop = await createApprovedShop();
  const cancelled = await seedProduct(shop.id);
  const collected = await seedProduct(shop.id);
  const client = await createConfirmedUser("vendeur-annule");

  const place = async (productId: string) => {
    await admin.from("cart_items").insert({ user_id: client.id, product_id: productId });
    await signIn(page, client.email, "/commande");
    await page.getByLabel("Téléphone").fill("22123456");
    await page.getByLabel("Retrait en boutique").check();
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();
    await page.context().clearCookies();

    const { data } = await admin
      .from("order_items")
      .select("order_id")
      .eq("product_id", productId)
      .single();

    return data!.order_id;
  };

  const first = await place(cancelled.id);
  const second = await place(collected.id);

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/commandes/${first}`);
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await page.getByLabel("Motif").fill("Pièce abîmée");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
  expect(await productStatus(cancelled.id)).toBe("available");

  await page.goto(`/vendeur/boutique/${shop.id}/commandes/${second}`);
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lancer la préparation" }).click();
  await expect(page.getByText("En préparation", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer expédiée" })).toHaveCount(0);
  await page.getByRole("button", { name: "Marquer livrée" }).click();
  await expect(page.getByText("Livrée", { exact: true })).toBeVisible();

  await page.goto(`/vendeur/boutique/${shop.id}`);
  await expect(page.getByText(/Livré\s*: 30 DT/)).toBeVisible();
});

test("annulation par l'administrateur", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const client = await createConfirmedUser("admin-annule");
  const manager = await createAdminUser();

  await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });
  await signIn(page, client.email, "/commande");
  await page.getByLabel("Téléphone").fill("22123456");
  await page.getByLabel("Retrait en boutique").check();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, manager.email, "/admin/commandes?statut=pending");
  await page.getByRole("listitem").filter({ hasText: shop.name }).getByRole("button", { name: "Annuler la commande" }).click();
  await page.getByLabel("Motif de l'annulation").fill("Fraude suspectée");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Commande annulée")).toBeVisible();
  expect(await productStatus(product.id)).toBe("available");
});

test("vendeur : réservation libérée, vente en magasin, remise en rayon", async ({ page }) => {
  const shop = await createApprovedShop();
  const reserved = await seedProduct(shop.id, { title: `Bloquee ${unique("b")}` });
  const instore = await seedProduct(shop.id, { title: `Magasin ${unique("m")}` });
  const client = await createConfirmedUser("libere");

  await signIn(page, client.email, `/produit/${reserved.id}`);
  await page.getByRole("button", { name: "Réserver" }).click();
  await expect(page.getByText("Réservée pour toi jusqu'à")).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/commandes`);
  await expect(page.getByText(reserved.title!)).toBeVisible();
  await page.getByRole("button", { name: "Libérer" }).click();
  await expect(page.getByText(reserved.title!)).toHaveCount(0);
  expect(await productStatus(reserved.id)).toBe("available");

  await page.goto(`/vendeur/boutique/${shop.id}/produits?onglet=published`);
  const row = page.getByRole("listitem").filter({ hasText: instore.title! });
  await row.getByRole("button", { name: "Vendue en magasin" }).click();
  await expect(row.getByRole("button", { name: "Remettre en rayon" })).toBeVisible();
  expect(await productStatus(instore.id)).toBe("sold");

  await row.getByRole("button", { name: "Remettre en rayon" }).click();
  await expect(row.getByRole("button", { name: "Vendue en magasin" })).toBeVisible();
  expect(await productStatus(instore.id)).toBe("available");
});

test("vendeur : édition en ligne des brouillons, suppression de photo, archivage", async ({ page }) => {
  const shop = await createApprovedShop();
  const { data: draft } = await admin
    .from("products")
    .insert({ shop_id: shop.id, reference: "BROUILLON-1" })
    .select("id")
    .single();

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits?onglet=draft`);
  await page.getByLabel("Titre BROUILLON-1").fill("Titre en ligne");
  await page.getByLabel("Prix (DT) BROUILLON-1").fill("gratuit");
  await page.getByLabel("Titre BROUILLON-1").click();
  await expect(page.getByText("Indique un prix en dinars")).toBeVisible();

  await page.getByLabel("Prix (DT) BROUILLON-1").fill("12,5");
  await page.getByLabel("Titre BROUILLON-1").click();
  await expect(page.getByText("Indique un prix en dinars")).toHaveCount(0);

  await expect
    .poll(async () => (await admin.from("products").select("title, price_millimes").eq("id", draft!.id).single()).data)
    .toEqual({ title: "Titre en ligne", price_millimes: 12500 });

  await page.goto(`/vendeur/boutique/${shop.id}/produits/${draft!.id}`, { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Supprimer la photo" })).toHaveCount(1);
  await page.getByRole("button", { name: "Supprimer la photo" }).click();
  await expect(page.getByRole("button", { name: "Supprimer la photo" })).toHaveCount(0);

  const { count } = await admin
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", draft!.id);
  expect(count).toBe(0);

  await page.goto(`/vendeur/boutique/${shop.id}/produits?onglet=draft`);
  await page.getByLabel("Tout sélectionner").check();
  await page.getByRole("button", { name: "Archiver" }).click();
  await expect(page.getByText("Aucun produit ici.")).toBeVisible();
});

test("stock : masquer et retirer une ligne", async ({ page }) => {
  const shop = await createApprovedShop();
  const { data: category } = await admin.from("categories").select("id").eq("slug", "jeans").single();
  await admin.from("inventory_items").insert({ shop_id: shop.id, category_id: category!.id, approx_quantity: 100 });

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/stock`);
  await page.getByLabel("Visible par les clients").uncheck();
  await expect(page.getByLabel("Visible par les clients")).not.toBeChecked();
  await expect.poll(async () => (await admin.from("inventory_items").select("is_visible").eq("shop_id", shop.id).single()).data?.is_visible).toBe(false);
  await page.context().clearCookies();

  await page.goto(`/boutique/${shop.slug}?onglet=magasin`);
  await expect(page.getByText("environ 100 pièces")).toHaveCount(0);

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/stock`);
  await page.getByRole("button", { name: "Retirer" }).click();
  await expect(page.getByText("Aucun stock déclaré.")).toBeVisible();
});

test("responsive : aucune page ne déborde en largeur sur téléphone", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Pièce au titre vraiment très long ${unique("l")} `.repeat(2).trim().slice(0, 100) });
  const reserved = await seedProduct(shop.id, { title: `Réservée ${unique("r")}` });
  const client = await createConfirmedUser("large");
  const { data: category } = await admin.from("categories").select("id").eq("slug", "jeans").single();

  await admin.from("inventory_items").insert({ shop_id: shop.id, category_id: category!.id, approx_quantity: 100 });
  await admin.from("reservations").insert({
    product_id: reserved.id,
    shop_id: shop.id,
    client_id: client.id,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
  await admin.from("products").update({ status: "reserved" }).eq("id", reserved.id);

  const expectNoOverflow = async (paths: string[]) => {
    for (const path of paths) {
      await page.goto(path, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect.soft(overflow, path).toBeLessThanOrEqual(0);
    }
  };

  const publicPaths = ["/", "/catalogue", "/boutiques", `/boutique/${shop.slug}`, `/produit/${product.id}`];
  const base = `/vendeur/boutique/${shop.id}`;
  const sellerPaths = [
    base,
    `${base}/produits?onglet=published`,
    `${base}/produits/nouveau`,
    `${base}/publication-rapide`,
    `${base}/collections`,
    `${base}/stock`,
    `${base}/commandes`,
    `${base}/demandes`,
    `${base}/reglages`,
  ];

  await expectNoOverflow(publicPaths);
  await expectNoOverflow(publicPaths.map((path) => `/ar${path === "/" ? "" : path}`));

  await signIn(page, shop.owner.email);
  await expectNoOverflow(sellerPaths);
  await expectNoOverflow(sellerPaths.map((path) => `/ar${path}`));
  await page.context().clearCookies();

  await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });
  await signIn(page, client.email);
  const clientPaths = ["/compte", "/panier", "/commande", "/compte/reservations", "/compte/commandes", "/compte/favoris", "/compte/demandes"];
  await expectNoOverflow(clientPaths);
  await expectNoOverflow(clientPaths.map((path) => `/ar${path}`));
  await page.context().clearCookies();

  const manager = await createAdminUser();
  await signIn(page, manager.email);
  await expectNoOverflow(["/admin", "/admin/boutiques", "/admin/produits", "/admin/commandes", "/admin/utilisateurs", "/admin/audit"]);
});

test("états : aucune donnée de la boutique suspendue n'est publique", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Suspendue ${unique("s")}` });

  await admin.from("shops").update({ status: "suspended" }).eq("id", shop.id);

  await page.goto(`/produit/${product.id}`);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();

  await page.goto(`/catalogue?q=${encodeURIComponent(product.title!)}`);
  await expect(page.getByRole("heading", { name: "Rien ne correspond" })).toBeVisible();
});

test("accueil : les sections affichent le vrai catalogue après mise à jour du cache", async ({ page, request }) => {
  test.setTimeout(150_000);

  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Accueil ${unique("h")}` });
  const { data: category } = await admin.from("categories").select("id").eq("slug", "jeans").single();
  await admin.from("collections").insert({ shop_id: shop.id, name: `Coll ${unique("c")}`, is_published: true });
  await admin.from("inventory_items").insert({ shop_id: shop.id, category_id: category!.id, approx_quantity: 5 });
  await admin.from("favorites").insert({
    user_id: (await createConfirmedUser("aime")).id,
    product_id: product.id,
  });

  // Page statique revalidée toutes les 60 secondes : la première visite déclenche la régénération.
  await expect
    .poll(
      async () => {
        await request.get("/");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return (await (await request.get("/")).text()).includes(product.title!);
      },
      { timeout: 90_000, intervals: [2000] },
    )
    .toBe(true);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nouveaux arrivages" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Les plus aimées" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Boutiques à découvrir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catégories" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible();
});
