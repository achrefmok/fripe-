import { expect, test } from "@playwright/test";
import { admin, createAdminUser, signIn } from "./helpers";
import { createApprovedShop, PNG, seedProduct } from "./market-helpers";

// Le stack de test active le fournisseur « fixture » (scripts/test-stack.mjs) : il lit un marqueur
// placé dans le fichier et renvoie les scores d'un vrai classifieur. Toute la chaîne est réelle :
// action serveur, blocage avant stockage, rapport en base, suspension et notification.
const marked = (label: string) => Buffer.concat([PNG, Buffer.from(`FRIPE-MODERATION-TEST:${label}`)]);

async function eventsOf(userId: string) {
  const { data } = await admin
    .from("media_moderation_events")
    .select("decision, category, severity, context, sanction, reason, created_at")
    .eq("user_id", userId)
    .order("created_at");
  return data ?? [];
}

async function statusOf(userId: string) {
  const { data } = await admin.from("profiles").select("status").eq("id", userId).single();
  return data?.status;
}

test.describe("modération des médias", () => {
  test("une photo +18 est bloquée avant stockage, sans suspension à la première tentative", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const before = await admin.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits/${product.id}`);
    await page.locator("input[type=file]").first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: marked("erotica") });

    await expect(page.getByText(/Ce média a été bloqué/)).toBeVisible();

    const after = await admin.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);
    expect(after.count).toBe(before.count);
    expect(await statusOf(shop.owner.id)).toBe("active");
    expect(await eventsOf(shop.owner.id)).toMatchObject([{ decision: "block", category: "sexual_erotica", severity: "medium", context: "product_image", sanction: "none" }]);
  });

  test("un contenu pornographique bloque l'envoi, suspend le compte et prévient les administrateurs", async ({ page }) => {
    const manager = await createAdminUser();
    const shop = await createApprovedShop();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/reglages`);
    await page.locator("input[type=file]").first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: marked("explicit-critical") });

    await expect(page.getByText(/ton compte est suspendu/)).toBeVisible();
    expect(await statusOf(shop.owner.id)).toBe("suspended");

    const { data: stored } = await admin.from("shops").select("logo_path").eq("id", shop.id).single();
    expect(stored?.logo_path).toBeNull();

    const [event] = await eventsOf(shop.owner.id);
    expect(event).toMatchObject({ decision: "block", category: "sexual_explicit", severity: "critical", context: "shop_logo", sanction: "suspended" });
    expect(event.reason).toMatch(/explicite/);

    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", manager.id)
      .eq("kind", "media_blocked");
    expect(count).toBeGreaterThanOrEqual(1);

    // Le compte suspendu est renvoyé vers la page dédiée.
    await page.goto(`/vendeur/boutique/${shop.id}/reglages`);
    await expect(page).toHaveURL(/compte-suspendu/);

    // Le rapport détaillé : identifiant du compte, type de contenu, date, motif et sanction.
    await page.context().clearCookies();
    await signIn(page, manager.email, `/admin/medias?compte=${shop.owner.id}`);
    const report = page.getByTestId("media-event").first();
    await expect(report).toContainText(shop.owner.id);
    await expect(report).toContainText("Logo de boutique");
    await expect(report).toContainText("Sexuel explicite ou pornographique");
    await expect(report).toContainText("Compte suspendu automatiquement");
    await expect(report.locator("time")).toBeVisible();
  });

  test("un indice d'IA est rapporté sans bloquer ni sanctionner", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits/${product.id}`);
    await page.locator("input[type=file]").first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: marked("ai") });

    await expect.poll(async () => (await eventsOf(shop.owner.id)).length).toBe(1);
    expect(await eventsOf(shop.owner.id)).toMatchObject([{ decision: "flag", category: "ai_generated", sanction: "none" }]);
    await expect.poll(async () => {
      const { count } = await admin.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);
      return count;
    }).toBe(2);
    expect(await statusOf(shop.owner.id)).toBe("active");
  });

  test("service d'analyse en panne : l'envoi est refusé, sans rapport ni sanction", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits/${product.id}`);
    await page.locator("input[type=file]").first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: marked("unavailable") });

    await expect(page.getByText(/vérification automatique des médias est momentanément indisponible/)).toBeVisible();
    expect(await eventsOf(shop.owner.id)).toEqual([]);
    expect(await statusOf(shop.owner.id)).toBe("active");
  });

  test("une photo ordinaire passe sans rapport", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits/${product.id}`);
    await page.locator("input[type=file]").first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });

    await expect.poll(async () => {
      const { count } = await admin.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);
      return count;
    }).toBe(2);
    expect(await eventsOf(shop.owner.id)).toEqual([]);
  });
});
