import { expect, test } from "@playwright/test";
import { admin, signIn } from "./helpers";
import { createApprovedShop, seedProduct } from "./market-helpers";

// Caméra et micro simulés par Chromium : le parcours réel, sans matériel.
test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  },
  permissions: ["camera", "microphone"],
});

test("studio : filmer, pause, revoir, musique, voix, texte et prix, publier", async ({ page }) => {
  test.setTimeout(120_000);
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: "Veste en jean Studio", price: 45000 });

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/videos`);
  await page.getByRole("link", { name: "Créer une vidéo" }).click();
  await expect(page).toHaveURL(/\/videos\/nouvelle$/);

  // Le recours reste toujours proposé : appareil photo du téléphone et import.
  await expect(page.getByLabel("Filmer avec l'appareil photo")).toHaveAttribute("capture", "environment");

  // 1. Filmer, avec une pause.
  await page.getByRole("button", { name: "Ouvrir la caméra" }).click();
  await expect(page.getByLabel("Image de la caméra")).toBeVisible();
  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Reprendre" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();

  // 2. Revoir puis valider.
  await expect(page.getByLabel("Vidéo enregistrée")).toBeVisible();
  await page.getByRole("button", { name: "Valider" }).click();

  // 3. Monter : musique, texte, pièce et prix, voix.
  const preview = page.getByRole("img", { name: "Aperçu du montage" });
  await expect(preview).toBeVisible();
  await expect(page.getByRole("button", { name: "Aperçu" })).toBeEnabled();

  await page.getByRole("radiogroup", { name: "Musique" }).getByText("Souk").click();
  await expect(page.getByText(/Musiques originales composées par FRIPE/)).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Texte sur la vidéo").fill("Nouvel arrivage");
  await page.getByLabel("Pièce montrée").selectOption(product.id);
  await expect(page.getByLabel("Nom affiché")).toHaveValue("Veste en jean Studio");
  await expect(page.getByLabel("Prix affiché")).toHaveValue("45 DT");

  // L'étiquette du prix est bien dessinée sur l'image (rouge harissa en bas de l'aperçu).
  const tagged = await preview.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d")!;
    const { data } = context.getImageData(0, Math.floor(canvas.height * 0.6), canvas.width, Math.floor(canvas.height * 0.4));
    for (let i = 0; i < data.length; i += 4) if (data[i] === 200 && data[i + 1] === 53 && data[i + 2] === 42) return true;
    return false;
  });
  expect(tagged).toBe(true);

  await page.getByRole("button", { name: "Enregistrer ma voix" }).click();
  await expect(page.getByText(/Voix enregistrée \(\d+ s\)/)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("slider", { name: "Musique" }).fill("30");
  await expect(page.getByText("30 %")).toBeVisible();

  // 4. Rendu final puis publication, associée à la pièce.
  await page.getByRole("button", { name: "Créer ma vidéo" }).click();
  await expect(page.getByLabel("Vidéo finale")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Description")).toHaveValue("Veste en jean Studio · 45 DT");
  await expect(page.getByLabel(/Associer la vidéo à « Veste en jean Studio »/)).toBeChecked();
  await page.getByRole("button", { name: "Publier la vidéo" }).click();

  await expect(page).toHaveURL(/\/videos$/, { timeout: 30_000 });
  const { data: videos } = await admin
    .from("videos")
    .select("id, status, duration_seconds, video_products (product_id)")
    .eq("shop_id", shop.id);
  expect(videos).toHaveLength(1);
  expect(videos![0].status).toBe("published");
  expect(videos![0].duration_seconds).toBeGreaterThanOrEqual(1);
  expect(videos![0].video_products.map((link) => link.product_id)).toEqual([product.id]);
});

test("studio : refaire une prise et publier sans montage", async ({ page }) => {
  test.setTimeout(90_000);
  const shop = await createApprovedShop();
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/videos/nouvelle`);

  await page.getByRole("button", { name: "Ouvrir la caméra" }).click();
  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();
  await page.getByRole("button", { name: "Refaire" }).click();
  await expect(page.getByRole("button", { name: "Ouvrir la caméra" })).toBeVisible();

  await page.getByRole("button", { name: "Ouvrir la caméra" }).click();
  await page.getByRole("button", { name: "Démarrer l'enregistrement" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Arrêter l'enregistrement" }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await page.getByRole("button", { name: "Publier sans montage" }).click();
  await page.getByLabel("Description").fill("Arrivage du jour");
  await expect(page.getByText("Tu pourras associer des pièces à la vidéo dans « Mes vidéos ».")).toBeVisible();
  await page.getByRole("button", { name: "Publier la vidéo" }).click();
  await expect(page).toHaveURL(/\/videos$/, { timeout: 30_000 });

  const { data } = await admin.from("videos").select("description, status").eq("shop_id", shop.id);
  expect(data).toEqual([{ description: "Arrivage du jour", status: "published" }]);
});

test("studio en arabe : étapes et commandes traduites", async ({ page }) => {
  const shop = await createApprovedShop();
  await signIn(page, shop.owner.email, `/ar/vendeur/boutique/${shop.id}/videos/nouvelle`);
  await expect(page.getByRole("heading", { name: "إنشاء فيديو" })).toBeVisible();
  await expect(page.getByRole("button", { name: "افتح الكاميرا" })).toBeVisible();
  await expect(page.getByRole("list", { name: "مراحل الفيديو" })).toContainText("التصوير");
});
