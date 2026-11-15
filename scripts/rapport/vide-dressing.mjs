// Rapport de test du Vide-Dressing, sans Docker : `pnpm test:rapport`.
// Lance un faux Supabase local (données d'exemple), le site en `next dev` branché dessus, fait
// passer Playwright sur ordinateur et téléphone, puis écrit un PDF dans rapports/.
// Aucune donnée ne quitte la machine ; la vraie base n'est jamais touchée.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MOCK_PORT = 54998;
const SITE_PORT = 3200;
const BASE = `http://localhost:${SITE_PORT}`;
const KARIM = "11111111-1111-4111-8111-111111111111";
const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "h");
const OUT = join(ROOT, "rapports");
const SHOTS = join(OUT, `captures-${stamp}`);
mkdirSync(SHOTS, { recursive: true });

const children = [];
function start(command, args, env = {}) {
  // Sous Windows, pnpm passe par le shell : la commande part en une seule chaîne, chemins entre guillemets.
  const windows = process.platform === "win32";
  const line = [command, ...args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))].join(" ");
  const child = windows
    ? spawn(line, { cwd: ROOT, env: { ...process.env, ...env }, shell: true })
    : spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env } });
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
}
process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});

async function waitFor(url, label, timeout = 180_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} ne répond pas sur ${url}`);
}

// --- Les vérifications -------------------------------------------------------------------------

const results = [];
const shots = [];
const check = (group, name, ok, detail = "") => {
  results.push({ group, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "  OK  " : "  ÉCHEC"} ${group} · ${name}${detail ? ` — ${detail}` : ""}`);
};
const shoot = async (page, file, caption) => {
  const path = join(SHOTS, `${file}.png`);
  await page.screenshot({ path });
  shots.push({ path, caption });
};

async function attempt(group, name, run) {
  try {
    await run();
  } catch (error) {
    check(group, name, false, String(error.message ?? error).split("\n")[0].slice(0, 160));
  }
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function journey(browser, group, options) {
  const context = await browser.newContext({ locale: "fr-FR", ...options });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.setDefaultTimeout(15_000);

  await attempt(group, "Accueil", async () => {
    await page.goto(`${BASE}/vide-dressing`, { waitUntil: "networkidle" });
    check(group, "Titre du héros", await page.getByRole("heading", { level: 1, name: /Les dressings/ }).isVisible());
    check(group, "Bandeau défilant", await page.getByRole("region", { name: "Les dernières arrivées" }).isVisible());
    await page.waitForTimeout(2600);
    const doors = page.getByRole("button", { name: "Ouvrir ou fermer le dressing" });
    check(group, "L'armoire s'ouvre", (await doors.getAttribute("aria-expanded")) === "true");
    await shoot(page, `${group}-1-heros`, `${group} — héros et armoire ouverte`);
    await doors.click();
    check(group, "La porte referme l'armoire", (await doors.getAttribute("aria-expanded")) === "false");
    await doors.click();
    check(group, "Dressings du jour en cercles", (await page.locator(".vd-story").count()) >= 2);
    check(group, "Quatre envies", (await page.locator(".vd-mood").count()) === 4);
    const cards = await page.locator(".vd-grid .vd-card").count();
    check(group, "Cartes des pièces", cards > 0, `${cards} cartes`);
    const extra = await overflow(page);
    check(group, "Pas de défilement horizontal", extra <= 0, `${extra} px`);
    await page.locator("#dressings").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await shoot(page, `${group}-2-dressings`, `${group} — dressings du jour et envies`);
    await page.locator("#pieces").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await shoot(page, `${group}-3-grille`, `${group} — toutes les pièces, en grille`);
  });

  await attempt(group, "Portant", async () => {
    await page.getByRole("button", { name: "Portant" }).click();
    await page.waitForTimeout(1500);
    check(group, "Vue portant", (await page.locator(".vd-pieces").getAttribute("data-view")) === "rack");
    await shoot(page, `${group}-4-portant`, `${group} — toutes les pièces, sur le portant`);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector(".vd-pieces")?.getAttribute("data-view") === "rack", null, { timeout: 5000 }).catch(() => {});
    check(group, "Le portant est mémorisé", (await page.locator(".vd-pieces").getAttribute("data-view")) === "rack");
    await page.getByRole("button", { name: "Grille" }).click();
  });

  await attempt(group, "Filtre", async () => {
    await page.getByRole("link", { name: /Neuf avec étiquette/ }).click();
    await page.waitForURL(/etat=new_with_tags/);
    check(group, "« Neuf avec étiquette » filtre les pièces", (await page.locator(".vd-grid .vd-card").count()) > 0);
  });

  await attempt(group, "Lot", async () => {
    await page.goto(`${BASE}/vide-dressing/dressing/${KARIM}`, { waitUntil: "networkidle" });
    check(group, "Page du dressing", await page.getByRole("heading", { level: 1, name: /Le dressing de Karim/ }).isVisible());
    const propose = page.getByRole("button", { name: "Proposer ce lot à Karim" });
    check(group, "Proposer est désactivé à vide", await propose.isDisabled());
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Ajouter Sac à main rouge au lot" }).click();
    await page.getByRole("button", { name: "Ajouter Chaussures en cuir au lot" }).click();
    check(group, "Lot de deux pièces", await page.getByText("2 pièces : propose ton prix pour l'ensemble.").isVisible());
    check(group, "Sous-total 130 DT", (await page.locator(".vd-lot__sums dd").innerText()).includes("130"));
    await page.getByLabel("Ton prix pour le lot (DT)").fill("110");
    check(group, "Économie affichée (20 DT)", await page.getByText(/Tu proposes 20 DT de moins/).isVisible());
    check(group, "Total proposé 110 DT", (await page.locator(".vd-lot__total strong").innerText()).includes("110"));
    await page.waitForTimeout(600);
    await shoot(page, `${group}-5-lot`, `${group} — portant d'un dressing et lot composé`);
    await page.getByRole("button", { name: "Retirer Chaussures en cuir du lot" }).first().click();
    check(group, "Retirer une pièce du lot", await page.getByText("Ajoute une autre pièce pour proposer un prix de lot.").isVisible());
  });

  await attempt(group, "Coup de foudre", async () => {
    await page.goto(`${BASE}/vide-dressing/coup-de-foudre`, { waitUntil: "networkidle" });
    const progress = page.getByText(/^1 \/ \d pièces du jour$/);
    check(group, "Pile des pièces du jour", await progress.isVisible());
    const like = await page.getByRole("button", { name: "Coup de cœur" }).boundingBox();
    const limit = await page.evaluate(() => {
      const bar = document.querySelector(".luxe-tabbar");
      if (!bar || getComputedStyle(bar).display === "none") return innerHeight;
      return Math.min(...[...bar.querySelectorAll("a")].map((link) => link.getBoundingClientRect().top));
    });
    check(group, "Boutons visibles au-dessus de la barre du bas", like.y + like.height <= limit);
    await shoot(page, `${group}-6-coup-de-foudre`, `${group} — mode Coup de foudre`);
    const total = Number((await progress.textContent()).match(/\/ (\d)/)[1]);
    const card = await page.locator(".vd-crush__card").boundingBox();
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) await page.mouse.move(card.x + card.width / 2 - step * 25, card.y + card.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(700);
    check(group, "Glisser passe à la pièce suivante", await page.getByText(new RegExp(`^2 / ${total} pièces du jour$`)).isVisible());
    for (let index = 2; index <= total; index += 1) {
      await page.getByRole("button", { name: "Passer" }).click();
      await page.waitForTimeout(250);
    }
    check(group, "Écran de fin", await page.getByRole("heading", { name: /C'est tout/ }).isVisible());
  });

  check(group, "Aucune erreur dans la console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await context.close();
}

async function extras(browser) {
  await attempt("Arabe", "Page en arabe", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ar-TN" });
    const page = await context.newPage();
    await page.goto(`${BASE}/ar/vide-dressing`, { waitUntil: "networkidle" });
    check("Arabe", "Sens droite à gauche", (await page.evaluate(() => document.documentElement.dir)) === "rtl");
    check("Arabe", "Pas de défilement horizontal", (await overflow(page)) <= 0);
    await page.waitForTimeout(2600);
    await shoot(page, "arabe-heros", "Arabe — héros");
    await context.close();
  });

  await attempt("Accessibilité", "Mouvement réduit", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${BASE}/vide-dressing`, { waitUntil: "networkidle" });
    const animation = await page.locator(".vd-ticker__track").evaluate((element) => getComputedStyle(element).animationName);
    check("Accessibilité", "Mouvement réduit : le bandeau s'arrête", animation === "none", animation);
    await context.close();
  });

  await attempt("Thème sombre", "Thème sombre", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto(`${BASE}/vide-dressing/dressing/${KARIM}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Ajouter Sac à main rouge au lot" }).click();
    await page.waitForTimeout(800);
    await shoot(page, "theme-sombre-dressing", "Thème sombre — page d'un dressing");
    check("Thème sombre", "Page d'un dressing en thème sombre", true);
    await context.close();
  });
}

// --- Le PDF ------------------------------------------------------------------------------------

function escape(text) {
  return String(text).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

async function writePdf(browser, seconds) {
  const passed = results.filter((result) => result.ok).length;
  const groups = [...new Set(results.map((result) => result.group))];
  const image = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  const when = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 16mm 14mm; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #241a17; font-size: 11pt; }
    h1 { font-family: Georgia, serif; font-weight: 400; font-size: 26pt; margin: 0; }
    h1 em { color: #5e2424; }
    h2 { font-family: Georgia, serif; font-weight: 400; font-size: 16pt; margin: 22px 0 8px; border-bottom: 1px solid #e5d9c6; padding-bottom: 4px; }
    .meta { color: #6b5d55; margin: 6px 0 16px; }
    .score { display: inline-block; padding: 10px 16px; border-radius: 12px; font-size: 14pt; font-weight: 600;
      background: ${passed === results.length ? "#e7f2e4; color: #24572a" : "#f7e3e0; color: #7a1f16"}; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    td { padding: 5px 6px; border-bottom: 1px solid #eee4d6; vertical-align: top; }
    td.state { width: 64px; font-weight: 700; }
    .ok { color: #24572a; } .ko { color: #9b2116; }
    .detail { color: #6b5d55; }
    figure { margin: 0 0 18px; page-break-inside: avoid; }
    figure img { width: 100%; border: 1px solid #e5d9c6; border-radius: 8px; }
    figure.phone img { width: auto; max-width: 48%; max-height: 190mm; }
    figcaption { font-size: 9.5pt; color: #6b5d55; margin-top: 4px; }
    .note { font-size: 9.5pt; color: #6b5d55; }
  </style></head><body>
    <h1>Rapport de test — <em>Vide-Dressing</em></h1>
    <p class="meta">${escape(when)} · durée ${seconds} s · Playwright (Chromium) · ordinateur 1440×900 et Pixel 7</p>
    <p class="score">${passed} / ${results.length} vérifications réussies</p>
    <p class="note">Le site tourne en local sur un faux Supabase (données d'exemple : 12 pièces, 4 dressings). La connexion,
      l'envoi réel d'un lot et l'enregistrement des favoris ne sont pas couverts ici : ils demandent la base de test
      (<code>pnpm test:e2e -- vide-dressing</code>).</p>
    ${groups
      .map(
        (group) => `<h2>${escape(group)}</h2><table>${results
          .filter((result) => result.group === group)
          .map(
            (result) => `<tr><td class="state ${result.ok ? "ok" : "ko"}">${result.ok ? "OK" : "ÉCHEC"}</td><td>${escape(result.name)}${
              result.detail ? ` <span class="detail">— ${escape(result.detail)}</span>` : ""
            }</td></tr>`,
          )
          .join("")}</table>`,
      )
      .join("")}
    <h2 style="page-break-before: always">Captures</h2>
    ${shots
      .map((shot) => `<figure class="${shot.caption.startsWith("Téléphone") ? "phone" : ""}"><img src="${image(shot.path)}"><figcaption>${escape(shot.caption)}</figcaption></figure>`)
      .join("")}
  </body></html>`;

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const file = join(OUT, `rapport-vide-dressing-${stamp}.pdf`);
  await page.pdf({ path: file, format: "A4", printBackground: true });
  await page.close();
  return { file, passed };
}

// --- Le déroulé --------------------------------------------------------------------------------

const began = Date.now();
let code = 0;
try {
  console.log("1/4  Faux Supabase local…");
  start("node", [join(ROOT, "scripts/rapport/faux-supabase.mjs")], { MOCK_PORT: String(MOCK_PORT) });
  await waitFor(`http://localhost:${MOCK_PORT}/rest/v1/categories`, "Le faux Supabase", 20_000);

  console.log(`2/4  Site en mode dev sur ${BASE} (la première compilation prend une minute)…`);
  const site = start("pnpm", ["exec", "next", "dev", "-p", String(SITE_PORT)], {
    NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
    NEXT_PUBLIC_SITE_URL: BASE,
  });
  site.stderr.on("data", (chunk) => process.env.RAPPORT_DEBUG && process.stderr.write(chunk));
  await waitFor(`${BASE}/vide-dressing`, "Le site");

  console.log("3/4  Tests Playwright…");
  const browser = await chromium.launch();
  await journey(browser, "Ordinateur", { viewport: { width: 1440, height: 900 } });
  await journey(browser, "Téléphone", { ...devices["Pixel 7"] });
  await extras(browser);

  console.log("4/4  PDF…");
  const { file, passed } = await writePdf(browser, Math.round((Date.now() - began) / 1000));
  await browser.close();
  console.log(`\n${passed}/${results.length} vérifications réussies.\nRapport : ${file}`);
  if (passed !== results.length) code = 1;
} catch (error) {
  console.error(`\nLe rapport n'a pas pu être produit : ${error.message}`);
  code = 1;
} finally {
  stopAll();
}
process.exit(code);
