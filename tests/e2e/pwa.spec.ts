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

test.describe("bouton d'installation", () => {
  test("Android : la fenêtre d'installation du navigateur s'ouvre au clic", async ({ page }) => {
    await page.goto("/catalogue");
    await expect(page.getByTestId("install-button")).toBeVisible();

    // Chrome émet cet événement quand l'application est installable ; on le simule ici.
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      event.prompt = async () => {
        (window as unknown as { __prompted: boolean }).__prompted = true;
      };
      event.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(event);
    });

    await page.getByTestId("install-button").click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
    // Aucune notice : la fenêtre du navigateur a pris le relais.
    await expect(page.locator("[data-platform]")).toHaveCount(0);
  });

  test("déjà installée : le bouton disparaît", async ({ page }) => {
    await page.emulateMedia({ media: "screen" });
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query === "(display-mode: standalone)" ? ({ ...original(query), matches: true, addEventListener() {}, removeEventListener() {} } as MediaQueryList) : original(query);
    });
    await page.goto("/catalogue");
    await expect(page.getByRole("navigation", { name: "Rubriques" })).toBeVisible();
    await expect(page.getByTestId("install-button")).toHaveCount(0);
  });

  test.describe("iPhone", () => {
    test.use({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      viewport: { width: 320, height: 568 },
    });

    test("les gestes du menu Partager, dans l'écran, en français et en arabe", async ({ page }) => {
      await page.goto("/catalogue");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      await page.getByRole("button", { name: "Installer l'application FRIPE" }).click();
      const sheet = page.getByRole("dialog", { name: "Installer FRIPE" });
      await expect(sheet.getByText("Sur l'écran d'accueil", { exact: false })).toBeVisible();
      await expect(sheet.locator("[data-platform=ios]")).toBeVisible();
      await sheet.getByRole("button", { name: "Fermer" }).click();
      await expect(sheet).toHaveCount(0);

      await page.goto("/ar/catalogue");
      await page.getByRole("button", { name: "تثبيت تطبيق FRIPE" }).click();
      await expect(page.getByRole("dialog").getByText("إضافة إلى الشاشة الرئيسية", { exact: false })).toBeVisible();
    });
  });

  test.describe("navigateur d'Instagram", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0" });

    test("invite à ouvrir le vrai navigateur et propose de copier le lien", async ({ page }) => {
      await page.goto("/catalogue");
      await page.getByTestId("install-button").click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.locator("[data-platform=inapp]")).toBeVisible();
      await expect(sheet.getByRole("button", { name: "Copier le lien" })).toBeVisible();
    });
  });
});
