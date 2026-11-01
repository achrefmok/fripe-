import { expect, test, type Page } from "@playwright/test";
import { admin, createAdminUser, createConfirmedUser, signIn } from "./helpers";
import { createApprovedShop, PNG, productStatus, seedProduct, unique } from "./market-helpers";

const CHECKOUT_PHONE = "22 123 456";

async function fillDelivery(page: Page) {
  await page.getByLabel("Téléphone").fill(CHECKOUT_PHONE);
  await page.getByLabel("Gouvernorat").selectOption({ label: "Tunis" });
  await page.getByLabel("Ville").selectOption({ label: "La Marsa" });
  await page.getByLabel("Rue, numéro, immeuble").fill("12 rue de la Fripe");
  await expect(page.getByText("8 DT", { exact: true })).toBeVisible();
}

test("vendeur : création, photos, modification et publication d'un produit", async ({ page }) => {
  const shop = await createApprovedShop();
  const title = `Veste ${unique("t")}`;
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits/nouveau`);

  await page.getByLabel("Titre").fill(title);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/produits\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "manquant" })).toBeVisible();

  await page.getByLabel("Catégorie").selectOption({ label: "Jeans" });
  await page.getByLabel("État").selectOption({ label: "Très bon état" });
  await page.getByLabel("Prix (DT)").fill("35,500");
  await page.getByLabel("Taille").fill("M");
  await page.getByLabel("Marque").fill("Levis");
  await page.getByLabel("Défauts à signaler").fill("Petit accroc à la manche");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées").first()).toBeVisible();

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText("Photo manquante")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: PNG },
    { name: "b.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByRole("button", { name: "Supprimer la photo" })).toHaveCount(2);

  await page.locator('input[type="file"]').setInputFiles({
    name: "faux.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.getByText("Choisis une image JPEG, PNG ou WebP.")).toBeVisible();

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText("1 pièce publiée")).toBeVisible();

  await page.context().clearCookies();
  await page.goto(`/catalogue?q=${encodeURIComponent(title)}`);
  await page.getByRole("link", { name: new RegExp(title) }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("35,500 DT").first()).toBeVisible();
  await expect(page.getByText("Très bon état")).toBeVisible();
  await expect(page.getByText("Petit accroc à la manche")).toBeVisible();
  await expect(page.getByText("Disponible")).toBeVisible();
});

test("catalogue : recherche sans accents, filtres, tri et pagination", async ({ page }) => {
  const shop = await createApprovedShop("sfax-ville");
  const token = unique("marque");

  await seedProduct(shop.id, { title: `Été ${token} chemise`, price: 20000, brand: token, size: "L", categorySlug: "chemises", condition: "very_good" });
  await seedProduct(shop.id, { title: `Blouson ${token}`, price: 60000, brand: token, size: "M", categorySlug: "manteaux" });
  await seedProduct(shop.id, { title: `Jean ${token}`, price: 40000, brand: token, size: "M", categorySlug: "jeans" });

  await page.goto(`/catalogue?q=ete+${token}`);
  await expect(page.getByRole("status")).toContainText("1 pièce");
  await expect(page.getByRole("link", { name: new RegExp(`Été ${token}`) })).toBeVisible();

  await page.goto(`/catalogue?marque=${token}&tri=price_desc`);
  await expect(page.getByRole("status")).toContainText("3 pièces");
  const titles = await page.locator("article h3").allTextContents();
  expect(titles[0]).toContain("Blouson");
  expect(titles[2]).toContain("Été");

  await page.goto(`/catalogue?marque=${token}&taille=m&tri=price_asc`);
  await expect(page.getByRole("status")).toContainText("2 pièces");

  await page.goto(`/catalogue?marque=${token}&prixMin=30&prixMax=50`);
  await expect(page.getByRole("status")).toContainText("1 pièce");

  await page.goto(`/catalogue?marque=${token}&categorie=vestes-manteaux`);
  await expect(page.getByRole("status")).toContainText("1 pièce");

  await page.goto(`/catalogue?marque=${token}&etat=very_good`);
  await expect(page.getByRole("status")).toContainText("1 pièce");

  const { data: sfax } = await admin.from("governorates").select("id").eq("slug", "sfax").single();
  const { data: tunis } = await admin.from("governorates").select("id").eq("slug", "tunis").single();

  await page.goto(`/catalogue?marque=${token}&gouvernorat=${sfax!.id}`);
  await expect(page.getByRole("status")).toContainText("3 pièces");

  await page.goto(`/catalogue?marque=${token}&gouvernorat=${tunis!.id}`);
  await expect(page.getByRole("heading", { name: "Rien ne correspond" })).toBeVisible();
});

test("catalogue : la pagination se fait côté serveur", async ({ page }) => {
  const shop = await createApprovedShop();
  const token = unique("page");
  await Promise.all(Array.from({ length: 26 }, (_, index) => seedProduct(shop.id, { title: `Lot ${index}`, brand: token })));

  await page.goto(`/catalogue?marque=${token}`);
  await expect(page.getByRole("status")).toContainText("26 pièces");
  await expect(page.locator("article")).toHaveCount(24);

  await page.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("article")).toHaveCount(2);
});

test("collection : création, ajout de pièces, affichage public", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/collections`);

  await page.getByLabel("Nom de la collection").fill("Jeans vintage");
  await page.getByRole("button", { name: "Créer la collection" }).click();
  await expect(page).toHaveURL(/collections\/[0-9a-f-]{36}$/);

  await page.getByRole("checkbox", { name: new RegExp(product.title!) }).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modifications enregistrées")).toBeVisible();

  await page.context().clearCookies();
  await page.goto(`/boutique/${shop.slug}`);
  await page.getByRole("link", { name: "Jeans vintage" }).click();
  await expect(page.getByRole("heading", { name: "Jeans vintage" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(product.title!) })).toBeVisible();
});

test("stock physique : déclaration indicative, non commandable", async ({ page }) => {
  const shop = await createApprovedShop();
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/stock`);

  await page.getByLabel("Catégorie").selectOption({ label: "Jeans" });
  await page.getByLabel("Quantité approximative").fill("250");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Stock ajouté")).toBeVisible();

  await page.getByRole("textbox", { name: /Quantité approximative Jeans/ }).fill("240");
  await page.getByRole("button", { name: "Mettre à jour" }).click();
  await expect(page.getByText("Modifications enregistrées")).toBeVisible();

  const { count } = await admin
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id);
  expect(count).toBe(2);

  await page.context().clearCookies();
  await page.goto(`/boutique/${shop.slug}`);
  await expect(page.getByText("environ 240 pièces")).toBeVisible();
  await expect(page.getByText("Quantités indicatives")).toBeVisible();
  await expect(page.getByRole("button", { name: /Acheter|Réserver|panier/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Demander un article" })).toBeVisible();
});

test("demande d'article : le client décrit, le vendeur propose une pièce réelle", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Veste Nike ${unique("n")}` });
  const client = await createConfirmedUser("demande", "Client Demande");

  await signIn(page, client.email, `/boutique/${shop.slug}/demande`);
  await page.getByLabel("Catégorie").selectOption({ label: "Vestes et manteaux" });
  await page.getByLabel("Taille").fill("L");
  await page.getByLabel("Couleur").fill("noir");
  await page.getByLabel("Marque souhaitée").fill("Nike");
  await page.getByLabel("Budget maximum (DT)").fill("50");
  await page.getByLabel("Message").fill("Je cherche une veste Nike noire");
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(page).toHaveURL(/compte\/demandes/);
  await expect(page.getByText("Pas encore de réponse.")).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/demandes`);
  await expect(page.getByText("De Client Demande")).toBeVisible();
  await expect(page.getByText("Budget : 50 DT")).toBeVisible();
  await page.getByLabel("Pièce à proposer").selectOption({ value: product.id });
  await page.getByRole("button", { name: "Proposer" }).click();
  await expect(page.getByText("Proposition envoyée")).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, client.email, "/compte/demandes");
  await expect(page.getByText(product.title!)).toBeVisible();
  await page.getByRole("link", { name: "Voir la pièce" }).click();
  await expect(page.getByRole("heading", { name: product.title! })).toBeVisible();
});

test("réservation : un seul client garde la pièce, annulation possible", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const first = await createConfirmedUser("reserve");
  const second = await createConfirmedUser("reserve2");

  await signIn(page, first.email, `/produit/${product.id}`);
  await page.getByRole("button", { name: "Réserver" }).click();
  await expect(page.getByText("Réservée pour toi jusqu'à")).toBeVisible();
  expect(await productStatus(product.id)).toBe("reserved");
  await page.context().clearCookies();

  await signIn(page, second.email, `/produit/${product.id}`);
  await expect(page.getByText("Quelqu'un l'a réservée")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réserver" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Acheter" })).toHaveCount(0);
  await page.context().clearCookies();

  await signIn(page, first.email, "/compte/reservations");
  await page.getByRole("button", { name: "Annuler la réservation" }).click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
  expect(await productStatus(product.id)).toBe("available");
});

test("expiration : le cron libère réellement la pièce et le client le voit", async ({ page }) => {
  test.setTimeout(120_000);

  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const client = await createConfirmedUser("expire");

  await signIn(page, client.email, `/produit/${product.id}`);
  await page.getByRole("button", { name: "Réserver" }).click();
  await expect(page.getByText("Réservée pour toi jusqu'à")).toBeVisible();

  await admin
    .from("reservations")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("product_id", product.id);

  await expect.poll(() => productStatus(product.id), { timeout: 80_000, intervals: [3000] }).toBe("available");

  await page.goto("/compte/reservations");
  await expect(page.getByText("Expirée")).toBeVisible();
  await expect(page.getByText("Le délai est passé")).toBeVisible();

  await page.goto(`/produit/${product.id}`);
  await expect(page.getByRole("button", { name: "Réserver" })).toBeVisible();
});

test("commande : panier, livraison, traitement vendeur jusqu'à la livraison", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { price: 30000 });
  const client = await createConfirmedUser("acheteur", "Acheteur Test");

  await signIn(page, client.email, `/produit/${product.id}`);
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("link", { name: "Voir le panier" })).toBeVisible();

  await page.goto("/panier");
  await expect(page.getByText(product.title!)).toBeVisible();
  await page.getByRole("link", { name: "Passer la commande" }).click();

  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByText("Indique un numéro tunisien à 8 chiffres.")).toBeVisible();

  await fillDelivery(page);
  await expect(page.getByText("38 DT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();

  await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();
  expect(await productStatus(product.id)).toBe("reserved");

  const { data: order } = await admin
    .from("orders")
    .select("id, total_millimes, delivery_fee_millimes, order_groups (phone, address_line)")
    .eq("client_id", client.id)
    .single();

  expect(order?.total_millimes).toBe(38000);
  expect(order?.order_groups).toMatchObject({ phone: "+21622123456" });

  await page.goto("/panier");
  await expect(page.getByRole("heading", { name: "Ton panier est vide" })).toBeVisible();

  await page.goto(`/produit/${product.id}`);
  await expect(page.getByText("Quelqu'un l'a réservée")).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/commandes/${order!.id}`);
  await expect(page.getByText("12 rue de la Fripe")).toBeVisible();

  for (const [action, status] of [
    ["Confirmer", "Confirmée"],
    ["Lancer la préparation", "En préparation"],
    ["Marquer expédiée", "Expédiée"],
    ["Marquer livrée", "Livrée"],
  ]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByText(status, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole("button", { name: "Annuler la commande" })).toHaveCount(0);
  expect(await productStatus(product.id)).toBe("sold");
  await page.context().clearCookies();

  await signIn(page, client.email, `/compte/commandes/${order!.id}`);
  await expect(page.getByText("Livrée", { exact: true })).toBeVisible();
});

test("commande multi-boutiques : une commande par boutique, retrait gratuit", async ({ page }) => {
  const first = await createApprovedShop();
  const second = await createApprovedShop();
  const one = await seedProduct(first.id, { price: 30000 });
  const two = await seedProduct(second.id, { price: 20000 });
  const client = await createConfirmedUser("multi");

  await admin.from("cart_items").insert([
    { user_id: client.id, product_id: one.id },
    { user_id: client.id, product_id: two.id },
  ]);

  await signIn(page, client.email, "/commande");
  await page.getByRole("group", { name: second.name }).getByLabel("Retrait en boutique").check();
  await fillDelivery(page);
  await expect(page.getByText("58 DT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();

  const { data: orders } = await admin
    .from("orders")
    .select("id, shop_id, fulfillment, delivery_fee_millimes")
    .eq("client_id", client.id);

  expect(orders).toHaveLength(2);
  expect(orders?.find((order) => order.shop_id === second.id)).toMatchObject({
    fulfillment: "pickup",
    delivery_fee_millimes: 0,
  });

  const foreign = orders!.find((order) => order.shop_id === first.id)!;
  await page.context().clearCookies();

  await signIn(page, second.owner.email, `/vendeur/boutique/${second.id}/commandes/${foreign.id}`);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
  expect(await page.content()).not.toContain("12 rue de la Fripe");
});

test("annulation : le client annule une commande en attente, la pièce revient", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const client = await createConfirmedUser("annule");

  await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });
  await signIn(page, client.email, "/commande");
  await fillDelivery(page);
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();

  await page.getByRole("link", { name: "Voir mes commandes" }).click();
  await page.getByRole("link", { name: new RegExp(shop.name) }).click();
  await page.getByRole("button", { name: "Annuler la commande" }).click();
  await page.getByLabel("Motif").fill("Erreur de taille");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByText("Motif : Erreur de taille".replace(" :", " :"))).toBeVisible();
  expect(await productStatus(product.id)).toBe("available");
});

test("publication rapide : CSV validé, modification groupée, publication avec refus motivés", async ({ page }) => {
  const shop = await createApprovedShop();
  const token = unique("csv");
  const csv = [
    "titre;categorie;prix;etat;marque;taille",
    `Jean ${token};jeans;30;bon etat;Levis;M`,
    `Veste ${token};Manteaux;45,5;très bon;Nike;L`,
    "Sans prix;jeans;;bon etat;;",
    "Mauvais;inconnue;10;;;",
  ].join("\n");

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/publication-rapide`);
  await page.getByLabel("Choisir un fichier").setInputFiles({
    name: "stock.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });

  await expect(page.getByText("2 lignes valides, 2 à corriger")).toBeVisible();
  await expect(page.getByText(/Ligne 4/)).toBeVisible();
  await expect(page.getByText(/Ligne 5/)).toContainText("Catégorie inconnue");

  await page.getByRole("button", { name: "Créer les brouillons" }).click();
  await expect(page).toHaveURL(/onglet=draft/);
  await expect(page.locator("li", { hasText: "P-" })).toHaveCount(2);

  await page.getByLabel("Tout sélectionner").check();
  await page.getByLabel("Prix (DT)").first().fill("25");
  await page.getByLabel("État", { exact: true }).selectOption({ label: "Comme neuf" });
  await page.getByRole("button", { name: "Appliquer à la sélection" }).click();
  await expect(page.getByText("Sélection mise à jour")).toBeVisible();

  const { data: drafts } = await admin
    .from("products")
    .select("id, price_millimes, condition, publication_status")
    .eq("shop_id", shop.id);

  expect(drafts?.every((draft) => draft.price_millimes === 25000 && draft.condition === "like_new")).toBe(true);

  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByText("Photo manquante")).toHaveCount(2);

  await admin.from("product_images").insert(
    drafts!.map((draft) => ({ product_id: draft.id, path: `${shop.id}/${draft.id}/x.png` })),
  );

  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByText("2 pièces publiées")).toBeVisible();

  const { count } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id)
    .eq("publication_status", "published");

  expect(count).toBe(2);
});

test("publication rapide : une photo devient un brouillon", async ({ page }) => {
  const shop = await createApprovedShop();
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/publication-rapide`);

  await page.getByLabel("Choisir les photos").setInputFiles([
    { name: "1.png", mimeType: "image/png", buffer: PNG },
    { name: "2.png", mimeType: "image/png", buffer: PNG },
    { name: "3.png", mimeType: "image/png", buffer: PNG },
  ]);

  await expect(page).toHaveURL(/onglet=draft/);

  const { data } = await admin
    .from("products")
    .select("id, product_images (id)")
    .eq("shop_id", shop.id);

  expect(data).toHaveLength(3);
  expect(data?.every((product) => product.product_images.length === 1)).toBe(true);
});

test("isolation : un autre vendeur ne voit ni produits ni commandes", async ({ page }) => {
  const victim = await createApprovedShop();
  const intruder = await createApprovedShop();
  const product = await seedProduct(victim.id, { title: `Secret ${unique("s")}` });

  await signIn(page, intruder.owner.email);

  for (const path of ["", "/produits", `/produits/${product.id}`, "/commandes", "/stock", "/demandes", "/reglages"]) {
    await page.goto(`/vendeur/boutique/${victim.id}${path}`);
    await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
  }

  await page.goto(`/vendeur/boutique/${intruder.id}/produits/${product.id}`);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
  expect(await page.content()).not.toContain("Secret");
});

test("accès client : un client ne lit pas la commande d'un autre", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const owner = await createConfirmedUser("proprio");
  const stranger = await createConfirmedUser("inconnu");

  await admin.from("cart_items").insert({ user_id: owner.id, product_id: product.id });
  await signIn(page, owner.email, "/commande");
  await fillDelivery(page);
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page.getByRole("heading", { name: "Commande envoyée" })).toBeVisible();

  const { data: order } = await admin.from("orders").select("id, group_id").eq("client_id", owner.id).single();
  await page.context().clearCookies();

  await signIn(page, stranger.email, `/compte/commandes/${order!.id}`);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
  expect(await page.content()).not.toContain("12 rue de la Fripe");

  await page.goto(`/commande/confirmation/${order!.group_id}`);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();

  await page.goto(`/vendeur/boutique/${shop.id}/commandes`);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
});

test("administration : supervision des produits et des commandes", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Interdit ${unique("m")}` });
  const manager = await createAdminUser();

  await signIn(page, manager.email, `/admin/produits?q=${encodeURIComponent(product.title!)}`);
  await page.getByRole("button", { name: "Retirer" }).click();
  await page.getByLabel("Motif interne").fill("Contrefaçon");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Produit retiré")).toBeVisible();

  const { data } = await admin.from("products").select("publication_status").eq("id", product.id).single();
  expect(data?.publication_status).toBe("archived");

  await page.goto("/admin/audit");
  await expect(page.getByText("product.moderated", { exact: true }).first()).toBeVisible();

  await page.goto("/admin/commandes");
  await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();

  await page.context().clearCookies();
  const response = await page.goto(`/produit/${product.id}`);
  expect(response?.status()).toBeGreaterThanOrEqual(200);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
});

test("interface arabe : catalogue, fiche produit et commande en RTL", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `جينز ${unique("a")}`, price: 30000 });
  const client = await createConfirmedUser("arabe", "ليلى");

  await page.goto(`/ar/catalogue?q=${encodeURIComponent(product.title!)}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "الكتالوج" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("قطعة واحدة");

  await page.goto(`/ar/connexion?next=${encodeURIComponent(`/produit/${product.id}`)}`);
  await page.getByLabel("البريد الإلكتروني").fill(client.email);
  await page.getByLabel("كلمة السر").fill("portant-2026!");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();

  await expect(page).toHaveURL(new RegExp(`/ar/produit/${product.id}`));
  await expect(page.getByText("30 د.ت").first()).toBeVisible();
  await expect(page.getByText("حالة جيدة")).toBeVisible();

  await page.getByRole("button", { name: "شراء" }).click();
  await expect(page).toHaveURL(/\/ar\/commande/);
  await page.getByLabel("الهاتف").fill(CHECKOUT_PHONE);
  await page.getByLabel("الولاية").selectOption({ label: "تونس" });
  await page.getByLabel("المدينة").selectOption({ label: "المرسى" });
  await page.getByLabel("الشارع، الرقم، العمارة").fill("12 نهج الفريب");
  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page.getByRole("heading", { name: "تم إرسال الطلب" })).toBeVisible();
});

test("interface arabe : espace vendeur en RTL", async ({ page }) => {
  const shop = await createApprovedShop();
  await signIn(page, shop.owner.email);
  await page.goto(`/ar/vendeur/boutique/${shop.id}/produits/nouveau`);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("العنوان")).toBeVisible();

  await page.goto(`/ar/vendeur/boutique/${shop.id}/stock`);
  await expect(page.getByRole("heading", { name: "المخزون في المحل" })).toBeVisible();
});
