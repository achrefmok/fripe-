// Scénarios d'utilisation : on se comporte comme une vraie personne (clics, saisie, menus, envois de
// formulaires), en arabe et en français, sur téléphone et sur ordinateur. Les libellés viennent des
// fichiers de traduction : un bouton mal traduit fait échouer le scénario.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import { makeSession } from "./faux-supabase-complet.mjs";
import { inspectPage } from "./inspection.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const messages = {
  fr: JSON.parse(readFileSync(join(ROOT, "src/messages/fr.json"), "utf8")),
  ar: JSON.parse(readFileSync(join(ROOT, "src/messages/ar.json"), "utf8")),
};
const PRODUCT = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const exact = (text) => new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);

export const RUNS = [
  { key: "ar-mobile", locale: "ar", context: { ...devices["Pixel 7"] } },
  { key: "fr-desktop", locale: "fr", context: { viewport: { width: 1440, height: 900 } } },
  { key: "ar-tablette", locale: "ar", context: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
];

// Chaque scénario reçoit la page, les messages de la langue et un `check(nom, condition, détail)`.
export const SCENARIOS = [
  {
    name: "Navigation principale",
    async run({ page, go, m, check, mobile }) {
      await go("/");
      // Téléphone : la barre du bas ; tablette et ordinateur : la barre du haut.
      const tabbar = page.locator(".luxe-tabbar");
      const useTabbar = mobile && (await tabbar.isVisible().catch(() => false));
      const nav = useTabbar ? tabbar : page.getByRole("navigation", { name: m.nav.mainLabel });
      check("La navigation est visible", await nav.first().isVisible());
      const [target, path] = useTabbar ? [m.nav.chine, "/chine"] : [m.nav.videDressing, "/vide-dressing"];
      await nav.first().getByRole("link", { name: target }).first().click();
      await page.waitForURL((url) => url.pathname.endsWith(path), { timeout: 30_000 }).catch(() => {});
      check(`Le lien « ${target} » mène à sa page`, page.url().includes(path), page.url());
    },
  },
  {
    name: "Changer de langue",
    async run({ page, go, m, locale, check }) {
      await go("/catalogue");
      const switcher = page.getByRole("link", { name: m.common.languageLabel }).or(page.getByRole("button", { name: m.common.languageLabel })).first();
      check("Le bouton de langue existe", await switcher.isVisible());
      await switcher.click();
      await page.waitForURL((url) => (locale === "fr" ? url.pathname.startsWith("/ar") : !url.pathname.startsWith("/ar")), { timeout: 30_000 }).catch(() => {});
      await page.waitForLoadState("networkidle");
      const dir = await page.evaluate(() => document.documentElement.dir);
      check("La langue change et le sens suit", locale === "fr" ? dir === "rtl" && page.url().includes("/ar/") : dir === "ltr" && !page.url().includes("/ar/"), `${page.url()} dir=${dir}`);
      check("On reste sur la même page", page.url().includes("/catalogue"), page.url());
    },
  },
  {
    name: "Changer de thème",
    async run({ page, go, m, check }) {
      await go("/");
      const button = page.getByRole("button", { name: m.common.theme }).first();
      check("Le bouton de thème existe", await button.isVisible());
      const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      await button.click();
      const option = page.getByRole("menuitemradio", { name: before ? m.common.themeLight : m.common.themeDark }).or(page.getByRole("menuitem", { name: before ? m.common.themeLight : m.common.themeDark }));
      if (await option.first().isVisible().catch(() => false)) await option.first().click();
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      check("Le thème bascule", after !== before, `sombre avant=${before} après=${after}`);
    },
  },
  {
    name: "Rechercher et filtrer le catalogue",
    async run({ page, go, m, check }) {
      await go("/catalogue");
      const search = page.getByRole("searchbox").or(page.getByLabel(m.catalog.searchLabel)).first();
      await search.fill("veste");
      await search.press("Enter");
      await page.waitForURL(/q=veste/, { timeout: 15_000 }).catch(() => {});
      check("La recherche passe dans l'adresse", page.url().includes("q=veste"), page.url());
      const filters = page.getByRole("button", { name: new RegExp(m.catalog.filters) }).first();
      await filters.click();
      // Le panneau s'ouvre dans la page (catalogue) ou dans une feuille qui monte du bas.
      const panel = page.locator("#catalog-filters:not([hidden])").or(page.getByRole("dialog")).first();
      await panel.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      check("Le panneau de filtres s'ouvre", await panel.isVisible());
      check("Le bouton annonce son état ouvert", (await filters.getAttribute("aria-expanded")) !== "false");
      const condition = panel.getByLabel(m.catalog.condition);
      if (await condition.count()) {
        await condition.selectOption({ index: 1 });
        await panel.getByRole("button", { name: m.catalog.apply }).click();
        await page.waitForURL(/etat=/, { timeout: 15_000 }).catch(() => {});
        check("Le filtre d'état s'applique", page.url().includes("etat="), page.url());
      } else check("Le filtre d'état existe", false);
    },
  },
  {
    name: "Connexion : erreurs puis succès",
    async run({ page, go, m, check, findLatin }) {
      await go("/connexion");
      const submit = page.getByRole("button", { name: exact(m.auth.signIn) }).first();
      await submit.click();
      await page.waitForTimeout(500);
      const invalid = await page.locator("[aria-invalid=true]").count();
      check("Envoyer vide signale les champs", invalid > 0, `${invalid} champ(s) signalé(s)`);
      await findLatin("après l'envoi vide");
      await page.getByLabel(m.auth.email).first().fill("lina@exemple.tn");
      const password = page.getByLabel(m.auth.password, { exact: true }).first();
      if (await password.isVisible().catch(() => false)) await password.fill("motdepasse-solide-1");
      await submit.click();
      await page.waitForURL((url) => !url.pathname.endsWith("/connexion"), { timeout: 20_000 }).catch(() => {});
      check("La connexion mène hors de la page de connexion", !page.url().endsWith("/connexion"), page.url());
    },
  },
  {
    name: "Inscription : validation",
    async run({ page, go, m, check, findLatin }) {
      await go("/inscription");
      await page.getByRole("button", { name: exact(m.auth.signUp) }).first().click();
      await page.waitForTimeout(500);
      check("Envoyer vide signale les champs", (await page.locator("[aria-invalid=true]").count()) > 0);
      await findLatin("messages d'erreur");
      await page.getByLabel(m.auth.password, { exact: true }).first().fill("123");
      await page.getByRole("button", { name: exact(m.auth.signUp) }).first().click();
      await page.waitForTimeout(400);
      check("Un mot de passe trop court est refusé", (await page.getByLabel(m.auth.password, { exact: true }).first().getAttribute("aria-invalid")) === "true");
    },
  },
  {
    name: "Mot de passe oublié",
    async run({ page, go, m, check }) {
      await go("/mot-de-passe-oublie");
      await page.getByLabel(m.auth.email).first().fill("lina@exemple.tn");
      await page.getByRole("button", { name: m.auth.forgotSubmit }).click();
      await page.waitForTimeout(1500);
      check("Le message de confirmation s'affiche", await page.getByText(m.auth.forgotSent.slice(0, 25)).first().isVisible().catch(() => false));
    },
  },
  {
    name: "Fiche produit : favori, panier, signalement",
    auth: true,
    async run({ page, go, m, check, findLatin }) {
      await go(`/produit/${PRODUCT}`);
      check("La fiche s'affiche", await page.locator("h1").first().isVisible());
      const buttons = await page.locator("main button").evaluateAll((list) => list.map((button) => (button.innerText || button.getAttribute("aria-label") || "").trim()).filter(Boolean));
      check("La fiche propose des actions", buttons.length > 0, buttons.slice(0, 6).join(" | "));
      const report = page.getByRole("button", { name: new RegExp(m.moderation?.report ?? "Signaler") }).first();
      if (await report.isVisible().catch(() => false)) {
        await report.click();
        const dialog = page.getByRole("dialog");
        check("Le signalement s'ouvre dans une fenêtre", await dialog.isVisible());
        await findLatin("fenêtre de signalement");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
        check("La fenêtre se ferme avec Échap", !(await dialog.isVisible().catch(() => false)));
      }
    },
  },
  {
    name: "Nouvelle annonce : validation du formulaire",
    auth: true,
    async run({ page, go, check, findLatin }) {
      await go("/compte/annonces/nouvelle?rubrique=vide_dressing");
      const submit = page.locator("main form button[type=submit]").first();
      check("Le formulaire a un bouton d'envoi", await submit.isVisible());
      await submit.click();
      await page.locator("[aria-invalid=true]").first().waitFor({ timeout: 10_000 }).catch(() => {});
      const invalid = await page.locator("[aria-invalid=true]").count();
      check("Envoyer vide signale les champs", invalid > 0, `${invalid} champ(s)`);
      const described = await page.locator("[aria-invalid=true][aria-describedby]").count();
      check("Chaque champ invalide annonce son erreur", described === invalid, `${described}/${invalid}`);
      await findLatin("erreurs du formulaire");
      const usable = await page.locator("main form select:not([disabled])").evaluateAll((list) => list.findIndex((select) => select.options.length > 1));
      const select = page.locator("main form select:not([disabled])").nth(Math.max(usable, 0));
      if (usable >= 0) {
        await select.selectOption({ index: 1 });
        check("Une liste se choisit au clavier comme à la souris", (await select.inputValue()) !== "");
      }
    },
  },
  {
    name: "Profil : enregistrer",
    auth: true,
    async run({ page, go, m, check }) {
      await go("/compte/profil");
      const save = page.getByRole("button", { name: exact(m.common.save) }).first();
      check("Le bouton Enregistrer existe", await save.isVisible().catch(() => false));
      if (await save.isVisible().catch(() => false)) {
        await save.click();
        await page.waitForTimeout(1500);
        const toast = await page.locator("[data-sonner-toast]").first().innerText().catch(() => "");
        check("Un retour s'affiche après l'enregistrement", Boolean(toast) || (await page.getByText(m.common.saved).count()) > 0, toast);
      }
    },
  },
  {
    name: "Menu du compte et déconnexion",
    auth: true,
    async run({ page, go, m, check, mobile }) {
      await go("/compte");
      const signOut = page.getByRole("button", { name: m.common.signOut }).or(page.getByRole("menuitem", { name: m.common.signOut })).first();
      if (!(await signOut.isVisible().catch(() => false))) {
        const account = page.getByRole("link", { name: m.nav.account }).or(page.getByRole("button", { name: m.nav.account })).first();
        if (await account.isVisible().catch(() => false)) await account.click();
      }
      check(`« ${m.common.signOut} » est accessible${mobile ? " sur téléphone" : ""}`, await signOut.isVisible().catch(() => false));
    },
  },
  {
    name: "Espace vendeur : nouveau produit",
    auth: true,
    async run({ page, go, check, findLatin }) {
      await go("/vendeur/boutique/5b0b5b0b-1111-4222-8333-444455556666/produits/nouveau");
      const submit = page.locator("main form button[type=submit]").first();
      check("Le formulaire produit s'affiche", await submit.isVisible().catch(() => false));
      if (await submit.isVisible().catch(() => false)) {
        // Un produit peut rester en brouillon : l'enregistrer vide mène à sa fiche d'édition.
        await page.locator("main form input:not([type=hidden]):not([type=file])").first().fill("قميص كتان");
        await submit.click();
        await page.waitForURL((url) => !url.pathname.endsWith("/nouveau"), { timeout: 20_000 }).catch(() => {});
        check("Le brouillon s'enregistre et ouvre sa fiche", !page.url().endsWith("/nouveau"), page.url());
        await findLatin("fiche du produit");
      }
    },
  },
];

export async function runScenarios({ site, shots, revive, log = console.log }) {
  const browser = await chromium.launch();
  const session = makeSession();
  const results = [];

  for (const run of RUNS) {
    log(`\n== Scénarios · ${run.key}`);
    for (const scenario of SCENARIOS) {
      const context = await browser.newContext({ ...run.context, locale: run.locale === "ar" ? "ar-TN" : "fr-FR" });
      await context.route(/contentsquare\.(net|com)/, (route) => route.abort());
      // Le cookie « déjà vu » de la page Découvrir : sans lui, « / » y redirige (src/features/landing/intro.ts).
      await context.addCookies([{ name: "fripe_decouvert", value: "1", url: site }]);
      if (scenario.auth) await context.addCookies([{ name: "sb-localhost-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: site }]);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message.split("\n")[0]));
      const m = messages[run.locale];
      const steps = [];
      const check = (name, ok, detail = "") => steps.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
      const open = (path) => page.goto(`${site}${run.locale === "ar" ? "/ar" : ""}${path === "/" && run.locale === "ar" ? "" : path}`, { waitUntil: "networkidle", timeout: 90_000 });
      const go = (path) =>
        open(path).catch(async (error) => {
          if (!revive || !/Timeout/.test(error.message)) throw error;
          log(`  … ${path} ne répond pas : relance du serveur dev`);
          await revive();
          return open(path);
        });
      const findLatin = async (where) => {
        if (run.locale !== "ar") return;
        const result = await page.evaluate(inspectPage, { arabic: true });
        const texts = result.latin.map((item) => item.text).filter((text) => !/Français|alt\+T|NomFR|نص تجريبي|^app$/.test(text));
        check(`Tout est en arabe (${where})`, texts.length === 0, texts.slice(0, 4).join(" | "));
      };
      try {
        await scenario.run({ page, go, m, locale: run.locale, check, findLatin, mobile: Boolean(run.context.isMobile) });
      } catch (error) {
        check("Le scénario va jusqu'au bout", false, error.message.split("\n")[0].slice(0, 200));
      }
      if (errors.length) check("Aucune erreur JavaScript", false, errors[0]);
      const failed = steps.filter((step) => !step.ok);
      if (shots && failed.length) await page.screenshot({ path: join(shots, `scenario-${run.key}-${scenario.name.replace(/\W+/g, "_")}.png`) }).catch(() => {});
      results.push({ run: run.key, scenario: scenario.name, steps });
      log(`${failed.length ? "  ✗" : "  ✓"} ${scenario.name}${failed.length ? ` — ${failed.map((step) => `${step.name}${step.detail ? ` (${step.detail})` : ""}`).join(" ; ")}` : ""}`);
      await context.close();
    }
  }
  await browser.close();
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [site = "http://localhost:3300"] = process.argv.slice(2);
  const results = await runScenarios({ site, shots: join(ROOT, "rapports") });
  const failed = results.flatMap((result) => result.steps.filter((step) => !step.ok).map((step) => `${result.run} · ${result.scenario} · ${step.name}`));
  console.log(`\n${failed.length} étape(s) en échec sur ${results.reduce((sum, result) => sum + result.steps.length, 0)}`);
}
