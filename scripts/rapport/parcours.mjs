// Parcourt toutes les pages (pages.mjs) dans plusieurs configurations et rassemble les problèmes.
// Utilisé par app.mjs (qui démarre les serveurs et écrit le PDF), ou seul contre un site déjà lancé :
//   node scripts/rapport/parcours.mjs http://localhost:3300 http://localhost:54997 [filtre]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import { inspectPage } from "./inspection.mjs";
import { PAGES } from "./pages.mjs";

export const CONFIGS = [
  { key: "ar-desktop-clair", label: "Arabe · ordinateur · clair", locale: "ar", theme: "light", context: { viewport: { width: 1440, height: 900 } } },
  { key: "ar-mobile-sombre", label: "Arabe · téléphone · sombre", locale: "ar", theme: "dark", context: { ...devices["Pixel 7"] } },
  { key: "fr-tablette-sombre", label: "Français · tablette · sombre", locale: "fr", theme: "dark", context: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
  { key: "fr-mobile-clair", label: "Français · téléphone · clair", locale: "fr", theme: "light", context: { ...devices["iPhone 13"] } },
];

async function sessionCookie(mockBase) {
  const { makeSession } = await import("./faux-supabase-complet.mjs");
  const host = new URL(mockBase).hostname.split(".")[0];
  return { name: `sb-${host}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(makeSession())).toString("base64url")}` };
}

// Ouvre les fenêtres et menus d'une page (filtres, dialogues, listes) et les inspecte aussi.
async function openPopups(page, inspect) {
  const found = [];
  const triggers = page.locator("main button[aria-haspopup], main button[aria-expanded='false'], main [data-slot='dialog-trigger'], main [data-slot='sheet-trigger']");
  const total = Math.min(await triggers.count(), 3);
  for (let index = 0; index < total; index += 1) {
    const trigger = triggers.nth(index);
    if (!(await trigger.isVisible().catch(() => false))) continue;
    try {
      await trigger.click({ timeout: 3000 });
      await page.waitForTimeout(400);
      const result = await page.evaluate(inspect, {});
      found.push(...result.contrast.map((entry) => ({ ...entry, what: `[ouvert] ${entry.what}` })));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    } catch {
      // Un bouton qui navigue ou disparaît : on passe.
    }
  }
  return found;
}

export async function crawl({ site, mock, filter, shots, revive, log = console.log }) {
  const browser = await chromium.launch();
  const cookie = await sessionCookie(mock);
  const issues = [];
  const pages = PAGES.filter((entry) => !filter || entry.path.includes(filter) || entry.name.toLowerCase().includes(filter.toLowerCase()));
  if (shots) mkdirSync(shots, { recursive: true });

  for (const config of CONFIGS) {
    log(`\n== ${config.label} (${pages.length} pages)`);
    const context = await browser.newContext({ ...config.context, colorScheme: config.theme, locale: config.locale === "ar" ? "ar-TN" : "fr-FR" });
    // Les robots de test ne doivent pas compter dans les statistiques réelles.
    await context.route(/contentsquare\.(net|com)/, (route) => route.abort());
    await context.addInitScript((theme) => {
      try {
        localStorage.setItem("theme", theme);
      } catch {}
    }, config.theme);

    for (const entry of pages) {
      const cookies = entry.auth ? [{ ...cookie, url: site }] : [];
      await context.clearCookies();
      // Le cookie « déjà vu » de la page Découvrir : sans lui, « / » y redirige (src/features/landing/intro.ts).
      await context.addCookies([...cookies, { name: "fripe_decouvert", value: "1", url: site }]);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message.split("\n")[0]));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (/realtime|websocket|Failed to load resource|favicon|serwist|hydrat.*extension|Download the React DevTools/i.test(text)) return;
        errors.push(text.split("\n")[0].slice(0, 200));
      });
      const url = `${site}${config.locale === "ar" ? "/ar" : ""}${entry.path === "/" && config.locale === "ar" ? "" : entry.path}`;
      let status = 0;
      try {
        // Si le serveur dev se bloque (mémoire de Turbopack après des centaines de pages), on le relance
        // une fois puis on recharge la page : un blocage du banc de test ne doit pas passer pour un bug.
        const open = () => page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
        const response = await open().catch(async (error) => {
          if (!revive || !/Timeout/.test(error.message)) throw error;
          log(`  … ${entry.name} ne répond pas : relance du serveur dev`);
          await revive();
          return open();
        });
        status = response?.status() ?? 0;
        await page.waitForTimeout(600);
        const result = await page.evaluate(inspectPage, { arabic: config.locale === "ar" });
        const popups = config.theme === "dark" ? await openPopups(page, inspectPage) : [];
        const finalUrl = page.url().replace(site, "");
        const record = (kind, detail) => issues.push({ config: config.key, label: config.label, page: entry.name, path: entry.path, url: finalUrl, kind, detail });

        if (status >= 500) record("erreur", `HTTP ${status}`);
        if (config.locale === "ar" && result.dir !== "rtl") record("rtl", `dir="${result.dir}"`);
        // Données d'exemple : clés fabriquées (« نص تجريبي »), facteur MFA « app », et l'admin des lieux
        // qui montre volontairement le nom français à côté du nom arabe.
        const artefact = (text) => /نص تجريبي|^app$/.test(text) || (entry.path === "/admin/lieux" && /NomFR/.test(text));
        for (const item of result.latin.filter((item) => !artefact(item.text))) record("traduction", `${item.text} — ${item.where}`);
        if (result.overflow > 1) record("débordement", `${result.overflow} px · ${result.culprits.join(", ")}`);
        for (const item of [...result.contrast, ...popups]) record("contraste", `${item.what} — ${item.ratio}:1`);
        // Messages manquants pour des valeurs inventées par le faux Supabase (statuts, motifs) : artefacts.
        for (const error of [...new Set(errors)].filter((text) => !/نص تجريبي/.test(text))) record("console", error);
        if (shots) await page.screenshot({ path: join(shots, `${config.key}--${entry.path.replace(/[^a-z0-9]+/gi, "_") || "accueil"}.png`) });
        const count = issues.filter((issue) => issue.config === config.key && issue.path === entry.path).length;
        log(`${count ? "  ✗" : "  ✓"} ${entry.name.padEnd(30)} ${status} ${finalUrl}${count ? ` — ${count} problème(s)` : ""}`);
      } catch (error) {
        issues.push({ config: config.key, label: config.label, page: entry.name, path: entry.path, url, kind: "erreur", detail: error.message.split("\n")[0] });
        log(`  ✗ ${entry.name.padEnd(30)} ${error.message.split("\n")[0]}`);
      }
      await page.close();
    }
    await context.close();
  }
  await browser.close();
  return { issues, pages: pages.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [site = "http://localhost:3300", mock = "http://localhost:54997", filter] = process.argv.slice(2);
  const out = fileURLToPath(new URL("../../rapports/", import.meta.url));
  const { issues } = await crawl({ site, mock, filter, shots: join(out, "parcours") });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "parcours.json"), JSON.stringify(issues, null, 2));
  const byKind = Object.groupBy(issues, (issue) => issue.kind);
  console.log(`\n${issues.length} problème(s) : ${Object.entries(byKind).map(([kind, list]) => `${kind} ${list.length}`).join(", ")}`);
}
