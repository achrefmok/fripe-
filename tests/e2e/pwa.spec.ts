import { expect, test } from "@playwright/test";
import { createConfirmedUser, signIn } from "./helpers";

test("le manifest décrit une application installable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");

  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test("le service worker couvre le site et sert la page hors ligne", async ({ page, context }) => {
  await page.goto("/");
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toBe("http://localhost:3100/");

  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto("/confidentialite");
  await expect(page.getByRole("heading", { name: "Pas de réseau" })).toBeVisible();
  await context.setOffline(false);
});

test("aucune page authentifiée n'est mise en cache", async ({ page }) => {
  const { email } = await createConfirmedUser("cache", "Donnée Privée");
  await signIn(page, email);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.goto("/compte");
  await expect(page.getByRole("heading", { name: "Salut Donnée Privée" })).toBeVisible();

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];

    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        urls.push(request.url);
      }
    }

    return urls;
  });

  expect(cached.filter((url) => /\/(compte|vendeur|admin)/.test(url))).toEqual([]);
});

test("la page hors ligne suit la langue de l'utilisateur", async ({ page, context }) => {
  await page.goto("/ar");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.goto("/ar/confidentialite");
  await expect(page.getByRole("heading", { name: "لا توجد شبكة" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await context.setOffline(false);
});
