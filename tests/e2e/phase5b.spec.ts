import { spawnSync } from "node:child_process";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, createAdminUser, createConfirmedUser, PASSWORD, signIn, totp, uniqueEmail } from "./helpers";
import { clientFor, createApprovedShop, PNG, seedProduct } from "./market-helpers";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publicUrl = (bucket: string, path: string) => `${SUPABASE}/storage/v1/object/public/${bucket}/${path}`;
const png = () => new Blob([PNG], { type: "image/png" });

function maintenance(request: APIRequestContext) {
  return request.post("/api/internal/maintenance", {
    headers: { Authorization: `Bearer ${process.env.MAINTENANCE_TOKEN}` },
  });
}

function grant(email: string, fingerprint: string) {
  return spawnSync("node", ["scripts/grant-admin.mjs", email, fingerprint], { env: process.env, encoding: "utf8" });
}

async function submitPassword(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function enrollInUi(page: Page) {
  await page.getByRole("button", { name: "Continuer" }).click();
  const secret = (await page.getByTestId("mfa-secret").textContent())!;
  return secret;
}

test.describe("MFA des administrateurs", () => {
  test("nomination : facteur d'abord, empreinte vérifiée, rôle ensuite, jamais de mot de passe seul", async ({ page }) => {
    const candidate = await createConfirmedUser("candidat", "Admin Neuf");
    const shop = await createApprovedShop();

    const direct = await admin.from("platform_admins").insert({ user_id: candidate.id });
    expect(direct.error?.message).toBe("mfa_required");

    expect(grant(candidate.email, "00000000").status).not.toBe(0);

    await signIn(page, candidate.email, "/preparation-admin");
    await expect(page.getByRole("heading", { name: "Prépare ton accès administrateur" })).toBeVisible();

    const secret = await enrollInUi(page);
    await expect(page.getByRole("img", { name: /Code QR/ })).toBeVisible();

    await page.getByLabel("Code à 6 chiffres").fill("000000");
    await page.getByRole("button", { name: "Activer" }).click();
    await expect(page.getByText("Code incorrect ou expiré.")).toBeVisible();

    await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
    await page.getByRole("button", { name: "Activer" }).click();

    const fingerprint = (await page.getByTestId("mfa-fingerprint").textContent())!;

    expect(grant(candidate.email, "abcdef00").status).not.toBe(0);
    expect((await admin.from("platform_admins").select("user_id").eq("user_id", candidate.id)).data).toEqual([]);

    const granted = grant(candidate.email, fingerprint);
    expect(granted.status, granted.stderr).toBe(0);

    const passwordOnly = await clientFor(candidate.email);
    const refused = await passwordOnly.rpc("review_shop", { p_shop_id: shop.id, p_status: "suspended", p_note: "Tentative" });
    expect(refused.error?.message).toBe("forbidden");

    await page.context().clearCookies();
    await submitPassword(page, candidate.email);
    await expect(page.getByRole("heading", { name: "Second facteur" })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/verification-mfa/);

    await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await page.waitForURL((url) => !url.pathname.includes("verification-mfa"));

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();

    const { data } = await admin.from("audit_logs").select("id").eq("action", "platform_admins.insert").eq("entity_id", candidate.id);
    expect(data).toHaveLength(1);
  });

  test("connexion suivante : code exigé, destination conservée, redirection externe refusée", async ({ page }) => {
    const manager = await createAdminUser();

    await page.goto(`/connexion?next=${encodeURIComponent("/admin/categories")}`);
    await page.getByLabel("Adresse e-mail").fill(manager.email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByRole("heading", { name: "Second facteur" })).toBeVisible();
    await expect(page).toHaveURL(/next=%2Fadmin%2Fcategories/);

    await page.getByLabel("Code à 6 chiffres").fill("12");
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByText("Saisis les 6 chiffres du code.")).toBeVisible();

    await page.getByLabel("Code à 6 chiffres").fill("000000");
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByText("Code incorrect ou expiré.")).toBeVisible();

    await page.getByLabel("Code à 6 chiffres").fill(totp(manager.secret));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);

    await page.context().clearCookies();
    await page.goto(`/connexion?next=${encodeURIComponent("https://malveillant.example")}`);
    await page.getByLabel("Adresse e-mail").fill(manager.email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Second facteur" })).toBeVisible();
    expect(page.url()).not.toContain("malveillant");
    await page.getByLabel("Code à 6 chiffres").fill(totp(manager.secret));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page).toHaveURL(/localhost:3100\/compte$/);
  });

  test("un client et un vendeur ne voient aucun second facteur", async ({ page }) => {
    const shop = await createApprovedShop();

    await signIn(page, shop.owner.email, "/vendeur");
    await expect(page).toHaveURL(/\/vendeur$/);

    await page.goto("/verification-mfa");
    await expect(page).not.toHaveURL(/verification-mfa/);
    expect((await page.goto("/compte/securite"))?.status()).toBe(404);
  });

  test("appareils : dernier protégé, second ajouté, retrait journalisé", async ({ page }) => {
    const manager = await createAdminUser();

    await signIn(page, manager.email, "/compte/securite");
    await expect(page.getByText("Dernier appareil : il ne peut pas être retiré.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Retirer/ })).toHaveCount(0);

    await page.getByLabel("Nom de l'appareil").fill("Téléphone secours");
    const secret = await enrollInUi(page);
    await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
    await page.getByRole("button", { name: "Activer" }).click();
    await expect(page.getByText("Téléphone secours")).toBeVisible();

    await page.getByRole("button", { name: "Retirer Téléphone secours" }).click();
    await expect(page.getByText("Appareil retiré")).toBeVisible();
    await expect(page.getByText("Téléphone secours")).toHaveCount(0);

    const { data } = await admin.from("audit_logs").select("id").eq("action", "mfa.removed").eq("entity_id", manager.id);
    expect(data).toHaveLength(1);
  });

  test("avec le mot de passe seul, impossible d'ajouter ou de retirer un facteur", async () => {
    const manager = await createAdminUser();
    const passwordOnly = await clientFor(manager.email);

    const { data: factors } = await passwordOnly.auth.mfa.listFactors();
    const removed = await passwordOnly.auth.mfa.unenroll({ factorId: factors!.totp[0].id });
    expect(removed.error).not.toBeNull();

    const added = await passwordOnly.auth.mfa.enroll({ factorType: "totp", friendlyName: "Intrus" });
    expect(added.error).not.toBeNull();

    expect((await admin.auth.admin.mfa.listFactors({ userId: manager.id })).data?.factors).toHaveLength(1);
  });

  test("récupération : rôle retiré, sessions coupées à l'instant, nomination à refaire", async ({ page }) => {
    const manager = await createAdminUser();

    await signIn(page, manager.email, "/admin");
    await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();

    const session = await clientFor(manager.email);
    const { data: factors } = await session.auth.mfa.listFactors();
    expect((await session.auth.mfa.challengeAndVerify({ factorId: factors!.totp[0].id, code: totp(manager.secret) })).error).toBeNull();
    expect((await session.rpc("admin_list_users", { p_search: "", p_limit: 1, p_offset: 0 })).error).toBeNull();

    const refused = spawnSync("node", ["scripts/reset-admin-mfa.mjs", manager.email], { env: process.env, encoding: "utf8" });
    expect(refused.status).not.toBe(0);

    const stranger = spawnSync("node", ["scripts/reset-admin-mfa.mjs", uniqueEmail("inconnu"), "Op", "Perte"], {
      env: process.env,
      encoding: "utf8",
    });
    expect(stranger.status).not.toBe(0);

    const reset = spawnSync("node", ["scripts/reset-admin-mfa.mjs", manager.email, "Opérateur Un", "Téléphone perdu"], {
      env: process.env,
      encoding: "utf8",
    });
    expect(reset.status, reset.stderr).toBe(0);

    expect((await session.rpc("admin_list_users", { p_search: "", p_limit: 1, p_offset: 0 })).error?.message).toBe("forbidden");
    expect((await session.auth.refreshSession()).error).not.toBeNull();

    expect((await page.goto("/admin"))?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toHaveCount(0);

    expect((await admin.auth.admin.mfa.listFactors({ userId: manager.id })).data?.factors).toHaveLength(0);
    expect((await admin.from("platform_admins").select("user_id").eq("user_id", manager.id)).data).toEqual([]);

    const { data } = await admin.from("audit_logs").select("metadata").eq("action", "mfa.reset").eq("entity_id", manager.id).single();
    expect(data?.metadata).toMatchObject({ operator: "Opérateur Un", reason: "Téléphone perdu" });

    expect((await admin.from("platform_admins").insert({ user_id: manager.id })).error?.message).toBe("mfa_required");
  });

  test("un administrateur privé de facteur ne peut pas s'en recréer un depuis l'écran de connexion", async ({ page }) => {
    const manager = await createAdminUser();
    const { data } = await admin.auth.admin.mfa.listFactors({ userId: manager.id });
    await admin.auth.admin.mfa.deleteFactor({ id: data!.factors[0].id, userId: manager.id });

    await submitPassword(page, manager.email);
    await expect(page.getByRole("heading", { name: "Accès administrateur suspendu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer" })).toHaveCount(0);

    await page.goto("/admin");
    await expect(page).toHaveURL(/verification-mfa/);
  });

  test("le client Supabase du navigateur ne donne pas accès aux données d'administration en aal1", async () => {
    const manager = await createAdminUser();
    const anonymous = createClient(SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await anonymous.auth.signInWithPassword({ email: manager.email, password: PASSWORD });

    expect((await anonymous.from("audit_logs").select("id")).data).toEqual([]);
    expect((await anonymous.from("reports").select("id")).data).toEqual([]);
    expect((await anonymous.rpc("admin_list_users", { p_search: "", p_limit: 5, p_offset: 0 })).error?.message).toBe("forbidden");
  });
});

test.describe("maintenance", () => {
  test("appels refusés : sans jeton, faux, en paramètre, mauvaise méthode", async ({ request }) => {
    expect((await request.post("/api/internal/maintenance")).status()).toBe(404);
    expect((await request.post("/api/internal/maintenance", { headers: { Authorization: "Bearer faux" } })).status()).toBe(404);
    expect((await request.post(`/api/internal/maintenance?token=${process.env.MAINTENANCE_TOKEN}`)).status()).toBe(404);
    expect((await request.get("/api/internal/maintenance")).status()).toBe(405);
  });

  test("répétée, elle ne refait rien et ne touche pas aux fichiers légitimes", async ({ request }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const seller = await clientFor(shop.owner.email);
    const legit = `${shop.id}/${product.id}/legitime.png`;
    const abandoned = `${shop.id}/${product.id}/abandonne.png`;

    await seller.storage.from("product-images").upload(legit, png());
    await seller.storage.from("product-images").upload(abandoned, png());
    await admin.from("product_images").insert({ product_id: product.id, path: legit });

    await admin.from("storage_purge_queue").insert([
      { bucket: "product-images", path: abandoned, reason: "orphan" },
      { bucket: "product-images", path: legit, reason: "orphan" },
    ]);

    const first = await maintenance(request);
    expect(first.status()).toBe(200);

    expect((await fetch(publicUrl("product-images", abandoned))).ok).toBe(false);
    expect((await fetch(publicUrl("product-images", legit))).ok).toBe(true);

    const { data: kept } = await admin.from("storage_purge_queue").select("outcome").eq("path", legit).single();
    expect(kept?.outcome).toBe("kept");

    for (let run = 0; run < 2; run += 1) {
      const again = await maintenance(request);
      expect(again.status()).toBe(200);
      expect(await again.json()).toMatchObject({ storage: { removed: 0, failed: 0 } });
    }

    expect((await fetch(publicUrl("product-images", legit))).ok).toBe(true);
  });

  test("surveillance : jeton exigé, passage récent, alerte si la maintenance s'arrête", async ({ request }) => {
    const status = (token: string) =>
      request.post("/api/internal/maintenance/status", { headers: { Authorization: `Bearer ${token}` } });

    expect((await request.post("/api/internal/maintenance/status")).status()).toBe(404);
    expect((await status("faux")).status()).toBe(404);

    await maintenance(request);

    const healthy = await status(process.env.MAINTENANCE_TOKEN!);
    expect(healthy.status()).toBe(200);
    expect(await healthy.json()).toMatchObject({ stale: false, stuckFiles: 0, stuckAccounts: 0 });

    await admin.from("maintenance_runs").update({ started_at: new Date(Date.now() - 7_200_000).toISOString() }).eq("status", "succeeded");

    const stale = await status(process.env.MAINTENANCE_TOKEN!);
    expect(stale.status()).toBe(503);
    expect(await stale.json()).toMatchObject({ stale: true });
  });

  test("une exécution à la fois, verrou repris après un passage interrompu, historique tenu", async ({ request }) => {
    const { data: run } = await admin.from("maintenance_runs").insert({ status: "running" }).select("id").single();

    expect((await maintenance(request)).status()).toBe(409);

    await admin.from("maintenance_runs").update({ started_at: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", run!.id);

    expect((await maintenance(request)).status()).toBe(200);

    const { data: runs } = await admin.from("maintenance_runs").select("id, status").eq("id", run!.id).single();
    expect(runs?.status).toBe("expired");

    const { data: last } = await admin
      .from("maintenance_runs")
      .select("status, finished_at, result")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    expect(last).toMatchObject({ status: "succeeded", result: { storage: { failed: 0 } } });
    expect(last?.finished_at).not.toBeNull();
  });

  test("appels simultanés : jamais deux passages en même temps", async ({ request }) => {
    const statuses = (await Promise.all([1, 2, 3, 4].map(() => maintenance(request)))).map((response) => response.status());

    expect(statuses.every((status) => status === 200 || status === 409)).toBe(true);
    expect(statuses).toContain(200);

    const { count } = await admin.from("maintenance_runs").select("id", { count: "exact", head: true }).eq("status", "running");
    expect(count).toBe(0);
  });

  test("la file refuse un bucket inconnu, que Storage marquerait retiré à tort", async () => {
    const { error } = await admin.from("storage_purge_queue").insert({ bucket: "seau-inexistant", path: "x/y", reason: "test" });

    expect(error?.code).toBe("23514");
  });

  test("le journal d'administration affiche la dernière maintenance", async ({ page, request }) => {
    const manager = await createAdminUser();
    await maintenance(request);

    await signIn(page, manager.email, "/admin");
    await expect(page.getByText(/Dernière maintenance : .*\(succeeded\)/)).toBeVisible();
  });

  test("le script du planificateur réussit avec le jeton et signale un mauvais jeton", () => {
    const url = "http://localhost:3100/api/internal/maintenance";

    const ok = spawnSync("node", ["scripts/run-maintenance.mjs"], {
      env: { ...process.env, MAINTENANCE_URL: url },
      encoding: "utf8",
    });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).not.toContain(process.env.MAINTENANCE_TOKEN!);

    const refused = spawnSync("node", ["scripts/run-maintenance.mjs"], {
      env: { ...process.env, MAINTENANCE_URL: url, MAINTENANCE_TOKEN: "f".repeat(40) },
      encoding: "utf8",
    });
    expect(refused.status).toBe(1);

    const missing = spawnSync("node", ["scripts/run-maintenance.mjs"], {
      env: { ...process.env, MAINTENANCE_URL: "" },
      encoding: "utf8",
    });
    expect(missing.status).toBe(1);
  });
});

test.describe("retrait de contenu", () => {
  test("retrait d'urgence : fichiers retirés même si la suspension est ensuite levée", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id, { title: "Contenu dangereux" });
    const manager = await createAdminUser();
    const seller = await clientFor(shop.owner.email);
    const photo = `${shop.id}/${product.id}/illegale.png`;
    const logo = `${shop.id}/logo.png`;

    await seller.storage.from("product-images").upload(photo, png());
    await admin.from("product_images").insert({ product_id: product.id, path: photo });
    await seller.storage.from("shop-assets").upload(logo, png());
    await admin.from("shops").update({ logo_path: logo }).eq("id", shop.id);

    const { data: videoId } = await seller.rpc("create_video_draft", { p_shop_id: shop.id, p_description: "Vidéo" });
    const video = `${shop.id}/${videoId}/video.webm`;
    await seller.storage.from("shop-videos").upload(video, new Blob(["x"], { type: "video/webm" }));
    await admin.from("videos").update({
      status: "published",
      video_path: video,
      thumbnail_path: `${shop.id}/${videoId}/thumbnail.jpg`,
      duration_seconds: 5,
      published_at: new Date().toISOString(),
    }).eq("id", videoId);

    for (const [bucket, path] of [["product-images", photo], ["shop-assets", logo], ["shop-videos", video]]) {
      expect((await fetch(publicUrl(bucket, path))).ok).toBe(true);
    }

    await signIn(page, manager.email, "/admin/boutiques");
    await page.getByRole("listitem").filter({ hasText: shop.name }).getByRole("button", { name: "Retrait d'urgence" }).click();
    await page.getByLabel(/^Motif/).fill("Contenu potentiellement illégal");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Contenus retirés et boutique suspendue")).toBeVisible();

    for (const [bucket, path] of [["product-images", photo], ["shop-assets", logo], ["shop-videos", video]]) {
      await expect.poll(async () => (await fetch(publicUrl(bucket, path))).ok).toBe(false);
    }

    await page.getByRole("listitem").filter({ hasText: shop.name }).getByRole("button", { name: "Rétablir" }).click();
    await expect.poll(async () => (await admin.from("shops").select("status").eq("id", shop.id).single()).data?.status).toBe("approved");

    const { data } = await admin.from("products").select("publication_status, moderated_at").eq("id", product.id).single();
    expect(data?.publication_status).toBe("archived");
    expect(data?.moderated_at).not.toBeNull();

    const republish = await seller.rpc("set_products_publication", { p_product_ids: [product.id], p_status: "published" });
    expect(republish.data?.[0]?.problem).toBe("moderated");

    await page.context().clearCookies();
    expect((await page.goto(`/produit/${product.id}`))?.status()).toBe(404);
  });

  test("vidéo retirée directement, sans signalement", async ({ page }) => {
    const shop = await createApprovedShop();
    const manager = await createAdminUser();
    const seller = await clientFor(shop.owner.email);
    const { data: videoId } = await seller.rpc("create_video_draft", { p_shop_id: shop.id, p_description: "A retirer vite" });
    const video = `${shop.id}/${videoId}/video.webm`;

    await seller.storage.from("shop-videos").upload(video, new Blob(["x"], { type: "video/webm" }));
    await admin.from("videos").update({
      status: "published",
      video_path: video,
      thumbnail_path: `${shop.id}/${videoId}/thumbnail.jpg`,
      duration_seconds: 5,
      published_at: new Date().toISOString(),
    }).eq("id", videoId);

    await signIn(page, manager.email, "/admin/videos");
    await page.getByRole("listitem").filter({ hasText: "A retirer vite" }).getByRole("button", { name: "Retirer" }).click();
    await page.getByLabel("Motif interne").fill("Urgence");
    await page.getByRole("button", { name: "Confirmer" }).click();

    await expect.poll(async () => (await fetch(publicUrl("shop-videos", video))).ok).toBe(false);
  });

  test("produit masqué par la boutique : page fermée, fichier conservé car la décision est réversible", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    const seller = await clientFor(shop.owner.email);
    const photo = `${shop.id}/${product.id}/masquee.png`;

    await seller.storage.from("product-images").upload(photo, png());
    await admin.from("product_images").insert({ product_id: product.id, path: photo });
    await seller.rpc("set_products_publication", { p_product_ids: [product.id], p_status: "archived" });

    expect((await page.goto(`/produit/${product.id}`))?.status()).toBe(404);
    expect((await fetch(publicUrl("product-images", photo))).ok).toBe(true);

    const { count } = await admin.from("storage_purge_queue").select("id", { count: "exact", head: true }).eq("path", photo);
    expect(count).toBe(0);
  });
});
