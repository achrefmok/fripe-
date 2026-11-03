import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, createConfirmedUser, signIn } from "./helpers";
import { clientFor, createApprovedShop, PNG, seedProduct } from "./market-helpers";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const host = new URL(SUPABASE).host;

function seed(env: Record<string, string>) {
  return spawnSync("node", ["scripts/seed-staging.mjs"], { env: { ...process.env, ...env }, encoding: "utf8" });
}

async function signedIn(email: string, password: string) {
  const client = createClient(SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  return client;
}

test.describe("jeu de données fictif", () => {
  test("garde-fous : jamais la base locale, confirmation exigée", () => {
    const blocked = seed({ FRIPE_ENV: "development", FRIPE_SEED_CONFIRM: host });
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toContain("FRIPE_ENV");

    const unconfirmed = seed({ FRIPE_ENV: "staging", FRIPE_SEED_CONFIRM: "autre-hote" });
    expect(unconfirmed.status).not.toBe(0);

    const local = seed({
      FRIPE_ENV: "staging",
      FRIPE_SEED_CONFIRM: "127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });

    expect(local.status).not.toBe(0);
    expect(local.stderr).toContain("base locale");
  });

  test("création, relance sans doublon, comptes isolés, administrateur sans rôle", async ({ page }) => {
    const folder = mkdtempSync(join(tmpdir(), "fripe-seed-"));
    const out = join(folder, "comptes.json");
    const env = { FRIPE_ENV: "staging", FRIPE_SEED_CONFIRM: host, FRIPE_SEED_OUT: out };

    try {
      const first = seed(env);
      expect(first.status, first.stderr).toBe(0);
      expect(first.stdout).not.toContain("password");

      const accounts = JSON.parse(readFileSync(out, "utf8"));
      expect(Object.keys(accounts).sort()).toEqual(["admin", "clientA", "clientB", "shopA", "shopB"]);

      const { data: shops } = await admin.from("shops").select("id, slug, status").in("slug", ["demo-boutique-a", "demo-boutique-b"]);
      expect(shops).toHaveLength(2);
      expect(shops!.every((shop) => shop.status === "approved")).toBe(true);

      const shopA = shops!.find((shop) => shop.slug === "demo-boutique-a")!;
      const shopB = shops!.find((shop) => shop.slug === "demo-boutique-b")!;

      const again = seed(env);
      expect(again.status, again.stderr).toBe(0);

      const { count } = await admin.from("products").select("id", { count: "exact", head: true }).in("shop_id", [shopA.id, shopB.id]);
      expect(count).toBe(16);

      const looks = await admin.from("collections").select("id", { count: "exact", head: true }).in("shop_id", [shopA.id, shopB.id]);
      expect(looks.count).toBe(2);

      const { data: demoAdmin } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const adminId = demoAdmin.users.find((user) => user.email === "admin.demo@example.com")!.id;
      expect((await admin.from("platform_admins").select("user_id").eq("user_id", adminId)).data).toEqual([]);

      const emails = demoAdmin.users.map((user) => user.email ?? "").filter((email) => email.endsWith("@example.com"));
      expect(emails.every((email) => /^(admin\.demo|boutique\.[ab]|client\.[ab])@example\.com$/.test(email))).toBe(true);

      const sellerA = await signedIn(accounts.shopA.email, accounts.shopA.password);
      const clientA = await signedIn(accounts.clientA.email, accounts.clientA.password);
      const clientB = await signedIn(accounts.clientB.email, accounts.clientB.password);

      const stolen = await sellerA.from("products").update({ price_millimes: 1 }).eq("shop_id", shopB.id).select("id");
      expect(stolen.data).toEqual([]);

      const { data: productB } = await admin.from("products").select("id").eq("shop_id", shopB.id).limit(1).single();

      const { data: groupId, error } = await clientA.rpc("place_order", {
        p_product_ids: [productB!.id],
        p_pickup_shop_ids: [shopB.id],
        p_recipient_name: "Client Démo A",
        p_phone: "+21622000000",
        p_governorate_id: null,
        p_city_id: null,
        p_address_line: null,
      });

      expect(error).toBeNull();
      expect((await clientB.from("order_groups").select("id").eq("id", groupId)).data).toEqual([]);
      expect((await sellerA.from("order_groups").select("id").eq("id", groupId)).data).toEqual([]);

      await page.goto("/boutique/demo-boutique-a");
      await expect(page.getByRole("heading", { name: "Boutique Démo A" })).toBeVisible();
      await expect(page.locator("main img").first()).toBeVisible();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

test.describe("limites de l'hébergement", () => {
  test("une image de plus de 4 Mo est refusée avec un message clair", async ({ page }) => {
    const shop = await createApprovedShop();

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/reglages`);

    const large = Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024 + 1024)]);
    await page.locator("input[type=file]").first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: large });

    await expect(page.getByText("L'image dépasse 4 Mo.")).toBeVisible();
  });

  test("une image proche de la limite passe en moins de 4,5 Mo de requête", async ({ page }) => {
    const shop = await createApprovedShop();
    const product = await seedProduct(shop.id);
    let bodySize = 0;

    page.on("request", (request) => {
      if (request.method() === "POST") bodySize = Math.max(bodySize, request.postDataBuffer()?.length ?? 0);
    });

    await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits/${product.id}`);

    const near = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);
    await page.locator("input[type=file]").first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: near });

    await expect.poll(async () => {
      const { count } = await admin.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", product.id);
      return count;
    }).toBe(2);

    expect(bodySize).toBeLessThan(4.5 * 1024 * 1024);
  });
});

test.describe("préproduction", () => {
  test("hors préproduction, ni bandeau ni blocage de l'indexation", async ({ page, request }) => {
    const response = await page.goto("/");

    expect(response?.headers()["x-robots-tag"]).toBeUndefined();
    await expect(page.getByText("Version de test.")).toHaveCount(0);

    expect(await (await request.get("/robots.txt")).text()).toContain("Allow: /");
  });

  test("le compte de démonstration d'un autre client ne devient jamais administrateur par son mot de passe", async () => {
    const user = await createConfirmedUser("sansrole");
    const client = await clientFor(user.email);

    expect((await client.from("platform_admins").insert({ user_id: user.id })).error).not.toBeNull();
  });
});
